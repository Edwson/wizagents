"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import StepUp from "@/components/StepUp";
import { Btn, Badge, Reveal, SectionLabel } from "@/components/ui";
import { money, money2, timeAgo } from "@/lib/format";
import {
  IconWallet, IconBuildingBank, IconBrandPaypal, IconBrandStripe, IconCurrencyDollar,
  IconArrowUpRight, IconShieldLock, IconLock, IconX, IconCircleCheck, IconClockHour4, IconAlertTriangle,
} from "@tabler/icons-react";

export type Earnings = {
  lifetime: number; available: number; pending: number; withdrawn: number;
  mrrGross: number; mrrNet: number; subShare: number; addonShare: number;
  share: number; hasMethod: boolean; method: string; destinationMasked: string;
};
export type Payout = {
  id: string; amount: number; feeAmount: number; netAmount: number;
  method: string; destinationMasked: string;
  status: "requested" | "processing" | "paid" | "failed"; requestedAt: string;
};
type Method = "bank" | "paypal" | "stripe" | "wise";

const MIN = 50;

export default function PayoutPanel({ initial }: { initial?: { earnings: Earnings; payouts: Payout[] } }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();

  const [earnings, setEarnings] = useState<Earnings | null>(initial?.earnings ?? null);
  const [payouts, setPayouts] = useState<Payout[]>(initial?.payouts ?? []);
  const [loading, setLoading] = useState(!initial);

  // method form
  const [method, setMethod] = useState<Method>((initial?.earnings?.method as Method) || "bank");
  const [account, setAccount] = useState("");
  const [savingMethod, setSavingMethod] = useState(false);

  // withdraw
  const [showAmount, setShowAmount] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // step-up: which flow is pending verification
  const [stepUp, setStepUp] = useState<null | "method" | "withdraw">(null);

  async function refetch() {
    try {
      const r = await fetch("/api/payout", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) { setEarnings(d.earnings); setPayouts(d.payouts); if (d.earnings.method) setMethod(d.earnings.method); }
    } finally { setLoading(false); }
  }

  useEffect(() => { if (!initial) refetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Payout method ----
  async function saveMethod(): Promise<void> {
    const acct = account.trim();
    if (acct.length < 4) { toast(t("Enter a valid account or email.", "有効な口座またはメールを入力してください。", "請輸入有效的帳號或電子郵件。"), "error"); return; }
    setSavingMethod(true);
    try {
      const r = await fetch("/api/payout/method", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, account: acct }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setAccount("");
        setEarnings((e) => e ? { ...e, hasMethod: true, method: d.method, destinationMasked: d.destinationMasked } : e);
        toast(t("Payout destination saved.", "受取先を保存しました。", "已儲存收款方式。"), "success");
        return;
      }
      if (d.code === "need_2fa") { toast(t("Enable two-factor authentication first to protect your money.", "資金保護のため、まず二段階認証を有効にしてください。", "為保護你的資金，請先啟用兩步驗證。"), "error"); return; }
      if (d.code === "need_stepup") { setStepUp("method"); return; }
      toast(d.error || t("Could not save. Please try again.", "保存できませんでした。もう一度お試しください。", "無法儲存，請再試一次。"), "error");
    } catch {
      toast(t("Network error. Please try again.", "ネットワークエラー。もう一度お試しください。", "網路錯誤，請再試一次。"), "error");
    } finally { setSavingMethod(false); }
  }

  // ---- Withdraw ----
  function openWithdraw() {
    if (!earnings) return;
    setAmount(String(earnings.available));
    setShowAmount(true);
  }

  async function submitWithdraw(): Promise<void> {
    if (!earnings) return;
    const amt = Math.floor(Number(amount) || 0);
    if (amt < MIN) { toast(t(`Minimum withdrawal is $${MIN}.`, `最低出金額は$${MIN}です。`, `最低提領金額為 $${MIN}。`), "error"); return; }
    if (amt > earnings.available) { toast(t("Amount exceeds your available balance.", "出金可能額を超えています。", "金額超過可提領餘額。"), "error"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/payout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setShowAmount(false); setAmount("");
        toast(t("Withdrawal requested — funds are on their way.", "出金を申請しました。まもなく着金します。", "已申請提領，款項將很快到帳。"), "success");
        await refetch();
        return;
      }
      if (d.code === "need_2fa") { toast(t("Enable two-factor authentication first to protect your money.", "資金保護のため、まず二段階認証を有効にしてください。", "為保護你的資金，請先啟用兩步驗證。"), "error"); return; }
      if (d.code === "need_stepup") { setStepUp("withdraw"); return; }
      toast(d.error || t("Withdrawal failed. Please try again.", "出金に失敗しました。もう一度お試しください。", "提領失敗，請再試一次。"), "error");
    } catch {
      toast(t("Network error. Please try again.", "ネットワークエラー。もう一度お試しください。", "網路錯誤，請再試一次。"), "error");
    } finally { setSubmitting(false); }
  }

  // Called after StepUp sets the 5-minute cookie — retry the original action.
  function onVerified() {
    const which = stepUp;
    setStepUp(null);
    if (which === "method") saveMethod();
    else if (which === "withdraw") submitWithdraw();
  }

  const hasMethod = !!earnings?.hasMethod;
  const available = earnings?.available ?? 0;
  const canWithdraw = hasMethod && available >= MIN;

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* ---------- Withdraw ---------- */}
      <Reveal>
        <SectionLabel>{t("Withdraw", "出金", "提領")}</SectionLabel>
        <div className="glass-card border-grad p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-glassborder bg-panel/40 p-2.5"><IconWallet size={20} stroke={1.8} className="text-violet" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-muted">{t("Available to withdraw", "出金可能額", "可提領金額")}</div>
              <div className="font-display text-3xl font-bold text-grad">{money(available)}</div>
              <div className="mt-1 text-[11px] text-faint">
                {t(`Minimum $${MIN}. Typically 1–3 business days after approval.`, `最低$${MIN}。承認後、通常1〜3営業日で着金します。`, `最低 $${MIN}。核准後通常 1–3 個工作日到帳。`)}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Btn variant="primary" onClick={openWithdraw} disabled={!canWithdraw} className={!canWithdraw ? "cursor-not-allowed opacity-50" : ""}>
              <IconArrowUpRight size={16} stroke={1.8} />
              {t("Withdraw funds", "出金する", "提領資金")}
            </Btn>
            {!hasMethod && <div className="mt-3 text-[11.5px] text-amber">{t("Add a payout destination first.", "先に受取先を追加してください。", "請先新增收款方式。")}</div>}
            {hasMethod && available < MIN && <div className="mt-3 text-[11.5px] text-faint">{t(`You need at least $${MIN} available to withdraw.`, `出金には最低$${MIN}の残高が必要です。`, `提領需至少 $${MIN} 可用餘額。`)}</div>}
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-lg border border-glassborder bg-panel/30 p-3 text-[11px] leading-5 text-muted">
            <IconShieldLock size={15} stroke={1.8} className="mt-0.5 shrink-0 text-green" />
            <span>{t("Every withdrawal is confirmed with your authenticator code or biometric. This is what keeps your earnings yours — no one can move your money without you.", "すべての出金は認証コードまたは生体認証で確認します。これによりあなたの収益はあなたのものに保たれ、本人以外は資金を動かせません。", "每筆提領都需以驗證碼或生物辨識確認。這確保收益始終屬於你——沒有你，任何人都無法動用你的資金。")}</span>
          </div>
        </div>
      </Reveal>

      {/* ---------- Payout method ---------- */}
      <Reveal delay={80}>
        <SectionLabel>{t("Payout destination", "受取先", "收款方式")}</SectionLabel>
        <div className="glass-card p-6">
          {hasMethod && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-green/30 bg-green/5 p-3">
              <IconCircleCheck size={18} stroke={1.8} className="text-green" />
              <div className="min-w-0 text-[12px]">
                <div className="font-medium">{t("Verified destination", "確認済みの受取先", "已驗證的收款方式")}</div>
                <div className="text-muted">{methodLabel(earnings!.method, t)} · {earnings!.destinationMasked}</div>
              </div>
            </div>
          )}

          <div className="text-[12px] text-muted">{hasMethod ? t("Update where you get paid", "受取先を変更", "更新收款方式") : t("Choose where you get paid", "受取先を選択", "選擇收款方式")}</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["bank", "paypal", "stripe", "wise"] as Method[]).map((m) => (
              <button key={m} onClick={() => setMethod(m)} type="button"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] transition-all ${method === m ? "border-violet bg-purple/5 text-text shadow-glow" : "border-glassborder bg-panel/30 text-muted hover:border-purple"}`}>
                {methodIcon(m)}
                {methodLabel(m, t)}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-[11px] uppercase tracking-[0.1em] text-faint">
            {method === "paypal" ? t("PayPal email", "PayPalメール", "PayPal 電子郵件") : method === "bank" ? t("Account / IBAN", "口座番号 / IBAN", "帳號 / IBAN") : t("Account", "アカウント", "帳號")}
          </label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-glassborder bg-panel/30 px-3 focus-within:border-violet">
            <IconLock size={15} stroke={1.8} className="shrink-0 text-faint" />
            <input value={account} onChange={(e) => setAccount(e.target.value)}
              type={method === "paypal" ? "email" : "text"}
              placeholder={method === "paypal" ? "you@example.com" : "•••• •••• •••• 1234"}
              className="w-full bg-transparent py-2.5 text-[13px] text-text placeholder:text-faint focus:outline-none" />
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-4 text-faint">
            <IconShieldLock size={13} stroke={1.8} className="mt-px shrink-0" />
            {t("We store only the last 4 digits — never your full account number.", "保存するのは末尾4桁のみで、口座番号全体は保持しません。", "我們只保留末 4 碼，絕不儲存完整帳號。")}
          </div>

          <div className="mt-4">
            <Btn variant="outline" onClick={saveMethod} disabled={savingMethod}>
              {savingMethod ? t("Saving…", "保存中…", "儲存中…") : hasMethod ? t("Update destination", "受取先を更新", "更新收款方式") : t("Save destination", "受取先を保存", "儲存收款方式")}
            </Btn>
          </div>
        </div>
      </Reveal>

      {/* ---------- History ---------- */}
      <Reveal delay={120} className="lg:col-span-2">
        <SectionLabel>{t("Payout history", "出金履歴", "提領記錄")}</SectionLabel>
        <div className="glass-card p-2">
          {loading && <div className="py-10 text-center text-[12px] text-faint">{t("Loading…", "読み込み中…", "載入中…")}</div>}
          {!loading && payouts.length === 0 && (
            <div className="py-12 text-center text-[12px] text-muted">{t("No withdrawals yet. Your payout history will appear here.", "まだ出金はありません。出金履歴はここに表示されます。", "尚無提領記錄，你的提領歷史會顯示在這裡。")}</div>
          )}
          <div className="divide-y divide-glassborder">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-glassborder bg-panel/40 p-2">{methodIcon(p.method as Method)}</div>
                  <div>
                    <div className="text-[13px] font-medium">{money2(p.netAmount)} <span className="text-[11px] font-normal text-faint">→ {p.destinationMasked || methodLabel(p.method, t)}</span></div>
                    <div className="text-[11px] text-faint">{timeAgo(p.requestedAt, locale)}{p.feeAmount > 0 ? ` · ${t("fee", "手数料", "手續費")} ${money2(p.feeAmount)}` : ""}</div>
                  </div>
                </div>
                <StatusBadge status={p.status} t={t} />
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ---------- Amount modal ---------- */}
      {showAmount && earnings && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="glass-card border-grad w-full max-w-sm p-6">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-bold"><IconArrowUpRight size={16} stroke={1.8} className="text-violet" />{t("Withdraw funds", "出金", "提領資金")}</div>
              <button onClick={() => setShowAmount(false)} className="text-faint hover:text-text"><IconX size={16} /></button>
            </div>
            <p className="mb-4 text-[11.5px] leading-6 text-muted">
              {t("Sending to", "送金先", "轉入")} <span className="text-text">{methodLabel(earnings.method, t)} · {earnings.destinationMasked}</span>. {t("You'll confirm it's you on the next step.", "次のステップで本人確認を行います。", "下一步將確認你的身分。")}
            </p>
            <label className="block text-[11px] uppercase tracking-[0.1em] text-faint">{t("Amount", "金額", "金額")}</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-glassborder bg-panel/30 px-3 focus-within:border-violet">
              <IconCurrencyDollar size={16} stroke={1.8} className="shrink-0 text-faint" />
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
                className="w-full bg-transparent py-2.5 text-[15px] font-display font-bold text-text focus:outline-none" autoFocus />
              <button type="button" onClick={() => setAmount(String(earnings.available))} className="shrink-0 text-[11px] text-violet hover:underline">{t("Max", "上限", "全部")}</button>
            </div>
            <div className="mt-2 text-[11px] text-faint">{t(`Available ${money(earnings.available)} · minimum $${MIN}.`, `出金可能額 ${money(earnings.available)}・最低$${MIN}。`, `可提領 ${money(earnings.available)}・最低 $${MIN}。`)}</div>
            <div className="mt-5 flex gap-2">
              <Btn variant="ghost" onClick={() => setShowAmount(false)} className="flex-1">{t("Cancel", "キャンセル", "取消")}</Btn>
              <Btn variant="primary" onClick={submitWithdraw} disabled={submitting} className="flex-1">
                {submitting ? t("Processing…", "処理中…", "處理中…") : t("Continue", "続ける", "繼續")}
              </Btn>
            </div>
          </div>
        </div>
      )}

      <StepUp open={stepUp !== null} onClose={() => setStepUp(null)} onVerified={onVerified}
        title={stepUp === "withdraw" ? t("Confirm withdrawal", "出金の確認", "確認提領") : t("Confirm payout destination", "受取先の確認", "確認收款方式")} />
    </div>
  );
}

function StatusBadge({ status, t }: { status: Payout["status"]; t: (en: string, ja?: string, zh?: string) => string }) {
  if (status === "paid") return <Badge tone="green"><IconCircleCheck size={12} stroke={1.8} />{t("Paid", "着金済み", "已到帳")}</Badge>;
  if (status === "failed") return <Badge tone="rust"><IconAlertTriangle size={12} stroke={1.8} />{t("Failed", "失敗", "失敗")}</Badge>;
  if (status === "requested") return <Badge tone="amber"><IconClockHour4 size={12} stroke={1.8} />{t("Requested", "申請済み", "已申請")}</Badge>;
  return <Badge tone="amber"><IconClockHour4 size={12} stroke={1.8} />{t("Processing", "処理中", "處理中")}</Badge>;
}

function methodLabel(m: string, t: (en: string, ja?: string, zh?: string) => string) {
  switch (m) {
    case "paypal": return "PayPal";
    case "stripe": return "Stripe";
    case "wise": return "Wise";
    default: return t("Bank transfer", "銀行振込", "銀行轉帳");
  }
}
function methodIcon(m: Method) {
  const p = { size: 16, stroke: 1.8 as const };
  if (m === "paypal") return <IconBrandPaypal {...p} className="text-cyan" />;
  if (m === "stripe") return <IconBrandStripe {...p} className="text-violet" />;
  if (m === "wise") return <IconCurrencyDollar {...p} className="text-green" />;
  return <IconBuildingBank {...p} className="text-violet" />;
}
