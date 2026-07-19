"use client";
import { useCallback, useEffect, useState } from "react";
import { IconTargetArrow, IconFlask, IconPlus, IconTrash, IconRefresh } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, Badge, SectionLabel, Progress } from "@/components/ui";

type SampleScore = {
  question: string; agentAnswer: string; expertAnswer: string;
  overlap: number; coverage: number; stance: number; score: number;
};
type Sample = { id: string; question: string; expertAnswer: string };
type Run = { id: string; score: number; samples: number; createdAt: string; detail: SampleScore[] };
type Method = { en: string; ja: string; zh: string };
type State = {
  minSamples: number;
  method: Method | null;
  samples: Sample[];
  runs: Run[];
  current: { score: number; measuredAt: string | null; samples: number };
};

const EMPTY: State = { minSamples: 3, method: null, samples: [], runs: [], current: { score: 0, measuredAt: null, samples: 0 } };

export default function FidelityPanel({ slug }: { slug: string }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();

  const [state, setState] = useState<State>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [expertAnswer, setExpertAnswer] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState(false);
  const [removing, setRemoving] = useState("");
  const [lastRun, setLastRun] = useState<Run | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/fidelity/${slug}`, { cache: "no-store" });
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setState({
        minSamples: d.minSamples ?? 3,
        method: d.method ?? null,
        samples: d.samples ?? [],
        runs: d.runs ?? [],
        current: d.current ?? EMPTY.current,
      });
      if (!lastRun && d.runs?.length) setLastRun(d.runs[0]);
    } catch { /* leave empty — the panel degrades to its explanatory state */ }
    setLoading(false);
  }, [slug, lastRun]);

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`/api/fidelity/${slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, data: d as any };
  }

  async function addSample() {
    setErr(""); setAdding(true);
    const { ok, data } = await post({ action: "add", question: question.trim(), expertAnswer: expertAnswer.trim() });
    setAdding(false);
    if (!ok) { setErr(String(data?.error || t("Could not add the sample.", "サンプルを追加できませんでした。", "無法新增樣本。"))); return; }
    setQuestion(""); setExpertAnswer("");
    toast(t("Held-out answer added", "取り置きの回答を追加しました", "已新增保留答案"), "success");
    await load();
  }

  async function removeSample(id: string) {
    setRemoving(id);
    const { ok } = await post({ action: "remove", id });
    setRemoving("");
    if (!ok) { toast(t("Could not remove the sample.", "サンプルを削除できませんでした。", "無法刪除樣本。"), "error"); return; }
    await load();
  }

  async function run() {
    setErr(""); setRunning(true);
    const { ok, data } = await post({ action: "run" });
    setRunning(false);
    if (!ok) {
      setErr(String(data?.error || t("The measurement run failed.", "計測の実行に失敗しました。", "量測執行失敗。")));
      toast(t("Measurement did not run", "計測は実行されませんでした", "未執行量測"), "error");
      return;
    }
    setLastRun({ ...data.run, createdAt: new Date().toISOString() });
    toast(t(`Measured: ${data.run.score}%`, `計測しました：${data.run.score}%`, `已量測：${data.run.score}%`), "success");
    await load();
  }

  const methodNote = state.method ? state.method[locale] ?? state.method.en : "";
  const n = state.samples.length;
  const enough = n >= state.minSamples;
  const measured = state.current.score > 0;
  const dateLabel = state.current.measuredAt
    ? new Date(state.current.measuredAt).toLocaleDateString(locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-TW" : "en-US",
        { year: "numeric", month: "short", day: "numeric" })
    : "";

  return (
    <div className="rounded-lg border border-purple/20 bg-panel2/40 p-3">
      {/* The honest frame, stated before anything else. */}
      <div className="flex items-start gap-2.5">
        <IconTargetArrow size={16} stroke={1.7} className="mt-0.5 shrink-0 text-purple" />
        <div>
          <div className="font-display text-[12.5px] font-bold text-text">
            {t("We don't claim 100% fidelity. We measure it.",
               "「再現度100%」とは謳いません。計測します。",
               "我們不宣稱「100% 還原」。我們量測它。")}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            {t("You supply questions you have already answered yourself. Your avatar answers the same questions blind — it never sees your answer. We score how much of your substance and your conclusions it reproduces. Until a run exists, the page says \"not yet measured\", and that is fine.",
               "あなた自身が既に回答した質問を登録します。アバターは同じ質問にブラインドで回答し、あなたの回答は決して見ません。あなたの内容と結論をどれだけ再現できたかを採点します。実行前は「未計測」と表示されます。それで構いません。",
               "你提供你本人已經回答過的問題。你的化身在看不到你答案的情況下回答同一批題目，我們評分它重現了多少你的實質內容與結論。在跑過之前，頁面就寫「尚未量測」，這樣很好。")}
          </p>
          {methodNote && (
            <p className="mt-1.5 rounded-md border border-glassborder/15 bg-panel/40 px-2.5 py-1.5 text-[10.5px] leading-5 text-faint">
              <span className="text-muted">{t("Method shown to buyers", "購入者に開示する手法", "向買方公開的方法")}:</span> {methodNote}
            </p>
          )}
        </div>
      </div>

      {/* Current measured state — never a fabricated number. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-glassborder/15 pt-3">
        {measured ? (
          <>
            <Badge tone="cyan"><IconTargetArrow size={12} stroke={1.7} /> {t(`Fidelity ${state.current.score}%`, `再現度 ${state.current.score}%`, `還原度 ${state.current.score}%`)}</Badge>
            <span className="text-[10.5px] text-faint">
              {t(`measured against ${state.current.samples} held-out answers${dateLabel ? ` on ${dateLabel}` : ""}`,
                 `${state.current.samples} 件の取り置き回答で計測${dateLabel ? `（${dateLabel}）` : ""}`,
                 `以 ${state.current.samples} 則保留答案量測${dateLabel ? `（${dateLabel}）` : ""}`)}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-faint">{t("Fidelity: not yet measured", "再現度：未計測", "還原度：尚未量測")}</span>
        )}
      </div>

      {/* Why an expert should bother. */}
      <p className="mt-2 text-[10.5px] leading-5 text-faint">
        {t("A measured score is what lets a buyer trust the avatar is you — rather than taking your word for it.",
           "計測されたスコアがあってはじめて、購入者は「このアバターはあなただ」と信じられます。言葉だけでは足りません。",
           "有量測過的分數，買方才能相信這個化身確實是你——而不是只憑你一句話。")}
      </p>

      {/* Held-out samples */}
      <div className="mt-3 border-t border-glassborder/15 pt-3">
        <SectionLabel>{t("Held-out answers", "取り置きの回答", "保留答案")}</SectionLabel>
        {loading ? (
          <div className="mt-2 text-[11px] text-faint">{t("Loading…", "読み込み中…", "載入中…")}</div>
        ) : n === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-glassborder/25 p-3 text-[11px] text-faint">
            {t(`No held-out answers yet. Add at least ${state.minSamples} to measure.`,
               `取り置きの回答はまだありません。計測には最低 ${state.minSamples} 件必要です。`,
               `尚未有保留答案。至少需要 ${state.minSamples} 則才能量測。`)}
          </div>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {state.samples.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2 rounded-lg border border-glassborder/15 bg-panel/40 px-2.5 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] font-medium text-text">{s.question}</div>
                  <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-4 text-faint">
                    {s.expertAnswer.length > 140 ? `${s.expertAnswer.slice(0, 140)}…` : s.expertAnswer}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={t("Remove held-out answer", "取り置きの回答を削除", "刪除保留答案")}
                  disabled={removing === s.id}
                  onClick={() => void removeSample(s.id)}
                  className="shrink-0 rounded-md border border-glassborder/20 p-1 text-faint transition hover:border-rust/40 hover:text-rust disabled:opacity-40"
                >
                  <IconTrash size={13} stroke={1.7} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add form */}
        <div className="mt-2.5 rounded-lg border border-glassborder/20 bg-panel/40 p-2.5">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("The question you were actually asked…", "実際に受けた質問…", "你實際被問到的問題…")}
            className="w-full rounded-lg border border-glassborder/20 bg-panel2/50 px-2.5 py-2 text-[11.5px] outline-none backdrop-blur-sm transition focus:border-purple"
          />
          <label className="mt-2 block text-[10.5px] font-semibold text-muted">
            {t("Paste YOUR answer — the avatar is scored against it",
               "あなた自身の回答を貼り付けてください — アバターはこれを基準に採点されます",
               "貼上「你本人」的答案 — 化身將以此為基準被評分")}
          </label>
          <textarea
            value={expertAnswer}
            onChange={(e) => setExpertAnswer(e.target.value)}
            rows={4}
            placeholder={t("Your real answer, in your own words and with your own conclusion…", "あなたの実際の回答を、あなたの言葉と結論で…", "你真實的回答，用你自己的話與結論…")}
            className="mt-1 w-full resize-none rounded-lg border border-glassborder/20 bg-panel2/50 px-2.5 py-2 text-[11.5px] leading-6 outline-none backdrop-blur-sm transition focus:border-purple"
          />
          {err && <div className="mt-1.5 text-[10.5px] leading-4 text-rust">{err}</div>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10.5px] text-faint">
              {t(`${n} / ${state.minSamples} minimum`, `${n} / ${state.minSamples} 件（最低）`, `${n} / ${state.minSamples} 則（最低）`)}
            </span>
            <Btn
              size="sm"
              variant="outline"
              className="disabled:opacity-40"
              disabled={adding || !question.trim() || !expertAnswer.trim()}
              onClick={() => void addSample()}
            >
              <IconPlus size={13} stroke={1.7} />
              {adding ? t("Adding…", "追加中…", "新增中…") : t("Add sample", "サンプルを追加", "新增樣本")}
            </Btn>
          </div>
        </div>
      </div>

      {/* Run the harness */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-glassborder/15 pt-3">
        <span className="text-[10.5px] leading-4 text-faint">
          {enough
            ? t("The avatar answers all held-out questions blind, then we score it.",
                "アバターは取り置きの質問すべてにブラインドで回答し、採点されます。",
                "化身將盲測回答所有保留題目，然後接受評分。")
            : t(`Add ${state.minSamples - n} more held-out ${state.minSamples - n === 1 ? "answer" : "answers"} to measure.`,
                `計測にはあと ${state.minSamples - n} 件の取り置き回答が必要です。`,
                `還需要 ${state.minSamples - n} 則保留答案才能量測。`)}
        </span>
        <Btn size="sm" variant="primary" className="disabled:opacity-40"
          title={enough ? undefined : t(`Add at least ${state.minSamples} held-out answers first.`, `まず最低 ${state.minSamples} 件の取り置き回答を追加してください。`, `請先新增至少 ${state.minSamples} 則保留答案。`)}
          disabled={!enough || running} onClick={() => void run()}>
          {running ? <IconRefresh size={13} stroke={1.7} className="animate-spin" /> : <IconFlask size={13} stroke={1.7} />}
          {running ? t("Measuring…", "計測中…", "量測中…") : t("Measure fidelity", "再現度を計測", "量測還原度")}
        </Btn>
      </div>

      {/* Breakdown of the latest run */}
      {lastRun && lastRun.detail?.length > 0 && (
        <div className="mt-3 border-t border-glassborder/15 pt-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[26px] font-extrabold leading-8 text-text">{lastRun.score}%</span>
            <span className="text-[10.5px] text-faint">
              {t(`across ${lastRun.samples} held-out answers`, `${lastRun.samples} 件の取り置き回答による`, `基於 ${lastRun.samples} 則保留答案`)}
            </span>
          </div>
          <div className="mt-2"><Progress value={lastRun.score} /></div>

          <div className="mt-3 space-y-2">
            {lastRun.detail.map((d, i) => (
              <div key={i} className="rounded-lg border border-glassborder/15 bg-panel/40 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 truncate text-[11.5px] font-medium text-text">{d.question}</div>
                  <Badge tone={d.score >= 70 ? "green" : d.score >= 45 ? "amber" : "rust"}>{d.score}%</Badge>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <Component
                    label={t("Coverage", "カバレッジ", "覆蓋率")}
                    note={t("how much of your substance it reproduced", "あなたの内容をどれだけ再現できたか", "重現了多少你的實質內容")}
                    value={d.coverage}
                  />
                  <Component
                    label={t("Stance", "スタンス", "立場")}
                    note={t("did it reach your conclusions", "あなたの結論に到達したか", "是否得出你的結論")}
                    value={d.stance}
                  />
                  <Component
                    label={t("Overlap", "重なり", "重疊")}
                    note={t("wording similarity, weighted lightly", "文言の類似度（重みは軽い）", "字詞相似度，權重很低")}
                    value={d.overlap}
                  />
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10.5px] text-muted transition hover:text-text">
                    {t("Compare answers", "回答を比較", "比較答案")}
                  </summary>
                  <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-glassborder/15 bg-panel2/40 p-2">
                      <div className="text-[10px] font-semibold text-muted">{t("Your answer", "あなたの回答", "你的答案")}</div>
                      <p className="mt-1 text-[10.5px] leading-5 text-faint">{d.expertAnswer}</p>
                    </div>
                    <div className="rounded-md border border-glassborder/15 bg-panel2/40 p-2">
                      <div className="text-[10px] font-semibold text-muted">{t("The avatar's answer", "アバターの回答", "化身的答案")}</div>
                      <p className="mt-1 text-[10.5px] leading-5 text-faint">{d.agentAnswer}</p>
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Component({ label, note, value }: { label: string; note: string; value: number }) {
  return (
    <div className="rounded-md border border-glassborder/15 bg-panel2/40 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10.5px] font-semibold text-text">{label}</span>
        <span className="text-[10.5px] text-muted">{value}%</span>
      </div>
      <div className="mt-1"><Progress value={value} /></div>
      <div className="mt-1 text-[9.5px] leading-4 text-faint">{note}</div>
    </div>
  );
}
