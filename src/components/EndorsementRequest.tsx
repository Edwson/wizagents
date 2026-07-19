"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, Badge } from "@/components/ui";
import { money } from "@/lib/format";
import {
  IconFileCertificate,
  IconX,
  IconShieldCheck,
} from "@tabler/icons-react";

type Agent = { slug: string; name: string; creatorName: string; signaturePrice: number };
type Scope = "reviewed" | "engaged";

export default function EndorsementRequest({
  agent,
  loggedIn = true,
  className = "",
}: {
  agent: Agent;
  loggedIn?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [scope, setScope] = useState<Scope>("reviewed");
  const [busy, setBusy] = useState(false);
  const [needSub, setNeedSub] = useState(false);
  const [done, setDone] = useState<{ refCode: string } | null>(null);

  const reviewedPrice = agent.signaturePrice;
  const engagedPrice = agent.signaturePrice * 4;

  function reset() {
    setSubject(""); setContext(""); setScope("reviewed"); setNeedSub(false); setDone(null);
  }
  function close() { setOpen(false); reset(); }

  async function submit() {
    if (subject.trim().length < 3) {
      toast(t("Describe what needs endorsing", "何を保証してほしいか記入してください", "請說明需要背書的內容"), "error");
      return;
    }
    setBusy(true); setNeedSub(false);
    try {
      const res = await fetch("/api/endorsement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: agent.slug, subject: subject.trim(), context: context.trim(), scope }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone({ refCode: data.endorsement.refCode });
        toast(t("Endorsement requested", "エンドースメントを依頼しました", "已送出背書申請"), "success");
        router.refresh();
      } else if (data.code === "not_subscriber") {
        setNeedSub(true);
      } else if (data.code === "own_agent") {
        toast(t("You can't request an endorsement of your own agent", "自分のエージェントには依頼できません", "無法為自己的 Agent 申請背書"), "error");
      } else {
        toast(data.error || t("Request failed", "リクエストに失敗しました", "申請失敗"), "error");
      }
    } catch {
      toast(t("Request failed", "リクエストに失敗しました", "申請失敗"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => (loggedIn ? setOpen(true) : router.push("/login"))}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border border-purple/40 bg-purple/5 px-3 py-2.5 text-[12.5px] font-semibold text-purple transition-colors hover:bg-purple/10 ${className}`}
      >
        <IconFileCertificate size={16} stroke={1.7} />
        {t("Request a signed endorsement", "実名エンドースメントを依頼", "申請實名背書")}
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={close}>
          <div
            className="glass-card border-grad relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <IconFileCertificate size={22} className="text-purple" stroke={1.7} />
                <div className="font-display text-[16px] font-bold text-text">
                  {t("Request a signed endorsement", "実名エンドースメントを依頼", "申請實名背書")}
                </div>
              </div>
              <button onClick={close} className="text-faint transition-colors hover:text-text" aria-label="Close">
                <IconX size={16} stroke={2} />
              </button>
            </div>

            {done ? (
              <div className="mt-6 text-center">
                <IconShieldCheck size={38} className="mx-auto text-green" stroke={1.7} />
                <div className="mt-3 font-display text-[17px] font-bold text-text">
                  {t("Request submitted", "依頼を送信しました", "申請已送出")}
                </div>
                <p className="mt-2 text-[12.5px] leading-6 text-muted">
                  {t(
                    `${agent.creatorName} will review and sign within SLA. Track it — and cite it once signed — from your dashboard.`,
                    `${agent.creatorName} が SLA 内にレビューし署名します。署名後はダッシュボードから引用できます。`,
                    `${agent.creatorName} 將於 SLA 內審閱並簽核。簽核後可於儀表板追蹤並引用。`,
                  )}
                </p>
                <div className="mt-4 rounded-lg border border-border bg-panel/40 px-4 py-3">
                  <div className="text-[10.5px] uppercase tracking-[0.16em] text-faint">
                    {t("Reference code", "参照コード", "參照代碼")}
                  </div>
                  <div className="mt-1 font-mono text-[20px] font-bold tracking-[0.12em] text-text">{done.refCode}</div>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-faint">
                  {t(
                    "Public citation becomes live at /verify/… once the expert signs.",
                    "専門家の署名後、/verify/… で公開引用が有効になります。",
                    "專家簽核後，/verify/… 的公開引用即生效。",
                  )}
                </p>
                <Btn onClick={close} variant="outline" className="mt-5 w-full">{t("Done", "完了", "完成")}</Btn>
              </div>
            ) : needSub ? (
              <div className="mt-6 text-center">
                <div className="font-display text-[15px] font-bold text-text">
                  {t("An active subscription is required", "有効な購読が必要です", "需有有效訂閱")}
                </div>
                <p className="mt-2 text-[12.5px] leading-6 text-muted">
                  {t(
                    "Endorsements are available to subscribers of this agent. Subscribe first, then request a citable sign-off.",
                    "エンドースメントはこのエージェントの購読者が利用できます。まず購読してから、引用可能な署名を依頼してください。",
                    "背書僅開放給此 Agent 的訂閱者。請先訂閱，再申請可引用的簽核。",
                  )}
                </p>
                <div className="mt-5 flex gap-2">
                  <Btn onClick={() => setNeedSub(false)} variant="ghost" className="flex-1">{t("Back", "戻る", "返回")}</Btn>
                  <Btn href={`/agent/${agent.slug}`} variant="amber" className="flex-1">{t("View subscription", "購読を見る", "查看訂閱")}</Btn>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <p className="text-[12.5px] leading-6 text-muted">
                  {t(
                    `Sometimes an answer isn't enough. Have ${agent.creatorName} — a named human — review and publicly sign off on your claim, with a citable reference you can put in front of a reviewer, investor, or committee.`,
                    `回答だけでは足りないことがあります。実名の ${agent.creatorName} があなたの主張をレビューし、査読者・投資家・委員会に提示できる引用可能な署名を公開します。`,
                    `有時候一個答案還不夠。讓具名的真人 ${agent.creatorName} 審閱並公開簽核你的主張，附上可放在審稿人、投資人或委員會面前的引用代碼。`,
                  )}
                </p>

                {/* Tier selector */}
                <div className="grid grid-cols-2 gap-2">
                  <TierCard
                    active={scope === "reviewed"}
                    onClick={() => setScope("reviewed")}
                    title={t("Reviewed", "レビュー", "審閱")}
                    price={money(reviewedPrice)}
                    desc={t("The expert signs a specific answer.", "専門家が特定の回答に署名。", "專家為特定答案簽核。")}
                  />
                  <TierCard
                    active={scope === "engaged"}
                    onClick={() => setScope("engaged")}
                    title={t("Engaged", "本格関与", "深度委任")}
                    price={money(engagedPrice)}
                    desc={t("A deeper professional engagement.", "より深い専門的関与。", "更深入的專業委任。")}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-faint">
                    {t("Subject", "対象", "主旨")}
                  </label>
                  <input
                    value={subject}
                    onChange={(ev) => setSubject(ev.target.value)}
                    maxLength={200}
                    placeholder={t("e.g. Series A raise — technical due-diligence memo", "例：シリーズA調達 — 技術デューデリ資料", "例：A 輪募資 — 技術盡調備忘錄")}
                    className="w-full rounded-lg border border-border bg-panel/40 px-3 py-2 text-[13px] text-text outline-none placeholder:text-faint focus:border-purple/60"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-faint">
                    {t("What should the expert review?", "専門家に何をレビューしてほしいですか？", "希望專家審閱什麼？")}
                  </label>
                  <textarea
                    value={context}
                    onChange={(ev) => setContext(ev.target.value)}
                    rows={4}
                    maxLength={4000}
                    placeholder={t("Paste the claim, answer, or summary you need vouched for.", "保証してほしい主張・回答・要約を貼り付けてください。", "貼上你需要背書的主張、答案或摘要。")}
                    className="w-full resize-none rounded-lg border border-border bg-panel/40 px-3 py-2 text-[13px] leading-6 text-text outline-none placeholder:text-faint focus:border-purple/60"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-panel/30 px-3 py-2">
                  <span className="text-[12px] text-muted">{t("Total", "合計", "總計")}</span>
                  <span className="font-display text-[16px] font-bold text-text">
                    {money(scope === "engaged" ? engagedPrice : reviewedPrice)}
                  </span>
                </div>

                <Btn onClick={submit} disabled={busy} variant="amber" size="lg" className="w-full disabled:opacity-50">
                  {busy ? t("Submitting…", "送信中…", "送出中…") : t("Request endorsement", "エンドースメントを依頼", "申請背書")}
                </Btn>
                <p className="text-center text-[11px] leading-5 text-faint">
                  {t(
                    "WizAgents brokers and records — the named expert alone vouches. Fee refunded if declined.",
                    "WizAgents は仲介・記録し、保証するのは実名の専門家のみです。辞退された場合は返金されます。",
                    "WizAgents 僅居中促成並存證，僅由具名專家背書。若被婉拒將退款。",
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TierCard({
  active, onClick, title, price, desc,
}: { active: boolean; onClick: () => void; title: string; price: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-3 text-left transition-colors ${
        active ? "border-purple bg-purple/10" : "border-border bg-panel/30 hover:border-borderlight"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[13px] font-bold text-text">{title}</span>
        {active && <Badge tone="purple">✓</Badge>}
      </div>
      <div className="mt-1 font-display text-[15px] font-bold text-text">{price}</div>
      <div className="mt-1 text-[11px] leading-5 text-muted">{desc}</div>
    </button>
  );
}
