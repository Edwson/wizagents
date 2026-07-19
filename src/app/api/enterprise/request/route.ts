import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, randomToken } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { orgContext, budgetCheck } from "@/lib/org";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Admin: the queue. Member: my own requests.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const org = await orgContext(user as any);
  if (org?.isAdmin) {
    const rows = await db.accessRequest.findMany({ where: { orgOwnerId: org.orgOwnerId }, orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json({ ok: true, asAdmin: true, requests: rows });
  }
  const mine = await db.accessRequest.findMany({ where: { requesterId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ ok: true, asAdmin: false, requests: mine });
}

/** A seat member asks the org to buy access to an Agent. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const b = await readJson(req); if (!b) return badRequest();

  const seat = await db.enterpriseSeat.findFirst({ where: { status: "active", OR: [{ memberUserId: user.id }, { memberEmail: user.email }] } });
  if (!seat) return NextResponse.json({ error: "You don't hold an active seat in any organization." }, { status: 403 });
  const agent = await db.agent.findUnique({ where: { slug: String(b.slug || "") } });
  if (!agent || agent.status !== "published") return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const dup = await db.accessRequest.findFirst({ where: { orgOwnerId: seat.orgOwnerId, requesterId: user.id, agentId: agent.id, status: "pending" } });
  if (dup) return NextResponse.json({ ok: true, id: dup.id, already: true });

  const r = await db.accessRequest.create({
    data: { orgOwnerId: seat.orgOwnerId, requesterId: user.id, requesterEmail: user.email, agentId: agent.id, agentName: agent.name, reason: String(b.reason || "").slice(0, 500) },
  });
  await notify(seat.orgOwnerId, "subscription", `Access request: ${agent.name}`, `${user.email} asked for access. $${agent.price}/mo.`, "/enterprise");
  return NextResponse.json({ ok: true, id: r.id });
}

/** Admin decides. Approving actually SUBSCRIBES the org (and respects the budget). */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const org = await orgContext(user as any);
  if (!org?.isAdmin) return NextResponse.json({ error: "Only an organization admin can decide" }, { status: 403 });
  const b = await readJson(req); if (!b) return badRequest();

  const r = await db.accessRequest.findUnique({ where: { id: String(b.id || "") } });
  if (!r || r.orgOwnerId !== org.orgOwnerId) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (r.status !== "pending") return NextResponse.json({ error: "Already decided" }, { status: 409 });

  if (b.action === "deny") {
    await db.accessRequest.update({ where: { id: r.id }, data: { status: "denied", decidedById: user.id, decidedAt: new Date(), note: String(b.note || "").slice(0, 300) } });
    await notify(r.requesterId, "subscription", `Access denied: ${r.agentName}`, String(b.note || "Your organization declined this request."), "/market");
    return NextResponse.json({ ok: true, status: "denied" });
  }

  const agent = await db.agent.findUnique({ where: { id: r.agentId } });
  if (!agent) return NextResponse.json({ error: "Agent no longer available" }, { status: 404 });

  const existing = await db.subscription.findUnique({ where: { userId_agentId: { userId: org.orgOwnerId, agentId: agent.id } } });
  if (!existing || existing.status !== "active") {
    // Budget is enforced at the moment money would actually be committed.
    const budget = await budgetCheck(org.orgOwnerId, agent.price);
    if (!budget.ok) {
      return NextResponse.json({ error: `Approving this would put you $${budget.over}/mo over your budget cap of $${budget.cap}. Raise the cap or free up spend.`, code: "over_budget", budget }, { status: 409 });
    }
    const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await db.$transaction(async (tx) => {
      if (existing) {
        await tx.subscription.update({ where: { id: existing.id }, data: { status: "active", canceledAt: null, price: agent.price, lockedPrice: agent.price, currentPeriodEnd: periodEnd, flagged: false, extractionStrikes: 0 } });
      } else {
        await tx.subscription.create({ data: { userId: org.orgOwnerId, agentId: agent.id, status: "active", price: agent.price, lockedPrice: agent.price, mcpToken: randomToken(), currentPeriodEnd: periodEnd } });
      }
      await tx.agent.update({ where: { id: agent.id }, data: { subscribers: { increment: 1 } } });
      await tx.transaction.create({ data: { userId: org.orgOwnerId, type: "subscription", amount: agent.price, agentId: agent.id, note: `Approved for ${r.requesterEmail}` } });
    });
    // In allowlist mode, approving must also permit it.
    await db.orgAllowlist.upsert({
      where: { orgOwnerId_agentId: { orgOwnerId: org.orgOwnerId, agentId: agent.id } },
      update: {}, create: { orgOwnerId: org.orgOwnerId, agentId: agent.id, agentName: agent.name },
    });
  }

  await db.accessRequest.update({ where: { id: r.id }, data: { status: "approved", decidedById: user.id, decidedAt: new Date() } });
  await notify(r.requesterId, "subscription", `Access approved: ${r.agentName}`, "Your organization approved it — the Agent is available to you now.", "/dashboard");
  return NextResponse.json({ ok: true, status: "approved" });
}
