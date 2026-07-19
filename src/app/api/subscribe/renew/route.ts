import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();
  const agent = await db.agent.findUnique({ where: { slug: body.slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const sub = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
  if (!sub) return NextResponse.json({ error: "No subscription to renew" }, { status: 404 });
  if (sub.flagged) return NextResponse.json({ error: "This subscription is suspended and cannot be renewed. Contact support.", code: "flagged" }, { status: 403 });

  const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
  const wasInactive = sub.status !== "active";
  await db.subscription.update({ where: { id: sub.id }, data: { status: "active", canceledAt: null, currentPeriodEnd: new Date(base.getTime() + 30 * 24 * 3600 * 1000) } });
  if (wasInactive) await db.agent.update({ where: { id: agent.id }, data: { subscribers: { increment: 1 } } });
  // Price-lock: long-term subscribers keep the price they joined at.
  const charge = sub.lockedPrice ?? agent.price;
  if (!sub.viaPass) await db.transaction.create({ data: { userId: user.id, type: "subscription", amount: charge, agentId: agent.id, note: `Renewed ${agent.name}${charge < agent.price ? " (price locked)" : ""}` } });
  return NextResponse.json({ ok: true });
}
