"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, Badge, SectionLabel } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import {
  IconFileCertificate,
  IconShieldCheck,
  IconShieldOff,
  IconWritingSign,
  IconExternalLink,
  IconClock,
  IconAlertTriangle,
  IconX,
  IconEye,
  IconArrowBackUp,
} from "@tabler/icons-react";

type Agent = { name: string; slug: string };

type Requested = {
  id: string; refCode: string; subject: string; context?: string; scope: string; status: string;
  statement: string; knowledgeVersion: string; price?: number;
  slaDueAt?: string | null; acceptedAt?: string | null; signedAt?: string | null;
  declinedAt?: string | null; refundedAt?: string | null; revokedAt?: string | null;
  revokeReason?: string; createdAt: string; agent: Agent;
};

type ToSign = {
  id: string; refCode: string; subject: string; context: string; scope: string;
  status: string; price?: number; knowledgeVersion?: string;
  slaDueAt?: string | null; acceptedAt?: string | null; signedAt?: string | null;
  revokedAt?: string | null; revokeReason?: string;
  createdAt: string; agent: Agent; user: { name: string };
};

type Action = "accept" | "sign" | "decline" | "revoke";

/* ---------------- helpers ---------------- */

function statusTone(status: string): "green" | "amber" | "rust" | "muted" | "cyan" {
  if (status === "signed") return "green";
  if (status === "declined") return "muted";
  if (status === "revoked") return "rust";
  if (status === "reviewing") return "cyan";
  return "amber";
}

/** SLA: ms remaining, plus a tone. Amber under 24h, rust once overdue. */
function slaState(due: string | null | undefined, now: number) {
  if (!due) return null;
  const ms = new Date(due).getTime() - now;
  const overdue = ms <= 0;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const tone: "muted" | "amber" | "rust" = overdue ? "rust" : ms < 86400000 ? "amber" : "muted";
  return { ms, overdue, d, h, m, tone };
}

