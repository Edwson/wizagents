import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getLocale, pick, type Locale } from "@/lib/locale";
import {
  IconFileCertificate,
  IconShieldCheck,
  IconShieldOff,
  IconWritingSign,
  IconAlertCircle,
  IconHistory,
} from "@tabler/icons-react";

export const dynamic = "force-dynamic";

async function load(ref: string) {
  const code = decodeURIComponent(ref || "").trim().toUpperCase();
  if (!code) return null;
  try {
    return await db.endorsement.findUnique({
      where: { refCode: code },
      include: { agent: true, expert: true },
    });
  } catch {
    return null;
  }
}

/** The citation is pinned to a KB snapshot; the agent may have moved on since. */
async function loadProvenance(agentId: string, expertUserId: string) {
  const [latestKv, profile] = await Promise.all([
    db.knowledgeVersion.findFirst({ where: { agentId }, orderBy: { createdAt: "desc" } }).catch(() => null),
    db.creatorProfile.findUnique({ where: { userId: expertUserId } }).catch(() => null),
  ]);
  return {
    currentVersion: latestKv?.version || "",
    expertVerified: !!profile?.verified,
    expertVertical: profile?.verticalLabel || "",
  };
}

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const e = await load(ref);
  if (!e || (e.status !== "signed" && e.status !== "revoked")) {
    return { title: "Endorsement not found — WizAgents", robots: { index: false } };
  }
  const name = e.expertName || e.expert?.name || "an expert";
  if (e.status === "revoked") {
    return {
      title: `Endorsement ${e.refCode} — REVOKED · WizAgents`,
      description: `This endorsement was revoked by ${name} and is no longer valid.`,
      robots: { index: false },
    };
  }
  return {
    title: `Endorsement ${e.refCode} — signed by ${name} · WizAgents`,
    description: `A named human expert (${name}) has signed and stands behind: "${e.subject}". Verify reference ${e.refCode} on WizAgents.`,
  };
}

function fmtDate(d: Date | null, locale: Locale): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(
    locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-TW" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );
}

