type Lang = "en" | "ja" | "zh";
const L = (lang: Lang, en: string, ja: string, zh: string) => (lang === "ja" ? ja : lang === "zh" ? zh : en);

export type CouncilAnswer = { slug: string; name: string; creatorName: string; type: string; reply: string };

/**
 * Triangulation summary across multiple expert avatars answering the same question.
 * Honest and lightweight: it frames how to read several genuine viewpoints, not a
 * fake "consensus score". The value is more angles, more objectively.
 */
export function synthesize(answers: CouncilAnswer[], lang: Lang = "en"): string {
  const n = answers.length;
  const names = answers.map((a) => a.creatorName).filter((v, i, s) => s.indexOf(v) === i);
  const intro = L(lang,
    `You consulted ${n} independent expert avatars. Each answers from their own corpus and stance, so treat this as triangulation — more angles on the same decision, not a single averaged voice.`,
    `${n} 名の独立した専門家アバターに相談しました。それぞれ独自のコーパスと立場から答えます。単一の平均ではなく、複数の角度からの三角測量として扱ってください。`,
    `你諮詢了 ${n} 位獨立的專家化身。每一位都從自己的知識庫與立場出發回答，請把這當作「三角驗證」——對同一個決定的多個角度，而非一個被平均掉的聲音。`);
  const how = L(lang,
    "Where they agree, confidence is higher. Where they diverge, that is exactly the 5% worth a human escalation or a signed endorsement before you act.",
    "一致する部分は確度が高い。分かれる部分こそ、行動前に人へのエスカレーションや署名付きエンドースメントに値する 5% です。",
    "他們一致的地方，信心較高；他們分歧的地方，正是行動前值得升級真人、或申請實名背書的那 5%。");
  const who = names.length ? L(lang, `Named experts on the record: ${names.join(", ")}.`, `記録に残る専門家：${names.join("、")}。`, `具名負責的專家：${names.join("、")}。`) : "";
  return `${intro}\n\n${how}\n\n${who}`;
}
