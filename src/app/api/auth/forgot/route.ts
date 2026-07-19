import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson, badRequest } from "@/lib/req";
import { rateLimit, clientIp, randomTokenHex } from "@/lib/security";
import { sendMail, mailerConfigured } from "@/lib/mailer";
import { seclog } from "@/lib/seclog";

export const dynamic = "force-dynamic";

/**
 * Request a password reset.
 * The response is ALWAYS the same whether or not the address exists — otherwise this
 * endpoint becomes an account-enumeration oracle for an attacker.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfter}s.` }, { status: 429 });
  const b = await readJson(req); if (!b) return badRequest();
  const email = String(b.email || "").trim().toLowerCase();

  const generic = { ok: true, message: "If that address has an account, a reset link is on its way." };
  if (!email.includes("@")) return NextResponse.json(generic);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json(generic);           // same response, same shape

  const token = randomTokenHex(32);
  await db.emailToken.create({
    data: { userId: user.id, token, type: "reset", expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const link = `${origin}/reset?token=${token}`;
  await sendMail(email, "Reset your WizAgents password",
    `Someone asked to reset the password for your WizAgents account.\n\nReset it here (valid for 1 hour):\n${link}\n\nIf this wasn't you, ignore this message — your password has not changed.`);
  await seclog(user.id, "login_failed", "Password reset requested", req);

  return NextResponse.json({ ...generic, deliveryConfigured: mailerConfigured() });
}
