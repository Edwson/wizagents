import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { passwordIssues, rateLimit, clientIp } from "@/lib/security";
import { seclog } from "@/lib/seclog";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Consume a reset token: set the new password and sign out every existing session. */
export async function POST(req: Request) {
  const rl = rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, { status: 429 });
  const b = await readJson(req); if (!b) return badRequest();

  const token = String(b.token || "");
  const next = String(b.newPassword || "");
  const issues = passwordIssues(next);
  if (issues.length) return NextResponse.json({ error: issues[0], issues }, { status: 400 });

  const row = await db.emailToken.findUnique({ where: { token } });
  if (!row || row.type !== "reset" || row.usedAt || row.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: row.userId },
      // sessionVersion bump = every device (including the attacker's) is signed out
      data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null },
    });
    await tx.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  });

  await seclog(row.userId, "password_changed", "Password reset via email link — all sessions signed out", req);
  await notify(row.userId, "welcome", "Your password was reset", "All devices were signed out. If this wasn't you, contact support immediately.", "/settings");
  return NextResponse.json({ ok: true });
}
