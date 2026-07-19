"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, Badge, SectionLabel, Reveal } from "@/components/ui";
import VerifiedBadge from "./VerifiedBadge";
import { levelOf, levelLabel, levelBlurb, type Level } from "@/lib/verification";
import {
  IconRosetteDiscountCheck,
  IconUserCheck,
  IconIdBadge2,
  IconUpload,
  IconShieldCheck,
  IconAlertCircle,
  IconCheck,
  IconHourglass,
  IconAlertTriangle,
  IconTrash,
} from "@tabler/icons-react";

/* Kept for callers that still import it. */
export type VerificationStatus = "none" | "pending" | "approved" | "rejected";
export type KycStatus = "none" | "submitted" | "in_review" | "approved" | "rejected";

type IdType = "passport" | "national_id" | "drivers_licence";

type Doc = {
  id: string;
  fileName: string;
  size: number;
  scan: "clean" | "flagged";
  detail?: string;
};

type Form = {
  legalName: string;
  country: string;
  idType: IdType;
  licenceNumber: string;
  issuingBody: string;
  links: string[];
};

const inp =
  "w-full rounded-lg border border-border bg-panel/40 px-3 py-2 text-[13px] leading-6 text-text outline-none transition-colors placeholder:text-faint focus:border-purple/60";
const lbl = "mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-faint";

