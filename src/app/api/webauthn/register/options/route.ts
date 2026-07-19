import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateRegistrationOptions, rpID, RP_NAME } from "@/lib/webauthn";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const creds = await db.webAuthnCredential.findMany({ where: { userId: user.id } });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME, rpID: rpID(),
    userID: new TextEncoder().encode(user.id),
    userName: user.email, userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: creds.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred", authenticatorAttachment: "platform" },
  });
  await db.user.update({ where: { id: user.id }, data: { currentChallenge: options.challenge } });
  return NextResponse.json(options);
}
