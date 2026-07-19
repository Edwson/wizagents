import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserWithSecrets } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { verifyToken } from "@/lib/totp";
import { generateBackupCodes } from "@/lib/security";

export async function POST(req: Request) {
  const user = await getCurrentUserWithSecrets();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();
  if (!user.twoFactorSecret) return NextResponse.json({ error: "Start setup first" }, { status: 400 });
  if (!verifyToken(body.token, user.twoFactorSecret)) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  await db.backupCode.deleteMany({ where: { userId: user.id } });
  const codes = generateBackupCodes(10);
  await db.backupCode.createMany({ data: codes.map((c) => ({ userId: user.id, codeHash: c.hash })) });
  return NextResponse.json({ ok: true, backupCodes: codes.map((c) => c.code) });
}