const COUNTRIES = [
  "United Kingdom", "United States", "Japan", "Taiwan", "Singapore", "Hong Kong",
  "Canada", "Australia", "New Zealand", "Ireland", "Germany", "France", "Netherlands",
  "Spain", "Italy", "Sweden", "Switzerland", "South Korea", "India", "Brazil",
];

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`);

export default function VerifyForm({
  verified,
  identityVerified,
  kycStatus,
  status,
}: {
  verified: boolean;
  identityVerified?: boolean;
  kycStatus?: KycStatus | string;
  /** Legacy prop — kept as a fallback until the server state loads. */
  status?: VerificationStatus | string;
  /** Legacy prop, no longer read. Accepted so existing callers keep compiling. */
  initial?: { licenseInfo?: string; bio?: string; verticalLabel?: string };
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { toast } = useToast();

  // Fallback state from props, replaced by GET /api/kyc on mount.
  const fallbackKyc: KycStatus =
    (kycStatus as KycStatus) ||
    (verified ? "approved" : status === "pending" ? "submitted" : status === "rejected" ? "rejected" : "none");

  const [level, setLevel] = useState<Level>(levelOf({ verified, identityVerified }));
  const [state, setState] = useState<KycStatus>(fallbackKyc);
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [f, setF] = useState<Form>({
    legalName: "",
    country: "",
    idType: "passport",
    licenceNumber: "",
    issuingBody: "",
    links: [""],
  });
  const [idDoc, setIdDoc] = useState<Doc | null>(null);
  const [selfie, setSelfie] = useState<Doc | null>(null);
  const [credDoc, setCredDoc] = useState<Doc | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  /* ---- Load the real state. Simplest correct thing: one GET on mount. ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/kyc");
        const d = await res.json().catch(() => ({}));
        if (!alive || !d?.ok) return;
        if (d.profile) {
          setLevel(levelOf(d.profile));
          setState((d.profile.kycStatus || "none") as KycStatus);
        }
        if (d.kyc) {
          setNote(d.kyc.reviewerNote || "");
          let links: string[] = [];
          try {
            const parsed = JSON.parse(d.kyc.links || "[]");
            if (Array.isArray(parsed)) links = parsed.filter((x: unknown) => typeof x === "string");
          } catch {
            links = [];
          }
          setF((p) => ({
            ...p,
            legalName: d.kyc.legalName || "",
            country: d.kyc.country || "",
            idType: (["passport", "national_id", "drivers_licence"].includes(d.kyc.idType) ? d.kyc.idType : "passport") as IdType,
            licenceNumber: d.kyc.licenceNumber || "",
            issuingBody: d.kyc.issuingBody || "",
            links: links.length ? links : [""],
          }));
        }
      } catch {
        /* keep the prop fallback */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---- Upload: bytes are scanned in memory and never stored. ---- */
  const upload = useCallback(
    async (file: File, put: (d: Doc | null) => void, setPending: (b: boolean) => void) => {
      setPending(true);
      setError("");
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/creator/asset", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d?.ok || !d.id) {
          setError(d?.error || t("Upload failed. Please try again.", "アップロードに失敗しました。もう一度お試しください。", "上傳失敗，請再試一次。"));
          put(null);
          return;
        }
        const clean = d.status === "clean" && !d.quarantined;
        put({ id: d.id, fileName: file.name, size: file.size, scan: clean ? "clean" : "flagged", detail: d.detail });
        if (!clean) {
          toast(t("That file was flagged by the safety scan.", "そのファイルは安全スキャンでフラグされました。", "該檔案已被安全掃描標記。"), "error");
        }
      } catch {
        setError(t("Upload failed. Please try again.", "アップロードに失敗しました。もう一度お試しください。", "上傳失敗，請再試一次。"));
        put(null);
      } finally {
        setPending(false);
      }
    },
    [t, toast],
  );

  const flagged = [idDoc, selfie, credDoc].some((d) => d && d.scan === "flagged");
  const canSubmit = !!f.legalName.trim() && !!f.country.trim() && !!idDoc && !flagged && !busy;

  async function submit() {
    setError("");
    if (!idDoc) {
      setError(t("Upload a government ID document.", "公的身分証明書をアップロードしてください。", "請上傳政府核發的身分證件。"));
      return;
    }
    if (flagged) {
      setError(t("Remove the flagged document before submitting.", "フラグされた書類を削除してから送信してください。", "請先移除被標記的檔案再提交。"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: f.legalName.trim(),
          country: f.country.trim(),
          idType: f.idType,
          idDocId: idDoc.id,
          selfieId: selfie?.id || undefined,
          credentialDocId: credDoc?.id || undefined,
          licenceNumber: f.licenceNumber.trim(),
          issuingBody: f.issuingBody.trim(),
          links: f.links.map((l) => l.trim()).filter(Boolean).slice(0, 5),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.ok) {
        setError(d?.error || t("Submission failed. Please try again.", "送信に失敗しました。もう一度お試しください。", "提交失敗，請再試一次。"));
        return;
      }
      setState("submitted");
      setEditing(false);
      setNote("");
      toast(t("Submitted for human review", "人によるレビューに提出しました", "已提交人工審核"), "success");
      router.refresh();
    } catch {
      setError(t("Submission failed. Please try again.", "送信に失敗しました。もう一度お試しください。", "提交失敗，請再試一次。"));
    } finally {
      setBusy(false);
    }
  }

  const underReview = state === "submitted" || state === "in_review";
  const showForm = editing || state === "none" || state === "rejected" || (state === "approved" && level === "identity");

  return (
    <div className="mx-auto max-w-2xl">
      <Reveal>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[22px] font-bold tracking-tight text-text">
            {t("Verification", "本人確認と認証", "身分與專家認證")}
          </h1>
          {level === "none" ? <StatusPill state={state} /> : <VerifiedBadge level={level} />}
        </div>
        <p className="mt-1.5 text-[12.5px] leading-6 text-muted">
          {t(
            "Every tier is granted by a human reviewer. You cannot verify yourself — that is the point: the mark only means something because someone checked what sits behind it.",
            "すべての段階は人によるレビューで付与されます。自己認証はできません——それが要点です。誰かが背後の内容を確認しているからこそ、このマークに意味があります。",
            "每個層級皆由真人審核者授予，你無法自行認證——這正是重點：唯有有人查核過背後的內容，這個標記才具意義。",
          )}
        </p>
      </Reveal>

      {/* Privacy — say it loudly, it is a feature. */}
      <Reveal delay={50}>
        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-green/40 bg-green/5 px-4 py-3">
          <IconShieldCheck size={17} stroke={1.7} className="mt-0.5 shrink-0 text-green" />
          <div>
            <div className="font-display text-[13px] font-bold text-green">
              {t("Your documents are never stored.", "書類は保存されません。", "我們不會保存你的文件。")}
            </div>
            <p className="mt-0.5 text-[12px] leading-6 text-muted">
              {t(
                "Files are scanned for malware in memory and discarded immediately. We keep only a hash and the scan result — never the file itself, and never the image of your ID.",
                "ファイルはメモリ上でマルウェアスキャンされ、直ちに破棄されます。保存されるのはハッシュとスキャン結果だけで、ファイル本体も身分証の画像も残りません。",
                "檔案在記憶體中完成惡意程式掃描後隨即丟棄。我們只保留雜湊值與掃描結果——不保留檔案本身，也不保留證件影像。",
              )}
            </p>
          </div>
        </div>
      </Reveal>

      {/* The ladder — three tiers, and what each one actually buys. */}
      <Reveal delay={80}>
        <div className="mt-5 glass-card p-5">
          <SectionLabel>{t("Verification tiers", "認証の段階", "認證層級")}</SectionLabel>
          <div className="space-y-2">
            <Rung
              active={level === "none"}
              icon={<IconIdBadge2 size={16} stroke={1.7} className="text-faint" />}
              title={levelLabel("none", locale)}
              blurb={t(
                "No badge. You can publish, but you cannot sign citable endorsements.",
                "バッジなし。公開はできますが、引用可能なエンドースメントには署名できません。",
                "無標記。可以發布，但無法簽核可被引用的背書。",
              )}
            />
            <Rung
              active={level === "identity"}
              icon={<IconUserCheck size={16} stroke={1.7} className="text-cyan" />}
              title={levelLabel("identity", locale)}
              blurb={t(
                "A reviewer confirmed you are a real, named human. Unlocks the Identity verified badge.",
                "実在する本人であることをレビュー担当者が確認済み。「本人確認済み」バッジが付きます。",
                "審核者已確認你是真實具名的人。可獲得「已驗證身分」標記。",
              )}
            />
            <Rung
              active={level === "expert"}
              icon={<IconRosetteDiscountCheck size={16} stroke={1.7} className="text-purple" />}
              title={levelLabel("expert", locale)}
              blurb={t(
                "Identity plus professional credentials, checked by a human. Only this tier can sign citable endorsements and be featured.",
                "本人確認に加え、専門資格を人が確認済み。引用可能なエンドースメントに署名し、注目枠に掲載されるのはこの段階だけです。",
                "身分加上專業資格，皆經真人查核。只有此層級能簽核可被引用的背書並獲得精選資格。",
              )}
            />
          </div>
        </div>
      </Reveal>

      {/* Current status */}
      {loaded && underReview && !editing && (
        <Reveal delay={110}>
          <Panel tone="amber" icon={<IconHourglass size={18} stroke={1.7} className="text-amber" />} title={t("Under human review", "人によるレビュー中", "人工審核中")}>
            <p className="text-[12.5px] leading-6 text-muted">
              {t(
                "A reviewer is checking your identity and, if you supplied them, your credentials. You will be notified when the review completes — there is nothing else to do.",
                "レビュー担当者が本人確認と、提出があれば資格を確認しています。完了時に通知されます。今は他に必要な操作はありません。",
                "審核者正在查核你的身分，若你有提交資格文件也會一併查核。完成後會通知你——目前無需其他動作。",
              )}
            </p>
            <div className="mt-4">
              <Btn variant="outline" size="sm" onClick={() => setEditing(true)}>
                {t("Edit and resubmit", "編集して再提出", "編輯並重新提交")}
              </Btn>
            </div>
          </Panel>
        </Reveal>
      )}

      {loaded && state === "approved" && level === "expert" && !editing && (
        <Reveal delay={110}>
          <Panel tone="purple" icon={<IconRosetteDiscountCheck size={18} stroke={1.7} className="text-purple" />} title={levelLabel("expert", locale)}>
            <p className="text-[12.5px] leading-6 text-muted">
              {levelBlurb("expert", locale)}{" "}
              {t(
                "You can sign citable endorsements, and your Agents carry the mark.",
                "引用可能なエンドースメントに署名でき、あなたのエージェントにマークが表示されます。",
                "你可以簽核可被引用的背書，你的 Agent 也會帶有此標記。",
              )}
            </p>
          </Panel>
        </Reveal>
      )}

      {loaded && state === "approved" && level === "identity" && !editing && (
        <Reveal delay={110}>
          <Panel tone="cyan" icon={<IconUserCheck size={18} stroke={1.7} className="text-cyan" />} title={levelLabel("identity", locale)}>
            <p className="text-[12.5px] leading-6 text-muted">
              {t(
                "Your identity is confirmed. To reach Verified Expert — the only tier that can sign citable endorsements — add your professional credentials below and resubmit.",
                "本人確認は完了しています。引用可能なエンドースメントに署名できる唯一の段階「認証済み専門家」に進むには、以下に専門資格を追加して再提出してください。",
                "你的身分已確認。若要達到「認證專家」——唯一能簽核可被引用背書的層級——請於下方補上專業資格並重新提交。",
              )}
            </p>
          </Panel>
        </Reveal>
      )}

      {loaded && state === "rejected" && (
        <Reveal delay={110}>
          <Panel tone="rust" icon={<IconAlertTriangle size={18} stroke={1.7} className="text-rust" />} title={t("Not approved", "承認されませんでした", "未通過審核")}>
            <p className="text-[12.5px] leading-6 text-muted">
              {t(
                "A reviewer could not confirm your details. Correct them below and resubmit — resubmitting puts you back in the review queue.",
                "レビュー担当者が内容を確認できませんでした。以下を修正して再提出してください。再提出すると再びレビュー待ちの列に入ります。",
                "審核者無法確認你的資料。請於下方修正後重新提交——重新提交後會再次進入審核佇列。",
              )}
            </p>
            {note && (
              <div className="mt-3 rounded-lg border border-border bg-panel2 px-3 py-2.5">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-faint">
                  {t("Reviewer note", "レビュー担当者のコメント", "審核者備註")}
                </div>
                <p className="mt-1 text-[12.5px] leading-6 text-text">{note}</p>
              </div>
            )}
          </Panel>
        </Reveal>
      )}

      {/* One form, two grouped sections. No wizard. */}
      {loaded && showForm && (
        <Reveal delay={140}>
          <div className="mt-5 glass-card space-y-5 p-5">
            <div>
              <SectionLabel>{t("1 · Identity", "1 · 本人確認", "1 · 身分")}</SectionLabel>
              <p className="-mt-1 mb-4 text-[11.5px] leading-5 text-faint">
                {t(
                  "Required. Grants Identity verified.",
                  "必須。「本人確認済み」が付与されます。",
                  "必填。可獲得「已驗證身分」。",
                )}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={lbl}>{t("Full legal name", "戸籍上の氏名", "法定全名")}</label>
                  <input
                    value={f.legalName}
                    onChange={(e) => set("legalName", e.target.value)}
                    placeholder={t("As printed on your ID", "身分証の記載どおりに", "與證件上完全一致")}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>{t("Country", "国", "國家 / 地區")}</label>
                  <input
                    value={f.country}
                    onChange={(e) => set("country", e.target.value)}
                    list="kyc-countries"
                    placeholder={t("Country of issue", "発行国", "證件核發地")}
                    className={inp}
                  />
                  <datalist id="kyc-countries">
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="mt-4">
                <label className={lbl}>{t("ID type", "身分証の種類", "證件類型")}</label>
                <select value={f.idType} onChange={(e) => set("idType", e.target.value as IdType)} className={inp}>
                  <option value="passport">{t("Passport", "パスポート", "護照")}</option>
                  <option value="national_id">{t("National ID card", "マイナンバーカード／国民身分証", "國民身分證")}</option>
                  <option value="drivers_licence">{t("Driver’s licence", "運転免許証", "駕照")}</option>
                </select>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Upload
                  label={t("ID document", "身分証明書", "身分證件")}
                  required
                  doc={idDoc}
                  onFile={(file, done) => upload(file, setIdDoc, done)}
                  onClear={() => setIdDoc(null)}
                />
                <Upload
                  label={t("Selfie (optional)", "自撮り写真（任意）", "自拍照（選填）")}
                  doc={selfie}
                  onFile={(file, done) => upload(file, setSelfie, done)}
                  onClear={() => setSelfie(null)}
                />
              </div>
            </div>

            <div className="border-t border-border pt-5">
              <SectionLabel>{t("2 · Credentials", "2 · 専門資格", "2 · 專業資格")}</SectionLabel>
              <p className="-mt-1 mb-4 text-[11.5px] leading-5 text-faint">
                {t(
                  "Optional — but required to reach Verified Expert, the only tier that can sign citable endorsements.",
                  "任意 — ただし、引用可能なエンドースメントに署名できる唯一の段階「認証済み専門家」には必須です。",
                  "選填 — 但要達到「認證專家」（唯一能簽核可被引用背書的層級）則為必要。",
                )}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={lbl}>{t("Licence / registration no.", "登録番号", "執照 / 註冊編號")}</label>
                  <input
                    value={f.licenceNumber}
                    onChange={(e) => set("licenceNumber", e.target.value)}
                    placeholder={t("e.g. NY Bar #123456", "例：登録番号 123456", "例：律師證號 12345")}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>{t("Issuing body", "発行機関", "核發機構")}</label>
                  <input
                    value={f.issuingBody}
                    onChange={(e) => set("issuingBody", e.target.value)}
                    placeholder={t("The registry a reviewer can check", "レビュー担当者が照会できる名簿", "審核者可查證的名冊機構")}
                    className={inp}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Upload
                  label={t("Credential document", "資格証明書", "資格證明文件")}
                  doc={credDoc}
                  onFile={(file, done) => upload(file, setCredDoc, done)}
                  onClear={() => setCredDoc(null)}
                />
              </div>

              <div className="mt-4">
                <label className={lbl}>{t("Corroborating links (up to 5)", "裏付けリンク（最大 5 件）", "佐證連結（最多 5 個）")}</label>
                <div className="space-y-2">
                  {f.links.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={l}
                        onChange={(e) => set("links", f.links.map((x, j) => (j === i ? e.target.value : x)))}
                        placeholder={t("LinkedIn · ORCID · Google Scholar · firm page", "LinkedIn・ORCID・Google Scholar・事務所ページ", "LinkedIn · ORCID · Google Scholar · 事務所頁面")}
                        className={inp}
                      />
                      {f.links.length > 1 && (
                        <button
                          type="button"
                          onClick={() => set("links", f.links.filter((_, j) => j !== i))}
                          aria-label={t("Remove link", "リンクを削除", "移除連結")}
                          className="shrink-0 rounded-lg border border-border px-2.5 text-muted transition-colors hover:border-rust/40 hover:text-rust"
                        >
                          <IconTrash size={15} stroke={1.7} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {f.links.length < 5 && (
                  <button
                    type="button"
                    onClick={() => set("links", [...f.links, ""])}
                    className="mt-2 text-[11.5px] text-purple transition-opacity hover:opacity-80"
                  >
                    {t("+ Add another link", "＋ リンクを追加", "＋ 新增連結")}
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rust/40 bg-rust/5 px-3 py-2.5 text-[12px] leading-5 text-rust">
                <IconAlertCircle size={15} stroke={1.7} className="mt-px shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Btn onClick={submit} disabled={!canSubmit} size="md" className="flex-1 disabled:opacity-50">
                {busy
                  ? t("Submitting…", "送信中…", "提交中…")
                  : state === "none"
                    ? t("Submit for review", "レビューに提出", "提交審核")
                    : t("Resubmit for review", "再提出して審査を受ける", "重新提交審核")}
              </Btn>
              {editing && (
                <Btn variant="ghost" size="md" onClick={() => { setEditing(false); setError(""); }}>
                  {t("Cancel", "キャンセル", "取消")}
                </Btn>
              )}
            </div>

            <p className="text-[10.5px] leading-5 text-faint">
              {t(
                "Submitting does not verify you. It places you in a human review queue.",
                "提出しても認証されるわけではありません。人によるレビューの待ち列に入ります。",
                "提交不代表通過認證，只是進入人工審核佇列。",
              )}
            </p>
          </div>
        </Reveal>
      )}
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Upload({
  label,
  required,
  doc,
  onFile,
  onClear,
}: {
  label: string;
  required?: boolean;
  doc: Doc | null;
  onFile: (file: File, setPending: (b: boolean) => void) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  return (
    <div>
      <label className={lbl}>
        {label}
        {required && <span className="ml-1 text-rust">*</span>}
      </label>
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file, setPending);
          e.target.value = "";
        }}
      />
      {!doc ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => ref.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-panel/40 px-3 py-3 text-[12.5px] text-muted transition-colors hover:border-purple/60 hover:text-text disabled:opacity-50"
        >
          <IconUpload size={15} stroke={1.7} />
          {pending
            ? t("Scanning…", "スキャン中…", "掃描中…")
            : t("Choose a file", "ファイルを選択", "選擇檔案")}
        </button>
      ) : (
        <div
          className={`rounded-lg border px-3 py-2.5 ${doc.scan === "clean" ? "border-green/40 bg-green/5" : "border-rust/40 bg-rust/5"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-text">{doc.fileName}</div>
              <div className="mt-0.5 text-[10.5px] text-faint">{fmtSize(doc.size)}</div>
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label={t("Remove file", "ファイルを削除", "移除檔案")}
              className="shrink-0 text-faint transition-colors hover:text-rust"
            >
              <IconTrash size={15} stroke={1.7} />
            </button>
          </div>
          <div className="mt-2">
            {doc.scan === "clean" ? (
              <Badge tone="green">
                <IconCheck size={11} stroke={1.7} />
                {t("Scan clean · not stored", "スキャン正常・保存なし", "掃描正常 · 未保存")}
              </Badge>
            ) : (
              <Badge tone="rust">
                <IconAlertTriangle size={11} stroke={1.7} />
                {t("Flagged — cannot be submitted", "フラグ済み — 提出できません", "已標記 — 無法提交")}
              </Badge>
            )}
          </div>
          {doc.scan === "flagged" && doc.detail && (
            <p className="mt-1.5 text-[10.5px] leading-5 text-rust">{doc.detail}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Rung({ active, icon, title, blurb }: { active: boolean; icon: React.ReactNode; title: string; blurb: string }) {
  const { t } = useI18n();
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${active ? "border-purple/40 bg-purple/5" : "border-border bg-panel2/50"}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-display text-[13px] font-bold ${active ? "text-text" : "text-muted"}`}>{title}</span>
          {active && <Badge tone="purple">{t("You are here", "現在の段階", "目前層級")}</Badge>}
        </div>
        <p className="mt-0.5 text-[11.5px] leading-5 text-faint">{blurb}</p>
      </div>
    </div>
  );
}

function Panel({
  tone,
  icon,
  title,
  children,
}: {
  tone: "amber" | "purple" | "cyan" | "rust";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    amber: "border-amber/40 bg-amber/5 text-amber",
    purple: "border-purple/40 bg-purple/5 text-purple",
    cyan: "border-cyan/40 bg-cyan/5 text-cyan",
    rust: "border-rust/40 bg-rust/5 text-rust",
  };
  return (
    <div className={`mt-5 glass-card p-5 ${tones[tone].split(" ").slice(0, 2).join(" ")}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className={`font-display text-[15px] font-bold ${tones[tone].split(" ")[2]}`}>{title}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function StatusPill({ state }: { state: KycStatus }) {
  const { t } = useI18n();
  if (state === "submitted" || state === "in_review")
    return <Badge tone="amber">{t("Under human review", "人によるレビュー中", "人工審核中")}</Badge>;
  if (state === "rejected") return <Badge tone="rust">{t("Not approved", "承認されず", "未通過")}</Badge>;
  return <Badge tone="muted">{t("Not submitted", "未提出", "尚未提交")}</Badge>;
}
