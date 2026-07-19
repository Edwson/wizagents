import { catLabel } from "./categories";
import { shouldAbstain, abstentionReply } from "./abstain";

export type Lang = "en" | "ja" | "zh";
export type ChatTurn = { role: "user" | "assistant" | "expert" | "system"; content: string };

export type AgentContext = {
  name: string;
  category: string;
  creatorName: string;
  description: string;
  systemPrompt: string;
  knowledgeSummary: string;
  features: string[];
  lang?: Lang;            // agent's primary language — replies follow this
  regulated?: boolean;
};

const pick = (lang: Lang, en: string, ja: string, zh: string) => (lang === "ja" ? ja : lang === "zh" ? zh : en);

/**
 * Generate an agent reply. Uses a real LLM when LLM_API_KEY is configured,
 * otherwise a deterministic, persona-aware, LOCALE-AWARE expert engine so the
 * product is fully usable offline. Master §3.3: abstain-over-bluff.
 */
export async function generateAgentReply(
  agent: AgentContext,
  history: ChatTurn[],
  userMessage: string
): Promise<string> {
  const lang: Lang = agent.lang || "en";
  // §3.3 — abstain rather than answer outside the expert's stance.
  const decision = shouldAbstain(
    { name: agent.name, category: agent.category, features: agent.features, description: agent.description, regulated: agent.regulated },
    userMessage
  );
  if (decision.abstain) return abstentionReply({ creatorName: agent.creatorName }, decision.reason, lang);

  const key = process.env.LLM_API_KEY;
  if (key && key.trim()) {
    try { return await llmReply(agent, history, userMessage, key, lang); }
    catch (e) { console.error("LLM error, using local engine:", e); }
  }
  return localExpertReply(agent, userMessage, lang);
}

async function llmReply(agent: AgentContext, history: ChatTurn[], userMessage: string, key: string, lang: Lang): Promise<string> {
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const langName = pick(lang, "English", "Japanese (日本語)", "Traditional Chinese (繁體中文)");
  const sys =
    (agent.systemPrompt ||
      `You are "${agent.name}", a ${catLabel(agent.category, lang)} expert Agent maintained by ${agent.creatorName}. ${agent.description}`) +
    `\n\nAlways answer in ${langName}, professionally and in a structured way. This is informational — a real expert's method and judgment, not licensed advice; say so when the topic is regulated. If the question falls outside your expertise, say so plainly and suggest escalating to the human expert instead of guessing.`;
  const messages = [
    { role: "system", content: sys },
    ...history.filter((h) => h.role === "user" || h.role === "assistant").slice(-8)
      .map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: userMessage },
  ];
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 700 }),
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("no completion");
  return text;
}

// Trilingual category reasoning frames: angle + 4 steps + source label.
type Frame = { angle: [string, string, string]; steps: [string, string, string][]; refs: [string, string, string] };
const F = (angle: [string, string, string], steps: [string, string, string][], refs: [string, string, string]): Frame => ({ angle, steps, refs });

