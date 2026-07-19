// Abstain-over-bluff — Product Master §3.3 & §10.6.
// The avatar should say "ask a human" rather than confidently answer outside
// the expert's stance. Abstention is a *marketed* feature, not a failure.

export type AbstainDecision = { abstain: boolean; reason: "out_of_scope" | "needs_human" | "none" };

const STOP = new Set(("the a an of to and or for in on at is are be with how what why when who "
  + "i you my your our we can do does will would should could this that these those it as by from "
  + "please help me about into over under not no yes if then than").split(" "));

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+|[一-鿿]|[぀-ヿ]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w));
}

// Demands a guaranteed/definitive ruling — an expert abstains and routes to a human.
const OVERREACH = /\b(guarantee|guaranteed|100%|definitely will|will i win|is it legal|am i liable|sue|lawsuit|diagnos|prescri)\b|保證|絕對|一定會|是否合法|會不會贏|確診|處方|絶対|確実に|診断|処方/i;

/**
 * Decide whether to abstain. Out-of-scope = the question shares no vocabulary
 * with the agent's domain (category + name + features + description). Overreach
 * = a demand for a definitive/regulated guarantee, especially on regulated agents.
 */
export function shouldAbstain(
  agent: { name: string; category: string; features: string[]; description?: string; regulated?: boolean },
  message: string
): AbstainDecision {
  const msg = message.trim();
  if (msg.length < 3) return { abstain: false, reason: "none" };

  if (OVERREACH.test(msg) && (agent.regulated ?? false)) return { abstain: true, reason: "needs_human" };

  const domain = new Set(tokens([agent.name, agent.category, agent.description || "", ...(agent.features || [])].join(" ")));
  const qs = tokens(msg);
  if (qs.length >= 4) {
    const overlap = qs.filter((w) => domain.has(w)).length;
    // substantive question, essentially no shared domain vocabulary → out of scope
    if (overlap === 0) return { abstain: true, reason: "out_of_scope" };
  }
  return { abstain: false, reason: "none" };
}

/** Localised abstention reply that points the buyer to the human expert. */
export function abstentionReply(
  agent: { creatorName: string },
  reason: AbstainDecision["reason"],
  lang: "en" | "ja" | "zh" = "en"
): string {
  const L = (en: string, ja: string, zh: string) => (lang === "ja" ? ja : lang === "zh" ? zh : en);
  if (reason === "needs_human") {
    return L(
      `This is exactly the kind of question that deserves a real person, not a confident guess. I won't give you a definitive ruling on something this consequential — instead, escalate it to ${agent.creatorName} below for a named, accountable answer you can actually rely on.`,
      `これは自信ありげな推測ではなく、実在の専門家が答えるべき問いです。これほど重大な事柄に断定はしません。下から ${agent.creatorName} 本人へエスカレーションし、責任の伴う回答を得てください。`,
      `這正是該由真人、而非自信猜測來回答的問題。對這麼重大的事我不會給你一個「斬釘截鐵」的結論——請於下方升級給 ${agent.creatorName} 本人，取得具名、可負責、你能真正依靠的答案。`
    );
  }
  return L(
    `That sits outside what I'm built to judge well, and I'd rather tell you that than bluff. If it's important, escalate to ${agent.creatorName} — a real expert who can point you to the right person. Answering with humility is the whole point.`,
    `それは私が的確に判断できる範囲の外です。取り繕うより正直にお伝えします。重要なら ${agent.creatorName} へエスカレーションを。適切な専門家へ繋ぎます。謙虚に答えることこそが本質です。`,
    `這超出我能可靠判斷的範圍，我寧可誠實告訴你，也不願硬答。若這件事重要，請升級給 ${agent.creatorName}——真正的專家能把你導向對的人。懂得說「該問人了」正是價值所在。`
  );
}
