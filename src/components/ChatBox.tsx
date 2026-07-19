"use client";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { IconSignature, IconShieldCheck, IconClockCheck, IconUserCheck } from "@tabler/icons-react";

type Receipt = { header: string; snapshot: string; expert: string; grounding: string; safety: string; fidelity: string; advice: string };
type Msg = { role: string; content: string; provenance?: Receipt };

export default function ChatBox({
  slug, mode, trialLimit = 3, remaining: initialRemaining, initialMessages = [],
  canEscalate = false, escalationPrice = 180, onNeedSub, prefill, prefillKey = 0,
}: {
  slug: string; mode: "trial" | "full"; trialLimit?: number; remaining?: number;
  initialMessages?: Msg[]; canEscalate?: boolean; escalationPrice?: number; onNeedSub?: () => void;
  /** Question injected from the outside (e.g. a starter-question chip). */
  prefill?: string;
  /** Bump this to (re)send `prefill`. 0 / unchanged → no-op, so existing callers are unaffected. */
  prefillKey?: number;
}) {
  const { t } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [remaining, setRemaining] = useState<number | undefined>(initialRemaining);
  const [exhausted, setExhausted] = useState(false);
  const [esc, setEsc] = useState<null | { id: string; status: string; price: number }>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, esc]);

  // Parent-injected question (starter chips). Fires only when `prefillKey` changes.
  const sendRef = useRef<(q: string) => void>(() => {});
  sendRef.current = (q: string) => { void send(q); };
  useEffect(() => {
    const q = (prefill || "").trim();
    if (!prefillKey || !q) return;
    if (exhausted) { setInput(q); return; }
    sendRef.current(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  async function send(override?: string) {
    const text = (typeof override === "string" ? override : input).trim();
    if (!text || loading || streaming || exhausted) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, message: text, mode }) });
      if (!res.ok || !res.body) {
        let data: any = {};
        try { const t2 = await res.text(); const line = t2.split("\n").find((x) => x.startsWith("data: ")); if (line) data = JSON.parse(line.slice(6)); } catch {}
        setLoading(false);
        if (res.status === 402 || data.trialExhausted) { setExhausted(true); return; }
        if (res.status === 401) { setMsgs((m) => [...m, { role: "assistant", content: t("Please log in to try this Agent.","この Agent を試すにはログインしてください。","請先登入以試用此 Agent。") }]); return; }
        if (res.status === 403 && data.needSub) { onNeedSub?.(); setMsgs((m) => [...m, { role: "assistant", content: t("An active subscription is required to continue.","会話を続けるには有効な購読が必要です。","需要有效訂閱才能繼續對話。") }]); return; }
        if (res.status === 429 || data.rateLimited) { setMsgs((m) => [...m, { role: "system", content: data.error || t("Daily usage limit reached, please try again tomorrow.","本日の利用上限に達しました。明日また試してください。","已達今日用量上限，請明日再試。") }]); return; }
        setMsgs((m) => [...m, { role: "assistant", content: data.error || t("An error occurred","エラーが発生しました","發生錯誤") }]); return;
      }
      // start an empty assistant bubble and stream into it
      setLoading(false); setStreaming(true);
      setMsgs((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const p of parts) {
          const line = p.replace(/^data: /, "").trim();
          if (!line) continue;
          const evt = JSON.parse(line);
          if (evt.delta) setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + evt.delta }; return c; });
          if (evt.done && typeof evt.remaining === "number") setRemaining(evt.remaining);
          if (evt.done && evt.provenance) setMsgs((m) => { const c = [...m]; const last = c[c.length - 1]; if (last && last.role === "assistant") c[c.length - 1] = { ...last, provenance: evt.provenance }; return c; });
        }
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: t("Connection interrupted, please retry.","接続が切断されました。もう一度お試しください。","連線中斷，請重試。") }]);
    } finally {
      setLoading(false); setStreaming(false);
    }
  }

  async function escalate(tier: "standard" | "urgent") {
    setLoading(true);
    const res = await fetch("/api/escalation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, tier, question: msgs.filter((m) => m.role === "user").slice(-1)[0]?.content || "" }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setEsc({ id: data.escalation.id, status: "queued", price: data.escalation.price });
    setMsgs((m) => [...m, { role: "system", content: t(`Escalated to a human expert · in SLA queue (within ${tier === "urgent" ? "4" : "48"} hours) · Fee $${data.escalation.price}`,`人間の専門家へエスカレーション · SLA キュー投入（${tier === "urgent" ? "4" : "48"} 時間以内）· 費用 $${data.escalation.price}`,`已升級給真人專家 · 進入 SLA 佇列（${tier === "urgent" ? "4" : "48"} 小時內）· 費用 $${data.escalation.price}`) }]);
  }

  const busy = loading || streaming;
  return (
    <div className="glass hairline overflow-hidden rounded-2xl shadow-[0_8px_32px_rgb(var(--shadow)/var(--shadowA))]">
      <div className="flex items-center justify-between border-b border-glassborder/60 px-4 py-2.5 text-[11px] text-muted">
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulsedot rounded-full bg-green" />{mode === "trial" ? t("Trial sandbox","試用サンドボックス","試用沙盒") : t("Private conversation","専用の会話","專屬對話")}</span>
        {mode === "trial" && remaining !== undefined && <span className="font-mono text-faint">{t("Trials left","残り試用","剩餘試用")} <span className="text-cyan">{remaining}</span>/{trialLimit}</span>}
      </div>

      <div className="max-h-[360px] min-h-[160px] space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && <div className="py-8 text-center text-[12px] text-faint">{t("Type your first question to experience this Agent's reply.","最初の質問を入力して、この Agent の回答を体験しましょう。","輸入你的第一個問題，體驗這個 Agent 的回覆。")}</div>}
        {msgs.map((m, i) => <Bubble key={i} role={m.role} content={m.content} provenance={m.provenance} streaming={streaming && i === msgs.length - 1 && m.role === "assistant"} />)}
        {loading && <div className="flex items-center gap-1.5 text-[12px] text-faint"><Dots /> {t("Expert is working…","専門家が対応中…","專家處理中…")}</div>}
        {exhausted && (
          <div className="rounded-xl border-grad glass px-4 py-3.5 text-center">
            <div className="text-[12.5px] text-amber">{t("Free trials used up","無料試用回数を使い切りました","免費試用次數已用完")}</div>
            <button onClick={onNeedSub} className="btn-glow mt-2.5 inline-flex rounded-lg px-3.5 py-1.5 text-[12px] font-bold text-white bg-purple hover:brightness-110">{t("Subscribe to continue","購読して続ける","訂閱以繼續對話")}</button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {canEscalate && esc?.status !== "answered" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-glassborder/60 px-4 py-2.5">
          <span className="text-[11px] text-muted">{t("High-stakes question?","リスクの高い質問？","高風險問題？")}</span>
          <button disabled={busy || !!esc} onClick={() => escalate("standard")} className="rounded-md border border-purple/50 px-2 py-1 text-[11px] text-purple hover:bg-purple/10 disabled:opacity-40">{t("Escalate to human","人へエスカレーション","升級真人")} · ${escalationPrice}</button>
          <button disabled={busy || !!esc} onClick={() => escalate("urgent")} className="rounded-md border border-rust/50 px-2 py-1 text-[11px] text-rust hover:bg-rust/10 disabled:opacity-40">{t("Rush 4hr","特急 4hr","加急 4hr")}</button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-glassborder/60 bg-panel/30 px-3 py-2.5 backdrop-blur-sm">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={exhausted ? t("Subscribe to continue…","購読して続ける…","訂閱以繼續…") : t("Type a message…","メッセージを入力…","輸入訊息…")} disabled={exhausted || busy}
          className="flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-faint disabled:opacity-60" />
        <button onClick={() => send()} disabled={busy || exhausted} className="btn-glow rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-glow transition-all bg-purple hover:brightness-110 disabled:opacity-40">{t("Send","送信","送出")}</button>
      </div>
    </div>
  );
}

function Dots() {
  return <span className="inline-flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-pulsedot rounded-full bg-faint" style={{ animationDelay: `${i * 0.2}s` }} />)}</span>;
}
function Bubble({ role, content, provenance, streaming }: { role: string; content: string; provenance?: Receipt; streaming?: boolean }) {
  const { t } = useI18n();
  if (role === "user") return <div className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm border border-violet/25 bg-gradient-to-br from-violet/20 to-purple/10 px-3.5 py-2 text-[12.5px] leading-6 text-text shadow-[0_2px_16px_-6px_rgb(var(--violet)/0.5)]">{content}</div></div>;
  if (role === "system") return <div className="text-center text-[11px] text-amber">{content}</div>;
  if (role === "expert") return (
    <div className="rounded-xl border border-green/40 bg-green/[0.06] px-3.5 py-3 backdrop-blur-sm">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-green"><IconSignature size={13} stroke={1.8} /> {t("Expert reply with verified sign-off","専門家の実名署名付き回答","專家實名簽核回覆")}</div>
      <div className="whitespace-pre-wrap text-[12.5px] leading-6 text-text">{content}</div>
    </div>
  );
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] space-y-1.5">
        <div className="whitespace-pre-wrap rounded-xl rounded-bl-sm border border-glassborder/70 bg-glass/50 px-3.5 py-2 text-[12.5px] leading-6 text-muted backdrop-blur-md">{content}{streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-blink bg-violet align-middle" />}</div>
        {provenance && !streaming && <ProvenanceReceipt p={provenance} />}
      </div>
    </div>
  );
}

function ProvenanceReceipt({ p }: { p: Receipt }) {
  return (
    <div className="rounded-lg border border-glassborder/70 bg-panel/40 px-3 py-2 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-cyan"><IconShieldCheck size={11} stroke={1.8} /> {p.header}</div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-[10.5px] leading-5 text-muted sm:grid-cols-2">
        <span className="flex items-center gap-1"><IconClockCheck size={11} stroke={1.7} className="shrink-0 text-faint" /> {p.snapshot}</span>
        <span className="flex items-center gap-1"><IconUserCheck size={11} stroke={1.7} className="shrink-0 text-faint" /> {p.expert}</span>
        <span className="flex items-center gap-1"><IconShieldCheck size={11} stroke={1.7} className="shrink-0 text-faint" /> {p.safety}</span>
        <span className="text-faint">{p.fidelity}</span>
        <span className="text-faint">{p.grounding}</span>
      </div>
      <div className="mt-1.5 border-t border-glassborder/50 pt-1.5 text-[9.5px] leading-4 text-faint">{p.advice}</div>
    </div>
  );
}