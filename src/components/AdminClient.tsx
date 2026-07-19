"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { useI18n } from "@/lib/i18n";
import { money } from "@/lib/format";
import { catLabel } from "@/lib/categories";
import ProtectionPanel from "./ProtectionPanel";
import ModerationQueue from "./ModerationQueue";
import { IconRosetteDiscountCheck, IconUserCheck, IconShieldCheck, IconAlertTriangle, IconExternalLink, IconIdBadge2 } from "@tabler/icons-react";

type KPI = { users: number; creators: number; buyers: number; agents: number; published: number; suspended: number; activeSubs: number; gmv: number; platformRev: number; requests: number; pendingVerify: number; mrr: number; arr: number; arpu: number; payoutPending: number; payoutPaid: number; addonGmv: number };
type Ag = { id: string; slug: string; name: string; creatorName: string; category: string; price: number; subscribers: number; status: string; rating: number };
type Usr = { id: string; name: string; email: string; role: string; createdAt: string };
type Ver = { userId: string; name: string; email: string; vertical: string; license: string; status: string };
type Tx = { type: string; amount: number; note: string; createdAt: string; email: string };
type Cfg = { takeRatePct: number; passPrice: number; defaultTrial: number; dailyRateLimit: number; escalationFeePct: number };
/** Document metadata only — the file itself was never stored. */
type KycDoc = { fileName: string; mime: string; size: number; scanStatus: string; sha256: string } | null;
type KycSub = {
  id: string; userId: string; name: string; email: string;
  legalName: string; country: string; idType: string;
  licenceNumber: string; issuingBody: string; links: string[];
  status: string; createdAt: string;
  docs: { id: KycDoc; selfie: KycDoc; credential: KycDoc };
};

