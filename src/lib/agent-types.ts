// The four avatar modes from the WizAgents case study.
// 師匠 Mentor · 助手 Assistant · 対話 Conversation · 探究 Discussion
export type AgentType = "mentor" | "assistant" | "conversation" | "discussion";
export const AGENT_TYPES: AgentType[] = ["mentor", "assistant", "conversation", "discussion"];

type Lang = "en" | "ja" | "zh";
const L = (lang: Lang, en: string, ja: string, zh: string) => (lang === "ja" ? ja : lang === "zh" ? zh : en);

export function isAgentType(v: any): v is AgentType { return AGENT_TYPES.includes(v); }

export function typeLabel(t: string, lang: Lang = "en"): string {
  switch (t) {
    case "assistant": return L(lang, "Assistant", "助手", "助手");
    case "conversation": return L(lang, "Conversation", "対話", "對話");
    case "discussion": return L(lang, "Discussion", "探究", "探究");
    default: return L(lang, "Mentor", "師匠", "師匠");
  }
}
/** The kanji glyph the case study pairs with each mode. */
export function typeGlyph(t: string): string {
  return t === "assistant" ? "助手" : t === "conversation" ? "対話" : t === "discussion" ? "探究" : "師匠";
}
export function typeTagline(t: string, lang: Lang = "en"): string {
  switch (t) {
    case "assistant": return L(lang, "The expert's method applied to your task, with their standards baked in.", "専門家の手法をあなたのタスクに適用。基準はそのまま。", "把專家的方法用在你的任務上，標準內建其中。");
    case "conversation": return L(lang, "Someone to think out loud with, who has actually been there.", "実際に経験した人と、声に出して考える相手。", "一個能一起把想法說出來、真的走過那條路的人。");
    case "discussion": return L(lang, "A sparring partner for the hard, open questions — pressure-tested by a human.", "難しく開かれた問いのための壁打ち相手 — 人によって鍛えられる。", "面對困難開放題的思辨對手——由真人壓力測試過。");
    default: return L(lang, "A master's judgment, on call — to guide a decision, not just answer it.", "師の判断をオンデマンドで — 答えるだけでなく決断を導く。", "隨時可召的大師判斷力——引導一個決定，而不只是回答它。");
  }
}
/** Server-side framing appended to the system prompt so the avatar behaves per mode. */
export function typeFraming(t: string): string {
  switch (t) {
    case "assistant": return "Operate as an ASSISTANT: apply the expert's method and standards directly to the user's task; produce usable output, checklists, drafts — not just discussion.";
    case "conversation": return "Operate as a CONVERSATION partner: think out loud with the user, reflect, and draw on lived experience; be a companion in reasoning rather than a report generator.";
    case "discussion": return "Operate as a DISCUSSION sparring partner: pressure-test the user's thinking on hard, open questions; surface counter-arguments and blind spots; challenge respectfully.";
    default: return "Operate as a MENTOR: guide the user toward a sound decision with the expert's judgment; weigh trade-offs and say what you would do and why, not just list options.";
  }
}
