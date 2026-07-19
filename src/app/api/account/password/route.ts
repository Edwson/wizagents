import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserWithSecrets, hashPassword, verifyPassword } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { createSession } from "@/lib/session";
import { passwordIssues, rateLimit, clientIp } from "@/lib/security";
import { seclog } from "@/lib/seclog";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Change password. Requires the CURRENT password (so a hijacked, unlocked session
 * cannot silently take the account), then bumps sessionVersion — which signs out
 * every other device instantly, including an attacker's.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserWithSecrets();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const rl = rateLimit(`pwchange:${user.id}:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, { status: 429 });

  const b = await readJson(req); if (!b) return badRequest();
  const current = String(b.currentPassword || "");
  const next = String(b.newPassword || "");

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) {
    await seclog(user.id, "login_failed", "Wrong current password on password change", req);
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
  }
  const issues = passwordIssues(next);
  if (issues.length) return NextResponse.json({ error: issues[0], issues }, { status: 400 });
  if (await verifyPassword(next, user.passwordHash)) {
    return NextResponse.json({ error: "Choose a password you haven't used here before." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
  // keep THIS device signed in, on the new version
  await createSession({ uid: updated.id, role: updated.role, email: updated.email, name: updated.name, sv: updated.sessionVersion });
  await seclog(user.id, "password_changed", "Password changed — all other sessions signed out", req);
  await notify(user.id, "welcome", "Your password was changed", "If this wasn't you, reset your password immediately and review your security activity.", "/settings");
  return NextResponse.json({ ok: true, otherSessionsRevoked: true });
}
