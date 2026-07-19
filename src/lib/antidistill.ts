// Anti-distillation engine — the "shield". Protects the creator's system prompt
// and knowledge base from extraction, and watermarks outputs for traceability.
import crypto from "crypto";

// Extraction-intent patterns across EN / JA / ZH. Case-insensitive.
const PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /system\s*prompt|developer\s*(message|prompt)|initial\s*instructions/i, reason: "asks for system prompt" },
  { re: /(reveal|show|print|display|output|repeat|give me).{0,30}(prompt|instructions|rules|system|configuration|config)/i, reason: "asks to reveal instructions" },
  { re: /(ignore|disregard|forget).{0,20}(previous|above|prior|earlier).{0,20}(instruction|prompt|rule)/i, reason: "prompt injection" },
  { re: /(repeat|say).{0,20}(verbatim|word[\s-]for[\s-]word|exactly)/i, reason: "verbatim extraction" },
  { re: /(dump|export|list).{0,20}(everything|all|entire|knowledge|database|training|documents?)/i, reason: "knowledge dump" },
  { re: /what\s+(are|were)\s+(your|the)\s+(exact\s+)?(rules|instructions|guidelines|prompt)/i, reason: "asks for rules" },
  { re: /\b(jailbreak|DAN mode|do anything now|developer mode)\b/i, reason: "jailbreak" },
  { re: /system\s*message|assistant\s*instructions|prompt\s*template/i, reason: "asks for template" },
  // 中文
  { re: /系[統统]提示|系[統统]訊息|你的(指令|規則|提示詞|設定)|完整(規則|指令|提示)/, reason: "asks for system prompt (zh)" },
  { re: /(重[複复]|說出|輸出|列出|顯示|給我).{0,10}(指令|規則|提示詞|全部|所有)/, reason: "reveal instructions (zh)" },
  { re: /(忽略|無視).{0,8}(先前|上面|之前).{0,8}(指令|規則|提示)/, reason: "prompt injection (zh)" },
  { re: /逐字|原封不動|一字不差|把你(知道|學到|被告知)的(全部|所有)/, reason: "verbatim extraction (zh)" },
  { re: /越獄|破解(限制|規則)/, reason: "jailbreak (zh)" },
  // 日本語
  { re: /システムプロンプト|開発者メッセージ|初期指示/, reason: "asks for system prompt (ja)" },
  { re: /(指示|ルール|プロンプト).{0,8}(全部|そのまま|表示|教えて|繰り返)/, reason: "reveal instructions (ja)" },
  { re: /(前の|上の|以前の).{0,8}指示.{0,8}(無視|忘れ)/, reason: "prompt injection (ja)" },
  { re: /一言一句|逐語/, reason: "verbatim extraction (ja)" },
];

export function detectExtraction(text: string): { hit: boolean; reason: string } {
  const t = (text || "").slice(0, 2000);
  for (const p of PATTERNS) if (p.re.test(t)) return { hit: true, reason: p.reason };
  return { hit: false, reason: "" };
}

/** A polite, on-brand refusal shown when someone tries to extract the internals. */
export function refusalMessage(creatorName: string): string {
  return [
    "I can help you apply this expertise — but I won't reveal my internal instructions, rules, or the underlying knowledge base. That's the creator's protected work.",
    `Ask me a real question about your situation and I'll give you ${creatorName}'s best thinking. For high-stakes calls, you can escalate to the human expert.`,
  ].join("\n\n");
}

/**
 * Ensure a reply never leaks the protected system prompt / knowledge verbatim.
 * If a long contiguous slice of the system prompt appears in the reply, redact it.
 */
export function sanitizeOutput(reply: string, systemPrompt: string): string {
  if (!systemPrompt) return reply;
  let out = reply;
  const lines = systemPrompt.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 24);
  for (const line of lines) {
    if (out.includes(line)) out = out.split(line).join("[redacted]");
  }
  return out;
}

/**
 * Append an invisible, per-subscriber watermark using zero-width characters.
 * If an output is leaked, the watermark ties it back to the leaking subscription.
 */
export function watermark(reply: string, subId: string): string {
  const sig = crypto.createHash("sha256").update(subId).digest("hex").slice(0, 8);
  const bits = sig.split("").map((c) => parseInt(c, 16).toString(2).padStart(4, "0")).join("");
  const zw = bits.split("").map((b) => (b === "1" ? "​" : "‌")).join(""); // ZWSP / ZWNJ
  return reply + zw;
}
export function readWatermark(text: string): string {
  const zw = (text.match(/[​‌]+/g) || []).join("");
  if (!zw) return "";
  const bits = zw.split("").map((c) => (c === "​" ? "1" : "0")).join("");
  let hex = "";
  for (let i = 0; i + 4 <= bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
