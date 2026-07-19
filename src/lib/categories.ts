export type Locale = "en" | "ja" | "zh";

// [en, ja, zh]
const CAT: Record<string, [string, string, string]> = {
  compliance: ["Compliance", "コンプライアンス", "合規"],
  design: ["Design", "デザイン", "設計"],
  transaction: ["Trading", "トレーディング", "交易"],
  engineering: ["Engineering", "エンジニアリング", "工程"],
  legal: ["Legal", "法務", "法律"],
  software: ["Software", "ソフトウェア", "軟體開發"],
  finance: ["Finance", "ファイナンス", "財務分析"],
  web3: ["Web3", "Web3", "Web3"],
  ecommerce: ["E-commerce", "EC", "電商營運"],
  healthcare: ["Healthcare", "ヘルスケア", "醫療"],
  marketing: ["Marketing", "マーケティング", "行銷"],
  writing: ["Writing", "ライティング", "寫作"],
  humanities: ["Humanities", "人文", "人文"],
  psychology: ["Psychology", "心理", "心理"],
  career: ["Career", "キャリア", "職涯"],
  wellness: ["Wellness", "ウェルネス", "健康生活"],
  education: ["Education", "教育", "教育"],
  lifestyle: ["Lifestyle", "ライフスタイル", "生活"],
  content: ["Content", "コンテンツ", "內容創作"],
  realestate: ["Real Estate", "不動産", "房地產"],
  insurance: ["Insurance", "保険", "保險"],
  gaming: ["Gaming", "ゲーム", "遊戲"],
  music: ["Music", "音楽", "音樂"],
  culinary: ["Culinary", "料理", "料理"],
  science: ["Science", "科学", "科學"],
  companion: ["Companion", "コンパニオン", "陪伴"],
  space: ["Space", "宇宙", "太空"],
  physics: ["Physics", "物理", "物理"],
  chemistry: ["Chemistry", "化学", "化學"],
  data: ["Data", "データ", "數據"],
};

const IDX: Record<Locale, number> = { en: 0, ja: 1, zh: 2 };

export function catLabel(cat: string, locale: Locale = "en"): string {
  const row = CAT[cat];
  return row ? row[IDX[locale]] : cat;
}

export const CATEGORY_KEYS = Object.keys(CAT);

// Legacy export kept for any server callers; English map.
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CAT).map(([k, v]) => [k, v[0]])
);

export const PRIMARY_CATEGORIES = [
  "compliance", "design", "transaction", "engineering", "legal",
  "software", "finance", "web3", "ecommerce", "marketing",
];

// Localized verification label
export function verifyLabel(cat: string, locale: Locale = "en"): string {
  const c = catLabel(cat, locale);
  return locale === "ja" ? `${c}の認証済み専門家` : locale === "zh" ? `${c}領域認證專家` : `Verified ${c} expert`;
}
