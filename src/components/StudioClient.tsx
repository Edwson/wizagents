"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconPlus, IconSignature, IconChevronDown, IconShieldCheck, IconTargetArrow } from "@tabler/icons-react";
import Sparkline from "./Sparkline";
import { catLabel } from "@/lib/categories";
import { useI18n } from "@/lib/i18n";
import ProtectionPanel from "./ProtectionPanel";
import FidelityPanel from "./FidelityPanel";
import OnboardingChecklist from "./OnboardingChecklist";
import { useToast } from "./Toast";

type Ag = { slug: string; name: string; category: string; price: number; subscribers: number; renewal: number; status: string; rating: number; trend: number[]; stanceProfile: string };
type Esc = { id: string; agentName: string; question: string; status: string; tier: string; price: number; answer: string; signed: boolean };

export default function StudioClient({
  displayName, verified, verticalLabel, stats, agents, escalations,
}: {
  displayName: string; verified: boolean; verticalLabel: string;
  stats: { subscribers: number; mrr: number; avgRenewal: number; earnings: number };
  agents: Ag[]; escalations: Esc[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const [openStance, setOpenStance] = useState<string | null>(null);
  const [openFidelity, setOpenFidelity] = useState<string | null>(null);
  const [stance, setStance] = useState<Record<string, string>>(() => Object.fromEntries(agents.map((a) => [a.slug, a.stanceProfile])));
  const [savingStance, setSavingStance] = useState("");

  async function saveStance(slug: string) {
    setSavingStance(slug);
    try {
      const res = await fetch(`/api/creator/agent/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stanceProfile: stance[slug] ?? "" }) });
      if (res.ok) toast(t("Stance profile saved", "スタンスプロファイルを保存しました", "已儲存立場設定"), "success");
      else toast(t("Could not save stance profile", "スタンスプロファイルを保存できませんでした", "無法儲存立場設定"), "error");
    } catch {
      toast(t("Network error", "ネットワークエラー", "網路錯誤"), "error");
    } finally { setSavingStance(""); }
  }

  async function answer(id: string, sign: boolean) {
    const text = (drafts[id] || "").trim();
    if (text.length < 10) { toast(t("Write your answer before publishing it — your name goes on it.", "公開前に回答を記入してください。あなたの名前が付きます。", "發布前請先寫下你的回覆——上面會署你的名字。"), "error"); return; }
    setBusy(id);
    const r = await fetch(`/api/escalation/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "answer", answer: text, sign }) });
    setBusy("");
    if (r.ok) { toast(sign ? t("Answered and signed", "回答して署名しました", "已回覆並簽核") : t("Answer published", "回答を公開しました", "已發布回覆"), "success"); router.refresh(); }
    else toast(t("Could not publish", "公開できませんでした", "無法發布"), "error");
  }

  /** Generate a starting draft the expert then edits. It is never published or signed on its own. */
  async function makeDraft(id: string) {
    setBusy(id);
    const r = await fetch(`/api/escalation/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draft" }) });
    const d = await r.json();
    setBusy("");
    if (d.ok && d.draft) { setDrafts({ ...drafts, [id]: d.draft }); toast(t("Draft ready — edit it, then publish. It is not signed until you say so.", "下書きを作成しました。編集して公開してください。署名はあなたの操作が必要です。", "草稿已生成——請編輯後發布；未經你確認不會簽核。"), "success"); }
  }

  return (
    <div className="animate-fadein">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight"><span className="text-grad">{t("Creator Studio", "クリエイタースタジオ", "創作者工作室")}</span></h1>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
            {displayName} · {verticalLabel}
            {verified ? <span className="text-purple">✓ {t("Verified", "認証済み", "已認證")}</span> : <Link href="/studio/verification" className="text-amber">{t("Not verified · Get verified", "未認証・認証する", "未認證 · 前往驗證")} →</Link>}
          </div>
        </div>
        <div className="flex gap-2"><Link href="/studio/analytics" className="rounded-xl border border-glassborder/20 bg-panel/40 px-4 py-2 text-[13px] text-muted backdrop-blur-sm transition hover:border-violet/40 hover:text-text">{t("Analytics", "データ分析", "數據分析")}</Link><Link href="/studio/revenue" className="rounded-xl border border-glassborder/20 bg-panel/40 px-4 py-2 text-[13px] text-muted backdrop-blur-sm transition hover:border-violet/40 hover:text-text">{t("Revenue", "収益明細", "收益明細")}</Link><Link href="/studio/create" className="btn-glow inline-flex items-center gap-1 rounded-xl border border-transparent px-4 py-2 text-[13px] font-bold text-white shadow-glow transition hover:brightness-110 bg-purple"><IconPlus size={14} stroke={1.7} /> {t("Create New Agent", "新しいエージェントを作成", "建立新 Agent")}</Link></div>
      </div>

      <div className="mt-6">
        <OnboardingChecklist
          role="creator"
          steps={[
            {
              done: agents.length > 0,
              label: ["Create your first Agent", "最初のエージェントを作成", "建立你的第一個 Agent"],
              desc: ["Package your expertise into a 24/7 income stream.", "あなたの専門性を24時間365日の収入源に。", "把你的專業封裝成 24/7 的收入來源。"],
              cta: ["Create", "作成", "建立"],
              href: "/studio/create",
            },
            {
              done: agents.some((a) => a.status === "published"),
              label: ["Publish it", "公開する", "發布上架"],
              desc: ["Make your Agent live so buyers can subscribe.", "エージェントを公開して購読可能にしましょう。", "讓你的 Agent 上線，供買家訂閱。"],
              cta: ["Publish", "公開", "發布"],
              href: agents[0] ? `/studio/agent/${agents[0].slug}` : "/studio/create",
            },
            {
              done: stats.earnings > 0,
              label: ["Set up payouts", "支払い受取を設定", "設定收款"],
              desc: ["Add your payout details to receive your share.", "取り分を受け取るための受取情報を追加します。", "填寫收款資訊以領取你的分潤。"],
              cta: ["Revenue", "収益", "收益"],
              href: "/studio/revenue",
            },
            {
              done: verified,
              label: ["Get verified", "認証を取得", "取得認證"],
              desc: ["Build trust with buyers through identity verification.", "本人確認で買い手からの信頼を築きます。", "透過身分驗證建立買家信任。"],
              cta: ["Verify", "認証", "驗證"],
              href: "/studio/verification",
            },
          ]}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat v={stats.subscribers.toLocaleString()} l={t("Total Subscribers", "総登録者", "總訂閱者")} tone="#8b6dff" />
        <Stat v={`$${stats.mrr.toLocaleString()}`} l={t("Monthly Recurring Revenue (your share)", "月間経常収益（あなたの取り分）", "月經常性收入 (你的分潤)")} tone="#4ade80" />
        <Stat v={`${stats.avgRenewal}%`} l={t("Avg. Renewal Rate", "平均更新率", "平均續訂率")} tone="#e5a94e" />
        <Stat v={`$${stats.earnings.toLocaleString()}`} l={t("Total Earnings", "累計収益", "累計收益")} tone="#5eb0ff" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        {/* agents */}
        <div>
          <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("My Agents", "マイエージェント", "我的 Agent")}（{agents.length}）</div>
          <div className="space-y-3">
            {agents.length === 0 && (
              <div className="glass-card border-dashed p-8 text-center">
                <div className="text-[13px] text-muted">{t("No agents yet. Package your expertise into 24/7 income.", "まだエージェントがありません。あなたの専門性を24時間365日の収入に。", "還沒有 Agent。把你的專業封裝成 24/7 的收入。")}</div>
                <Link href="/studio/create" className="btn-glow mt-3 inline-block rounded-xl border border-transparent px-4 py-2 text-[13px] font-bold text-white shadow-glow transition hover:brightness-110 bg-purple">{t("Launch your first Agent in 4 steps", "4ステップで最初のエージェントを公開", "四步上架你的第一個 Agent")} →</Link>
              </div>
            )}
            {agents.map((a) => (
              <div key={a.slug} className="glass-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted">{catLabel(a.category)}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <Link href={`/studio/agent/${a.slug}`} className="mt-1 block font-display text-[14px] font-bold transition hover:text-violet">{a.name}</Link>
                  </div>
                  <Sparkline points={a.trend} tone="#8b6dff" width={120} height={34} />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 border-t border-glassborder/15 pt-3 text-center">
                  <Mini v={a.subscribers} l={t("Subscribers", "登録者", "訂閱者")} />
                  <Mini v={`$${a.price}`} l={t("Monthly", "月額", "月費")} />
                  <Mini v={`${a.renewal}%`} l={t("Renewal", "更新", "續訂")} />
                  <Mini v={`$${Math.round(a.subscribers * a.price * 0.78).toLocaleString()}`} l={t("Monthly Share", "月間取り分", "月分潤")} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/studio/agent/${a.slug}`} className="rounded-lg border border-glassborder/20 bg-panel/40 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm transition hover:border-violet/40 hover:text-text">{t("Edit / Push Knowledge", "編集・知識を更新", "編輯 / 推送知識")}</Link>
                  <Link href={`/agent/${a.slug}`} className="rounded-lg border border-glassborder/20 bg-panel/40 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm transition hover:border-violet/40 hover:text-text">{t("Preview Public Page", "公開ページをプレビュー", "預覽公開頁")}</Link>
                  <button type="button" onClick={() => setOpenStance(openStance === a.slug ? null : a.slug)} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] backdrop-blur-sm transition ${openStance === a.slug ? "border-purple/50 bg-purple/10 text-text" : "border-glassborder/20 bg-panel/40 text-muted hover:border-violet/40 hover:text-text"}`}>
                    <IconShieldCheck size={12} stroke={1.7} /> {t("Stance profile", "スタンスプロファイル", "立場設定")}
                    <IconChevronDown size={11} stroke={1.7} className={`transition-transform ${openStance === a.slug ? "rotate-180" : ""}`} />
                  </button>
                  <button type="button" onClick={() => setOpenFidelity(openFidelity === a.slug ? null : a.slug)} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] backdrop-blur-sm transition ${openFidelity === a.slug ? "border-purple/50 bg-purple/10 text-text" : "border-glassborder/20 bg-panel/40 text-muted hover:border-violet/40 hover:text-text"}`}>
                    <IconTargetArrow size={12} stroke={1.7} /> {t("Fidelity", "再現度", "還原度")}
                    <IconChevronDown size={11} stroke={1.7} className={`transition-transform ${openFidelity === a.slug ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {openStance === a.slug && (
                  <div className="mt-3 rounded-lg border border-purple/20 bg-panel2/40 p-3">
                    <p className="text-[11px] leading-5 text-muted">{t(
                      "Your stance profile is what keeps the avatar you: the heuristics you reason by, the priorities you weigh, your red-lines, and what it should refuse to do. The more faithfully you capture it, the more the avatar reasons like you.",
                      "スタンスプロファイルこそがアバターを「あなた」に保ちます：判断のヒューリスティクス、重視する優先順位、レッドライン、そして拒否すべきこと。忠実に書くほど、アバターはあなたのように推論します。",
                      "立場設定是讓化身仍然「是你」的關鍵：你的判斷經驗法則、你權衡的優先順序、你的紅線，以及它應當拒絕的事。你寫得越忠實，化身就越像你在推理。"
                    )}</p>
                    <textarea value={stance[a.slug] ?? ""} onChange={(ev) => setStance({ ...stance, [a.slug]: ev.target.value })} rows={5}
                      placeholder={t("e.g. Heuristics I reason by · priorities I weigh · red-lines I never cross · questions I refuse to answer…", "例：判断のヒューリスティクス・重視する優先順位・越えないレッドライン・答えない問い…", "例如：我依循的經驗法則 · 我權衡的優先順序 · 我絕不跨越的紅線 · 我拒絕回答的問題…")}
                      className="mt-2 w-full resize-none rounded-lg border border-glassborder/20 bg-panel2/50 px-2.5 py-2 text-[11.5px] leading-6 outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow" />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button type="button" disabled={savingStance === a.slug} onClick={() => saveStance(a.slug)} className="btn-glow rounded-lg border border-transparent px-3 py-1.5 text-[11px] font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-40 bg-purple">{savingStance === a.slug ? t("Saving…", "保存中…", "儲存中…") : t("Save stance", "スタンスを保存", "儲存立場")}</button>
                    </div>
                  </div>
                )}
                {openFidelity === a.slug && (
                  <div className="mt-3">
                    <FidelityPanel slug={a.slug} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* escalation inbox */}
        <div>
          <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Human Escalation Inbox (Expert Loop)", "有人エスカレーション受信箱（Expert Loop）", "真人升級收件匣（Expert Loop）")}</div>
          <div className="space-y-3">
            {escalations.length === 0 && <div className="glass-card border-dashed p-6 text-center text-[12px] text-muted">{t("No pending escalations.", "保留中のエスカレーションはありません。", "目前沒有待處理的升級。")}</div>}
            {escalations.map((e) => (
              <div key={e.id} className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold">{e.agentName}</span>
                  <span className={`text-[10.5px] ${e.tier === "urgent" ? "text-rust" : "text-amber"}`}>{e.tier === "urgent" ? t("Urgent 4hr", "緊急 4hr", "加急 4hr") : t("Standard 48hr", "標準 48hr", "標準 48hr")} · ${e.price}</span>
                </div>
                <div className="mt-1.5 text-[11.5px] leading-6 text-muted">{t("Q", "Q", "Q")}：{e.question}</div>
                {e.status === "answered" || e.status === "signed" ? (
                  <div className="mt-2 rounded-lg border border-green/30 bg-green/5 p-2.5 text-[11.5px] leading-6 whitespace-pre-wrap text-text">{e.signed && <IconSignature size={12} stroke={1.7} className="mr-1 inline" />}{e.answer}</div>
                ) : (
                  <div className="mt-2">
                    <textarea value={drafts[e.id] || ""} onChange={(ev) => setDrafts({ ...drafts, [e.id]: ev.target.value })} placeholder={t("Write your expert reply — your name goes on it…", "専門家としての回答を記入（あなたの名前が付きます）…", "寫下你的專業回覆——上面會署你的名字…")} rows={2}
                      className="w-full rounded-lg border border-glassborder/20 bg-panel2/50 px-2.5 py-1.5 text-[11.5px] outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow" />
                    <div className="mt-1.5 flex gap-2">
                      <button disabled={busy === e.id} onClick={() => makeDraft(e.id)} className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted transition hover:text-text disabled:opacity-40">{t("Draft", "下書き", "生成草稿")}</button>
                      <button disabled={busy === e.id} onClick={() => answer(e.id, false)} className="btn-glow rounded-lg border border-transparent px-2.5 py-1 text-[11px] font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-40 bg-purple">{t("Reply", "返信", "回覆")}</button>
                      <button disabled={busy === e.id} onClick={() => answer(e.id, true)} className="rounded-lg border border-green/50 px-2.5 py-1 text-[11px] text-green transition hover:bg-green/10 disabled:opacity-40">{t("Reply & Sign", "返信して署名", "回覆並實名簽核")}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* knowledge protection */}
      <div className="mt-8">
        <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Knowledge Protection", "知識保護", "知識保護")}</div>
        <ProtectionPanel />
      </div>
    </div>
  );
}

function Stat({ v, l, tone }: { v: React.ReactNode; l: string; tone: string }) {
  return <div className="glass-card px-4 py-3"><div className="font-display text-[20px] font-extrabold" style={{ color: tone }}>{v}</div><div className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">{l}</div></div>;
}
function Mini({ v, l }: { v: React.ReactNode; l: string }) {
  return <div><div className="font-display text-[13px] font-extrabold">{v}</div><div className="text-[9.5px] text-faint">{l}</div></div>;
}
function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const m: Record<string, [string, string]> = { published: [t("Published", "公開中", "已發布"), "text-green"], draft: [t("Draft", "下書き", "草稿"), "text-amber"], review: [t("In Review", "審査中", "審核中"), "text-muted"], suspended: [t("Suspended", "停止中", "已停用"), "text-rust"] };
  const [l, c] = m[status] || ["", "text-muted"];
  return <span className={`text-[10px] ${c}`}>● {l}</span>;
}
