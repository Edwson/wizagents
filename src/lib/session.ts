import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET is required in production. Set a long random value.");
}
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "wizagents-dev-secret-change-in-prod"
);
const COOKIE = "as_session";
// Cookies carry the session, the 2FA challenge and the money step-up proof.
// In production they must never travel over plaintext HTTP.
const PROD = process.env.NODE_ENV === "production";
const COOKIE_BASE = { httpOnly: true as const, sameSite: "lax" as const, path: "/", secure: PROD };

export type SessionPayload = { uid: string; role: string; email: string; name: string; sv?: number };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const jar = await cookies();
  jar.set(COOKIE, token, { ...COOKIE_BASE, maxAge: 60 * 60 * 24 * 30 });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

const PRE = "as_pre2fa";
export async function createPreSession(uid: string) {
  const token = await new SignJWT({ uid, pre: true })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(secret);
  const jar = await cookies();
  jar.set(PRE, token, { ...COOKIE_BASE, maxAge: 300 });
}
export async function readPreSession(): Promise<{ uid: string } | null> {
  const jar = await cookies();
  const token = jar.get(PRE)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret); return payload.pre ? { uid: payload.uid as string } : null; }
  catch { return null; }
}
export async function destroyPreSession() { (await cookies()).delete(PRE); }


const STEP = "as_stepup";
/** Issue a short-lived (5 min) proof that the user re-verified (2FA/passkey) for a money action. */
export async function setStepUp(uid: string) {
  const token = await new SignJWT({ uid, step: true })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(secret);
  const jar = await cookies();
  jar.set(STEP, token, { ...COOKIE_BASE, maxAge: 300 });
}
export async function readStepUp(): Promise<{ uid: string } | null> {
  const jar = await cookies();
  const token = jar.get(STEP)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret); return payload.step ? { uid: payload.uid as string } : null; }
  catch { return null; }
}
export async function clearStepUp() { (await cookies()).delete(STEP); }