function fmtSpan(d: number, h: number, m: number, locale: Locale): string {
  if (d > 0) return locale === "en" ? `${d}d ${h}h` : `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ---------------- component ---------------- */

export default function EndorsementInbox({ show = "all" }: { show?: "all" | "buyer" | "expert" }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState<Requested[]>([]);
  const [toSign, setToSign] = useState<ToSign[]>([]);
  /**
   * The API's `toSign` only returns status requested|reviewing, so an expert's own
   * SIGNED endorsements are not available to list. We keep the ones signed in this
   * session so the expert can still revoke a mistake immediately (revocation is the
   * integrity valve). See the note in the report.
   */
  const [justSigned, setJustSigned] = useState<ToSign[]>([]);

  const [signing, setSigning] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [declining, setDeclining] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notVerified, setNotVerified] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/endorsement");
      const data = await res.json();
      if (data.ok) { setRequested(data.requested || []); setToSign(data.toSign || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Keep the SLA countdown honest without hammering the render loop.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  function closeAll() {
    setSigning(null); setStatement("");
    setDeclining(null); setDeclineReason("");
    setRevoking(null); setRevokeReason("");
  }

  async function act(id: string, action: Action, item?: ToSign) {
    if (action === "revoke" && revokeReason.trim().length < 5) {
      toast(t("A revocation must state a reason (min 5 characters) — it is a public record.", "取り消しには理由が必要です（5文字以上）— 公開記録になります。", "撤銷必須註明理由（至少 5 個字）— 這是公開紀錄。"), "error");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, string> = { action };
      if (action === "sign" && statement.trim()) body.statement = statement.trim();
      if (action === "decline" && declineReason.trim()) body.reason = declineReason.trim();
      if (action === "revoke") body.reason = revokeReason.trim();

      const res = await fetch(`/api/endorsement/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        if (data.code === "not_verified") {
          setNotVerified(true);
          toast(t("Only a verified expert can sign.", "署名できるのは認証済みの専門家のみです。", "只有通過認證的專家才能簽核。"), "error");
        } else {
          toast(data.error || t("Action failed", "操作に失敗しました", "操作失敗"), "error");
        }
        return;
      }

      if (action === "accept") {
        toast(t("Accepted — the buyer knows you are reviewing", "受理しました — 依頼者にレビュー中と通知されました", "已受理 — 已通知買方你正在審閱"), "success");
      } else if (action === "sign") {
        toast(t("Signed — the citation is live", "署名しました — 引用が有効になりました", "已簽核 — 引用已生效"), "success");
        if (item) {
          setJustSigned((p) => [
            { ...item, status: "signed", signedAt: new Date().toISOString(), statement: statement.trim() } as ToSign,
            ...p.filter((x) => x.id !== item.id),
          ]);
        }
      } else if (action === "decline") {
        toast(t("Declined — the fee was refunded to the buyer", "辞退しました — 費用は依頼者に返金されました", "已婉拒 — 費用已退還買方"), "success");
      } else {
        toast(t("Revoked — the public citation now shows as withdrawn", "取り消しました — 公開引用は撤回済みと表示されます", "已撤銷 — 公開引用現顯示為已撤回"), "success");
        setJustSigned((p) => p.map((x) => (x.id === id ? { ...x, status: "revoked", revokedAt: new Date().toISOString(), revokeReason: revokeReason.trim() } : x)));
      }
      closeAll();
      load();
    } catch {
      toast(t("Action failed", "操作に失敗しました", "操作失敗"), "error");
    } finally { setBusy(false); }
  }

  const showBuyer = show === "all" || show === "buyer";
  const showExpert = show === "all" || show === "expert";

  const expertItems = useMemo(() => {
    const ids = new Set(toSign.map((x) => x.id));
    return [...toSign, ...justSigned.filter((x) => !ids.has(x.id))];
  }, [toSign, justSigned]);

  if (loading) {
    return <div className="glass-card p-5 text-[12.5px] text-muted">{t("Loading endorsements…", "エンドースメントを読み込み中…", "載入背書中…")}</div>;
  }
  if ((!showBuyer || requested.length === 0) && (!showExpert || expertItems.length === 0)) {
    return null;
  }

  const scopeLabel = (scope: string) =>
    scope === "engaged"
      ? t("Engaged", "本格関与", "深度委任")
      : t("Reviewed", "レビュー", "審閱");

  return (
    <div className="space-y-8">
      {/* ---------------- EXPERT ---------------- */}
      {showExpert && expertItems.length > 0 && (
        <div>
          <SectionLabel>{t("Endorsements awaiting your signature", "あなたの署名待ちのエンドースメント", "等待你簽核的背書")}</SectionLabel>

          {notVerified && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-rust/40 bg-rust/5 px-3.5 py-3 text-[12px] leading-6 text-rust">
              <IconShieldOff size={16} stroke={1.7} className="shrink-0" />
              <span className="flex-1">
                {t(
                  "You must be a verified expert to sign a citable endorsement. Verification is reviewed by a human.",
                  "引用可能なエンドースメントに署名するには、認証済みの専門家である必要があります。認証は人によるレビューです。",
                  "你必須是通過認證的專家才能簽核可被引用的背書。認證由真人審核。",
                )}
              </span>
              <Link href="/studio/verification" className="inline-flex items-center gap-1 rounded-lg border border-rust/40 px-2.5 py-1 text-[11.5px] font-semibold text-rust transition-colors hover:bg-rust/10">
                <IconShieldCheck size={13} stroke={1.7} /> {t("Get verified", "認証を受ける", "前往認證")}
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {expertItems.map((e) => {
              const sla = e.status === "requested" || e.status === "reviewing" ? slaState(e.slaDueAt, now) : null;
              const isSigned = e.status === "signed";
              const isRevoked = e.status === "revoked";
              return (
                <div key={e.id} className="glass-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <IconFileCertificate size={17} className="text-purple" stroke={1.7} />
                    <span className="font-display text-[14px] font-bold text-text">{e.subject}</span>
                    <Badge tone={e.scope === "engaged" ? "purple" : "cyan"}>{scopeLabel(e.scope)}</Badge>
                    {e.status === "reviewing" && <Badge tone="cyan">{t("Reviewing", "レビュー中", "審閱中")}</Badge>}
                    {isSigned && <Badge tone="green">{t("Signed", "署名済み", "已簽核")}</Badge>}
                    {isRevoked && <Badge tone="rust">{t("Revoked", "取り消し済み", "已撤銷")}</Badge>}
                    <span className="font-mono text-[11px] text-faint">{e.refCode}</span>
                    <span className="ml-auto text-[11px] text-faint">{timeAgo(e.createdAt, locale)}</span>
                  </div>

                  <div className="mt-1 text-[11.5px] text-muted">
                    {t("Requested by", "依頼者", "申請者")} {e.user?.name} · {e.agent?.name}
                    {typeof e.price === "number" && e.price > 0 && <> · ${e.price}</>}
                  </div>

                  {/* SLA countdown */}
                  {sla && (
                    <div
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium ${
                        sla.tone === "rust"
                          ? "border-rust/40 bg-rust/5 text-rust"
                          : sla.tone === "amber"
                            ? "border-amber/40 bg-amber/5 text-amber"
                            : "border-border bg-panel/30 text-muted"
                      }`}
                    >
                      {sla.overdue ? <IconAlertTriangle size={13} stroke={1.7} /> : <IconClock size={13} stroke={1.7} />}
                      {sla.overdue
                        ? t(
                            `Overdue by ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                            `${fmtSpan(sla.d, sla.h, sla.m, locale)} 超過`,
                            `已逾期 ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                          )
                        : t(
                            `Due in ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                            `残り ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                            `剩餘 ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                          )}
                    </div>
                  )}

                  {e.context && (
                    <div className="mt-2 rounded-lg border border-border bg-panel/30 px-3 py-2 text-[12.5px] leading-6 text-text">{e.context}</div>
                  )}

                  {isRevoked && e.revokeReason && (
                    <p className="mt-2 text-[11.5px] leading-5 text-rust">
                      {t("Revoked", "取り消し済み", "已撤銷")}: {e.revokeReason}
                    </p>
                  )}

                  {/* --- sign panel --- */}
                  {signing === e.id && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-[11px] uppercase tracking-[0.12em] text-faint">
                        {t("Your signed statement (optional)", "署名声明（任意）", "你的簽核聲明（可選）")}
                      </label>
                      <textarea
                        value={statement}
                        onChange={(ev) => setStatement(ev.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder={t("Leave blank for a standard attributable sign-off.", "空欄の場合は標準の実名署名になります。", "留空則使用標準實名簽核。")}
                        className="w-full resize-none rounded-lg border border-border bg-panel/40 px-3 py-2 text-[12.5px] leading-6 text-text outline-none placeholder:text-faint focus:border-purple/60"
                      />
                      <div className="flex gap-2">
                        <Btn onClick={() => act(e.id, "sign", e)} disabled={busy} size="sm" className="flex-1 disabled:opacity-50">
                          <IconWritingSign size={14} stroke={1.7} /> {t("Sign & publish", "署名して公開", "簽核並公開")}
                        </Btn>
                        <Btn onClick={closeAll} variant="ghost" size="sm">
                          <IconX size={14} stroke={1.9} /> {t("Cancel", "キャンセル", "取消")}
                        </Btn>
                      </div>
                      <p className="text-[10.5px] leading-5 text-faint">
                        {t(
                          "Your name and the timestamp will be publicly attached to this reference. Only a verified expert can sign.",
                          "この参照コードにあなたの氏名とタイムスタンプが公開で付与されます。署名できるのは認証済みの専門家のみです。",
                          "你的姓名與時間戳將公開附加於此參照代碼。只有通過認證的專家才能簽核。",
                        )}
                      </p>
                    </div>
                  )}

                  {/* --- decline panel --- */}
                  {declining === e.id && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-[11px] uppercase tracking-[0.12em] text-faint">
                        {t("Reason for declining (optional)", "辞退の理由（任意）", "婉拒理由（可選）")}
                      </label>
                      <textarea
                        value={declineReason}
                        onChange={(ev) => setDeclineReason(ev.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder={t("e.g. Outside my area of practice.", "例：私の専門領域外です。", "例：超出我的執業範圍。")}
                        className="w-full resize-none rounded-lg border border-border bg-panel/40 px-3 py-2 text-[12.5px] leading-6 text-text outline-none placeholder:text-faint focus:border-purple/60"
                      />
                      <div className="flex gap-2">
                        <Btn onClick={() => act(e.id, "decline", e)} disabled={busy} variant="danger" size="sm" className="flex-1 disabled:opacity-50">
                          {t("Confirm decline", "辞退を確定", "確認婉拒")}
                        </Btn>
                        <Btn onClick={closeAll} variant="ghost" size="sm">
                          <IconX size={14} stroke={1.9} /> {t("Cancel", "キャンセル", "取消")}
                        </Btn>
                      </div>
                      <p className="text-[10.5px] leading-5 text-amber">
                        {t(
                          `Declining refunds the ${typeof e.price === "number" && e.price > 0 ? `$${e.price} ` : ""}fee to the buyer in full.`,
                          `辞退すると${typeof e.price === "number" && e.price > 0 ? ` $${e.price} の` : ""}費用は依頼者に全額返金されます。`,
                          `婉拒後${typeof e.price === "number" && e.price > 0 ? ` $${e.price} ` : ""}費用將全額退還買方。`,
                        )}
                      </p>
                    </div>
                  )}

                  {/* --- revoke panel --- */}
                  {revoking === e.id && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-[11px] uppercase tracking-[0.12em] text-faint">
                        {t("Reason for revoking (required)", "取り消しの理由（必須）", "撤銷理由（必填）")}
                      </label>
                      <textarea
                        value={revokeReason}
                        onChange={(ev) => setRevokeReason(ev.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder={t("e.g. New facts came to light that change my judgment.", "例：判断を変える新たな事実が判明したため。", "例：出現了改變我判斷的新事實。")}
                        className="w-full resize-none rounded-lg border border-border bg-panel/40 px-3 py-2 text-[12.5px] leading-6 text-text outline-none placeholder:text-faint focus:border-rust/60"
                      />
                      <div className="flex gap-2">
                        <Btn onClick={() => act(e.id, "revoke", e)} disabled={busy || revokeReason.trim().length < 5} variant="danger" size="sm" className="flex-1 disabled:opacity-50">
                          <IconArrowBackUp size={14} stroke={1.7} /> {t("Revoke citation", "引用を取り消す", "撤銷引用")}
                        </Btn>
                        <Btn onClick={closeAll} variant="ghost" size="sm">
                          <IconX size={14} stroke={1.9} /> {t("Cancel", "キャンセル", "取消")}
                        </Btn>
                      </div>
                      <p className="text-[10.5px] leading-5 text-rust">
                        {t(
                          "The reason becomes part of the public record on the citation page. Minimum 5 characters.",
                          "この理由は引用ページ上の公開記録の一部になります。5文字以上。",
                          "此理由將成為引用頁面上公開紀錄的一部分。至少 5 個字。",
                        )}
                      </p>
                    </div>
                  )}

                  {/* --- default action row --- */}
                  {!signing && !declining && !revoking && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {e.status === "requested" && (
                        <Btn onClick={() => act(e.id, "accept", e)} disabled={busy} variant="outline" size="sm" className="disabled:opacity-50">
                          <IconEye size={14} stroke={1.7} /> {t("Accept & review", "受理してレビュー", "受理並審閱")}
                        </Btn>
                      )}
                      {(e.status === "requested" || e.status === "reviewing") && (
                        <>
                          <Btn onClick={() => { closeAll(); setSigning(e.id); }} size="sm">
                            <IconWritingSign size={14} stroke={1.7} /> {t("Sign", "署名する", "簽核")}
                          </Btn>
                          <Btn onClick={() => { closeAll(); setDeclining(e.id); }} variant="danger" size="sm">
                            {t("Decline", "辞退", "婉拒")}
                          </Btn>
                        </>
                      )}
                      {isSigned && (
                        <>
                          <Link
                            href={`/verify/${e.refCode}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-purple/40 bg-purple/5 px-3 py-1.5 text-[12px] font-semibold text-purple transition-colors hover:bg-purple/10"
                          >
                            <IconExternalLink size={13} stroke={1.7} /> {t("View citation", "引用を見る", "查看引用")}
                          </Link>
                          <Btn onClick={() => { closeAll(); setRevoking(e.id); }} variant="danger" size="sm">
                            <IconArrowBackUp size={14} stroke={1.7} /> {t("Revoke", "取り消す", "撤銷")}
                          </Btn>
                        </>
                      )}
                      {isRevoked && (
                        <Link
                          href={`/verify/${e.refCode}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text"
                        >
                          <IconExternalLink size={13} stroke={1.7} /> {t("View public record", "公開記録を見る", "查看公開紀錄")}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- BUYER ---------------- */}
      {showBuyer && requested.length > 0 && (
        <div>
          <SectionLabel>{t("My endorsement requests", "私のエンドースメント依頼", "我的背書申請")}</SectionLabel>
          <div className="space-y-3">
            {requested.map((e) => {
              const sla = e.status === "requested" || e.status === "reviewing" ? slaState(e.slaDueAt, now) : null;
              return (
                <div key={e.id} className="glass-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <IconFileCertificate size={17} className={e.status === "revoked" ? "text-rust" : "text-purple"} stroke={1.7} />
                    <span className="font-display text-[14px] font-bold text-text">{e.subject}</span>
                    <Badge tone={statusTone(e.status)}>
                      {e.status === "signed" ? t("Signed", "署名済み", "已簽核")
                        : e.status === "declined" ? t("Declined · refunded", "辞退 · 返金済み", "已婉拒 · 已退款")
                        : e.status === "revoked" ? t("Revoked", "取り消し済み", "已撤銷")
                        : e.status === "reviewing" ? t("Under review", "レビュー中", "審閱中")
                        : t("Requested", "依頼済み", "已申請")}
                    </Badge>
                    <Badge tone="muted">{scopeLabel(e.scope)}</Badge>
                    <span className="font-mono text-[11px] text-faint">{e.refCode}</span>
                    <span className="ml-auto text-[11px] text-faint">{timeAgo(e.createdAt, locale)}</span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-muted">{e.agent?.name}</div>

                  {sla && (
                    <div
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium ${
                        sla.tone === "rust"
                          ? "border-rust/40 bg-rust/5 text-rust"
                          : sla.tone === "amber"
                            ? "border-amber/40 bg-amber/5 text-amber"
                            : "border-border bg-panel/30 text-muted"
                      }`}
                    >
                      {sla.overdue ? <IconAlertTriangle size={13} stroke={1.7} /> : <IconClock size={13} stroke={1.7} />}
                      {sla.overdue
                        ? t(
                            `SLA overdue by ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                            `SLA を ${fmtSpan(sla.d, sla.h, sla.m, locale)} 超過`,
                            `已逾 SLA ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                          )
                        : t(
                            `Expert response due in ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                            `専門家の応答期限まで ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                            `專家回覆剩餘 ${fmtSpan(sla.d, sla.h, sla.m, locale)}`,
                          )}
                    </div>
                  )}

                  {e.status === "signed" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-green">
                        <IconShieldCheck size={14} stroke={1.8} /> {t("A named, verified human stands behind this.", "実名の認証済み専門家がこれを保証します。", "有具名且通過認證的真人為此背書。")}
                      </span>
                      <Link
                        href={`/verify/${e.refCode}`}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg border border-purple/40 bg-purple/5 px-3 py-1.5 text-[12px] font-semibold text-purple transition-colors hover:bg-purple/10"
                      >
                        <IconExternalLink size={13} stroke={1.7} /> {t("View citation", "引用を見る", "查看引用")}
                      </Link>
                    </div>
                  ) : e.status === "declined" ? (
                    <p className="mt-2 text-[11.5px] leading-5 text-muted">
                      {t("The expert declined. Your fee has been refunded in full.", "専門家が辞退しました。費用は全額返金されました。", "專家已婉拒，費用已全額退還。")}
                      {e.revokeReason ? <> {t("Reason", "理由", "理由")}: {e.revokeReason}</> : null}
                    </p>
                  ) : e.status === "revoked" ? (
                    <div className="mt-3 rounded-lg border border-rust/40 bg-rust/5 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-rust">
                        <IconShieldOff size={14} stroke={1.7} />
                        {t("The expert revoked this endorsement.", "専門家がこのエンドースメントを取り消しました。", "專家已撤銷此背書。")}
                      </div>
                      {e.revokeReason && (
                        <p className="mt-1 text-[11.5px] leading-5 text-rust">
                          {t("Reason", "理由", "理由")}: {e.revokeReason}
                        </p>
                      )}
                      <Link href={`/verify/${e.refCode}`} className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-text">
                        <IconExternalLink size={13} stroke={1.7} /> {t("View public record", "公開記録を見る", "查看公開紀錄")}
                      </Link>
                    </div>
                  ) : e.status === "reviewing" ? (
                    <p className="mt-2 text-[11.5px] leading-5 text-muted">
                      {t("The expert has picked this up and is reviewing it. Your citation appears here once signed.", "専門家がこの依頼を受理し、レビューしています。署名後、引用がここに表示されます。", "專家已受理並正在審閱。簽核後引用會顯示於此。")}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11.5px] leading-5 text-muted">
                      {t("Waiting for the expert to accept. If they decline, your fee is refunded in full.", "専門家の受理待ちです。辞退された場合、費用は全額返金されます。", "等待專家受理。若對方婉拒，費用將全額退還。")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
