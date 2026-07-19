import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { verifyAuthenticationResponse, rpID, origin } from "@/lib/webauthn";
import { setStepUp } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.currentChallenge) return NextResponse.json({ error: "No challenge in progress" }, { status: 400 });

  const resp = body.authResp;
  const cred = await db.webAuthnCredential.findUnique({ where: { credentialId: resp?.id } });
  if (!cred || cred.userId !== user.id) return NextResponse.json({ error: "Unknown passkey" }, { status: 400 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: resp,
      expectedChallenge: dbUser.currentChallenge,
      expectedOrigin: origin(),
      expectedRPID: rpID(),
      credential: { id: cred.credentialId, publicKey: new Uint8Array(Buffer.from(cred.publicKey, "base64url")), counter: cred.counter, transports: (cred.transports ? cred.transports.split(",") : undefined) as any },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Verification failed" }, { status: 400 });
  }
  if (!verification.verified) return NextResponse.json({ error: "Biometric verification failed" }, { status: 400 });

  await db.webAuthnCredential.update({ where: { id: cred.id }, data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() } });
  await db.user.update({ where: { id: user.id }, data: { currentChallenge: null } });
  await setStepUp(user.id); // biometric satisfies the money step-up
  return NextResponse.json({ ok: true });
}
