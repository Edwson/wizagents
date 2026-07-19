import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson } from "@/lib/req";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const creds = await db.webAuthnCredential.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ok: true, credentials: creds.map((c) => ({ id: c.id, deviceName: c.deviceName, createdAt: c.createdAt, lastUsedAt: c.lastUsedAt })) });
}
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req);
  if (body?.id) await db.webAuthnCredential.deleteMany({ where: { id: body.id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
