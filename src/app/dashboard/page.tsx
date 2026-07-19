import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import DashboardClient from "@/components/DashboardClient";
import EndorsementInbox from "@/components/EndorsementInbox";
import ExpertDigest from "@/components/ExpertDigest";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [subsRaw, escRaw, txRaw] = await Promise.all([
    db.subscription.findMany({ where: { userId: user.id, status: { in: ["active", "canceled"] } }, include: { agent: true }, orderBy: { startedAt: "desc" } }),
    db.escalation.findMany({ where: { userId: user.id }, include: { agent: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const now = Date.now();
  const subs = subsRaw.map((s) => {
    const end = s.currentPeriodEnd ? s.currentPeriodEnd.getTime() : null;
    const expired = s.status !== "active" || (end !== null && end < now);
    const daysLeft = end !== null ? Math.max(0, Math.ceil((end - now) / 86400000)) : null;
    return {
      slug: s.agent.slug, name: s.agent.name, creatorName: s.agent.creatorName, category: s.agent.category,
      price: s.price, viaPass: s.viaPass, token: s.mcpToken, escalationPrice: s.agent.escalationPrice, requests: s.requests,
      status: s.status, flagged: s.flagged, expired, daysLeft,
      periodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
    };
  });
  // Enterprise seat: the agents your organization provides you (org's subscription).
  const mySeats = await db.enterpriseSeat.findMany({ where: { status: "active", OR: [{ memberUserId: user.id }, { memberEmail: user.email }] } });
  if (mySeats.length) {
    const ownAgentIds = new Set(subsRaw.map((s) => s.agentId));
    for (const seat of mySeats) {
      const [orgSubs, blocked] = await Promise.all([
        db.subscription.findMany({ where: { userId: seat.orgOwnerId, status: "active" }, include: { agent: true } }),
        db.blacklist.findMany({ where: { orgOwnerId: seat.orgOwnerId } }),
      ]);
      const blockedIds = new Set(blocked.map((b) => b.agentId));
      for (const os of orgSubs) {
        if (ownAgentIds.has(os.agentId) || blockedIds.has(os.agentId)) continue;
        ownAgentIds.add(os.agentId);
        const end = os.currentPeriodEnd ? os.currentPeriodEnd.getTime() : null;
        subs.push({
          slug: os.agent.slug, name: os.agent.name, creatorName: os.agent.creatorName, category: os.agent.category,
          price: 0, viaPass: false, token: "", escalationPrice: os.agent.escalationPrice, requests: os.requests,
          status: os.status, flagged: os.flagged, expired: false,
          daysLeft: end !== null ? Math.max(0, Math.ceil((end - now) / 86400000)) : null,
          periodEnd: os.currentPeriodEnd ? os.currentPeriodEnd.toISOString() : null,
          viaSeat: true,
        } as any);
      }
    }
  }

  subs.sort((a, b) => Number(a.expired) - Number(b.expired));
  const escalations = escRaw.map((e) => ({
    id: e.id, agentName: e.agent.name, status: e.status, tier: e.tier, price: e.price,
    question: e.question, answer: e.answer, signed: e.signed, createdAt: e.createdAt.toISOString(),
  }));
  const transactions = txRaw.map((t) => ({ type: t.type, amount: t.amount, note: t.note, createdAt: t.createdAt.toISOString() }));
  const monthlySpend = subs.filter((s) => !s.viaPass && !s.expired).reduce((a, s) => a + s.price, 0) + (user.pass?.active ? user.pass.monthlyPrice : 0);

  return (
    <>
      <DashboardClient
        subs={subs} escalations={escalations} transactions={transactions}
        hasPass={!!user.pass?.active} passPrice={user.pass?.monthlyPrice || 129} monthlySpend={monthlySpend}
      />
      <ExpertDigest />
      <div className="mt-12">
        <EndorsementInbox show="buyer" />
      </div>
    </>
  );
}