export default async function VerifyPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  const e = await load(ref);

  // Not found / never signed. A pending or declined request is not a citation.
  if (!e || (e.status !== "signed" && e.status !== "revoked")) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <IconAlertCircle size={40} className="mx-auto text-rust" stroke={1.7} />
        <h1 className="mt-4 font-display text-[22px] font-bold text-text">
          {P("No valid endorsement for this reference", "この参照コードに有効な署名はありません", "此參照代碼沒有有效的簽核")}
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-muted">
          {P(
            "The reference code may be mistyped, withdrawn, or still awaiting the expert's signature. Only a completed, signed endorsement can be verified here.",
            "参照コードの誤入力、取り下げ、または専門家の署名待ちの可能性があります。ここで検証できるのは、署名が完了したエンドースメントのみです。",
            "此參照代碼可能輸入有誤、已撤回，或仍在等待專家簽核。此處僅能驗證已完成簽核的背書。",
          )}
        </p>
        <div className="mt-4 inline-block rounded-md border border-border bg-panel/40 px-3 py-1.5 font-mono text-[12px] text-faint">
          {decodeURIComponent(ref || "").trim().toUpperCase() || "—"}
        </div>
        <div className="mt-8">
          <Link href="/market" className="text-[12.5px] text-muted transition-colors hover:text-purple">
            {P("Explore WizAgents →", "WizAgents を見る →", "探索 WizAgents →")}
          </Link>
        </div>
      </div>
    );
  }

  const revoked = e.status === "revoked";
  const { currentVersion, expertVerified, expertVertical } = await loadProvenance(e.agentId, e.expertUserId);
  const pinned = e.knowledgeVersion || "";
  const stale = !revoked && !!pinned && !!currentVersion && pinned !== currentVersion;

  const expertName = e.expertName || e.expert?.name || P("Verified expert", "認証済み専門家", "認證專家");
  const tierLabel =
    e.scope === "engaged"
      ? P("Professional engagement", "専門的関与", "專業委任")
      : P("Reviewed & signed", "レビュー・署名済み", "已審閱並簽核");

  return (
    <div className="mx-auto max-w-2xl py-10">
      {/* A revoked citation must never read as valid. */}
      {revoked && (
        <div className="mb-5 rounded-xl border border-rust/50 bg-rust/10 p-5">
          <div className="flex items-center gap-2">
            <IconShieldOff size={20} className="text-rust" stroke={1.7} />
            <span className="font-display text-[16px] font-bold uppercase tracking-[0.08em] text-rust">
              {P("Revoked", "取り消し済み", "已撤銷")}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-6 text-rust">
            {P(
              "This endorsement was revoked by the expert. It is no longer a valid citation and must not be relied upon.",
              "このエンドースメントは専門家によって取り消されました。もはや有効な引用ではなく、依拠してはなりません。",
              "此背書已被專家撤銷，不再是有效引用，不應據以採信。",
            )}
          </p>
          {e.revokeReason && (
            <div className="mt-3 rounded-lg border border-rust/30 bg-panel/30 px-3.5 py-2.5">
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-faint">
                {P("Reason given by the expert", "専門家が示した理由", "專家提出的理由")}
              </div>
              <p className="mt-1 text-[13px] leading-6 text-text">{e.revokeReason}</p>
            </div>
          )}
          <div className="mt-3 text-[11.5px] text-muted">
            {P("Revoked", "取り消し日", "撤銷日")} {fmtDate(e.revokedAt, locale)}
            {e.signedAt && <> · {P("originally signed", "当初の署名日", "原簽核日")} {fmtDate(e.signedAt, locale)}</>}
          </div>
        </div>
      )}

      {/* Certificate */}
      <div className={`glass-card relative overflow-hidden p-8 sm:p-10 ${revoked ? "border-rust/30 opacity-80" : "border-grad"}`}>
        {/* Header */}
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconFileCertificate size={30} className={revoked ? "text-rust" : "text-purple"} stroke={1.7} />
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-faint">
                {P("WizAgents · Endorsement of Record", "WizAgents · 記録されたエンドースメント", "WizAgents · 存證背書")}
              </div>
              <div className="font-display text-[20px] font-bold text-text">
                {P("Certificate of Endorsement", "エンドースメント証明書", "背書證明")}
              </div>
            </div>
          </div>
          {revoked ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rust/50 bg-rust/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-rust">
              <IconShieldOff size={13} stroke={1.9} /> {P("Revoked", "取り消し済み", "已撤銷")}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green/40 bg-green/10 px-2.5 py-1 text-[11px] font-semibold text-green">
              <IconShieldCheck size={13} stroke={1.9} /> {P("Signed", "署名済み", "已簽核")}
            </span>
          )}
        </div>

        {/* Reference code */}
        <div className="relative mt-7 rounded-lg border border-border bg-panel/40 px-4 py-3">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-faint">
            {P("Reference code", "参照コード", "參照代碼")}
          </div>
          <div className={`mt-1 font-mono text-[24px] font-bold tracking-[0.14em] ${revoked ? "text-muted line-through" : "text-text"}`}>
            {e.refCode}
          </div>
        </div>

        {/* Facts grid */}
        <div className="relative mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <Field label={P("Endorsed by", "署名者", "簽核者")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[15px] font-bold text-text">{expertName}</span>
              {expertVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-green/40 bg-green/10 px-2 py-0.5 text-[10.5px] font-semibold text-green">
                  <IconShieldCheck size={11} stroke={1.9} /> {P("Verified Expert", "認証済み専門家", "認證專家")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber">
                  {P("Verification not current", "認証は現在有効ではありません", "認證目前非有效")}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted">
              {expertVerified
                ? P(
                    "Credentials checked by a human reviewer",
                    "人によるレビューで資格を確認済み",
                    "資格已由真人審核者查核",
                  )
                : P(
                    "This expert's verification is not currently active",
                    "この専門家の認証は現在有効ではありません",
                    "此專家的認證目前並非有效狀態",
                  )}
              {expertVertical ? ` · ${expertVertical}` : ""}
            </div>
          </Field>
          <Field label={P("Via agent", "エージェント", "透過 Agent")}>
            <Link href={`/agent/${e.agent.slug}`} className="font-display text-[15px] font-bold text-text transition-colors hover:text-purple">
              {e.agent.name}
            </Link>
            <div className="text-[11px] text-muted">{tierLabel}</div>
          </Field>
          <Field label={P("Subject", "対象", "主旨")}>
            <div className="text-[13.5px] leading-6 text-text">{e.subject}</div>
          </Field>
          <Field label={P("Knowledge base pinned to", "固定された知識ベース", "鎖定的知識庫版本")}>
            <div className="font-mono text-[13px] text-text">
              {pinned || P("current at signing", "署名時点の最新", "簽核時的最新版")}
            </div>
            {stale && (
              <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-amber">
                <IconHistory size={13} stroke={1.7} className="mt-0.5 shrink-0" />
                <span>
                  {P(
                    `Pinned to ${pinned} · the expert's knowledge base has since moved to ${currentVersion}.`,
                    `${pinned} に固定 · その後、専門家の知識ベースは ${currentVersion} に更新されています。`,
                    `鎖定於 ${pinned} · 該專家的知識庫其後已更新至 ${currentVersion}。`,
                  )}
                </span>
              </div>
            )}
          </Field>
        </div>

        {/* Signed statement */}
        <div className="relative mt-7">
          <div className="mb-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-faint">
            <IconWritingSign size={14} stroke={1.7} className={revoked ? "text-rust" : "text-purple"} />
            {revoked
              ? P("Statement as signed (now withdrawn)", "署名時の声明（現在は撤回済み）", "簽核當時的聲明（現已撤回）")
              : P("Signed statement", "署名声明", "簽核聲明")}
          </div>
          <blockquote
            className={`rounded-lg border-l-2 px-4 py-3 text-[13.5px] italic leading-7 ${
              revoked ? "border-rust/50 bg-panel/20 text-muted" : "border-purple/60 bg-panel/30 text-text"
            }`}
          >
            &ldquo;{e.statement}&rdquo;
          </blockquote>
        </div>

        {/* Signature line */}
        <div className="relative mt-7 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-5">
          <div>
            <div className="font-display text-[15px] font-semibold text-text">{expertName}</div>
            <div className="text-[11px] text-muted">
              {P("Signed", "署名日", "簽核日")} {fmtDate(e.signedAt, locale)}
            </div>
          </div>
          <div className="text-right text-[10.5px] leading-5 text-faint">
            <div className="font-mono">{e.refCode}</div>
            <div>wiz-agents.com/verify/{e.refCode}</div>
          </div>
        </div>

        {/* Trust line */}
        {revoked ? (
          <div className="relative mt-6 flex items-center gap-2 rounded-lg border border-rust/40 bg-rust/5 px-4 py-2.5 text-[12px] text-rust">
            <IconShieldOff size={16} stroke={1.8} />
            {P(
              "Withdrawn by the expert · this certificate is a record, not a valid endorsement.",
              "専門家により撤回されました · この証明書は記録であり、有効なエンドースメントではありません。",
              "已由專家撤回 · 此證明僅為紀錄，並非有效背書。",
            )}
          </div>
        ) : (
          <div className="relative mt-6 flex items-center gap-2 rounded-lg border border-green/30 bg-green/5 px-4 py-2.5 text-[12px] text-green">
            <IconShieldCheck size={16} stroke={1.8} />
            {P(
              "Verified by WizAgents · a named, credential-checked human stands behind this.",
              "WizAgents により検証済み · 資格を確認された実名の人間がこれを保証します。",
              "由 WizAgents 驗證 · 有一位具名且經資格查核的真人為此背書。",
            )}
          </div>
        )}
      </div>

      {/* Honest framing footnote */}
      <p className="mt-5 px-2 text-center text-[11px] leading-5 text-faint">
        {P(
          "WizAgents brokers and records this endorsement; it does not manufacture credibility. The named expert alone vouches for the subject above, and may withdraw that sign-off at any time.",
          "WizAgents はこのエンドースメントを仲介・記録するものであり、信用を作り出すものではありません。上記の対象を保証するのは実名の専門家のみであり、その署名はいつでも撤回され得ます。",
          "WizAgents 僅居中促成並存證此背書，並不製造公信力。僅由上述具名專家為該主旨背書，且其得隨時撤回該簽核。",
        )}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
