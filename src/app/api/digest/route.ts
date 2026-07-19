import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { benefitsFor } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

/**
 * "What your experts changed" — the periodic value report for long-term subscribers.
 * No streaks, no check-ins: it simply shows what you got for staying, and what the
 * experts you pay have actually shipped since you last looked.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const subs = await db.subscription.findMany({
    where: { userId: user.id, status: "active" },
    include: { agent: true },
  });

  const items = await Promise.all(subs.map(async (s) => {
    const since = s.lastDigestAt ?? s.startedAt;
    const [updates, escalations] = await Promise.all([
      db.knowledgeVersion.findMany({ where: { agentId: s.agentId, createdAt: { gt: since } }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.escalation.count({ where: { userId: user.id, agentId: s.agentId, status: { in: ["answered", "signed"] } } }),
    ]);
    const b = benefitsFor(s.startedAt);
    return {
      slug: s.agent.slug,
      name: s.agent.name,
      creatorName: s.agent.creatorName,
      since: since.toISOString(),
      updates: updates.map((k) => ({ version: k.version, note: k.note, docCount: k.docCount, at: k.createdAt.toISOString() })),
      escalationsResolved: escalations,
      loyalty: b,
      lockedPrice: s.lockedPrice,
      listPrice: s.agent.price,
      priceSaved: s.lockedPrice != null && s.agent.price > s.lockedPrice ? s.agent.price - s.lockedPrice : 0,
      credits: s.credits,
    };
  }));

  const totals = {
    agents: items.length,
    knowledgeUpdates: items.reduce((n, i) => n + i.updates.length, 0),
    monthlySavedByPriceLock: items.reduce((n, i) => n + i.priceSaved, 0),
    credits: items.reduce((n, i) => n + i.credits, 0),
  };
  return NextResponse.json({ ok: true, items, totals });
}

/** Grant this month's loyalty credits and mark the digest as read. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const month = new Date().toISOString().slice(0, 7);
  const subs = await db.subscription.findMany({ where: { userId: user.id, status: "active" } });
  let granted = 0;
  for (const s of subs) {
    const b = benefitsFor(s.startedAt);
    const data: any = { lastDigestAt: new Date() };
    if (b.monthlyCredits > 0 && s.creditStamp !== month) {
      data.credits = { increment: b.monthlyCredits };
      data.creditStamp = month;
      granted += b.monthlyCredits;
    }
    await db.subscription.update({ where: { id: s.id }, data });
  }
  return NextResponse.json({ ok: true, creditsGranted: granted });
}