const ID_TYPES: Record<string, [string, string, string]> = {
  passport: ["Passport", "パスポート", "護照"],
  national_id: ["National ID card", "国民身分証", "國民身分證"],
  drivers_licence: ["Driver’s licence", "運転免許証", "駕照"],
};
const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`);

const TABS: [string, string, string, string][] = [
  ["overview", "Overview", "概要", "總覽"],
  ["agents", "Agent Review", "Agent 審査", "Agent 審核"],
  ["users", "Users", "ユーザー", "使用者"],
  ["verify", "Verification", "認証審査", "認證審核"],
  ["tx", "Ledger", "取引台帳", "交易帳本"],
  ["config", "Settings", "プラットフォーム設定", "平台設定"],
  ["protection", "Protection", "保護", "保護"],
  ["moderation", "Moderation", "モデレーション", "審核"],
];

export default function AdminClient({ kpi, agents, users, verifications, transactions, config }: {
  kpi: KPI; agents: Ag[]; users: Usr[]; verifications: Ver[]; transactions: Tx[]; config: Cfg;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [tab, setTab] = useState("overview");
  const [cfg, setCfg] = useState(config);
  const [busy, setBusy] = useState(false);
  // Verification tab: the KYC review queue, plus an optional written note per decision.
  const [kyc, setKyc] = useState<KycSub[]>([]);
  const [kycLoaded, setKycLoaded] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);

  const loadKyc = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/kyc");
      const d = await r.json().catch(() => ({}));
      if (d?.ok && Array.isArray(d.submissions)) setKyc(d.submissions);
    } catch {
      /* leave the queue empty */
    } finally {
      setKycLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (tab === "verify") loadKyc();
  }, [tab, loadKyc]);

  async function decide(userId: string, grant: "identity" | "expert" | "reject", ok: string) {
    setBusy(true);
    const r = await fetch("/api/admin/kyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, grant, note: (notes[userId] || "").trim() }),
    });
    setBusy(false);
    if (r.ok) {
      toast(ok, "success");
      setRejecting(null);
      setNotes((n) => ({ ...n, [userId]: "" }));
      setKyc((q) => q.filter((x) => x.userId !== userId));
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      toast(d.error || t("Operation failed", "操作に失敗しました", "操作失敗"), "error");
    }
  }

  async function api(url: string, body: any, ok: string) {
    setBusy(true);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) { toast(ok, "success"); router.refresh(); } else { const d = await r.json().catch(()=>({})); toast(d.error || t("Operation failed","操作に失敗しました","操作失敗"), "error"); }
  }

  return (
    <div className="animate-fadein">
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-rust/30 bg-rust/15 px-2 py-0.5 font-mono text-[11px] font-bold text-rust">ADMIN</span>
        <h1 className="font-display text-[26px] font-extrabold tracking-tight"><span className="text-grad">{t("Admin Console","管理コンソール","平台管理後台")}</span></h1>
      </div>
      <p className="mb-6 mt-1 text-[13px] text-muted">{t("Platform-wide metrics, content moderation, users, and rule settings.","プラットフォーム全体の運用指標、コンテンツ審査、ユーザーとルール設定。","全平台營運指標、內容審核、使用者與規則設定。")}</p>

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-glassborder/20 bg-panel2/40 p-1 backdrop-blur-sm">
        {TABS.map(([k, en, ja, zh]) => <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${tab === k ? "text-white bg-purple" : "text-muted hover:text-text"}`}>{t(en, ja, zh)}</button>)}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <K v={money(kpi.gmv)} l={t("Monthly GMV","月間GMV","月 GMV")} tone="#8b6dff" />
            <K v={money(kpi.platformRev)} l={t("Monthly Revenue","プラットフォーム月間収益","平台月收入")} tone="#4ade80" />
            <K v={kpi.activeSubs.toLocaleString()} l={t("Active Subscriptions","有効サブスク","有效訂閱")} tone="#e5a94e" />
            <K v={kpi.requests.toLocaleString()} l={t("Total API Usage","累計API利用量","累計 API 用量")} tone="#5eb0ff" />
            <K v={kpi.users.toLocaleString()} l={t("Total Users","ユーザー総数","使用者總數")} />
            <K v={`${kpi.creators} / ${kpi.buyers}`} l={t("Creators / Buyers","クリエイター / 購入者","創作者 / 買家")} />
            <K v={`${kpi.published}`} l={t(`Published (${kpi.suspended} suspended)`, `公開中（停止 ${kpi.suspended}）`, `已上架（停用 ${kpi.suspended}）`)} />
            <K v={kpi.pendingVerify} l={t("Pending Verifications","認証審査待ち","待審認證")} tone={kpi.pendingVerify ? "#f0663f" : undefined} />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint"><span className="inline-block h-px w-6 bg-gradient-to-r from-violet to-transparent" />{t("Monetization","マネタイズ","變現指標")}</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <K v={money(kpi.mrr)} l={t("MRR","MRR","月經常收入")} tone="#8b6dff" />
              <K v={money(kpi.arr)} l={t("ARR (run-rate)","ARR（年換算）","ARR（年化）")} tone="#4ade80" />
              <K v={money(kpi.arpu)} l={t("ARPU / mo","ARPU / 月","每用戶月營收")} />
              <K v={money(kpi.addonGmv)} l={t("Expert-loop GMV","エキスパートGMV","專家迴圈 GMV")} tone="#e5a94e" />
              <K v={money(kpi.payoutPending)} l={t("Payouts in flight","支払い処理中","付款處理中")} tone={kpi.payoutPending ? "#e5a94e" : undefined} />
              <K v={money(kpi.payoutPaid)} l={t("Paid to creators","クリエイター支払済","已付創作者")} tone="#5eb0ff" />
            </div>
            <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-faint">{t("Illustrative until measured · platform take " + config.takeRatePct + "% · creator share " + (100 - config.takeRatePct) + "%","計測まで参考値","實測前為示意 · 平台抽成 " + config.takeRatePct + "% · 創作者分潤 " + (100 - config.takeRatePct) + "%")}</div>
          </div>

          <div className="glass-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-display text-[13px] font-bold">{t("Recompute Derived Data","派生データの再計算","派生資料重算")}</div>
              <button disabled={busy} onClick={() => api("/api/admin/recompute", {}, t("Recomputed subscriber counts and ratings for all agents","全Agentのサブスク数と評価を再計算しました","已重算所有 Agent 的訂閱數與評分"))} className="btn-glow border border-transparent shadow-glow transition hover:brightness-110 bg-purple rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">{t("Recompute Now","今すぐ再計算","立即重算")}</button>
            </div>
            <div className="text-[11.5px] leading-6 text-muted">{t("Recalculate each agent's subscriber count and rating from actual active subscriptions and reviews, keeping displayed figures in sync with real data.","実際の有効サブスクと評価に基づき、各Agentのサブスク数と星評価を再計算し、表示数値を実データと一致させます。","依實際有效訂閱與評價，重新計算每個 Agent 的訂閱數與星等，確保顯示數據與真實資料一致。")}</div>
          </div>
        </div>
      )}

      {tab === "agents" && (
        <div className="glass-card !p-0 divide-y divide-glassborder/15 overflow-hidden">
          {agents.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{catLabel(a.category)}</span>
                  <span className={`text-[10px] ${a.status === "published" ? "text-green" : a.status === "suspended" ? "text-rust" : "text-amber"}`}>● {a.status}</span>
                </div>
                <Link href={`/agent/${a.slug}`} className="font-display text-[13px] font-bold transition hover:text-violet">{a.name}</Link>
                <div className="text-[10.5px] text-faint">by {a.creatorName} · {a.subscribers} {t("subs","件","訂閱")} · ${a.price} · ★{a.rating.toFixed(1)}</div>
              </div>
              <div className="flex gap-2">
                {a.status === "published"
                  ? <button disabled={busy} onClick={() => api("/api/admin/agent", { id: a.id, action: "suspend" }, t("Unpublished","非公開にしました","已下架"))} className="rounded-lg border border-rust/50 px-2.5 py-1 text-[11px] text-rust transition hover:bg-rust/10">{t("Unpublish","非公開","下架")}</button>
                  : <button disabled={busy} onClick={() => api("/api/admin/agent", { id: a.id, action: "publish" }, t("Published","公開しました","已上架"))} className="rounded-lg border border-green/50 px-2.5 py-1 text-[11px] text-green transition hover:bg-green/10">{t("Publish","公開","上架")}</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="glass-card !p-0 divide-y divide-glassborder/15 overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div><div className="font-display text-[13px] font-bold">{u.name}</div><div className="text-[10.5px] text-faint">{u.email}</div></div>
              <div className="flex items-center gap-2">
                <select defaultValue={u.role} onChange={(e) => api("/api/admin/user", { id: u.id, action: "setRole", role: e.target.value }, t("Role updated","役割を更新しました","已更新角色"))}
                  className="rounded-lg border border-glassborder/20 bg-panel2/50 px-2 py-1 text-[11.5px] outline-none backdrop-blur-sm transition focus:border-violet">
                  {["buyer","creator","enterprise","admin"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "verify" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-green/40 bg-green/5 px-4 py-3">
            <IconShieldCheck size={17} stroke={1.7} className="mt-0.5 shrink-0 text-green" />
            <p className="text-[12px] leading-6 text-muted">
              {t(
                "Documents are never stored. Each file was scanned for malware in memory and discarded — only the filename, size, hash and scan verdict below remain. Review the metadata and the corroborating links; grant only what you can actually confirm.",
                "書類は保存されていません。各ファイルはメモリ上でマルウェアスキャンされ破棄済みです。以下のファイル名・サイズ・ハッシュ・スキャン結果のみが残っています。メタデータと裏付けリンクを確認し、実際に確認できた範囲だけを付与してください。",
                "文件不會被保存。每個檔案都在記憶體中完成惡意程式掃描後即丟棄——僅保留下方的檔名、大小、雜湊與掃描結果。請審視中繼資料與佐證連結，只授予你確實能查證的層級。",
              )}
            </p>
          </div>

          {kycLoaded && kyc.length === 0 && (
            <div className="glass-card border-dashed py-12 text-center text-[12px] text-muted">
              {t("No verification requests pending", "審査待ちの認証申請はありません", "目前沒有待審核的認證申請")}
            </div>
          )}

          {kyc.map((v) => (
            <div key={v.id} className="glass-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[14px] font-bold text-text">
                    {v.legalName || v.name} <span className="ml-1 text-[10.5px] font-normal text-faint">{v.email}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                    <IconIdBadge2 size={13} stroke={1.7} className="text-faint" />
                    <span>{ID_TYPES[v.idType] ? t(...ID_TYPES[v.idType]) : v.idType}</span>
                    <span className="text-faint">·</span>
                    <span>{v.country || "—"}</span>
                    <span className="text-faint">·</span>
                    <span className="text-faint">{t("account name", "アカウント名", "帳號名稱")}: {v.name}</span>
                  </div>
                </div>
                <span className="rounded-full border border-amber/40 bg-panel/40 px-2 py-0.5 text-[10.5px] text-amber">
                  {t("Awaiting review", "レビュー待ち", "待審核")}
                </span>
              </div>

              {/* Documents — metadata only. */}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <DocCard label={t("ID document", "身分証明書", "身分證件")} doc={v.docs.id} />
                <DocCard label={t("Selfie", "自撮り写真", "自拍照")} doc={v.docs.selfie} />
                <DocCard label={t("Credential", "資格証明書", "資格證明")} doc={v.docs.credential} />
              </div>

              {/* Credentials */}
              <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <Field label={t("Licence / registration no.", "登録番号", "執照 / 註冊編號")}>
                  {v.licenceNumber || <span className="text-faint">{t("Not provided", "未提出", "未提供")}</span>}
                </Field>
                <Field label={t("Issuing body", "発行機関", "核發機構")}>
                  {v.issuingBody || <span className="text-faint">{t("Not provided", "未提出", "未提供")}</span>}
                </Field>
              </div>

              <div className="mt-3">
                <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.12em] text-faint">
                  {t("Corroborating links", "裏付けリンク", "佐證連結")}
                </div>
                {v.links.length === 0 ? (
                  <div className="text-[12px] text-faint">{t("None supplied", "提出なし", "未提供")}</div>
                ) : (
                  <ul className="space-y-1">
                    {v.links.map((l, i) => (
                      <li key={i}>
                        <a
                          href={l}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1.5 break-all text-[12px] text-purple transition-opacity hover:opacity-80"
                        >
                          <IconExternalLink size={12} stroke={1.7} className="shrink-0" />
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Decision */}
              <div className="mt-4 border-t border-border pt-4">
                <label className="mb-1.5 block text-[10.5px] uppercase tracking-[0.14em] text-faint">
                  {t("Reviewer note (sent to the applicant)", "レビュー担当者のコメント（申請者に通知）", "審核者備註（會通知申請者）")}
                </label>
                <input
                  value={notes[v.userId] || ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [v.userId]: e.target.value }))}
                  maxLength={300}
                  placeholder={t(
                    "e.g. Licence number could not be confirmed with the registry.",
                    "例：登録番号を名簿で確認できませんでした。",
                    "例：無法於公會名冊確認執照號碼。",
                  )}
                  className="w-full rounded-lg border border-border bg-panel/40 px-3 py-2 text-[12.5px] text-text outline-none transition-colors placeholder:text-faint focus:border-purple/60"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={() => decide(v.userId, "identity", t("Identity verified", "本人確認を付与しました", "已授予身分驗證"))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/40 px-3 py-1.5 text-[11.5px] text-cyan transition-colors hover:bg-cyan/10 disabled:opacity-50"
                  >
                    <IconUserCheck size={14} stroke={1.7} /> {t("Grant Identity", "本人確認を付与", "授予身分驗證")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => decide(v.userId, "expert", t("Verified Expert granted", "認証済み専門家を付与しました", "已授予認證專家"))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple/40 bg-purple/10 px-3 py-1.5 text-[11.5px] text-purple transition-colors hover:bg-purple/20 disabled:opacity-50"
                  >
                    <IconRosetteDiscountCheck size={14} stroke={1.7} /> {t("Grant Verified Expert", "認証済み専門家を付与", "授予認證專家")}
                  </button>
                  {rejecting === v.userId ? (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => decide(v.userId, "reject", t("Rejected", "却下しました", "已拒絕"))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rust/50 bg-rust/10 px-3 py-1.5 text-[11.5px] font-semibold text-rust transition-colors hover:bg-rust/20 disabled:opacity-50"
                      >
                        <IconAlertTriangle size={14} stroke={1.7} /> {t("Confirm rejection", "却下を確定", "確認拒絕")}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setRejecting(null)}
                        className="rounded-lg border border-transparent px-3 py-1.5 text-[11.5px] text-muted transition-colors hover:bg-panel2 hover:text-text"
                      >
                        {t("Cancel", "キャンセル", "取消")}
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => setRejecting(v.userId)}
                      className="rounded-lg border border-rust/50 px-3 py-1.5 text-[11.5px] text-rust transition-colors hover:bg-rust/10 disabled:opacity-50"
                    >
                      {t("Reject", "却下", "拒絕")}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[10.5px] leading-5 text-faint">
                  {t(
                    "Identity confirms a real, named human. Verified Expert additionally confirms professional credentials — only that tier can sign citable endorsements or be featured.",
                    "「本人確認」は実在する本人であることの確認です。「認証済み専門家」はさらに専門資格を確認したもので、引用可能なエンドースメントへの署名や注目枠の掲載はこの段階のみ可能です。",
                    "「身分驗證」確認此人真實具名；「認證專家」另外確認其專業資格——只有該層級能簽核可被引用的背書或獲得精選資格。",
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "tx" && (
        <div className="glass-card !p-0 divide-y divide-glassborder/15 overflow-hidden">
          {transactions.map((t2, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
              <span className="text-muted">{t2.note || t2.type} <span className="text-faint">· {t2.email}</span></span>
              <span className="font-display font-bold">{money(t2.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "config" && (
        <div className="max-w-md space-y-4 glass-card p-6">
          <Row label={t("Platform Take Rate %","プラットフォーム手数料 %","平台抽成 %")}><input type="number" value={cfg.takeRatePct} onChange={(e) => setCfg({ ...cfg, takeRatePct: +e.target.value })} className={inp} /></Row>
          <Row label={t("Pass Monthly Fee $","パス月額 $","通行證月費 $")}><input type="number" value={cfg.passPrice} onChange={(e) => setCfg({ ...cfg, passPrice: +e.target.value })} className={inp} /></Row>
          <Row label={t("Default Trial Count","デフォルト試用回数","預設試用次數")}><input type="number" value={cfg.defaultTrial} onChange={(e) => setCfg({ ...cfg, defaultTrial: +e.target.value })} className={inp} /></Row>
          <Row label={t("Daily Usage Limit / Sub","1日の利用上限 / サブスク","每日用量上限 / 訂閱")}><input type="number" value={cfg.dailyRateLimit} onChange={(e) => setCfg({ ...cfg, dailyRateLimit: +e.target.value })} className={inp} /></Row>
          <Row label={t("Expert Loop Fee %","Expert Loop 手数料 %","Expert Loop 抽成 %")}><input type="number" value={cfg.escalationFeePct} onChange={(e) => setCfg({ ...cfg, escalationFeePct: +e.target.value })} className={inp} /></Row>
          <button disabled={busy} onClick={() => api("/api/admin/config", cfg, t("Platform settings updated","プラットフォーム設定を更新しました","平台設定已更新"))} className="btn-glow border border-transparent shadow-glow transition hover:brightness-110 bg-purple w-full rounded-xl py-2.5 text-[13px] font-bold text-white disabled:opacity-50">{t("Save Settings","設定を保存","儲存設定")}</button>
          <div className="text-[11px] leading-6 text-faint">{t("These settings affect the whole platform in real time: revenue split, pass pricing, trial quotas, and API rate limits.","これらの設定はプラットフォーム全体に即時反映されます：分配計算、パス価格、試用枠、APIレート制限。","這些設定即時影響全平台：分潤計算、通行證定價、試用額度與 API 速率限制。")}</div>
        </div>
      )}

      {tab === "protection" && (
        <ProtectionPanel scope="admin" />
      )}

      {tab === "moderation" && (
        <ModerationQueue />
      )}
    </div>
  );
}
const inp = "w-32 rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-1.5 text-[13px] text-right outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow";
function K({ v, l, tone }: { v: React.ReactNode; l: string; tone?: string }) {
  return <div className="glass-card px-4 py-3"><div className="font-display text-[19px] font-extrabold" style={tone ? { color: tone } : undefined}>{v}</div><div className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">{l}</div></div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-[12.5px] text-muted">{label}</span>{children}</div>;
}
function DocCard({ label, doc }: { label: string; doc: KycDoc }) {
  const { t } = useI18n();
  if (!doc) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-2.5">
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-faint">{label}</div>
        <div className="mt-1 text-[11.5px] text-faint">{t("Not supplied", "提出なし", "未提供")}</div>
      </div>
    );
  }
  const clean = doc.scanStatus === "clean";
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${clean ? "border-green/40 bg-green/5" : "border-rust/40 bg-rust/5"}`}>
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="mt-1 truncate text-[12px] text-text" title={doc.fileName}>{doc.fileName}</div>
      <div className="mt-0.5 text-[10.5px] text-faint">{doc.mime} · {fmtSize(doc.size)}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${clean ? "border-green/40 text-green" : "border-rust/40 text-rust"}`}>
          {clean ? t("Scan clean", "スキャン正常", "掃描正常") : t("Flagged", "フラグ済み", "已標記")}
        </span>
        <span className="font-mono text-[10px] text-faint" title={t("SHA-256 prefix — the file itself was not stored", "SHA-256 の先頭 — ファイル本体は保存されていません", "SHA-256 前綴——檔案本身未被保存")}>
          {doc.sha256}…
        </span>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="mt-1 text-[12.5px] leading-6 text-text">{children}</div>
    </div>
  );
}
