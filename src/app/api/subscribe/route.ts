import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, randomToken } from "@/lib/auth";
import { budgetCheck } from "@/lib/org";
import { readJson, badRequest } from "@/lib/req";
import { notify } from "@/lib/notify";
import { canSubscribe, passCovers } from "@/lib/rules";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req);
  if (!body) return badRequest();
  const { slug, viaPass } = body;
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const existing = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
  const alreadyActive = existing?.status === "active";
  const guard = canSubscribe(user as any, agent as any, alreadyActive);
  if (!guard.ok) {
    if (guard.code === "already") return NextResponse.json({ ok: true, token: existing!.mcpToken, already: true });
    return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status });
  }

  const usePass = !!viaPass && passCovers(user as any, agent as any);

  // An enterprise budget cap that only applies to some paths is not a cap. Enforce it here too.
  if (user.role === "enterprise" && !usePass && !alreadyActive) {
    const b = await budgetCheck(user.id, agent.price);
    if (!b.ok) {
      return NextResponse.json(
        { error: `This would put you $${b.over} over your $${b.cap}/mo budget cap. Raise the cap in Billing, or free up spend first.`, code: "over_budget" },
        { status: 402 },
      );
    }
  }
  const viaPassRequested = !!viaPass;
  const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  let sub;
  try {
    sub = await db.$transaction(async (tx) => {
      const s = existing
        ? await tx.subscription.update({ where: { id: existing.id }, data: { status: "active", canceledAt: null, viaPass: usePass, price: usePass ? 0 : agent.price, currentPeriodEnd: periodEnd, flagged: false, extractionStrikes: 0 } })
        : await tx.subscription.create({ data: { userId: user.id, agentId: agent.id, status: "active", price: usePass ? 0 : agent.price, viaPass: usePass, mcpToken: randomToken(), currentPeriodEnd: periodEnd, lockedPrice: usePass ? null : agent.price } });
      await tx.agent.update({ where: { id: agent.id }, data: { subscribers: { increment: 1 } } });
      if (!usePass) await tx.transaction.create({ data: { userId: user.id, type: "subscription", amount: agent.price, agentId: agent.id, note: `Subscribed to ${agent.name}` } });
      return s;
    });
  } catch (e: any) {
    // Concurrent duplicate (unique userId+agentId) — treat as already-subscribed, return the token.
    const dup = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
    if (dup) return NextResponse.json({ ok: true, token: dup.mcpToken, endpoint: `https://mcp.wiz-agents.com/a/${agent.slug}`, already: true });
    console.error("subscribe failed:", e);
    return NextResponse.json({ error: "Could not complete the subscription. Please try again." }, { status: 500 });
  }
  await notify(agent.creatorId, "subscription", `New subscriber: ${agent.name}`, `${user.name} subscribed${usePass ? " (via Pass)" : `, $${agent.price}/mo`}.`, `/studio/agent/${agent.slug}`);
  return NextResponse.json({ ok: true, token: sub.mcpToken, endpoint: `https://mcp.wiz-agents.com/a/${agent.slug}`, viaPass: usePass, viaPassApplied: usePass, viaPassRequestedButUncovered: viaPassRequested && !usePass });
}
