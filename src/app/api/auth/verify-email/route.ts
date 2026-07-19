import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson, badRequest } from "@/lib/req";

export async function POST(req: Request) {
  const body = await readJson(req); if (!body) return badRequest();
  const token = String(body.token || "");
  const et = await db.emailToken.findUnique({ where: { token } });
  if (!et || et.type !== "verify" || et.usedAt || et.expiresAt < new Date())
    return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
  await db.$transaction([
    db.user.update({ where: { id: et.userId }, data: { emailVerified: true } }),
    db.emailToken.update({ where: { id: et.id }, data: { usedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
}
