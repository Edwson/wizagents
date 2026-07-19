"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChatBox from "./ChatBox";
import { catLabel } from "@/lib/categories";
import { useToast } from "./Toast";
import { useI18n } from "@/lib/i18n";
import { IconTicket, IconSignature, IconCheck, IconPlugConnected } from "@tabler/icons-react";
import { Reveal, Btn } from "@/components/ui";
import OnboardingChecklist from "./OnboardingChecklist";

type Sub = { slug: string; name: string; creatorName: string; category: string; price: number; viaPass: boolean; token: string; escalationPrice: number; requests: number; status: string; flagged: boolean; expired: boolean; daysLeft: number | null; periodEnd: string | null; viaSeat?: boolean };
type Esc = { id: string; agentName: string; status: string; tier: string; price: number; question: string; answer: string; signed: boolean; createdAt: string };
type Tx = { type: string; amount: number; note: string; createdAt: string };

export default function DashboardClient({
  subs, escalations, transactions, hasPass, passPrice, monthlySpend,
}: { subs: Sub[]; escalations: Esc[]; transactions: Tx[]; hasPass: boolean; passPrice: number; monthlySpend: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [sel, setSel] = useState<Sub | null>(subs[0] || null);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const [pass, setPass] = useState(hasPass);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!sel) return;
    fetch(`/api/conversation?slug=${sel.slug}`).then((r) => r.json()).then((d) => setHistory(d.messages || []));
  }, [sel]);

  async function togglePass() {
    const r = await fetch("/api/pass", { method: "POST" });
    const d = await r.json();
    if (d.ok) { setPass(d.active); toast(d.active ? t("Pass activated","パスを開通しました","已開通通行證") : t("Pass canceled","パスを解約しました","已取消通行證"), "success"); router.refresh(); }
  }
  async function cancel(slug: string) {
    if (!confirm(t("Cancel this subscription? Stopping payment stops the service.","この購読を解約しますか？支払いを止めるとサービスも停止します。","確定要取消此訂閱？停止付費即停止服務。"))) return;
    await fetch("/api/subscribe/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
    router.refresh();
  }
  function copy(t2: string, k: string) { navigator.clipboard?.writeText(t2); setCopied(k); setTimeout(() => setCopied(""), 1500); }
  const [renewing, setRenewing] = useState(false);
  async function renew(slug: string) {
    setRenewing(true);
    try {
      const r = await fetch("/api/subscribe/renew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) { toast(t("Access restored — your subscription is active again.","アクセスを復元しました。購読が再び有効です。","已恢復存取 — 訂閱重新生效。"), "success"); router.refresh(); }
      else toast(d.error === "flagged" ? t("This subscription is locked for policy violations. Contact support.","このサブスクはポリシー違反によりロックされています。サポートへご連絡ください。","此訂閱因違規已鎖定，請聯繫客服。") : t("Could not renew. Please try again.","更新できませんでした。もう一度お試しください。","無法續訂，請重試。"), "error");
    } finally { setRenewing(false); }
  }

  return (
    <div className="animate-fadein">
      <h1 className="font-display text-[30px] font-extrabold tracking-tight"><span className="text-grad">{t("My subscriptions","マイ購読","我的訂閱")}</span></h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">{t("Manage subscriptions, chat with your expert Agents, and track human escalations.","購読を管理し、専門家 Agent と対話し、人へのエスカレーションを追跡できます。","管理訂閱、與你的專家 Agent 對話、追蹤真人升級。")}</p>

      {subs.length < 2 && (
        <div className="mb-6">
          <OnboardingChecklist
            role="buyer"
            steps={[
              {
                done: subs.length > 0,
                label: ["Browse the marketplace", "マーケットを見る", "瀏覽市集"],
                desc: ["Find an expert Agent that fits your work.", "あなたの業務に合う専門家 Agent を見つけましょう。", "找到適合你工作的專家 Agent。"],
                cta: ["Browse", "見る", "瀏覽"],
                href: "/market",
              },
              {
                done: subs.some((x) => x.requests > 0),
                label: ["Start a conversation", "会話を始める", "開始對話"],
                desc: ["Ask your first question and see the expertise in action.", "最初の質問をして、その専門性を体験しましょう。", "提出第一個問題，親身體驗其專業。"],
                cta: ["Open chat", "チャットを開く", "開啟對話"],
                href: subs[0] ? `/agent/${subs[0].slug}` : "/market",
              },
              {
                done: monthlySpend > 0,
                label: ["Add a payment method", "支払い方法を追加", "新增付款方式"],
                desc: ["Keep access uninterrupted when subscriptions renew.", "更新時もアクセスが途切れないようにします。", "續訂時保持存取不中斷。"],
                cta: ["Settings", "設定", "設定"],
                href: "/settings",
              },
              {
                done: false,
                label: ["Enable 2FA to protect your account", "2FA を有効化してアカウントを保護", "啟用 2FA 保護帳戶"],
                desc: ["Add a second factor for stronger sign-in security.", "サインインの安全性を高める第二要素を追加します。", "加入第二重驗證，強化登入安全。"],
                cta: ["Settings", "設定", "設定"],
                href: "/settings",
              },
            ]}
          />
        </div>
      )}

      <Reveal as="div" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat v={subs.filter((x) => !x.expired).length} l={t("Active Agents","購読中の Agent","訂閱中 Agent")} />
        <Stat v={`$${monthlySpend}`} l={t("Monthly spend","毎月の支出","每月支出")} />
        <Stat v={escalations.length} l={t("Human escalations","真人升級","真人升級")} />
        <div className="glass-card border-grad p-4">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-faint"><IconTicket size={13} stroke={1.7} /> {t("Pass","パス","通行證")}</div>
          <button onClick={togglePass} className={`mt-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${pass ? "bg-green/20 text-green" : "border border-amber/50 text-amber hover:bg-amber/10"}`}>
            {pass ? t("Active · Click to cancel","利用中 · クリックで解約","使用中 · 點擊取消") : t(`Activate $${passPrice}/mo`,`$${passPrice}/mo で開通`,`開通 $${passPrice}/mo`)}
          </button>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* subs list */}
        <div className="space-y-2">
          <div className="text-[11px] tracking-[0.12em] text-rust">// {t("Subscribed","購読中","訂閱中")}</div>
          {subs.length === 0 && <div className="rounded-xl border border-dashed border-glassborder/70 p-6 text-center text-[12px] text-muted">{t("No subscriptions yet.","まだ購読がありません。","尚無訂閱。")}<Link href="/market" className="text-purple">{t("Browse the market →","マーケットを見る →","去市集看看 →")}</Link></div>}
          {subs.map((s) => (
            <button key={s.slug} onClick={() => setSel(s)} className={`w-full rounded-xl p-3 text-left transition-all ${sel?.slug === s.slug ? "border-grad glass-card !p-3" : "hairline bg-panel/40 backdrop-blur-sm hover:border-purple/50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted">{catLabel(s.category)}</span>
                {s.viaPass ? <span className="text-[10px] text-green">{t("Pass","パス","通行證")}</span> : <span className="text-[10px] text-muted">${s.price}/mo</span>}
              </div>
              <div className="mt-1 font-display text-[13px] font-bold leading-5">{s.name}</div>
              <div className="text-[10.5px] text-faint">by {s.creatorName}</div>
              {s.expired ? (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-rust/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-rust">{s.flagged ? t("Locked","ロック","已鎖定") : t("Access ended","アクセス終了","存取已終止")}</div>
              ) : s.daysLeft !== null && s.daysLeft <= 7 && !s.viaPass ? (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber">{t(`Renews in ${s.daysLeft}d`,`あと${s.daysLeft}日で更新`,`${s.daysLeft} 天後續訂`)}</div>
              ) : null}
            </button>
          ))}
        </div>

        {/* selected agent panel */}
        <div className="space-y-5">
          {sel ? (
            <>
              {sel.expired && (
                <div className="glass-card border border-rust/40 !bg-rust/[0.06] p-4">
                  <div className="font-display text-[14px] font-bold text-rust">{sel.flagged ? t("Subscription locked","購読はロックされています","訂閱已鎖定") : t("Access to this Agent has ended","この Agent へのアクセスが終了しました","已終止與此 Agent 的連線")}</div>
                  <p className="mt-1 text-[11.5px] leading-5 text-muted">
                    {sel.flagged
                      ? t("This connection was suspended after repeated attempts to extract the creator's protected knowledge. The live link to the expert is severed. Contact support to appeal.","作成者の保護された知識を繰り返し抽出しようとしたため、この接続は停止されました。専門家へのライブ接続は遮断されています。異議はサポートへ。","因多次嘗試抽取創作者受保護的知識，此連線已被停權。與專家的即時連結已切斷。如需申訴請聯繫客服。")
                      : t("Your subscription period ended, so the live link to the expert's knowledge is severed — the endpoint and token no longer answer. Renew to restore real-time access. You were renting living access to a real human's judgment, not a copy of it.","購読期間が終了したため、専門家の知識へのライブ接続は遮断され、エンドポイントとトークンは応答しなくなりました。更新するとリアルタイムアクセスが復元されます。あなたが借りていたのは、本物の人間の判断への生きたアクセスであり、その複製ではありません。","訂閱週期已結束，與專家知識的即時連結已切斷 — 端點與 Token 不再回應。續訂即可恢復即時存取。你租用的是一位真人判斷力的活體存取權，而非它的複本。")}
                  </p>
                  {!sel.flagged && (
                    <Btn onClick={() => renew(sel.slug)} disabled={renewing} variant="primary" className="mt-3 disabled:opacity-50">
                      {renewing ? t("Renewing…","更新中…","續訂中…") : sel.viaPass ? t("Reactivate","再開","重新啟用") : t(`Renew · $${sel.price}/mo`,`更新 · $${sel.price}/月`,`續訂 · $${sel.price}/月`)}
                    </Btn>
                  )}
                </div>
              )}
              {!sel.expired && <div className="glass-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-display text-[16px] font-bold">{sel.name}</div>
                  <div className="flex gap-2">
                    <Link href={`/agent/${sel.slug}`} className="rounded-md hairline bg-panel/40 px-2.5 py-1 text-[11px] text-muted backdrop-blur-sm transition-colors hover:border-purple hover:text-purple">{t("Details","詳細","詳情")}</Link>
                    <button onClick={() => cancel(sel.slug)} className="rounded-md border border-rust/40 px-2.5 py-1 text-[11px] text-rust hover:bg-rust/10">{t("Cancel subscription","購読を解約","取消訂閱")}</button>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-border bg-panel2 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display text-[13.5px] font-bold">{t("Connect to your AI tool","AI ツールに接続","接進你的 AI 工具")}</div>
                      <div className="mt-0.5 text-[11.5px] leading-5 text-muted">{t("One click into Claude Desktop, Cursor, Open WebUI, LangChain and more — over MCP or the OpenAI-compatible API. The expert always runs on WizAgents.","Claude Desktop、Cursor、Open WebUI、LangChain などへワンクリック。MCP でも OpenAI 互換 API でも。専門家は常に WizAgents 上で実行されます。","一鍵接進 Claude Desktop、Cursor、Open WebUI、LangChain 等 — 走 MCP 或 OpenAI 相容 API。專家始終在 WizAgents 上執行。")}</div>
                    </div>
                    <Btn href={`/connect/${sel.slug}`} variant="primary" className="shrink-0"><IconPlugConnected size={15} stroke={1.7} /> {t("Connect","接続","接入")}</Btn>
                  </div>
                </div>
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-[11px] text-faint transition-colors hover:text-muted">{t("Raw endpoint & token (advanced)","エンドポイントとトークン（上級者向け）","原始端點與 Token（進階）")}</summary>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Copyable label={t("MCP endpoint","MCP エンドポイント","MCP 端點")} value={`https://mcp.wiz-agents.com/a/${sel.slug}`} k="ep" copied={copied} onCopy={copy} tone="amber" />
                    <Copyable label={t("Access token","認証トークン","授權 Token")} value={sel.token} k="tok" copied={copied} onCopy={copy} tone="muted" />
                  </div>
                </details>
                <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
                  <span>{t("Cumulative API usage for this subscription:","この購読の累計 API 利用：","本訂閱累計 API 用量：")}<span className="text-muted">{t(`${sel.requests} calls`,`${sel.requests} 回`,`${sel.requests} 次`)}</span></span>
                  <Link href="/mcp" className="text-purple">{t("Connection guide →","接続ガイド →","接入指南 →")}</Link>
                </div>
              </div>}

              {!sel.expired && (
                <div>
                  <div className="mb-2 text-[11px] tracking-[0.12em] text-rust">// {t(`Chat with ${sel.name}`,`${sel.name} と対話`,`與 ${sel.name} 對話`)}</div>
                  <ChatBox key={sel.slug} slug={sel.slug} mode="full" initialMessages={history} canEscalate escalationPrice={sel.escalationPrice} />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted">{t("Select a subscription on the left to start chatting.","左側の購読を選択して対話を開始しましょう。","選擇左側一個訂閱開始對話。")}</div>
          )}

          {/* escalations */}
          {escalations.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] tracking-[0.12em] text-rust">// {t("Human escalation history","真人升級の履歴","真人升級紀錄")}</div>
              <div className="space-y-2">
                {escalations.map((e) => (
                  <div key={e.id} className="glass-card p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-[12.5px] font-bold">{e.agentName}</span>
                      <span className={`inline-flex items-center gap-1 text-[10.5px] ${e.status === "answered" || e.status === "signed" ? "text-green" : "text-amber"}`}>
                        {e.signed ? <><IconSignature size={12} stroke={1.8} /> {t("Signed","署名済み","已簽核")}</> : e.status === "answered" ? t("Answered","回答済み","已回覆") : t("In SLA queue","SLA キュー中","SLA 佇列中")} · ${e.price}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-muted">{t("Q: ","Q：","Q：")}{e.question}</div>
                    {e.answer && <div className="mt-2 rounded-md border border-green/30 bg-green/5 p-2.5 text-[11.5px] leading-6 text-text whitespace-pre-wrap">{e.answer}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* billing */}
          <div>
            <div className="mb-2 text-[11px] tracking-[0.12em] text-rust">// {t("Recent billing","最近の請求","近期帳務")}</div>
            <div className="glass-card divide-y divide-glassborder/50 !p-0 overflow-hidden">
              {transactions.slice(0, 6).map((t2, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-[12px] transition-colors hover:bg-panel/40">
                  <span className="text-muted">{t2.note || t2.type}</span>
                  <span className="font-mono font-bold text-text">${t2.amount}</span>
                </div>
              ))}
              {transactions.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-faint">{t("No transactions yet","取引履歴はまだありません","尚無交易紀錄")}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ v, l }: { v: React.ReactNode; l: string }) {
  return <div className="glass-card p-4"><div className="font-display text-[22px] font-extrabold text-grad">{v}</div><div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-faint">{l}</div></div>;
}
function Copyable({ label, value, k, copied, onCopy, tone }: { label: string; value: string; k: string; copied: string; onCopy: (v: string, k: string) => void; tone: "amber" | "muted" }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-faint"><span>{label}</span><button onClick={() => onCopy(value, k)} className="inline-flex items-center gap-0.5 text-purple">{copied === k ? <>{t("Copied","コピー済み","已複製")} <IconCheck size={11} stroke={2} /></> : t("Copy","コピー","複製")}</button></div>
      <code className={`block break-all rounded-md border-grad glass px-2.5 py-1.5 font-mono text-[10px] ${tone === "amber" ? "text-grad-neon" : "text-muted"}`}>{value}</code>
    </div>
  );
}
