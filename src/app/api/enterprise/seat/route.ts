import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { orgContext, budgetCheck, SEAT_PRICE } from "@/lib/org";
import { randomTokenHex } from "@/lib/security";
import { sendMail, mailerConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// List the org's seats (admins only).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const org = await orgContext(user as any);
  if (!org) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });
  const seats = await db.enterpriseSeat.findMany({ where: { orgOwnerId: org.orgOwnerId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ok: true, seats: seats.map((s) => ({
    id: s.id, memberEmail: s.memberEmail, memberName: s.memberName, role: s.role, status: s.status,
    invitedAt: s.invitedAt, acceptedAt: s.acceptedAt, linked: !!s.memberUserId,
  })) });
}

/** Invite someone to a seat. They must ACCEPT — we never enrol a person silently. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const org = await orgContext(user as any);
  if (!org?.isAdmin) return NextResponse.json({ error: "Only an organization admin can invite seats" }, { status: 403 });

  const b = await readJson(req); if (!b) return badRequest();
  const email = String(b.email || "").trim().toLowerCase();
  if (!email.includes("@")) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const role = b.role === "admin" ? "admin" : "member";

  const existing = await db.enterpriseSeat.findFirst({ where: { orgOwnerId: org.orgOwnerId, memberEmail: email } });
  if (existing && existing.status !== "declined") {
    return NextResponse.json({ error: "That person already has a seat or a pending invitation.", code: "exists" }, { status: 409 });
  }

  // A seat costs money — respect the budget cap.
  const budget = await budgetCheck(org.orgOwnerId, SEAT_PRICE);
  if (!budget.ok) {
    return NextResponse.json({ error: `Adding this seat would put you $${budget.over}/mo over your budget cap of $${budget.cap}.`, code: "over_budget", budget }, { status: 409 });
  }

  const inviteToken = randomTokenHex(24);
  const seat = await db.enterpriseSeat.create({
    data: { orgOwnerId: org.orgOwnerId, memberEmail: email, memberName: String(b.name || ""), role, status: "invited", inviteToken },
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const link = `${origin}/invite/${inviteToken}`;
  const orgName = (user as any).orgName || user.name;
  await sendMail(email, `${orgName} invited you to WizAgents`,
    `${orgName} has offered you a seat on their WizAgents organization.\n\nAccept (or decline) here:\n${link}\n\nIf you accept, your use of the org's Agents will be visible in their audit log. If you don't recognise this, simply decline.`);

  return NextResponse.json({ ok: true, id: seat.id, inviteLink: link, emailSent: mailerConfigured(), nearLimit: (budget as any).nearLimit || false });
}
