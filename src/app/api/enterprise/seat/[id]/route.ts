import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { orgContext } from "@/lib/org";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const ctx = await orgContext(user);
  if (!ctx || !ctx.isAdmin) return NextResponse.json({ error: "Only an organization admin can manage seats." }, { status: 403 });

  const seat = await db.enterpriseSeat.findUnique({ where: { id } });
  if (!seat || seat.orgOwnerId !== ctx.orgOwnerId) return NextResponse.json({ error: "Seat not found." }, { status: 404 });

  const { action, role, dailyLimit } = await req.json();

  // The owner's own seat can never be demoted or removed — an org must always have one accountable admin.
  if (seat.memberUserId === ctx.orgOwnerId && (action === "remove" || action === "suspend" || action === "role")) {
    return NextResponse.json({ error: "The organization owner's seat cannot be changed." }, { status: 400 });
  }
  // Only the owner may create or remove other admins.
  if (action === "role" && !ctx.isOwner) {
    return NextResponse.json({ error: "Only the organization owner can change roles." }, { status: 403 });
  }

  if (action === "remove") {
    // Revoking a seat must also kill every key it issued, or the person keeps access after being removed.
    await db.seatToken.updateMany({ where: { seatId: id }, data: { revoked: true } });
    await db.enterpriseSeat.delete({ where: { id } });
    return NextResponse.json({ ok: true, removed: true });
  }
  if (action === "role") {
    const r = role === "admin" ? "admin" : "member";
    await db.enterpriseSeat.update({ where: { id }, data: { role: r } });
    return NextResponse.json({ ok: true, role: r });
  }
  if (action === "limit") {
    const n = Math.max(0, Math.min(10000, Number(dailyLimit) || 0));
    await db.enterpriseSeat.update({ where: { id }, data: { dailyLimit: n } });
    return NextResponse.json({ ok: true, dailyLimit: n });
  }
  if (action === "suspend") {
    await db.seatToken.updateMany({ where: { seatId: id }, data: { revoked: true } });
    await db.enterpriseSeat.update({ where: { id }, data: { status: "suspended" } });
    return NextResponse.json({ ok: true, status: "suspended" });
  }
  if (action === "activate") {
    if (seat.status === "invited") return NextResponse.json({ error: "This person has not accepted the invite yet." }, { status: 400 });
    await db.enterpriseSeat.update({ where: { id }, data: { status: "active" } });
    return NextResponse.json({ ok: true, status: "active" });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
