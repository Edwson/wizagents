"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconLock, IconCircleCheck, IconArrowUpRight, IconHistory } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, SectionLabel, Reveal, Stat } from "@/components/ui";
import { tierLabel, type Benefits } from "@/lib/loyalty";
import { money, timeAgo } from "@/lib/format";

type Update = { version: string; note: string; docCount: number; at: string };
type Item = {
  slug: string; name: string; creatorName: string; since: string;
  updates: Update[]; escalationsResolved: number;
  loyalty: Benefits; lockedPrice: number | null; listPrice: number; priceSaved: number; credits: number;
};
type Totals = { agents: number; knowledgeUpdates: number; monthlySavedByPriceLock: number; credits: number };
type Digest = { ok: boolean; items: Item[]; totals: Totals };

/**
 * "What your experts changed" — a periodic statement, not a game screen.
 * It reports what the experts you pay actually shipped, and what staying has earned.
 * Nothing here asks the user to come back, keep a streak, or check in.
 */
export default function ExpertDigest() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [data, setData] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const monthKey = new Date().toISOString().slice(0, 7);
  const [collectedMonth, setCollectedMonth] = useState<string | null>(null);

  useEffect(() => {
    try { setCollectedMonth(window.localStorage.getItem("wiz.digest.collected")); } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/digest");
      if (!res.ok) { setData(null); return; }
      const d = (await res.json()) as Digest;
      setData(d?.ok ? d : null);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function collect() {
    setCollecting(true);
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const d = await res.json();
      if (d?.ok) {
        try { window.localStorage.setItem("wiz.digest.collected", monthKey); } catch { /* ignore */ }
        setCollectedMonth(monthKey);
        toast(
          d.creditsGranted > 0
            ? t(`${d.creditsGranted} credits added to your balance`,`${d.creditsGranted} クレジットを残高に追加しました`,`已將 ${d.creditsGranted} 點數加入你的餘額`)
            : t("Already collected this month","今月分は受け取り済みです","本月已領取"),
          "success",
        );
        await load();
      } else {
        toast(d?.error || t("Could not collect credits","クレジットを受け取れませんでした","無法領取點數"), "error");
      }
    } catch {
      toast(t("Could not collect credits","クレジットを受け取れませんでした","無法領取點數"), "error");
    } finally { setCollecting(false); }
  }

  if (loading || !data || data.items.length === 0) return null;

  const { items, totals } = data;
  const monthlyCredits = items.reduce((n, i) => n + i.loyalty.monthlyCredits, 0);
  // No nagging: once this month's credits are in, the call to action simply goes away.
  const collectable = monthlyCredits > 0 && collectedMonth !== monthKey;
  const quiet = totals.knowledgeUpdates === 0;

  return (
    <Reveal as="section" className="mt-12">
      <SectionLabel>{t("What your experts changed","専門家が更新したこと","你的專家做了哪些更新")}</SectionLabel>

      <div className="glass-card p-5">
        <h2 className="font-display text-[15px] font-bold text-text">
          {quiet
            ? t("No knowledge changes since your last statement.","前回の明細以降、知識の更新はありません。","自上次明細以來，知識庫沒有更新。")
            : t(`Since you subscribed, your experts shipped ${totals.knowledgeUpdates} knowledge updates.`,
                `購読開始以降、専門家は ${totals.knowledgeUpdates} 件の知識更新を反映しました。`,
                `自你訂閱以來，你的專家推送了 ${totals.knowledgeUpdates} 次知識更新。`)}
        </h2>
        <p className="mt-1 text-[12px] leading-6 text-muted">
          {t(`Across ${totals.agents} subscriptions. Your price is locked from the day you subscribed — an expert raising their price never affects you.`,
             `${totals.agents} 件の購読が対象です。価格は購読開始日に固定されており、専門家が値上げしてもあなたには影響しません。`,
             `涵蓋 ${totals.agents} 個訂閱。你的價格自訂閱當天鎖定 — 專家調漲不會影響你。`)}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label={t("Knowledge updates","知識の更新","知識更新")}
            value={totals.knowledgeUpdates}
            sub={t("shipped by your experts","専門家による反映","由你的專家推送")}
          />
          <Stat
            label={t("Saved by price lock","価格固定による節約","鎖價省下")}
            value={`${money(totals.monthlySavedByPriceLock)}/mo`}
            sub={t("versus today's list prices","現在の定価との差額","相較於現行定價")}
          />
          <Stat
            label={t("Credit balance","クレジット残高","點數餘額")}
            value={totals.credits}
            sub={t("spendable on escalations & endorsements","エスカレーション・裏書きに利用可能","可用於升級與背書")}
          />
        </div>

        {collectable && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-glassborder/60 pt-4">
            <div className="text-[11.5px] leading-6 text-muted">
              {t("Your loyalty credits for this month are ready.","今月のロイヤルティ・クレジットが利用可能です。","本月的忠誠點數已備妥。")}
            </div>
            <Btn onClick={collect} disabled={collecting} variant="outline" size="sm">
              {collecting
                ? t("Collecting…","受け取り中…","領取中…")
                : t("Collect this month's credits","今月のクレジットを受け取る","領取本月點數")}
            </Btn>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {items.map((it) => <Row key={it.slug} item={it} t={t} locale={locale} />)}
      </div>
    </Reveal>
  );
}

function Row({ item, t, locale }: { item: Item; t: (en: string, ja?: string, zh?: string) => string; locale: "en" | "ja" | "zh" }) {
  const b = item.loyalty;
  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <Link href={`/agent/${item.slug}`} className="font-display text-[13.5px] font-bold text-text transition-colors hover:text-purple">
            {item.name}
          </Link>
          <span className="text-[11.5px] text-muted">{t("by","by","by")} {item.creatorName}</span>
        </div>
        <span className="text-[11px] text-faint">
          {tierLabel(b.tier, locale)} · {t(`${b.months} months`,`${b.months} か月`,`${b.months} 個月`)}
        </span>
      </div>

      {item.updates.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {item.updates.map((u, i) => (
            <li key={i} className="flex items-start justify-between gap-3 rounded-lg hairline bg-panel/40 px-3 py-2 text-[11.5px] backdrop-blur-sm">
              <span className="flex items-start gap-1.5 text-muted">
                <span className="mt-0.5 text-purple"><IconArrowUpRight size={13} stroke={1.7} /></span>
                {u.note}
              </span>
              <span className="whitespace-nowrap font-mono text-[10.5px] text-faint">
                {u.version} · {t(`${u.docCount} docs`,`${u.docCount} 件`,`${u.docCount} 檔`)} · {timeAgo(u.at, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-faint">
          <IconHistory size={13} stroke={1.7} />
          {t("No knowledge changes in this period.","この期間の知識更新はありません。","此期間沒有知識更新。")}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-glassborder/60 pt-3 text-[11.5px] text-muted">
        {item.escalationsResolved > 0 && (
          <span className="flex items-center gap-1.5">
            <IconCircleCheck size={13} stroke={1.7} className="text-green" />
            {t(`${item.escalationsResolved} escalations resolved for you`,
               `${item.escalationsResolved} 件のエスカレーションに対応済み`,
               `已為你解決 ${item.escalationsResolved} 次升級`)}
          </span>
        )}
        {item.priceSaved > 0 ? (
          <span className="flex items-center gap-1.5">
            <IconLock size={13} stroke={1.7} className="text-green" />
            {t(`You're paying ${money(item.lockedPrice ?? item.listPrice)} — the current list price is ${money(item.listPrice)}. Your price is locked.`,
               `あなたの支払いは ${money(item.lockedPrice ?? item.listPrice)} — 現在の定価は ${money(item.listPrice)} です。価格は固定されています。`,
               `你支付 ${money(item.lockedPrice ?? item.listPrice)} — 目前定價為 ${money(item.listPrice)}。你的價格已鎖定。`)}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <IconLock size={13} stroke={1.7} className="text-faint" />
            {t(`Price locked at ${money(item.lockedPrice ?? item.listPrice)}/mo`,
               `価格は ${money(item.lockedPrice ?? item.listPrice)}/月 で固定`,
               `價格鎖定於 ${money(item.lockedPrice ?? item.listPrice)}/月`)}
          </span>
        )}
        {b.addonDiscountPct > 0 && (
          <span>{t(`${b.addonDiscountPct}% off escalations & endorsements`,
                    `エスカレーション・裏書き ${b.addonDiscountPct}% オフ`,
                    `升級與背書 ${b.addonDiscountPct}% 折扣`)}</span>
        )}
        {item.credits > 0 && (
          <span>{t(`${item.credits} credits`,`${item.credits} クレジット`,`${item.credits} 點數`)}</span>
        )}
      </div>
    </div>
  );
}
