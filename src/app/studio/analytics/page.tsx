import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, pick } from "@/lib/locale";
import AnalyticsClient from "@/components/AnalyticsClient";

export const dynamic = "force-dynamic";

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);

  const agents = await db.agent.findMany({
    where: { creatorId: user.id },
    include: { metrics: { orderBy: { month: "asc" } } },
    orderBy: { subscribers: "desc" },
  });

  if (agents.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/studio" className="text-[12px] text-muted hover:text-text">
          ← {P("Back to Studio", "スタジオに戻る", "返回工作室")}
        </Link>
        <div className="mt-8 rounded-xl border border-border bg-panel p-10 text-center">
          <div className="text-[15px] font-bold">{P("No agents yet", "エージェントがまだありません", "還沒有任何 Agent")}</div>
          <div className="mt-2 text-[12px] text-faint">
            {P("Once you create your first Agent, analytics will appear here.", "最初のエージェントを作成すると、ここに分析が表示されます。", "建立你的第一個 Agent 後，這裡就會顯示數據分析。")}
          </div>
          <Link
            href="/studio/create"
            className="mt-6 inline-block rounded-lg border border-border bg-panel2 px-4 py-2 text-[12px] text-amber hover:bg-panel3"
          >
            {P("Create Agent", "エージェントを作成", "建立 Agent")} →
          </Link>
        </div>
      </div>
    );
  }

  const ids = agents.map((a) => a.id);

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [events30, events14, escalations] = await Promise.all([
    db.usageEvent.findMany({
      where: { agentId: { in: ids }, createdAt: { gte: d30 } },
    }),
    db.usageEvent.findMany({
      where: { agentId: { in: ids }, createdAt: { gte: d14 } },
    }),
    db.escalation.count({ where: { agentId: { in: ids } } }),
  ]);

  // usage last 14 days buckets (oldest -> newest)
  const keys14: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    keys14.push(dayKey(d));
  }
  const bucket: Record<string, number> = {};
  keys14.forEach((k) => (bucket[k] = 0));
  for (const e of events14) {
    const k = dayKey(new Date(e.createdAt));
    if (k in bucket) bucket[k] += 1;
  }
  const usage14 = keys14.map((k) => bucket[k]);

  // usage30d per agent
  const per30: Record<string, number> = {};
  ids.forEach((id) => (per30[id] = 0));
  for (const e of events30) {
    if (e.agentId in per30) per30[e.agentId] += 1;
  }

  // Marketplace KPIs: subscriptions + trial conversions
  const [subs, trialConvs] = await Promise.all([
    db.subscription.findMany({
      where: { agentId: { in: ids } },
      select: { agentId: true, userId: true, status: true, viaPass: true, price: true },
    }),
    db.conversation.findMany({
      where: { agentId: { in: ids }, isTrial: true },
      select: { agentId: true, userId: true },
    }),
  ]);

  const activeSubsList = subs.filter((s) => s.status === "active");
  const activeSubs = activeSubsList.length;
  const canceledSubs = subs.filter((s) => s.status === "canceled").length;
  const churnRate =
    activeSubs + canceledSubs > 0
      ? Math.round((canceledSubs / (activeSubs + canceledSubs)) * 100)
      : 0;

  // distinct users who tried an agent (trial conversation)
  const trierUsers = new Set(trialConvs.map((c) => c.userId));
  const triers = trierUsers.size;
  // distinct users with an active subscription who had a trial = conversions
  const activeSubUsers = new Set(activeSubsList.map((s) => s.userId));
  let conversions = 0;
  for (const u of activeSubUsers) if (trierUsers.has(u)) conversions++;
  const conversionRate =
    triers > 0 ? Math.round((conversions / triers) * 100) : 0;

  // MRR = sum of active, non-pass subscription prices
  const mrr = activeSubsList.reduce(
    (sum, sub) => sum + (sub.viaPass ? 0 : sub.price),
    0,
  );

  // per-agent marketplace breakdown
  const perAgentKpi: Record<
    string,
    { active: number; canceled: number; mrr: number; triers: Set<string>; activeUsers: Set<string> }
  > = {};
  ids.forEach(
    (id) =>
      (perAgentKpi[id] = { active: 0, canceled: 0, mrr: 0, triers: new Set(), activeUsers: new Set() }),
  );
  for (const sub of subs) {
    const rec = perAgentKpi[sub.agentId];
    if (!rec) continue;
    if (sub.status === "active") {
      rec.active += 1;
      rec.activeUsers.add(sub.userId);
      if (!sub.viaPass) rec.mrr += sub.price;
    } else if (sub.status === "canceled") {
      rec.canceled += 1;
    }
  }
  for (const c of trialConvs) {
    perAgentKpi[c.agentId]?.triers.add(c.userId);
  }

  // subscriber growth: sum each agent's metrics per month across seeded months
  const monthTotals: Record<string, number> = {};
  const monthOrder: string[] = [];
  for (const a of agents) {
    for (const m of a.metrics) {
      if (!(m.month in monthTotals)) {
        monthTotals[m.month] = 0;
        monthOrder.push(m.month);
      }
      monthTotals[m.month] += m.subscribers;
    }
  }
  monthOrder.sort();
  const growth = monthOrder.map((m) => monthTotals[m]);

  const totalSubscribers = agents.reduce((s, a) => s + a.subscribers, 0);
  const avgRenewal =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.renewal, 0) / agents.length)
      : 0;

  const perAgent = agents.map((a) => {
    const rec = perAgentKpi[a.id];
    const aActive = rec?.active ?? 0;
    const aCanceled = rec?.canceled ?? 0;
    const aChurn =
      aActive + aCanceled > 0
        ? Math.round((aCanceled / (aActive + aCanceled)) * 100)
        : 0;
    const aTriers = rec?.triers.size ?? 0;
    let aConv = 0;
    if (rec) for (const u of rec.activeUsers) if (rec.triers.has(u)) aConv++;
    const aConvRate = aTriers > 0 ? Math.round((aConv / aTriers) * 100) : 0;
    return {
      name: a.name,
      slug: a.slug,
      category: a.category,
      subscribers: a.subscribers,
      usage30d: per30[a.id] ?? 0,
      renewal: a.renewal,
      revenue: a.subscribers * a.price,
      activeSubs: aActive,
      churnRate: aChurn,
      conversionRate: aConvRate,
      mrr: rec?.mrr ?? 0,
    };
  });

  return (
    <AnalyticsClient
      kpi={{
        subscribers: totalSubscribers,
        usage30d: events30.length,
        escalations,
        avgRenewal,
        conversionRate,
        churnRate,
        mrr,
        activeSubs,
        triers,
      }}
      usage14={usage14}
      growth={growth}
      perAgent={perAgent}
    />
  );
}