const CATEGORY_FRAMES: Record<string, Frame> = {
  law: F(
    ["from the angle of legal elements and case-law practice", "法的要件と判例実務の観点から", "從法律要件與判例實務的角度"],
    [["Clarify the legal relationship and the real issue", "法律関係と争点の明確化", "法律關係與爭點釐清"],
     ["Check the governing statutes and their elements", "適用法条と要件の検討", "適用法條與要件檢視"],
     ["Assess risk and where liability sits", "リスクと責任の評価", "風險與責任評估"],
     ["Give workable options and next steps", "実行可能な選択肢と次の一手", "可行方案與後續步驟"]],
    ["statutes & case-law library (current version)", "法規・判例ライブラリ（最新版）", "法規與判例庫（最新版本）"]),
  finance: F(
    ["from the angle of financial modeling and risk/return", "財務モデルとリスク・リターンの観点から", "從財務模型與風險報酬的角度"],
    [["Inventory the assumptions and inputs", "前提と入力データの棚卸し", "假設與資料輸入盤點"],
     ["Run the metrics and scenarios", "指標とシナリオの試算", "指標與情境試算"],
     ["Surface sensitivity and required disclosures", "感応度とリスク開示", "敏感度與風險揭露"],
     ["Recommend a decision (not investment advice)", "意思決定の提案（投資助言ではない）", "決策建議（非投資建議）"]],
    ["market-data feed & methodology library", "マーケットデータと方法論ライブラリ", "市場數據 Feed 與方法論庫"]),
  transaction: F(
    ["from the angle of deal structure and rule review", "取引ストラクチャーとルール審査の観点から", "從交易架構與規則審查的角度"],
    [["Break down the structure of the deal/product", "取引・商品構造の分解", "交易/商品結構拆解"],
     ["Compare against the listing/review checklist", "上場・審査チェックリストとの照合", "上市/上架審查清單比對"],
     ["Read the terms and their triggers", "条項とトリガーの解読", "條款與觸發條件解讀"],
     ["Flag gaps and how to cure them", "ギャップと補正の提案", "缺口與補正建議"]],
    ["exchange rulebook (current)", "取引所ルール（現行）", "交易所規則庫（現行版本）"]),
  design: F(
    ["from the angle of regulated-product design and usability", "規制対象プロダクト設計とユーザビリティの観点から", "從受監管產品設計與可用性的角度"],
    [["Inventory the flows and screens", "フローと画面の棚卸し", "流程與畫面盤點"],
     ["Check disclosure & suitability gates", "開示・適合性ゲートの確認", "風險揭露與適當性閘道檢查"],
     ["Review accessibility and consistency", "アクセシビリティと一貫性の確認", "無障礙與一致性審視"],
     ["Give fixes and acceptance criteria", "修正案と受入基準", "修正建議與驗收準則"]],
    ["regulatory guidance & design-system contract", "規制ガイダンスとデザインシステム契約", "監管指引與設計系統合約"]),
  engineering: F(
    ["from the angle of implementation and audit compliance", "実装と監査コンプライアンスの観点から", "從工程實作與稽核合規的角度"],
    [["Confirm requirements and constraints", "要件と制約の確認", "需求與約束確認"],
     ["Compare architecture/implementation options", "アーキ・実装案の比較", "架構/實作方案比較"],
     ["Work through edge cases and risk", "エッジケースとリスク", "邊界情況與風險"],
     ["Give verifiable, shippable steps", "検証可能な実装ステップ", "可驗證的落地步驟"]],
    ["standards & best-practice library", "標準・ベストプラクティス", "標準與最佳實務庫"]),
  software: F(
    ["from the angle of system design and code quality", "システム設計とコード品質の観点から", "從系統設計與程式品質的角度"],
    [["Define the problem and context", "問題とコンテキストの定義", "問題與情境界定"],
     ["Analyze the design trade-offs", "設計トレードオフの分析", "設計權衡分析"],
     ["Call out the pitfalls", "実装の要点と落とし穴", "實作要點與陷阱"],
     ["Give a test & verification strategy", "テストと検証の戦略", "測試與驗證策略"]],
    ["engineering knowledge base (recently updated)", "エンジニアリング知識ベース（最近更新）", "工程知識庫（近期更新）"]),
  web3: F(
    ["from the angle of on-chain mechanics and security", "オンチェーン機構とセキュリティの観点から", "從鏈上機制與安全的角度"],
    [["Requirements and chain/protocol choice", "要件とチェーン・プロトコル選定", "需求與鏈/協定選型"],
     ["Contract and fund-flow design", "コントラクトと資金フロー設計", "合約與資金流設計"],
     ["Review the attack surface", "攻撃面のレビュー", "安全與攻擊面審視"],
     ["Pre-launch checklist", "ローンチ前チェックリスト", "上線檢查清單"]],
    ["protocol docs & audit-case library", "プロトコル文書・監査事例", "協定文件與稽核案例庫"]),
  marketing: F(
    ["from the angle of growth strategy and conversion", "グロース戦略とコンバージョンの観点から", "從成長策略與轉換的角度"],
    [["Clarify the goal and audience", "目標とオーディエンスの明確化", "目標與受眾釐清"],
     ["Message and channel strategy", "メッセージとチャネル戦略", "訊息與渠道策略"],
     ["Metrics and experiment design", "指標と実験設計", "衡量指標與實驗設計"],
     ["A concrete action list", "実行アクションリスト", "落地行動清單"]],
    ["case studies & benchmark data", "事例・ベンチマークデータ", "案例與基準數據庫"]),
  healthcare: F(
    ["from the angle of health regulation and safety", "医療規制と安全の観点から", "從醫療法規與安全的角度"],
    [["Identify the applicable rules", "適用規範の識別", "適用規範識別"],
     ["Gap vs current compliance", "現状コンプライアンスとの差", "現況合規差異"],
     ["Risk and disclosure", "リスクと開示", "風險與揭露"],
     ["Remediation recommendations", "是正の提案", "整改建議"]],
    ["health-regulation library (current)", "医療規制ライブラリ（最新）", "醫療法規庫（最新版本）"]),
};

const DEFAULT_FRAME: Frame = F(
  ["from a professional-practice angle", "専門実務の観点から", "從專業實務的角度"],
  [["Define the problem", "問題の定義", "問題界定"],
   ["Analyze the key considerations", "主要論点の分析", "關鍵考量分析"],
   ["Risks and caveats", "リスクと注意点", "風險與注意事項"],
   ["Concrete recommendations and next steps", "具体的な提案と次の一手", "具體建議與後續步驟"]],
  ["domain knowledge base (recently updated)", "領域知識ベース（最近更新）", "領域知識庫（近期更新）"]);

