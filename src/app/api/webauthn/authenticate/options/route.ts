import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateAuthenticationOptions, rpID } from "@/lib/webauthn";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const creds = await db.webAuthnCredential.findMany({ where: { userId: user.id } });
  if (!creds.length) return NextResponse.json({ error: "No passkey enrolled", code: "no_passkey" }, { status: 400 });
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: (c.transports ? c.transports.split(",") : undefined) as any })),
    userVerification: "preferred",
  });
  await db.user.update({ where: { id: user.id }, data: { currentChallenge: options.challenge } });
  return NextResponse.json(options);
}
