import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { canEscalate } from "@/lib/rules";
import { discountedPrice } from "@/lib/loyalty";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req);
  if (!body) return badRequest();
  const { slug, question, tier, conversationId } = body;
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const sub = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
  const guard = canEscalate(user as any, agent as any, sub?.status === "active");
  if (!guard.ok) return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status });

  // Prevent accidental double-charge: reuse any still-open escalation for this agent.
  const open = await db.escalation.findFirst({ where: { userId: user.id, agentId: agent.id, status: { in: ["queued", "in_progress"] } }, orderBy: { createdAt: "desc" } });
  if (open) return NextResponse.json({ ok: true, escalation: { id: open.id, status: open.status, price: open.price, slaHours: open.tier === "urgent" ? 4 : 48 }, reused: true });

  const listPrice = tier === "urgent" ? Math.round(agent.escalationPrice * 1.8) : agent.escalationPrice;
  // Loyalty: tenure discounts human escalations.
  const { price: afterLoyalty, saved, pct } = discountedPrice(listPrice, sub!.startedAt);
  // Loyalty credits are real money off — spend them here (opt-in via useCredits).
  const wantCredits = body.useCredits !== false;             // default: spend what you've earned
  const creditsApplied = wantCredits ? Math.min(sub!.credits, afterLoyalty) : 0;
  const price = Math.max(0, afterLoyalty - creditsApplied);
  const hours = tier === "urgent" ? 4 : 48;
  const esc = await db.$transaction(async (tx) => {
    const e = await tx.escalation.create({
      data: { agentId: agent.id, userId: user.id, expertUserId: agent.creatorId, conversationId: conversationId || null, status: "queued", tier: tier || "standard", price, question: question || "(follows the conversation context)", slaDueAt: new Date(Date.now() + hours * 3600 * 1000) },
    });
    await tx.transaction.create({ data: { userId: user.id, type: "escalation", amount: price, agentId: agent.id, note: `Human escalation · ${tier === "urgent" ? "urgent" : "standard"}${creditsApplied ? ` · ${creditsApplied} credits applied` : ""}` } });
    if (creditsApplied > 0) await tx.subscription.update({ where: { id: sub!.id }, data: { credits: { decrement: creditsApplied } } });
    return e;
  });
  return NextResponse.json({ ok: true, escalation: { id: esc.id, status: esc.status, price, listPrice, saved, loyaltyPct: pct, creditsApplied, creditsLeft: sub!.credits - creditsApplied, slaHours: hours } });
}
