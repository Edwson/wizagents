import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { linkSeatsForUser } from "@/lib/entitlement";
import { catLabel } from "@/lib/categories";
import { readJson, badRequest } from "@/lib/req";
import { rateLimit, clientIp, passwordIssues, randomTokenHex } from "@/lib/security";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const rl = rateLimit(`register:ip:${clientIp(req)}`, 6, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, { status: 429 });

  const body = await readJson(req); if (!body) return badRequest();
  const { email, password, name, role, vertical } = body;
  if (!email || !password || !name) return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  if (!EMAIL_RE.test(String(email))) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const issues = passwordIssues(password);
  if (issues.length) return NextResponse.json({ error: "Weak password", code: "weak_password", issues }, { status: 400 });

  const lower = String(email).toLowerCase();
  if (await db.user.findUnique({ where: { email: lower } })) return NextResponse.json({ error: "This email is already registered" }, { status: 409 });

  const r = ["buyer", "creator", "enterprise"].includes(role) ? role : "buyer";
  const user = await db.user.create({
    data: {
      email: lower, passwordHash: await hashPassword(password), name, role: r, emailVerified: false, authProvider: "credentials",
      ...(r === "creator" ? { creatorProfile: { create: { displayName: name, verticalLabel: vertical ? catLabel(vertical) : "", verificationStatus: "none" } } } : {}),
    },
  });

  // Email verification token (in production, email this link; in dev we return it).
  const token = randomTokenHex(24);
  await db.emailToken.create({ data: { userId: user.id, token, type: "verify", expiresAt: new Date(Date.now() + 24 * 3600 * 1000) } });
  const verifyPath = `/verify-email?token=${token}`;

  await linkSeatsForUser(user.id, user.email);

  await createSession({ uid: user.id, role: user.role, email: user.email, name: user.name, sv: user.sessionVersion });
  const devLink = process.env.NODE_ENV !== "production" ? verifyPath : undefined;
  return NextResponse.json({ ok: true, role: user.role, needsEmailVerification: true, verifyPath: devLink });
}
