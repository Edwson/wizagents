import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { verifyRegistrationResponse, rpID, origin } from "@/lib/webauthn";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.currentChallenge) return NextResponse.json({ error: "No challenge in progress" }, { status: 400 });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.attResp,
      expectedChallenge: dbUser.currentChallenge,
      expectedOrigin: origin(),
      expectedRPID: rpID(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Verification failed" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) return NextResponse.json({ error: "Could not verify passkey" }, { status: 400 });

  const { credential } = verification.registrationInfo;
  await db.webAuthnCredential.create({
    data: {
      userId: user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      deviceName: body.deviceName || "Passkey",
      transports: (credential.transports || []).join(","),
    },
  });
  await db.user.update({ where: { id: user.id }, data: { currentChallenge: null } });
  return NextResponse.json({ ok: true });
}
