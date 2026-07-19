// The fidelity harness (Product Master §4.1).
//
// "100% fidelity" is not an honest claim, so we don't make it. Instead we MEASURE:
// the expert supplies held-out questions with their OWN real answers; the avatar
// answers the same questions blind; we score how closely it tracks the expert.
//
// The score is only ever shown when a run exists — otherwise the product says
// "not yet measured". Methodology is stated plainly so a buyer can judge it.
export type SampleScore = {
  question: string;
  agentAnswer: string;
  expertAnswer: string;
  overlap: number;     // shared substantive vocabulary
  coverage: number;    // how much of the expert's key content the avatar reproduced
  stance: number;      // did it reach the same conclusion-bearing terms
  score: number;       // 0-100 for this sample
};

const STOP = new Set(("the a an of to and or for in on at is are be with how what why when who i you my your our we "
  + "can do does will would should could this that these those it as by from please help me about into over under "
  + "not no yes if then than there their them they he she его は の に を が と で も です ます 的 是 在 了 和 有 我 你 他 這 那 就 不 也 都").split(/\s+/));

/**
 * Tokenize for scoring. Latin words are taken whole; CJK has no spaces, so we take
 * character BIGRAMS within each CJK run — single characters are too coarse to carry
 * meaning, and using them made stance-agreement score 0 for every Chinese/Japanese
 * expert. Bigrams give CJK the same substantive granularity Latin words have.
 */
function tokens(s: string): string[] {
  const str = String(s || "").toLowerCase();
  const latin = (str.match(/[a-z0-9]{2,}/g) || []).filter((w) => !STOP.has(w));
  const cjk: string[] = [];
  for (const run of str.match(/[一-鿿぀-ヿ]+/g) || []) {
    for (let i = 0; i < run.length - 1; i++) cjk.push(run.slice(i, i + 2));
  }
  return [...latin, ...cjk.filter((w) => !STOP.has(w))];
}
function setOf(s: string) { return new Set(tokens(s)); }

/** Terms that carry a conclusion — agreement here matters more than prose style. */
function stanceTerms(s: string): Set<string> {
  const str = String(s || "").toLowerCase();
  const latinStrong = (str.match(/[a-z0-9]{5,}/g) || []).filter((w) => !STOP.has(w));
  const cjk: string[] = [];
  for (const run of str.match(/[一-鿿぀-ヿ]+/g) || []) {
    for (let i = 0; i < run.length - 1; i++) cjk.push(run.slice(i, i + 2));  // CJK bigrams are already substantive
  }
  return new Set([...latinStrong, ...cjk.filter((w) => !STOP.has(w))]);
}

export function scoreSample(question: string, agentAnswer: string, expertAnswer: string): SampleScore {
  const A = setOf(agentAnswer), E = setOf(expertAnswer);
  const inter = [...E].filter((w) => A.has(w)).length;
  const union = new Set([...A, ...E]).size || 1;

  const overlap = inter / union;                                  // Jaccard — style-sensitive, weighted low
  const coverage = E.size ? inter / E.size : 0;                   // did it say what the expert said — weighted high
  const Es = stanceTerms(expertAnswer), As = stanceTerms(agentAnswer);
  const sInter = [...Es].filter((w) => As.has(w)).length;
  const stance = Es.size ? sInter / Es.size : 0;                  // conclusion-bearing agreement

  const score = Math.round(100 * (0.2 * overlap + 0.45 * coverage + 0.35 * stance));
  return {
    question,
    agentAnswer: agentAnswer.slice(0, 400),
    expertAnswer: expertAnswer.slice(0, 400),
    overlap: Math.round(overlap * 100),
    coverage: Math.round(coverage * 100),
    stance: Math.round(stance * 100),
    score: Math.max(0, Math.min(100, score)),
  };
}

export function aggregate(scores: SampleScore[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length);
}

/** Stated plainly to the buyer — no black box. */
export const METHOD_NOTE = {
  en: "Measured by asking the avatar held-out questions the expert has already answered themselves, then scoring how much of the expert's substance and conclusions it reproduces. Style is weighted lightly; conclusions heavily.",
  ja: "専門家自身が既に回答した「取り置き」の質問をアバターに投げ、専門家の内容と結論をどれだけ再現できるかで採点します。文体は軽く、結論は重く評価します。",
  zh: "做法：把專家「本人已回答過」的保留題目丟給化身作答，再評分它重現了多少專家的實質內容與結論。文風權重低，結論權重高。",
};
export const MIN_SAMPLES = 3;