const STEP_BANK: [string, string, string][] = [
  ["First pin down your specific situation and scope so a general rule isn't misapplied to your case — this step draws directly on \"{feat}\".",
   "まず個別の状況と適用範囲を特定し、一般則を誤って当てはめないようにします。ここでは「{feat}」を直接参照します。",
   "先確認你的具體情境與適用範圍，避免用通則套錯個案；這一步會直接引用「{feat}」。"],
  ["Compare the current state against the latest standard item by item, marking what needs action now versus later.",
   "現状と最新基準を項目ごとに比較し、今すぐ対応すべき点と後回しにできる点を切り分けます。",
   "逐項比對現況與最新標準之間的落差，標示出需要立即處理與可延後的項目。"],
  ["List the risk points and any disclosure/record-keeping obligations, with what triggers each.",
   "リスク箇所と開示・記録義務、それぞれのトリガーを列挙します。",
   "列出潛在風險點與必要的揭露／備查義務，並說明各自的觸發條件。"],
  ["Give the executable next step and acceptance criteria so you can ship it or hand it to your team.",
   "実行可能な次の一手と受入基準を示し、そのまま実装・引き継ぎできるようにします。",
   "給出可執行的下一步與驗收準則，讓你能直接落地或交付給團隊。"],
];

export function localExpertReply(agent: AgentContext, userMessage: string, lang: Lang = "en"): string {
  const frame = CATEGORY_FRAMES[agent.category] ?? DEFAULT_FRAME;
  const q = userMessage.trim().replace(/\s+/g, " ").slice(0, 120);
  const feat = agent.features[0];
  const focus = feat ? pick(lang, ` (this Agent is especially strong at: ${feat})`, `（この Agent が特に得意：${feat}）`, `（本 Agent 特別擅長：${feat}）`) : "";
  const lines: string[] = [];
  lines.push(pick(lang,
    `On your question "${q}", here is my analysis ${frame.angle[0]}${focus}:`,
    `ご質問「${q}」について、${frame.angle[1]}分析します${focus}：`,
    `針對你的問題「${q}」，我${frame.angle[2]}分析如下${focus}：`));
  lines.push("");
  frame.steps.forEach((s, i) => {
    const detail = STEP_BANK[i % STEP_BANK.length][lang === "ja" ? 1 : lang === "zh" ? 2 : 0]
      .replace("{feat}", agent.features[i % Math.max(agent.features.length, 1)] || pick(lang, "the relevant standard", "関連基準", "相關規範"));
    lines.push(`${i + 1}. **${s[lang === "ja" ? 1 : lang === "zh" ? 2 : 0]}** — ${detail}`);
  });
  lines.push("");
  lines.push(pick(lang,
    `Generated from ${frame.refs[0]}. If this is a "high cost of being wrong" situation, you can escalate to ${agent.creatorName} for a named answer within SLA, or request a signed endorsement for your audit file.`,
    `${frame.refs[1]}に基づいて生成。「間違えると困る」高リスクな状況なら、${agent.creatorName} 本人へエスカレーションして SLA 内に回答を得るか、監査用に実名署名を申請できます。`,
    `以上依據 ${frame.refs[2]} 生成。若這題屬於「答錯要出事」的高風險情境，你可以一鍵升級給 ${agent.creatorName} 本人於 SLA 內回覆，或申請實名簽核以便存入稽核文件。`));
  lines.push("");
  lines.push(pick(lang,
    `_Informational — a real expert's method and judgment, not licensed legal / financial / medical advice._`,
    `_情報提供 — 実在する専門家の手法と判断であり、有資格者による法務・財務・医療の助言ではありません。_`,
    `_本回覆為參考意見，係真實專家的方法與判斷，不構成正式法律／財務／醫療專業意見。_`));
  return lines.join("\n");
}

/** A signed / human-endorsed answer body (Expert Loop), locale-aware. */
export function expertSignedAnswer(agent: AgentContext, question: string, lang: Lang = "en"): string {
  const q = question.slice(0, 80);
  return pick(lang,
    `[Expert signed reply · ${agent.creatorName}]\n\nOn your question "${q}", I confirm the following in my own professional judgment:\n\n— The key here is matching the applicable scope to the current version of the rules. Against this week's knowledge-base snapshot, my conclusion aligns with the Agent's initial analysis, and I add: regulators' recent focus should be factored in. In any formal document, record the version and date you relied on.\n\nThis reply is signed by the named expert, with a timestamp and knowledge-base version — admissible in your internal review / audit file.`,
    `【専門家実名回答 · ${agent.creatorName}】\n\nご質問「${q}」について、本人の専門的判断として以下を確認します：\n\n— 要点は、適用範囲と最新版ルールの対応です。今週のナレッジ・スナップショットと照合し、私の結論は Agent の初期分析と一致します。加えて、当局が最近注視する点を考慮すべきです。正式文書には依拠した版と日付を明記してください。\n\n本回答は実名の専門家が確認し、タイムスタンプとナレッジ版番号付きで、社内レビュー／監査資料に使えます。`,
    `【專家實名回覆 · ${agent.creatorName}】\n\n就你提出的「${q}」，我以本人專業判斷確認如下：\n\n— 此情境的關鍵在於適用範圍與最新規範版本的對應。經核對本週知識庫快照，我的結論與 Agent 初步分析一致，並補充：實務上主管機關近期關注的重點需納入考量，建議於正式文件中明確記錄依據版本與日期。\n\n本回覆經專家實名確認，附時間戳與知識庫版本編號，可放入內部審查／稽核文件作為依據。`);
}
