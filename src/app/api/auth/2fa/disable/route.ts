import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserWithSecrets } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { verifyToken } from "@/lib/totp";

export async function POST(req: Request) {
  const user = await getCurrentUserWithSecrets();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();
  if (!user.twoFactorEnabled || !user.twoFactorSecret) return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
  if (!verifyToken(body.token, user.twoFactorSecret)) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  await db.backupCode.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
