import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession, createPreSession } from "@/lib/session";
import { linkSeatsForUser } from "@/lib/entitlement";
import { seclog } from "@/lib/seclog";
import { readJson, badRequest } from "@/lib/req";
import { rateLimit, clientIp } from "@/lib/security";

const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const body = await readJson(req);
  if (!body) return badRequest();
  const { email, password } = body;
  if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

  // Rate limit per IP and per email to blunt brute force / credential stuffing.
  const rlIp = rateLimit(`login:ip:${ip}`, 15, 5 * 60 * 1000);
  const rlEmail = rateLimit(`login:email:${String(email).toLowerCase()}`, 8, 5 * 60 * 1000);
  if (!rlIp.ok || !rlEmail.ok) {
    const retry = Math.max(rlIp.retryAfter, rlEmail.retryAfter);
    return NextResponse.json({ error: `Too many attempts. Try again in ${retry}s.` }, { status: 429, headers: { "Retry-After": String(retry) } });
  }

  const user = await db.user.findUnique({ where: { email: String(email).toLowerCase() } });
  const generic = NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  if (!user) return generic;
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json({ error: `Account temporarily locked. Try again in ${mins} min.` }, { status: 423 });
  }

  if (user.deletedAt) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    const data: any = { failedLogins: failed };
    if (failed >= LOCK_THRESHOLD) { data.lockedUntil = new Date(Date.now() + LOCK_MS); data.failedLogins = 0; }
    await db.user.update({ where: { id: user.id }, data });
    return generic;
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

  if (user.twoFactorEnabled) {
    await createPreSession(user.id);
    return NextResponse.json({ ok: true, twoFactorRequired: true });
  }
  await linkSeatsForUser(user.id, user.email);
  await seclog(user.id, "login", "Signed in", req);
  await createSession({ uid: user.id, role: user.role, email: user.email, name: user.name, sv: user.sessionVersion });
  return NextResponse.json({ ok: true, role: user.role });
}
