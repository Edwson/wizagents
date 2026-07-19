import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getConfig, creatorShare } from "@/lib/config";
import { creatorEarnings } from "@/lib/earnings";
import { getLocale, pick } from "@/lib/locale";
import PayoutPanel from "@/components/PayoutPanel";
import { SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";


export default async function RevenuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);

  const cfg = await getConfig();
  const SHARE = creatorShare(cfg);
  const earnings = await creatorEarnings(user.id);
  const sharePct = Math.round(earnings.share * 100);

  const [agents, payouts] = await Promise.all([
    db.agent.findMany({ where: { creatorId: user.id }, include: { metrics: { orderBy: { month: "asc" } } }, orderBy: { subscribers: "desc" } }),
    db.payout.findMany({ where: { creatorId: user.id }, orderBy: { requestedAt: "desc" }, take: 50 }),
  ]);
  const perAgent = agents.map((a) => ({ name: a.name, slug: a.slug, gross: a.subscribers * a.price, cut: Math.round(a.subscribers * a.price * SHARE), subs: a.subscribers, price: a.price }));
  const mrrGross = perAgent.reduce((s, a) => s + a.gross, 0);
  const mrrCut = perAgent.reduce((s, a) => s + a.cut, 0);
  const maxGross = Math.max(1, ...perAgent.map((a) => a.gross));

  // monthly trend (sum of creator cut)
  const monthMap: Record<string, number> = {};
  for (const a of agents) for (const m of a.metrics) monthMap[m.month] = (monthMap[m.month] || 0) + m.revenue * SHARE;
  const months = Object.keys(monthMap).sort();
  const trend = months.map((m) => ({ m, v: Math.round(monthMap[m]) }));
  const maxTrend = Math.max(1, ...trend.map((t) => t.v));

  const initial = {
    earnings,
    payouts: payouts.map((p) => ({
      id: p.id, amount: p.amount, feeAmount: p.feeAmount, netAmount: p.netAmount,
      method: p.method, destinationMasked: p.destinationMasked,
      status: p.status as "requested" | "processing" | "paid" | "failed",
      requestedAt: (p.requestedAt instanceof Date ? p.requestedAt : new Date(p.requestedAt)).toISOString(),
    })),
  };

  return (
    <div className="animate-fadein">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/studio" className="text-[12px] text-muted hover:text-text">← {P("Back to Studio", "スタジオに戻る", "回工作室")}</Link>
          <h1 className="mt-2 font-display text-[26px] font-extrabold">{P("Earnings & payouts", "収益と出金", "收益與提領")}</h1>
          <p className="mt-1 text-[12.5px] text-muted">{P(`You keep ${sharePct}% of every subscription. Withdraw your available balance anytime.`, `サブスクリプションの${sharePct}%はあなたのものです。出金可能残高はいつでも引き出せます。`, `每筆訂閱你保留 ${sharePct}%。可提領餘額隨時可提。`)}</p>
        </div>
      </div>

      {/* ---------- Balance ---------- */}
      <div className="mt-6">
        <SectionLabel>{P("Balance", "残高", "餘額")}</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="glass-card border-grad p-5">
            <div className="text-[11px] uppercase tracking-[0.1em] text-faint">{P("Available", "出金可能額", "可提領")}</div>
            <div className="mt-1 font-display text-4xl font-bold text-grad">{money(earnings.available)}</div>
            <div className="mt-1 text-[11px] text-muted">{P("Ready to withdraw", "今すぐ出金可能", "可立即提領")}</div>
          </div>
          <BalanceCard v={money(earnings.pending)} l={P("Pending", "処理中", "處理中")} sub={P("In transit to you", "着金手続き中", "轉帳處理中")} tone="text-amber" />
          <BalanceCard v={money(earnings.withdrawn)} l={P("Withdrawn", "出金済み", "已提領")} sub={P("Paid out to date", "これまでの出金合計", "累計提領")} tone="text-text" />
          <BalanceCard v={money(earnings.lifetime)} l={P("Lifetime", "累計収益", "累計收益")} sub={P(`Your ${sharePct}% share, all time`, `あなたの取り分${sharePct}%（累計）`, `你的 ${sharePct}% 分潤（累計）`)} tone="text-green" />
        </div>
      </div>

      {/* ---------- Interactive withdraw / method / history ---------- */}
      <PayoutPanel initial={initial} />

      {/* ---------- Recurring revenue snapshot ---------- */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card v={money(earnings.mrrNet)} l={P(`Monthly Recurring Revenue (your ${sharePct}%)`, `月間経常収益（あなたの${sharePct}%）`, `月經常性收入（你的 ${sharePct}%）`)} tone="#4ade80" />
        <Card v={money(earnings.mrrGross)} l={P("Platform GMV (your Agents)", "プラットフォームGMV（あなたのエージェント）", "平台 GMV（你的 Agent）")} tone="#8b6dff" />
        <Card v={money(earnings.addonShare)} l={P("Expert Loop add-on income", "Expert Loop 追加収入", "Expert Loop 加值收入")} tone="#e5a94e" />
        <Card v={money(earnings.subShare)} l={P("Subscription income (lifetime)", "サブスク収入（累計）", "訂閱收入（累計）")} tone="#5eb0ff" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {P("Monthly revenue trend (your share)", "月次収益トレンド（あなたの取り分）", "月收入趨勢（你的分潤）")}</div>
          <div className="rounded-xl border border-border bg-panel p-5">
            <div className="flex h-40 items-end gap-2">
              {trend.map((t) => (
                <div key={t.m} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-green/70" style={{ height: `${(t.v / maxTrend) * 130}px` }} title={money(t.v)} />
                  <div className="text-[9px] text-faint">{t.m.slice(5)}</div>
                </div>
              ))}
              {trend.length === 0 && <div className="w-full py-10 text-center text-[12px] text-faint">{P("No data yet", "データがありません", "尚無資料")}</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {P("take-rate breakdown", "テイクレート内訳", "take-rate 拆分")}</div>
          <div className="rounded-xl border border-border bg-panel p-5">
            <div className="flex items-center gap-4">
              <Donut share={SHARE} />
              <div className="space-y-2 text-[12px]">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-green" />{P("Your share", "あなたの取り分", "你的分潤")} {sharePct}% · <span className="font-bold">{money(mrrCut)}</span></div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-panel3" />{P("Platform", "プラットフォーム", "平台")} {cfg.takeRatePct}% · <span className="text-muted">{money(mrrGross - mrrCut)}</span></div>
                <div className="pt-1 text-[11px] text-faint">{P("Expert Loop add-on take rate is only 15%, encouraging you to take cases.", "Expert Loop の追加テイクレートはわずか15%で、案件対応を後押しします。", "Expert Loop 加值抽成僅 15%，鼓勵你接單。")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {P("Monthly revenue per Agent", "エージェント別の月次収益", "每個 Agent 的月收入")}</div>
        <div className="space-y-2">
          {perAgent.map((a) => (
            <Link key={a.slug} href={`/studio/agent/${a.slug}`} className="block rounded-xl border border-border bg-panel p-4 hover:border-purple">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-bold">{a.name}</span>
                <span className="text-muted">{a.subs} {P("subs", "登録", "訂閱")} × ${a.price} = <span className="font-bold text-green">{money(a.cut)}</span> <span className="text-faint">/ {money(a.gross)}</span></span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel3">
                <div className="h-full rounded-full bg-gradient-to-r from-green to-purple" style={{ width: `${(a.gross / maxGross) * 100}%` }} />
              </div>
            </Link>
          ))}
          {perAgent.length === 0 && <div className="rounded-xl border border-dashed border-border py-12 text-center text-[12px] text-muted">{P("No Agent revenue data yet", "エージェントの収益データがまだありません", "尚無 Agent 收益資料")}</div>}
        </div>
      </div>
    </div>
  );
}

function BalanceCard({ v, l, sub, tone }: { v: string; l: string; sub: string; tone: string }) {
  return (
    <div className="glass-card p-5">
      <div className="text-[11px] uppercase tracking-[0.1em] text-faint">{l}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${tone}`}>{v}</div>
      <div className="mt-1 text-[11px] text-muted">{sub}</div>
    </div>
  );
}
function Card({ v, l, tone }: { v: string; l: string; tone: string }) {
  return <div className="rounded-lg border border-border bg-panel px-4 py-3"><div className="text-[20px] font-extrabold" style={{ color: tone }}>{v}</div><div className="mt-0.5 text-[10.5px] text-faint">{l}</div></div>;
}
function Donut({ share }: { share: number }) {
  const r = 30, c = 2 * Math.PI * r, on = c * share;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(var(--panel3))" strokeWidth="12" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(var(--green))" strokeWidth="12" strokeDasharray={`${on} ${c - on}`} strokeDashoffset={c / 4} transform="rotate(-90 40 40)" />
      <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="800" fill="rgb(var(--text))">{Math.round(share*100)}%</text>
    </svg>
  );
}
