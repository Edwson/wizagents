import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";

export const dynamic = "force-dynamic";

// What am I being invited to? (public-ish: needs the token, shows only the org name)
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const seat = await db.enterpriseSeat.findUnique({ where: { inviteToken: token }, include: { orgOwner: { select: { name: true, orgName: true } } } });
  if (!seat || seat.status !== "invited") return NextResponse.json({ error: "This invitation is not valid.", code: "invalid" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    invite: {
      org: seat.orgOwner.orgName || seat.orgOwner.name,
      email: seat.memberEmail,
      role: seat.role,
      invitedAt: seat.invitedAt,
      notice: "If you accept, the organization pays for your access — and your use of their Agents appears in their audit log. If you don't recognise this organization, decline.",
    },
  });
}

/** Accept or decline. Only the invited person can act, and only for their own address. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to respond to this invitation", code: "need_login" }, { status: 401 });
  const b = await readJson(req); if (!b) return badRequest();
  const token = String(b.token || "");
  const action = b.action === "decline" ? "decline" : "accept";

  const seat = await db.enterpriseSeat.findUnique({ where: { inviteToken: token } });
  if (!seat || seat.status !== "invited") return NextResponse.json({ error: "This invitation is not valid." }, { status: 404 });
  if (seat.memberEmail.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "This invitation was sent to a different email address." }, { status: 403 });
  }

  if (action === "decline") {
    await db.enterpriseSeat.update({ where: { id: seat.id }, data: { status: "declined", inviteToken: null } });
    return NextResponse.json({ ok: true, status: "declined" });
  }
  await db.enterpriseSeat.update({
    where: { id: seat.id },
    data: { status: "active", memberUserId: user.id, acceptedAt: new Date(), inviteToken: null },
  });
  return NextResponse.json({ ok: true, status: "active" });
}
