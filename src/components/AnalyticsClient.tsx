import Link from "next/link";
import Sparkline from "@/components/Sparkline";
import { money } from "@/lib/format";
import { catLabel } from "@/lib/categories";
import { getLocale, pick } from "@/lib/locale";

type PerAgent = {
  name: string;
  slug: string;
  category: string;
  subscribers: number;
  usage30d: number;
  renewal: number;
  revenue: number;
  activeSubs: number;
  churnRate: number;
  conversionRate: number;
  mrr: number;
};

export default async function AnalyticsClient({
  kpi,
  usage14,
  growth,
  perAgent,
}: {
  kpi: {
    subscribers: number;
    usage30d: number;
    escalations: number;
    avgRenewal: number;
    conversionRate: number;
    churnRate: number;
    mrr: number;
    activeSubs: number;
    triers: number;
  };
  usage14: number[];
  growth: number[];
  perAgent: PerAgent[];
}) {
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  const maxUsage14 = Math.max(1, ...usage14);
  const maxAgentUsage = Math.max(1, ...perAgent.map((p) => p.usage30d));
  const currentTotal = growth.length > 0 ? growth[growth.length - 1] : 0;

  const stats = [
    { v: kpi.subscribers.toLocaleString(), l: P("Total Subscribers", "総登録数", "總訂閱數") },
    { v: kpi.usage30d.toLocaleString(), l: P("Usage (last 30 days)", "直近30日の利用量", "近 30 天用量") },
    { v: kpi.escalations.toLocaleString(), l: P("Escalations", "エスカレーション", "升級案件") },
    { v: `${kpi.avgRenewal}%`, l: P("Avg. Renewal Rate", "平均更新率", "平均續訂率") },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/studio" className="text-[12px] text-muted transition hover:text-text">
        ← {P("Back to Studio", "スタジオに戻る", "返回工作室")}
      </Link>
      <h1 className="mt-3 font-display text-[22px] font-extrabold tracking-tight"><span className="text-grad">{P("Analytics", "データ分析", "數據分析")}</span></h1>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.l}
            className="glass-card px-4 py-3"
          >
            <div className="font-display text-[20px] font-extrabold text-grad">{s.v}</div>
            <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Marketplace KPI cards */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            v: `${kpi.conversionRate}%`,
            l: P("Conversion rate", "コンバージョン率", "轉換率"),
          },
          {
            v: `${kpi.churnRate}%`,
            l: P("Churn rate", "解約率", "流失率"),
          },
          { v: money(kpi.mrr), l: P("MRR", "MRR", "月經常性收入") },
          {
            v: kpi.activeSubs.toLocaleString(),
            l: P("Active subscribers", "有効購読者", "有效訂閱者"),
          },
        ].map((s) => (
          <div
            key={s.l}
            className="glass-card px-4 py-3"
          >
            <div className="font-display text-[19px] font-extrabold">{s.v}</div>
            <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Usage 14 days */}
      <div className="mt-8 glass-card p-5">
        <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">
          // {P("Usage (last 14 days)", "直近14日の利用量", "近 14 天用量")}
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 120 }}>
          {usage14.map((v, i) => {
            const h = maxUsage14 > 0 ? Math.round((v / maxUsage14) * 100) : 0;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end"
                style={{ height: "100%" }}
                title={`${v}`}
              >
                <div
                  className="w-full rounded-sm bg-purple"
                  style={{ height: `${Math.max(v > 0 ? 4 : 1, h)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-faint">
          <span>{P("14 days ago", "14日前", "14 天前")}</span>
          <span>{P("7 days ago", "7日前", "7 天前")}</span>
          <span>{P("Today", "今日", "今天")}</span>
        </div>
        <div className="mt-2 text-[10.5px] text-muted">
          {P(`Peak ${maxUsage14}/day`, `1日最高 ${maxUsage14}回`, `單日最高 ${maxUsage14} 次`)}
        </div>
      </div>

      {/* Subscriber growth */}
      <div className="mt-6 glass-card p-5">
        <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">
          // {P("Subscriber growth (last 6 months)", "登録者の成長（直近6か月）", "訂閱成長（近 6 個月）")}
        </div>
        <div className="flex items-center justify-between">
          <Sparkline points={growth} tone="#4ade80" width={260} height={60} />
          <div className="text-right">
            <div className="font-display text-[20px] font-extrabold text-green">
              {currentTotal.toLocaleString()}
            </div>
            <div className="text-[10.5px] text-faint">{P("Current total subscribers", "現在の総登録数", "目前總訂閱")}</div>
          </div>
        </div>
      </div>

      {/* Per-agent performance */}
      <div className="mt-6 glass-card p-5">
        <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">
          // {P("Per-Agent Performance", "エージェント別パフォーマンス", "每個 Agent 表現")}
        </div>
        <div className="divide-y divide-border">
          {perAgent.map((a) => {
            const w =
              maxAgentUsage > 0
                ? Math.round((a.usage30d / maxAgentUsage) * 100)
                : 0;
            return (
              <div key={a.slug} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <Link
                      href={`/studio/agent/${a.slug}`}
                      className="font-display text-[13px] font-bold transition hover:text-violet"
                    >
                      {a.name}
                    </Link>
                    <span className="ml-2 text-[10.5px] text-faint">
                      {catLabel(a.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="text-muted">
                      {a.subscribers.toLocaleString()} {P("subs", "登録", "訂閱")}
                    </span>
                    <span className="text-muted">{a.usage30d} {P("uses", "回", "次")}</span>
                    <span className="text-muted">
                      {a.conversionRate}% {P("conv", "転換", "轉換")}
                    </span>
                    <span className="text-muted">
                      {a.churnRate}% {P("churn", "解約", "流失")}
                    </span>
                    <span className="text-muted">{money(a.mrr)} {P("MRR", "MRR", "月収")}</span>
                    <span className="font-display font-bold text-green">
                      {money(a.revenue)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel3">
                  <div
                    className="h-full rounded-full bg-purple"
                    style={{ width: `${w}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
