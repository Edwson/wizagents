"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChatBox from "./ChatBox";
import Sparkline from "./Sparkline";
import { catLabel } from "@/lib/categories";
import { typeLabel, typeGlyph, typeTagline } from "@/lib/agent-types";
import { useToast } from "./Toast";
import FavoriteButton from "./FavoriteButton";
import { useCards, AddCardForm, type Card } from "./PaymentMethods";
import { IconCreditCard } from "@tabler/icons-react";
import SimilarAgents from "./SimilarAgents";
import EndorsementRequest from "./EndorsementRequest";
import StepUp from "./StepUp";
import type { AgentDTO } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { IconCheck, IconX, IconLock, IconGauge, IconEye } from "@tabler/icons-react";
import AgentPitch from "./AgentPitch";
import { Reveal, Btn, Badge, Magnetic, GradientText } from "@/components/ui";
import VerifiedBadge from "./VerifiedBadge";
import LoyaltyPanel from "./LoyaltyPanel";
import { benefitsFor } from "@/lib/loyalty";
import type { Level } from "@/lib/verification";
import { METHOD_NOTE } from "@/lib/fidelity";

type KV = { version: string; note: string; docCount: number; createdAt: string };
type RV = { authorName: string; rating: number; comment: string };
type MP = { month: string; subscribers: number };

export type DetailAgent = {
  creatorId: string;
  slug: string; name: string; creatorName: string; category: string; agentType: string; price: number;
  renewal: number; subscribers: number; rating: number; description: string; features: string[];
  updatedLabel: string; inPass: boolean; trialLimit: number; escalationPrice: number; signaturePrice: number;
  replacesRate: number; replacesRole: string; savesHrs: number; knowledgeSummary: string;
  /** The expert's own presentation of this Agent. All optional — older agents have none. */
  pitch?: string; useCases?: string[]; notFor?: string; sampleQuestions?: string[]; tags?: string[];
  /** draft | review | published | suspended. Only ever non-published in owner/admin preview. */
  status?: string;
  knowledgeVersions: KV[]; reviews: RV[]; metrics: MP[]; verticalLabel: string; creatorBio: string; licenseInfo: string;
  /** 0 = not yet measured. Only ever set by a real harness run — never illustrative. */
  fidelityScore: number;
  /** Provenance of the score. Optional: the page may not thread them yet — we render gracefully without. */
  fidelityMeasuredAt?: string | null; fidelitySamplesN?: number;
  regulated: boolean;
  /** Reviewed verification tier of the creator. Absent → no badge. */
  creatorLevel?: Level;
};

/** Tenure facts for the viewer's own subscription to this Agent. Optional: the page may thread it,
 *  otherwise we read it from the digest endpoint, which already scopes to the current user. */
export type ViewerSubscription = { startedAt: string; lockedPrice?: number | null; credits?: number };

