// Verification tiers — deliberately few, so each badge means something.
//   none      → no badge
//   identity  → "Identity verified" (KYC: a real, named human)
//   expert    → "Verified Expert"   (identity + credentials checked by a human reviewer)
// Only `expert` unlocks signing citable endorsements and featured eligibility.
export type Level = "none" | "identity" | "expert";

export function levelOf(p?: { verified?: boolean; identityVerified?: boolean } | null): Level {
  if (!p) return "none";
  if (p.verified) return "expert";
  if (p.identityVerified) return "identity";
  return "none";
}

type Lang = "en" | "ja" | "zh";
const L = (l: Lang, en: string, ja: string, zh: string) => (l === "ja" ? ja : l === "zh" ? zh : en);

export function levelLabel(lv: Level, lang: Lang = "en"): string {
  if (lv === "expert") return L(lang, "Verified Expert", "認証済み専門家", "認證專家");
  if (lv === "identity") return L(lang, "Identity verified", "本人確認済み", "已驗證身分");
  return L(lang, "Unverified", "未認証", "未驗證");
}
export function levelBlurb(lv: Level, lang: Lang = "en"): string {
  if (lv === "expert") return L(lang, "Identity and professional credentials checked by a human reviewer.", "本人確認と専門資格を人がレビュー済み。", "身分與專業資格皆經真人審核。");
  if (lv === "identity") return L(lang, "A real, named human — identity confirmed. Credentials not yet reviewed.", "実在する本人確認済み。資格は未レビュー。", "真實具名的人，身分已確認；專業資格尚未審核。");
  return L(lang, "Not yet verified.", "未認証です。", "尚未驗證。");
}
/** Only a credential-checked expert may sign public citations or be featured. */
export function canSignEndorsements(lv: Level) { return lv === "expert"; }
export function canBeFeatured(lv: Level) { return lv === "expert"; }
