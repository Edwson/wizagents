"use client";
import { useState } from "react";
import { IconUsersGroup, IconScale, IconArrowRight } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, Badge, SectionLabel, Reveal, GradientText } from "./ui";
import { typeLabel, typeGlyph } from "@/lib/agent-types";
import { catLabel } from "@/lib/categories";

type Sub = { slug: string; name: string; creatorName: string; category: string; agentType: string };
type Answer = { slug: string; name: string; creatorName: string; type: string; reply: string };

const MIN = 2;
const MAX = 4;

export default function CouncilClient({ subs }: { subs: Sub[] }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [picked, setPicked] = useState<string[]>(subs.slice(0, Math.min(MAX, subs.length)).map((s) => s.slug));
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [summary, setSummary] = useState("");

  function toggle(slug: string) {
    setPicked((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= MAX) {
        toast(t(`Up to ${MAX} experts per council`, `評議会は最大 ${MAX} 名まで`, `評議會最多 ${MAX} 位專家`), "info");
        return cur;
      }
      return [...cur, slug];
    });
  }

  async function ask() {
    if (picked.length < MIN) { toast(t("Pick at least two experts", "専門家を2名以上選んでください", "請至少選擇兩位專家"), "error"); return; }
    if (question.trim().length < 3) { toast(t("Enter a question for the council", "評議会への質問を入力してください", "請輸入給評議會的問題"), "error"); return; }
    setBusy(true); setAnswers(null); setSummary("");
    try {
      const res = await fetch("/api/council", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), slugs: picked }) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || t("Council unavailable", "評議会は利用できません", "評議會暫不可用"), "error"); return; }
      setAnswers(data.answers); setSummary(data.summary);
    } catch {
      toast(t("Network error", "ネットワークエラー", "網路錯誤"), "error");
    } finally { setBusy(false); }
  }

  if (subs.length < MIN) {
    return (
      <div className="animate-fadein">
        <Header />
        <Reveal className="mt-8">
          <div className="glass-card border-dashed p-10 text-center">
            <IconUsersGroup size={30} stroke={1.7} className="mx-auto text-faint" />
            <div className="mt-3 font-display text-[16px] font-bold text-text">
              {t("You need at least two subscribed experts", "購読中の専門家が2名以上必要です", "你至少需要兩位已訂閱的專家")}
            </div>
            <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-6 text-muted">
              {t(
                "A council triangulates one question across several expert avatars — more angles, more objectively. Subscribe to two or more experts to convene one.",
                "評議会は、複数の専門家アバターに同じ問いを投げて三角測量します — より多くの角度で、より客観的に。2名以上の専門家を購読すると開催できます。",
                "評議會會把同一個問題交給多位專家化身進行三角驗證——更多角度，更客觀。訂閱兩位以上專家即可召開。"
              )}
            </p>
            <div className="mt-5"><Btn href="/market" variant="primary"><IconArrowRight size={15} stroke={1.7} /> {t("Browse the marketplace", "マーケットを見る", "瀏覽市集")}</Btn></div>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="animate-fadein">
      <Header />

      <Reveal className="mt-8">
        <SectionLabel>{t("Convene your council", "評議会を招集", "召開你的評議會")}</SectionLabel>
        <div className="glass-card p-5">
          <div className="text-[12px] text-muted">{t(`Select ${MIN}–${MAX} experts`, `専門家を ${MIN}〜${MAX} 名選択`, `選擇 ${MIN}–${MAX} 位專家`)} · <span className="text-faint">{picked.length}/{MAX}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {subs.map((s) => {
              const on = picked.includes(s.slug);
              return (
                <button key={s.slug} onClick={() => toggle(s.slug)} type="button"
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12px] transition-colors ${on ? "border-purple bg-purple/10 text-text" : "border-border bg-panel2/50 text-muted hover:text-text hover:border-borderlight"}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] ${on ? "bg-purple text-white" : "bg-panel3 text-muted"}`} title={typeLabel(s.agentType, locale)}>{typeGlyph(s.agentType)}</span>
                  <span className="leading-tight">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-[10.5px] text-faint">{s.creatorName} · {catLabel(s.category)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
              placeholder={t("Ask the council one question — e.g. \"Should I restructure the deal as an asset sale?\"", "評議会に一つの質問を — 例：「この案件を資産譲渡に組み替えるべきか？」", "向評議會提出一個問題 — 例如：「這筆交易該改成資產出售嗎？」")}
              className="w-full resize-none rounded-lg border border-border bg-panel2/50 px-3 py-2.5 text-[13px] leading-6 text-text outline-none transition focus:border-purple" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-faint">{t("Each expert answers independently, then we triangulate.", "各専門家が独立して回答し、その後三角測量します。", "每位專家獨立回答，隨後進行三角驗證。")}</span>
              <Btn onClick={ask} disabled={busy} variant="primary"><IconUsersGroup size={15} stroke={1.7} /> {busy ? t("Consulting…", "相談中…", "諮詢中…") : t("Consult the council", "評議会に相談", "諮詢評議會")}</Btn>
            </div>
          </div>
        </div>
      </Reveal>

      {answers && (
        <div className="mt-8">
          <SectionLabel>{t("The council's answers", "評議会の回答", "評議會的回答")}</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2">
            {answers.map((a) => (
              <div key={a.slug} className="glass-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-panel3 text-[12px] text-muted">{typeGlyph(a.type)}</span>
                    <div>
                      <div className="font-display text-[13.5px] font-bold text-text">{a.name}</div>
                      <div className="text-[10.5px] text-faint">{a.creatorName}</div>
                    </div>
                  </div>
                  <Badge tone="purple">{typeLabel(a.type, locale)}</Badge>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-6 text-muted">{a.reply}</p>
              </div>
            ))}
          </div>

          {summary && (
            <div className="mt-4 glass-card border-grad p-5">
              <div className="flex items-center gap-2">
                <IconScale size={17} stroke={1.7} className="text-purple" />
                <span className="font-display text-[14px] font-bold"><GradientText>{t("Triangulation", "三角測量", "三角驗證")}</GradientText></span>
              </div>
              <p className="mt-2.5 whitespace-pre-wrap text-[12.5px] leading-6 text-text">{summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Header() {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple/40 bg-purple/5 px-3 py-1 text-[11px] text-purple">
        <IconUsersGroup size={13} stroke={1.7} /> {t("Premium", "プレミアム", "尊享")}
      </div>
      <h1 className="font-display text-[28px] font-extrabold tracking-tight text-text">
        <GradientText>{t("Council", "評議会", "評議會")}</GradientText>
      </h1>
      <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted">
        {t(
          "Consult several expert avatars on the same question — each with a distinct stance — and triangulate. More angles, more objectively.",
          "同じ問いを複数の専門家アバターに — それぞれ異なる立場で — 相談し、三角測量する。より多くの角度で、より客観的に。",
          "就同一個問題諮詢多位專家化身——各有不同立場——並進行三角驗證。更多角度，更客觀。"
        )}
      </p>
    </div>
  );
}
