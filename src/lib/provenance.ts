// Provenance receipt — Product Master §3.1: every answer carries a dated
// knowledge-base snapshot, its source frame, the named human behind it, a
// safety-scan status, and an honest grounded/inferred label. Trust becomes
// visible, not asserted. All copy obeys the Appendix honesty rules:
// informational — method + a human in the loop, never licensed advice.

export type Grounding = "grounded" | "inferred" | "abstained";

export type Provenance = {
  snapshotVersion: string;   // e.g. "v4 · 2026-07"
  snapshotDate: string;      // ISO date of the KB snapshot
  expertName: string;        // named human accountable
  safety: "clean" | "pending" | "flagged";
  grounding: Grounding;      // honest tri-state
  fidelity: number;          // 0 = not yet measured (illustrative)
  regulated: boolean;        // surfaces the jurisdiction/advice disclaimer
  category: string;
};

type AgentLike = {
  creatorName: string;
  category: string;
  updatedLabel?: string;
  fidelityScore?: number;
  regulated?: boolean;
  knowledgeVersions?: { version: string; createdAt: Date | string; scanStatus?: string }[];
};

/** Derive a provenance receipt for an answer from an agent + its latest KB version. */
export function buildProvenance(agent: AgentLike, grounding: Grounding = "grounded"): Provenance {
  const kv = agent.knowledgeVersions && agent.knowledgeVersions[0];
  const date = kv ? new Date(kv.createdAt) : new Date();
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const version = kv?.version ? `${kv.version} · ${ym}` : `snapshot · ${ym}`;
  const scan = kv?.scanStatus;
  const safety: Provenance["safety"] = scan === "infected" || scan === "suspicious" ? "flagged" : scan === "pending" ? "pending" : "clean";
  return {
    snapshotVersion: version,
    snapshotDate: date.toISOString().slice(0, 10),
    expertName: agent.creatorName,
    safety,
    grounding,
    fidelity: agent.fidelityScore ?? 0,
    regulated: !!agent.regulated,
    category: agent.category,
  };
}

/** Localised labels for the receipt (en / ja / zh). */
export function provenanceLabels(p: Provenance, locale: "en" | "ja" | "zh" = "en") {
  const L = (en: string, ja: string, zh: string) => (locale === "ja" ? ja : locale === "zh" ? zh : en);
  const grounding =
    p.grounding === "grounded" ? L("Grounded in the expert's corpus", "専門家のコーパスに基づく", "依據專家知識庫")
    : p.grounding === "inferred" ? L("Model-inferred — verify before relying", "モデル推論 — 依拠前に確認を", "模型推論 — 採用前請查證")
    : L("Abstained — routed to the human", "回答保留 — 専門家へ", "已保留 — 轉交真人");
  const safety =
    p.safety === "clean" ? L("Safety scan: clean", "安全スキャン：問題なし", "安全掃描：正常")
    : p.safety === "pending" ? L("Safety scan: pending", "安全スキャン：確認中", "安全掃描：待確認")
    : L("Safety scan: flagged", "安全スキャン：要確認", "安全掃描：已標記");
  const fidelity =
    p.fidelity > 0 ? L(`Fidelity ${p.fidelity}% (illustrative)`, `忠実度 ${p.fidelity}%（参考値）`, `擬真度 ${p.fidelity}%（示意）`)
    : L("Fidelity: not yet measured", "忠実度：未計測", "擬真度：尚未量測");
  const advice = p.regulated
    ? L("Informational only — method plus a human in the loop, not licensed advice. Gated by jurisdiction.",
        "情報提供のみ — 手法＋人によるレビューであり、有資格者の助言ではありません。管轄ごとに制限。",
        "僅供參考 — 方法加真人把關，非受監管的專業建議；依司法管轄限制。")
    : L("Informational — a real expert's method and judgment, not a licensed opinion.",
        "情報提供 — 実在する専門家の手法と判断であり、有資格者の意見ではありません。",
        "僅供參考 — 真實專家的方法與判斷，非受監管的正式意見。");
  return {
    snapshot: L(`Knowledge snapshot ${p.snapshotVersion}`, `ナレッジ・スナップショット ${p.snapshotVersion}`, `知識庫快照 ${p.snapshotVersion}`),
    expert: L(`Accountable expert: ${p.expertName}`, `責任を負う専門家：${p.expertName}`, `具名負責專家：${p.expertName}`),
    grounding, safety, fidelity, advice,
    header: L("Receipts", "証跡", "答案憑證"),
  };
}

/** A compact plain-text provenance footer for MCP / non-UI channels. */
export function provenanceText(p: Provenance, locale: "en" | "ja" | "zh" = "en"): string {
  const x = provenanceLabels(p, locale);
  return [`— ${x.header} —`, x.snapshot, x.expert, x.grounding, x.safety, x.fidelity, x.advice].join("\n");
}
