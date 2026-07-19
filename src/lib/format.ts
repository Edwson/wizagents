export function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
export function money2(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function timeAgo(d: Date | string, locale: "en" | "ja" | "zh" = "en"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  const L = (en: string, ja: string, zh: string) => (locale === "ja" ? ja : locale === "zh" ? zh : en);
  if (s < 60) return L("just now", "たった今", "剛剛");
  const m = Math.floor(s / 60), h = Math.floor(s / 3600), dd = Math.floor(s / 86400);
  if (s < 3600) return L(`${m}m ago`, `${m}分前`, `${m} 分鐘前`);
  if (s < 86400) return L(`${h}h ago`, `${h}時間前`, `${h} 小時前`);
  if (s < 604800) return L(`${dd}d ago`, `${dd}日前`, `${dd} 天前`);
  return date.toLocaleDateString(locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-TW" : "en-US");
}
export function parseFeatures(json: string): string[] {
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

/**
 * The stored `updatedLabel` freshness marker is historically Chinese text.
 * Map it to a localized [en, ja, zh] tuple so it renders in the UI language.
 * Covers seed data, creator-created agents, and knowledge-push updates.
 */
export function updatedLabelI18n(raw: string): [string, string, string] {
  const r = (raw || "").trim();
  if (!r) return ["Recently updated", "最近更新", "近期更新"];
  if (!/[^\x00-\x7f]/.test(r)) return [r, r, r]; // already ascii
  const days = r.match(/(\d+)\s*天前/);
  if (days) { const n = days[1]; return [`Updated ${n} days ago`, `${n}日前に更新`, `${n} 天前更新`]; }
  const times = r.match(/(\d+)\s*次/);
  if (times) { const n = times[1]; return [`Updated ${n}× this month`, `今月${n}回更新`, `本月已更新 ${n} 次`]; }
  if (r.includes("昨日") || r.includes("昨天")) return ["Updated yesterday", "昨日更新", "昨日更新"];
  if (r.includes("剛剛") || r.includes("刚刚")) return ["Just updated", "たった今更新", "剛剛更新"];
  if (r.includes("本週") || r.includes("本周") || r.includes("每週") || r.includes("每周")) return ["Updated this week", "今週更新", "本週更新"];
  return ["Recently updated", "最近更新", "近期更新"];
}
