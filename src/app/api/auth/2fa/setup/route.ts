import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateSecret, keyUri, qrDataUrl } from "@/lib/totp";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  if (user.twoFactorEnabled) return NextResponse.json({ error: "2FA already enabled" }, { status: 409 });
  const secret = generateSecret();
  await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } }); // staged, not yet enabled
  const qr = await qrDataUrl(keyUri(user.email, secret));
  return NextResponse.json({ ok: true, secret, qr });
}
