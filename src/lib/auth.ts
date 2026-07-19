import bcrypt from "bcryptjs";
import { db } from "./db";
import { readSession } from "./session";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/**
 * The current user WITHOUT secrets.
 *
 * Defense in depth: this value is read by every page, and a page that passes it into a
 * client component would serialize it into the browser payload. So the password hash,
 * the TOTP secret and the in-flight WebAuthn challenge are stripped here and can never
 * ride along by accident. Code that genuinely needs them must ask explicitly.
 */
export async function getCurrentUser() {
  const sess = await readSession();
  if (!sess) return null;
  const user = await db.user.findUnique({
    where: { id: sess.uid },
    include: { creatorProfile: true, pass: true },
  });
  if (!user) return null;
  // Session revocation: a password change, a 2FA disable, or "sign out everywhere"
  // bumps sessionVersion — every JWT issued before that instant stops working.
  if (user.deletedAt) return null;
  if ((sess.sv ?? 0) !== (user.sessionVersion ?? 0)) return null;
  const { passwordHash: _p, twoFactorSecret: _t, currentChallenge: _c, ...safe } = user as any;
  return safe as Omit<typeof user, "passwordHash" | "twoFactorSecret" | "currentChallenge">;
}

/** The full row, secrets included. Only for code that must verify a secret server-side. */
export async function getCurrentUserWithSecrets() {
  const sess = await readSession();
  if (!sess) return null;
  const u = await db.user.findUnique({ where: { id: sess.uid }, include: { creatorProfile: true, pass: true } });
  if (!u) return null;
  if (u.deletedAt) return null;
  if ((sess.sv ?? 0) !== (u.sessionVersion ?? 0)) return null;
  return u;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function randomToken(prefix = "sk_live_") {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return prefix + s;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
