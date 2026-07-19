import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readPreSession, createSession, destroyPreSession } from "@/lib/session";
import { readJson, badRequest } from "@/lib/req";
import { verifyToken } from "@/lib/totp";
import { rateLimit, clientIp, sha256 } from "@/lib/security";

export async function POST(req: Request) {
  const pre = await readPreSession();
  if (!pre) return NextResponse.json({ error: "2FA session expired, sign in again" }, { status: 401 });
  const rl = rateLimit(`2fa:${pre.uid}:${clientIp(req)}`, 10, 5 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, { status: 429 });

  const body = await readJson(req); if (!body) return badRequest();
  const user = await db.user.findUnique({ where: { id: pre.uid } });
  if (!user || !user.twoFactorSecret) return NextResponse.json({ error: "Invalid state" }, { status: 400 });

  const code = String(body.token || "").trim();
  let ok = verifyToken(code, user.twoFactorSecret);
  if (!ok && code) {
    // try a one-time backup code
    const bc = await db.backupCode.findFirst({ where: { userId: user.id, used: false, codeHash: sha256(code.toUpperCase()) } });
    if (bc) { await db.backupCode.update({ where: { id: bc.id }, data: { used: true } }); ok = true; }
  }
  if (!ok) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  await createSession({ uid: user.id, role: user.role, email: user.email, name: user.name, sv: user.sessionVersion });
  await destroyPreSession();
  return NextResponse.json({ ok: true, role: user.role });
}