export default function AgentDetail({ agent, subscribed, token, hasPass, loggedIn, favorited, similar, more, subscribedIds, preview = false, viaSeat = false, subscription }: {
  agent: DetailAgent; subscribed: boolean; token: string | null; hasPass: boolean; loggedIn: boolean; favorited?: boolean;
  similar?: AgentDTO[]; more?: AgentDTO[]; subscribedIds?: string[];
  /** Owner/admin viewing an unpublished Agent. Buyer-identical, minus the ability to transact. */
  preview?: boolean; viaSeat?: boolean;
  /** If the page threads it, we skip the client fetch. */
  subscription?: ViewerSubscription;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [isSub, setIsSub] = useState(subscribed);
  const [tok, setTok] = useState(token);
  const [checkout, setCheckout] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [starter, setStarter] = useState("");
  const [starterKey, setStarterKey] = useState(0);
  const [loyal, setLoyal] = useState<ViewerSubscription | null>(subscription ?? null);

  // A subscriber's tenure is theirs to see. If the page didn't thread it, ask the digest —
  // it is user-scoped and already knows the tier, locked price and credits for every subscription.
  useEffect(() => {
    if (!isSub || subscription) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/digest");
        if (!res.ok) return;
        const d = await res.json();
        const item = (d?.items ?? []).find((i: any) => i.slug === agent.slug);
        if (!alive || !item) return;
        // The digest reports tenure in months (its `since` field is the last statement date, not the
        // subscription start), so we reconstruct an equivalent start date for benefitsFor().
        const months: number = item.loyalty?.months ?? 0;
        setLoyal({
          startedAt: new Date(Date.now() - months * 30 * 86400000).toISOString(),
          lockedPrice: item.lockedPrice ?? null,
          credits: item.credits ?? 0,
        });
      } catch { /* the panel simply doesn't render */ }
    })();
    return () => { alive = false; };
  }, [isSub, subscription, agent.slug]);

  const addonPct = loyal ? benefitsFor(loyal.startedAt).addonDiscountPct : 0;
  const escPrice = addonPct > 0 ? agent.escalationPrice - Math.round((agent.escalationPrice * addonPct) / 100) : agent.escalationPrice;
  const sigPrice = addonPct > 0 ? agent.signaturePrice - Math.round((agent.signaturePrice * addonPct) / 100) : agent.signaturePrice;
  const samples = (agent.sampleQuestions ?? []).filter((q) => q && q.trim());
  function askStarter(q: string) { setStarter(q); setStarterKey((k) => k + 1); }
  const passCovered = hasPass && agent.inPass;
  // Never assert a verification we haven't been handed. Absent → no badge.
  const creatorLevel: Level = agent.creatorLevel ?? "none";
  const monthEq = Math.max(1, Math.round(agent.replacesRate / agent.price));

  async function doSubscribe(viaPass = false) {
    if (!loggedIn) { router.push("/login"); return; }
    const res = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: agent.slug, viaPass }) });
    const data = await res.json();
    if (data.ok) { setIsSub(true); setTok(data.token); setCheckout(false); toast(t("Subscribed! MCP endpoint is ready","購読しました！MCP エンドポイントが利用可能です","訂閱成功！MCP 端點已就緒"),"success"); router.refresh(); } else { toast(data.error || t("Subscription failed","購読に失敗しました","訂閱失敗"),"error"); }
  }
  async function submitReview() {
    if (!comment.trim()) return;
    await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: agent.slug, rating, comment }) });
    setComment(""); toast(t("Thanks for your review","レビューありがとうございます","感謝你的評價"),"success"); router.refresh();
  }

  const statusWord = agent.status === "review"
    ? t("in review","審査中","審核中")
    : agent.status === "suspended"
      ? t("suspended","公開停止中","已暫停")
      : t("draft","下書き","草稿");

  return (
    <div className="animate-fadein">
      {preview && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber/40 bg-amber/[0.06] px-4 py-3">
          <span className="flex items-center gap-2 text-[12.5px] font-medium text-amber">
            <IconEye size={15} stroke={1.7} aria-hidden />
            {t("Preview","プレビュー","預覽")}
          </span>
          <span className="text-[12px] leading-6 text-muted">
            {t(`This Agent is a ${statusWord} and is not visible to buyers.`,`この Agent は${statusWord}のため、購入者には表示されません。`,`此 Agent 目前為${statusWord}，買家看不到。`)}
          </span>
          <Link href={`/studio/agent/${agent.slug}`} className="ml-auto text-[12px] text-purple underline-offset-4 hover:underline">
            {t("Edit in Studio →","スタジオで編集 →","前往工作室編輯 →")}
          </Link>
        </div>
      )}
      <Link href="/market" className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-purple">{t("← Back to market","← マーケットに戻る","← 返回市集")}</Link>
      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* MAIN */}
        <div className="space-y-8">
          <Reveal as="div" className="glass-card border-grad relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-purple/5 blur-3xl" aria-hidden />
            <div className="relative flex flex-wrap items-center gap-2">
              <Badge tone="muted">{catLabel(agent.category)}</Badge>
              <Badge tone="purple"><span className="font-display">{typeGlyph(agent.agentType)}</span> {typeLabel(agent.agentType, locale)}</Badge>
              <VerifiedBadge level={creatorLevel} />
              <span className="text-[11px] text-amber">{agent.rating >= 1 ? `★ ${agent.rating.toFixed(1)}` : t("New","新着","新")}（{t(`${agent.reviews.length} reviews`,`${agent.reviews.length} 件`,`${agent.reviews.length} 則`)}）</span>
              <span className="text-[11px] text-muted" title={t("Illustrative until measured","計測されるまで参考値","量測前為示意值")}>· {t(`${agent.subscribers} subscribers`,`${agent.subscribers} 人の購読者`,`${agent.subscribers} 位訂閱者`)}</span>
              <span className="text-[10px] text-faint">· {t("illustrative","参考値","示意")}</span>
              <FidelityChip agent={agent} />
            </div>
            <div className="relative mt-3 flex items-start justify-between gap-3">
              <h1 className="font-display text-[28px] font-extrabold leading-9 tracking-tight"><GradientText>{agent.name}</GradientText></h1>
              <FavoriteButton slug={agent.slug} initialFav={favorited} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">{t("by","by","by")} <Link href={`/creator/${agent.creatorId}`} className="text-text hover:text-purple">{agent.creatorName}</Link> <VerifiedBadge level={creatorLevel} size="sm" /> · {agent.verticalLabel}</div>
            <div className="relative mt-3 flex items-start gap-2.5 rounded-lg border border-purple/20 bg-purple/[0.04] px-3 py-2.5">
              <span className="font-display text-[20px] font-bold leading-6 text-purple">{typeGlyph(agent.agentType)}</span>
              <div>
                <div className="font-display text-[12.5px] font-bold text-text">{typeLabel(agent.agentType, locale)}</div>
                <div className="mt-0.5 text-[11.5px] leading-5 text-muted">{typeTagline(agent.agentType, locale)}</div>
              </div>
            </div>
            <AgentPitch
              className="relative mt-5"
              pitch={agent.pitch}
              creatorName={agent.creatorName}
              useCases={agent.useCases}
              notFor={agent.notFor}
              tags={agent.tags}
            />
            <p className="mt-4 text-[13.5px] leading-7 text-muted">{agent.description}</p>
            {agent.regulated && (
              <p className="relative mt-3 rounded-lg border border-amber/30 bg-amber/[0.05] px-3 py-2 text-[11px] leading-6 text-amber">{t("Informational — method plus a human in the loop, not licensed advice; gated by jurisdiction.","情報提供のみ — 手法と人間による確認を伴い、有資格者の助言ではありません。管轄により制限されます。","僅供參考 — 方法搭配真人把關，並非持照專業建議；依司法管轄權限制。")}</p>
            )}
          </Reveal>

          <Reveal as="div" className="glass-card border-grad p-5">
            <div className="font-display text-[13px] font-bold text-grad-neon">{t("Why subscribe?","なぜ購読する価値があるのか？","為什麼值得訂閱？")}</div>
            <div className="mt-2 text-[13px] leading-7 text-muted">
              {t("Monthly","月額","月費")} <span className="font-bold text-text">${agent.price}</span> ≈ {t("the cost of","","")}<span className="text-text">{monthEq} {t("min","分","分鐘")}</span>{t(" of a ","の","的")}<span className="text-purple">${agent.replacesRate}/hr</span> {agent.replacesRole}{t(" — but you get an expert who is available 24/7 and updated weekly, all month long."," の費用——でも実際に手に入るのは、まるまる1か月 24/7 稼働し毎週更新される専門家です。","的費用——但你換到的是整個月 24/7 且每週更新的專家。")} {t("Estimated","予想節約時間","預估每月省下")} ~<span className="text-green">{agent.savesHrs} {t("hrs","時間","小時")}</span>{t(" of expert time saved per month.","／月の専門時間。","的專業時間。")}
            </div>
          </Reveal>

          <Section title={t("What's covered","対応できること","涵蓋能力")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {agent.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl hairline bg-panel/40 px-3 py-2.5 text-[12.5px] text-muted backdrop-blur-sm transition-colors hover:border-green/40">
                  <span className="mt-0.5 text-green"><IconCheck size={14} stroke={2} /></span>{f}
                </div>
              ))}
            </div>
          </Section>

          <Section title={t("Trial sandbox · Try before you buy","試用サンドボックス · 購入前にお試し","試用沙盒 · 購買前先驗貨")}>
            <p className="mb-3 text-[12px] text-faint">{t(`Free trial of ${agent.trialLimit} conversations — validate quality with real tasks. This isn't just a chatbot, it's "an expert + their AI twin".`,`無料で ${agent.trialLimit} 回の対話をお試し。実際のタスクで品質を確認できます。単なるチャットボットではなく「専門家＋その AI 分身」です。`,`免費試用 ${agent.trialLimit} 次對話，用真實任務驗證品質。這不只是聊天機器人，而是「一位專家 + 他的 AI 分身」。`)}</p>
            {samples.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-faint">{t("Starter questions from the expert","専門家おすすめの最初の質問","專家建議的起手問題")}</div>
                <div className="flex flex-wrap gap-2">
                  {samples.map((q, i) => (
                    <button key={i} type="button" onClick={() => askStarter(q)}
                      className="rounded-full border border-border bg-panel/40 px-3 py-1.5 text-left text-[12px] leading-5 text-muted transition-colors hover:border-purple/50 hover:text-text">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <ChatBox slug={agent.slug} mode={isSub ? "full" : "trial"} trialLimit={agent.trialLimit}
              canEscalate={isSub} escalationPrice={escPrice} onNeedSub={() => setCheckout(true)}
              prefill={starter} prefillKey={starterKey} />
          </Section>

          <Section title={t("Expert Loop · Expert endorsement loop","Expert Loop · 専門家の裏付けループ","Expert Loop · 專家背書迴路")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { t: t("Human escalation","人へエスカレーション","真人升級"), d: t(`Escalate to ${agent.creatorName} in person when confidence is below threshold; reply within SLA.`,`信頼度が閾値を下回ると ${agent.creatorName} 本人にエスカレーションし、SLA 内に回答。`,`超出信心閾值時升級 ${agent.creatorName} 本人，SLA 內回覆。`), p: <AddonPrice list={agent.escalationPrice} now={escPrice} suffix={t("","から","起")} lead={t("From ","","")} /> },
                { t: t("Signed sign-off","実名署名","實名簽核"), d: t("Carries professional identity and timestamp; suitable for audit documents.","職業上の身分とタイムスタンプ付きで、監査文書に利用可能。","帶執業身分與時間戳，可放入稽核文件。"), p: <AddonPrice list={agent.signaturePrice} now={sigPrice} suffix={t("/item","/件","/件")} /> },
                { t: t("Version traceability","バージョン追跡","版本溯源"), d: t("Every answer traces back to that day's knowledge-base version snapshot.","すべての回答はその日の知識ベースのバージョンスナップショットまで遡れます。","每個答案回溯到當天知識庫版本快照。"), p: <span>{t("Included","込み","內含")}</span> },
              ].map((x) => (
                <div key={x.t} className="glass-card border-grad p-4">
                  <div className="font-display text-[13px] font-bold text-purple">{x.t}</div>
                  <div className="mt-1.5 text-[11.5px] leading-6 text-muted">{x.d}</div>
                  <div className="mt-2 text-[11px] text-amber">{x.p}</div>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Section title={t("Renewal trend","継続率の推移","續訂率趨勢")}>
              <div className="glass-card p-4">
                <div className="flex items-end justify-between">
                  <div><div className="font-display text-[24px] font-extrabold text-green">{agent.renewal}%</div><div className="text-[11px] text-muted">{t("90-day renewal","90 日継続率","90 天續訂率")}</div></div>
                  <Sparkline points={agent.metrics.map((m) => m.subscribers)} tone="#4ade80" />
                </div>
              </div>
            </Section>
            <Section title={t("Living knowledge · Recent updates","生きた知識 · 最近の更新","活的知識 · 近期更新")}>
              <div className="space-y-2">
                {agent.knowledgeVersions.map((k, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg hairline bg-panel/40 px-3 py-2 text-[11.5px] backdrop-blur-sm">
                    <span className="text-muted">{k.note}</span>
                    <span className="font-mono text-faint">{k.version} · {t(`${k.docCount} docs`,`${k.docCount} 件`,`${k.docCount} 檔`)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <Section title={t(`Subscriber reviews (${agent.reviews.length})`,`購読者レビュー（${agent.reviews.length}）`,`訂閱者評價（${agent.reviews.length}）`)}>
            <div className="space-y-3">
              {agent.reviews.map((r, i) => (
                <div key={i} className="glass-card p-3.5">
                  <div className="flex items-center justify-between"><span className="font-display text-[12.5px] font-bold">{r.authorName}</span><span className="text-[11px] text-amber">{"★".repeat(r.rating)}</span></div>
                  <div className="mt-1.5 text-[12px] leading-6 text-muted">{r.comment}</div>
                </div>
              ))}
              {isSub && (
                <div className="rounded-xl border border-dashed border-glassborder/70 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-[12px] text-muted">{t("Your rating:","あなたの評価：","你的評分：")}
                    {[1,2,3,4,5].map((n) => <button key={n} onClick={() => setRating(n)} className={n <= rating ? "text-amber" : "text-faint"}>★</button>)}
                  </div>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("Share your experience…","使用した感想を共有…","分享你的使用體驗…")} className="w-full rounded-lg hairline bg-panel/40 px-3 py-2 text-[12.5px] outline-none backdrop-blur-sm transition-colors focus:border-purple" rows={2} />
                  <Btn onClick={submitReview} variant="primary" size="sm" className="mt-2">{t("Submit review","レビューを送信","送出評價")}</Btn>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* SIDEBAR */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="glass-card border-grad glow relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-purple/5 blur-2xl" aria-hidden />
            {passCovered && !isSub && <div className="relative mb-3 rounded-md border border-green/40 bg-green/10 px-3 py-1.5 text-center text-[11px] text-green">{t("Included in your Pass","あなたのパスに含まれています","已含在你的通行證")}</div>}
            <div className="relative flex items-end gap-1">
              <span className="font-display text-[34px] font-extrabold text-grad">${agent.price}</span>
              <span className="mb-1.5 text-[12px] text-muted">/mo</span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
              <span className="text-green">● {t(`Renewal ${agent.renewal}%`,`継続 ${agent.renewal}%`,`續訂 ${agent.renewal}%`)}</span>
              <span>{agent.rating >= 1 ? `★ ${agent.rating.toFixed(1)}` : t("New","新着","新")}</span>
            </div>

            {isSub ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-center gap-1 rounded-lg border border-green/40 bg-green/10 px-3 py-2 text-center text-[12px] font-bold text-green"><IconCheck size={14} stroke={2} /> {t("Subscribed","購読済み","已訂閱")}</div>
                <div>
                  <div className="mb-1 text-[10.5px] text-faint">{t("MCP endpoint (paste into any AI tool)","MCP エンドポイント（任意の AI ツールに貼付）","MCP 端點（貼入任何 AI 工具）")}</div>
                  <code className="block break-all rounded-md border-grad glass px-2.5 py-2 font-mono text-[10.5px] text-grad-neon">https://mcp.wiz-agents.com/a/{agent.slug}</code>
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] text-faint">{t("Your access token","あなたの認証トークン","你的授權 Token")}</div>
                  <code className="block break-all rounded-md border-grad glass px-2.5 py-2 font-mono text-[10.5px] text-muted">{tok}</code>
                </div>
                <Btn href="/dashboard" variant="outline" className="w-full">{t("Go to my subscriptions →","マイ購読へ →","前往我的訂閱 →")}</Btn>
              </div>
            ) : preview ? (
              <div className="relative mt-4 space-y-2">
                <Btn disabled variant="outline" size="lg" className="w-full cursor-not-allowed opacity-60">{t("Publish to enable subscriptions","公開すると購読できます","發布後才能訂閱")}</Btn>
                <div className="pt-1 text-center text-[10.5px] leading-5 text-faint">{t("This is how the subscribe panel will look to buyers.","購入者にはこのように表示されます。","買家看到的訂閱區塊會長這樣。")}</div>
              </div>
            ) : (
              <div className="relative mt-4 space-y-2">
                <Magnetic><Btn onClick={() => (loggedIn ? setCheckout(true) : router.push("/login"))} variant="amber" size="lg" className="w-full">{t("Subscribe now","今すぐ購読","立即訂閱")}</Btn></Magnetic>
                {agent.inPass && hasPass && <button onClick={() => doSubscribe(true)} className="w-full rounded-xl border border-green/40 py-2 text-[12.5px] text-green transition-colors hover:bg-green/10">{t("Activate free with Pass","パスで無料開通","用通行證免費開通")}</button>}
                <div className="pt-1 text-center text-[10.5px] text-faint">{t(`Free ${agent.trialLimit} trials · Cancel anytime`,`無料試用 ${agent.trialLimit} 回 · いつでも解約可`,`免費試用 ${agent.trialLimit} 次 · 隨時退訂`)}</div>
              </div>
            )}

            <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-glassborder/60 pt-4 text-center">
              <Mini v={agent.subscribers} l={t("Subscribers","購読者","訂閱者")} /><Mini v={`${agent.renewal}%`} l={t("Renewal","継続率","續訂率")} /><Mini v={agent.rating >= 1 ? agent.rating.toFixed(1) : t("New","新着","新")} l={t("Rating","評価","評分")} />
            </div>
          </div>

          {isSub && loyal && (
            <div className="mt-4">
              <LoyaltyPanel startedAt={loyal.startedAt} lockedPrice={loyal.lockedPrice} listPrice={agent.price} credits={loyal.credits} />
            </div>
          )}

          <div className="mt-4 glass-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{t("Need a real sign-off?","実名の署名が必要ですか？","需要實名簽核？")}</div>
            <p className="mt-1.5 text-[11.5px] leading-6 text-muted">{t("When an answer isn't enough, have the expert review and publicly sign your claim — with a citable reference for reviewers, investors, or committees.","回答だけでは足りないとき、専門家が主張をレビューし公開署名します。査読者・投資家・委員会向けの引用可能な参照コード付き。","當一個答案還不夠時，讓專家審閱並公開簽核你的主張，附上可供審稿人、投資人或委員會引用的參照代碼。")}</p>
            <div className="mt-3">
              <EndorsementRequest agent={{ slug: agent.slug, name: agent.name, creatorName: agent.creatorName, signaturePrice: agent.signaturePrice }} loggedIn={loggedIn} />
            </div>
          </div>

          <div className="mt-4 glass-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{t("About the expert","専門家について","關於專家")}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link href={`/creator/${agent.creatorId}`} className="block font-display text-[13px] font-bold text-text transition-colors hover:text-purple">{agent.creatorName} →</Link>
              <VerifiedBadge level={creatorLevel} size="sm" />
            </div>
            <div className="mt-1 text-[11.5px] leading-6 text-muted">{agent.creatorBio}</div>
            {agent.licenseInfo && <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-green"><IconCheck size={13} stroke={2} /> {agent.licenseInfo}</div>}
          </div>
        </div>
      </div>

      <SimilarAgents title={t("Similar Agents","類似のAgent","相似 Agent")} agents={similar ?? []} subscribedIds={subscribedIds ?? []} hasPass={hasPass} />
      <SimilarAgents title={t("More from this creator","このクリエイターの他のAgent","同一創作者的更多 Agent")} agents={more ?? []} subscribedIds={subscribedIds ?? []} hasPass={hasPass} />

      {/* CHECKOUT MODAL */}
      {checkout && <Checkout agent={agent} onClose={() => setCheckout(false)} onConfirm={() => doSubscribe(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Reveal as="div"><div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint"><span className="inline-block h-px w-6 bg-gradient-to-r from-violet to-transparent" />{title}</div>{children}</Reveal>;
}
/** Shows the price a subscriber actually pays, with the list price struck through when loyalty discounts it. */
function AddonPrice({ list, now, lead = "", suffix = "" }: { list: number; now: number; lead?: string; suffix?: string }) {
  if (now >= list) return <span>{lead}${list}{suffix}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-faint line-through">${list}</span>
      <span>{lead}${now}{suffix}</span>
    </span>
  );
}
function Mini({ v, l }: { v: React.ReactNode; l: string }) {
  return <div><div className="font-display text-[15px] font-extrabold text-grad">{v}</div><div className="text-[10px] text-faint">{l}</div></div>;
}

function Checkout({ agent, onClose, onConfirm }: { agent: DetailAgent; onClose: () => void; onConfirm: () => void }) {
  const { t, locale } = useI18n();
  const { cards, loaded, reload } = useCards();
  const [processing, setProcessing] = useState(false);
  const [addNew, setAddNew] = useState(false);
  const [selId, setSelId] = useState<string>("");
  const [stepUp, setStepUp] = useState(false);
  const needsStepUp = agent.price >= 100; // high-value real charge requires verification
  function proceed() { setStepUp(false); setProcessing(true); setTimeout(onConfirm, 500); }
  function handleConfirm() { if (needsStepUp) { setStepUp(true); return; } proceed(); }
  const chosen: Card | undefined = cards.find((c) => c.id === selId) || cards.find((c) => c.isDefault) || cards[0];
  const showAdd = addNew || (loaded && cards.length === 0);
  const BRAND: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover", jcb: "JCB", card: "Card" };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadein" onClick={onClose}>
      <div className="glass-strong border-grad w-full max-w-md rounded-2xl p-6 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div className="font-display text-[16px] font-bold">{t("Confirm subscription","購読の確認","確認訂閱")}</div><button onClick={onClose} className="text-faint hover:text-text"><IconX size={16} stroke={2} /></button></div>
        <div className="mt-4 rounded-xl hairline bg-panel/40 p-3.5 text-[12.5px] backdrop-blur-sm">
          <div className="flex justify-between"><span className="text-muted">{agent.name}</span><span className="font-display font-bold text-grad">${agent.price}/mo</span></div>
          <div className="mt-1 text-[11px] text-faint">by {agent.creatorName} · {t("Cancel anytime","いつでも解約可","隨時可取消")}</div>
        </div>

        {!showAdd ? (
          <div className="mt-4 space-y-2">
            <div className="text-[11px] text-faint">{t("Pay with","支払い方法","付款方式")}</div>
            {cards.map((c) => (
              <button key={c.id} onClick={() => setSelId(c.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all ${chosen?.id === c.id ? "border-grad glass-card !p-[10px]" : "hairline bg-panel/40 backdrop-blur-sm hover:border-purple/50"}`}>
                <span className="flex items-center gap-2.5"><IconCreditCard size={17} className="text-muted" stroke={1.7} /><span className="text-[13px] font-bold">{BRAND[c.brand]} •••• {c.last4}</span>{c.isDefault && <span className="rounded-full border border-green/40 px-1.5 py-0.5 text-[9px] text-green">{t("Default","デフォルト","預設")}</span>}</span>
                <span className="text-[10.5px] text-faint">{String(c.expMonth).padStart(2,"0")}/{String(c.expYear).slice(-2)}</span>
              </button>
            ))}
            <button onClick={() => setAddNew(true)} className="w-full rounded-xl border border-dashed border-glassborder/70 py-2 text-[12px] text-muted transition-colors hover:border-purple hover:text-text">+ {t("Use a different card","別のカードを使う","使用其他卡片")}</button>
            <Btn disabled={!chosen || processing} onClick={handleConfirm} variant="amber" size="lg" className="mt-2 w-full disabled:opacity-40">
              {processing ? t("Processing…","処理中…","處理中…") : t(`Confirm · $${agent.price}/mo`,`確定 · $${agent.price}/mo`,`確認訂閱 · $${agent.price}/mo`)}
            </Btn>
            {needsStepUp && (
              <div className="flex items-center justify-center gap-1 text-center text-[10.5px] text-muted"><IconLock size={11} stroke={1.8} className="text-violet" /> {t("Protected by verification for payments ≥ $100","100ドル以上の支払いは本人確認で保護されます","滿 $100 的付款需經驗證保護")}</div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <AddCardForm compact onAdded={() => { setAddNew(false); reload(); }} />
            {cards.length > 0 && <button onClick={() => setAddNew(false)} className="mt-2 w-full text-[11px] text-muted">{t("Back to saved cards","保存済みカードに戻る","返回已儲存卡片")}</button>}
          </div>
        )}
        <div className="mt-3 flex items-center justify-center gap-1 text-center text-[10px] text-faint"><IconLock size={11} stroke={1.8} /> {t("Test environment · No real charge","テスト環境 · 実際には課金されません","測試環境 · 不會真的扣款")}</div>
      </div>
      <div onClick={(e) => e.stopPropagation()}><StepUp open={stepUp} onClose={() => setStepUp(false)} onVerified={proceed} title={t("Confirm payment","支払いの確認","確認付款")} /></div>
    </div>
  );
}

/** Buyer-facing fidelity. We never claim 100% and we never show a number we did not measure:
 *  a score appears only when a real harness run set it, with how it was measured stated plainly. */
function FidelityChip({ agent }: { agent: DetailAgent }) {
  const { t, locale } = useI18n();
  const [openMethod, setOpenMethod] = useState(false);

  if (!(agent.fidelityScore > 0)) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-faint" title={t("No held-out measurement has been run for this Agent yet.","このエージェントはまだ取り置きテストで計測されていません。","這個 Agent 尚未跑過保留題目的量測。")}>
        <IconGauge size={13} stroke={1.7} /> {t("Fidelity: not yet measured","再現度：未計測","還原度：尚未量測")}
      </span>
    );
  }

  const n = agent.fidelitySamplesN;
  const date = agent.fidelityMeasuredAt
    ? new Date(agent.fidelityMeasuredAt).toLocaleDateString(locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-TW" : "en-US", { year: "numeric", month: "short", day: "numeric" })
    : "";
  const provenance = n
    ? t(`measured against ${n} held-out expert answers${date ? ` · ${date}` : ""}`,
        `${n} 件の取り置き回答で計測${date ? ` · ${date}` : ""}`,
        `以 ${n} 則保留專家答案量測${date ? ` · ${date}` : ""}`)
    : t(`measured against held-out expert answers${date ? ` · ${date}` : ""}`,
        `取り置きの専門家回答で計測${date ? ` · ${date}` : ""}`,
        `以保留的專家答案量測${date ? ` · ${date}` : ""}`);

  return (
    <>
      <Badge tone="cyan"><IconGauge size={12} stroke={1.7} /> {t(`Fidelity ${agent.fidelityScore}%`,`再現度 ${agent.fidelityScore}%`,`還原度 ${agent.fidelityScore}%`)}</Badge>
      <button
        type="button"
        onClick={() => setOpenMethod((v) => !v)}
        aria-expanded={openMethod}
        title={METHOD_NOTE[locale] ?? METHOD_NOTE.en}
        className="text-[10.5px] text-faint underline decoration-dotted underline-offset-2 transition hover:text-muted"
      >
        {provenance}
      </button>
      {openMethod && (
        <div className="basis-full rounded-lg border border-glassborder/15 bg-panel2/40 px-2.5 py-1.5 text-[10.5px] leading-5 text-faint">
          <span className="text-muted">{t("How this was measured","計測方法","如何量測")}:</span> {METHOD_NOTE[locale] ?? METHOD_NOTE.en}
        </div>
      )}
    </>
  );
}
