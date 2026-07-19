"use client";
import { IconLock, IconCircleCheck } from "@tabler/icons-react";
import { benefitsFor, tierLabel, type Tier } from "@/lib/loyalty";
import { useI18n } from "@/lib/i18n";
import { Progress } from "@/components/ui";
import { money } from "@/lib/format";

/** Tier thresholds in months — used only to draw progress toward the next one. */
const FLOOR: Record<Tier, number> = { new: 0, established: 3, loyal: 12, veteran: 24 };
const NEXT: Record<Tier, Tier | null> = { new: "established", established: "loyal", loyal: "veteran", veteran: null };

/**
 * A quiet, per-subscription statement of what tenure has earned.
 * No streaks, no check-ins, nothing to "keep up" — time is the only input.
 */
export default function LoyaltyPanel({ startedAt, lockedPrice, listPrice, credits = 0 }: {
  startedAt: string;
  lockedPrice?: number | null;
  listPrice: number;
  credits?: number;
}) {
  const { t, locale } = useI18n();
  const b = benefitsFor(startedAt);
  const next = NEXT[b.tier];
  const saved = lockedPrice != null && listPrice > lockedPrice ? listPrice - lockedPrice : 0;

  const span = next ? FLOOR[next] - FLOOR[b.tier] : 0;
  const pct = next && span > 0 ? ((b.months - FLOOR[b.tier]) / span) * 100 : 100;

  const benefits: string[] = [];
  benefits.push(
    saved > 0
      ? t(`Price locked at ${money(lockedPrice!)}/mo — list is ${money(listPrice)}`,
          `価格は ${money(lockedPrice!)}/月 で固定 — 定価は ${money(listPrice)}`,
          `價格鎖定於 ${money(lockedPrice!)}/月 — 定價為 ${money(listPrice)}`)
      : t("Price locked from day one — future increases never apply to you",
          "初日から価格を固定 — 今後の値上げは適用されません",
          "從第一天起鎖價 — 日後漲價不影響你")
  );
  if (b.addonDiscountPct > 0) benefits.push(t(
    `${b.addonDiscountPct}% off human escalations & endorsements`,
    `人的エスカレーション・裏書きが ${b.addonDiscountPct}% オフ`,
    `真人升級與背書享 ${b.addonDiscountPct}% 折扣`));
  if (b.rateLimitBonusPct > 0) benefits.push(t(
    `+${b.rateLimitBonusPct}% daily request limit`,
    `1日のリクエスト上限 +${b.rateLimitBonusPct}%`,
    `每日請求上限 +${b.rateLimitBonusPct}%`));
  if (b.monthlyCredits > 0) benefits.push(t(
    `${b.monthlyCredits} credits per month`,
    `毎月 ${b.monthlyCredits} クレジット`,
    `每月 ${b.monthlyCredits} 點數`));

  return (
    <div className="glass-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{t("Your tenure","あなたの継続期間","你的訂閱年資")}</div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-display text-[13px] font-bold text-text">{tierLabel(b.tier, locale)}</span>
        <span className="text-[11px] text-muted">
          {t(`${b.months} months subscribed`,`購読 ${b.months} か月`,`已訂閱 ${b.months} 個月`)}
        </span>
      </div>

      {next && (
        <div className="mt-3">
          <Progress value={pct} />
          <div className="mt-1.5 text-[10.5px] text-faint">
            {t(`${b.nextTierInMonths ?? 0} months to ${tierLabel(next, "en")}`,
               `${tierLabel(next, "ja")}まであと ${b.nextTierInMonths ?? 0} か月`,
               `再 ${b.nextTierInMonths ?? 0} 個月成為${tierLabel(next, "zh")}`)}
          </div>
        </div>
      )}

      <ul className="mt-3 space-y-1.5 border-t border-glassborder/60 pt-3">
        {benefits.map((x, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-6 text-muted">
            <span className="mt-1 text-green">{i === 0 ? <IconLock size={12} stroke={1.7} /> : <IconCircleCheck size={12} stroke={1.7} />}</span>
            {x}
          </li>
        ))}
      </ul>

      {credits > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-glassborder/60 pt-3 text-[11.5px]">
          <span className="text-faint">{t("Credit balance","クレジット残高","點數餘額")}</span>
          <span className="font-display font-bold text-text">{credits}</span>
        </div>
      )}
    </div>
  );
}
