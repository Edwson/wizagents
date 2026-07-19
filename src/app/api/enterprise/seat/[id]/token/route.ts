import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson } from "@/lib/req";
import { orgContext, issueSeatToken } from "@/lib/org";

export const dynamic = "force-dynamic";

/** A seat's own keys. Visible to the seat holder, and to an org admin. */
async function authorize(userId: string, userEmail: string, userRole: string, seatId: string) {
  const seat = await db.enterpriseSeat.findUnique({ where: { id: seatId } });
  if (!seat) return null;
  const isHolder = seat.memberUserId === userId || seat.memberEmail.toLowerCase() === userEmail.toLowerCase();
  const org = await orgContext({ id: userId, email: userEmail, role: userRole } as any);
  const isAdmin = !!org?.isAdmin && org.orgOwnerId === seat.orgOwnerId;
  return isHolder || isAdmin ? { seat, isAdmin } : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const a = await authorize(user.id, user.email, user.role, id);
  if (!a) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const tokens = await db.seatToken.findMany({ where: { seatId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ok: true, tokens: tokens.map((t) => ({ id: t.id, label: t.label, revoked: t.revoked, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, preview: t.token.slice(0, 12) + "…" })) });
}

/** Issue a key. Returned ONCE — we show it now and never again. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const a = await authorize(user.id, user.email, user.role, id);
  if (!a) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (a.seat.status !== "active") return NextResponse.json({ error: "The seat must be active." }, { status: 409 });
  const b = await readJson(req);
  const t = await issueSeatToken(id, String(b?.label || "").slice(0, 40));
  return NextResponse.json({ ok: true, token: t.token, id: t.id, note: "Copy it now — it is not shown again." });
}

/** Revoke ONE person's key without touching anyone else's. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const a = await authorize(user.id, user.email, user.role, id);
  if (!a) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await readJson(req).catch(() => null);
  const q = new URL(req.url).searchParams;
  const tokenId = String(b?.tokenId || b?.id || q.get("tokenId") || q.get("id") || "");
  if (!tokenId) return NextResponse.json({ error: "Which key?" }, { status: 400 });
  const r = await db.seatToken.updateMany({ where: { id: tokenId, seatId: id }, data: { revoked: true } });
  if (r.count === 0) return NextResponse.json({ error: "Key not found on this seat." }, { status: 404 });
  return NextResponse.json({ ok: true, revoked: tokenId });
}
