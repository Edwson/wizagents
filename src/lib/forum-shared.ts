/** Pure constants + label helpers — safe to import from client components (no db). */
export const POST_KINDS = ["article", "guide", "question", "discussion", "case"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const TITLE_MAX = 140;
export const BODY_MAX = 20000;   // articles: creators write long-form freely
export const REPLY_MAX = 1800;   // a public reply is a SAMPLE of judgement, not a consultation
export const TAGS_MAX = 6;

export function kindLabel(k: string, l: "en" | "ja" | "zh" = "en") {
  const m: Record<string, [string, string, string]> = {
    article: ["Article", "記事", "文章"],
    guide: ["Guide", "使い方ガイド", "使用指南"],
    question: ["Question", "質問", "提問"],
    discussion: ["Discussion", "ディスカッション", "討論"],
    case: ["Case study", "ケーススタディ", "案例"],
  };
  const e = m[k] || m.discussion;
  return l === "ja" ? e[1] : l === "zh" ? e[2] : e[0];
}
