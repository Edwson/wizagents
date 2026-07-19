// Loyalty that rewards genuine tenure — no streaks, no check-ins, no busywork.
// Staying subscribed compounds real value: your price is locked, you accrue credits
// you can spend on human escalations/endorsements, and your limits rise.
export type Tier = "new" | "established" | "loyal" | "veteran";

export type Benefits = {
  tier: Tier;
  months: number;
  priceLocked: boolean;
  monthlyCredits: number;   // credits granted each month
  addonDiscountPct: number; // off escalations / endorsements
  rateLimitBonusPct: number;// extra daily requests
  nextTierInMonths: number | null;
};

export function tenureMonths(startedAt: Date | string): number {
  const t = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  return Math.max(0, Math.floor((Date.now() - t.getTime()) / (30 * 86400000)));
}

export function tierFor(months: number): Tier {
  if (months >= 24) return "veteran";
  if (months >= 12) return "loyal";
  if (months >= 3) return "established";
  return "new";
}

export function benefitsFor(startedAt: Date | string): Benefits {
  const months = tenureMonths(startedAt);
  const tier = tierFor(months);
  const table: Record<Tier, Omit<Benefits, "tier" | "months" | "nextTierInMonths">> = {
    new:          { priceLocked: true, monthlyCredits: 0,  addonDiscountPct: 0,  rateLimitBonusPct: 0 },
    established:  { priceLocked: true, monthlyCredits: 10, addonDiscountPct: 5,  rateLimitBonusPct: 25 },
    loyal:        { priceLocked: true, monthlyCredits: 25, addonDiscountPct: 10, rateLimitBonusPct: 50 },
    veteran:      { priceLocked: true, monthlyCredits: 50, addonDiscountPct: 15, rateLimitBonusPct: 100 },
  };
  const next = tier === "new" ? 3 - months : tier === "established" ? 12 - months : tier === "loyal" ? 24 - months : null;
  return { tier, months, nextTierInMonths: next !== null ? Math.max(0, next) : null, ...table[tier] };
}

/** Apply the subscriber's loyalty discount to an add-on (escalation / endorsement) price. */
export function discountedPrice(price: number, startedAt: Date | string): { price: number; saved: number; pct: number } {
  const { addonDiscountPct } = benefitsFor(startedAt);
  const saved = Math.round((price * addonDiscountPct) / 100);
  return { price: Math.max(0, price - saved), saved, pct: addonDiscountPct };
}

type Lang = "en" | "ja" | "zh";
const L = (l: Lang, en: string, ja: string, zh: string) => (l === "ja" ? ja : l === "zh" ? zh : en);
export function tierLabel(t: Tier, lang: Lang = "en") {
  if (t === "veteran") return L(lang, "Veteran subscriber", "ベテラン購読者", "資深訂閱者");
  if (t === "loyal") return L(lang, "Loyal subscriber", "ロイヤル購読者", "忠實訂閱者");
  if (t === "established") return L(lang, "Established subscriber", "定着した購読者", "穩定訂閱者");
  return L(lang, "New subscriber", "新規購読者", "新訂閱者");
}
