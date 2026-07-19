"use client";
import { useState } from "react";
import { IconShieldLock, IconShieldCheck, IconCopy } from "@tabler/icons-react";
import { useToast } from "./Toast";
import { useI18n } from "@/lib/i18n";

export default function TwoFactorSetup({ enabled: initial }: { enabled: boolean }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(initial);
  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle");
  const [qr, setQr] = useState(""); const [secret, setSecret] = useState("");
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<string[]>([]);

  async function startSetup() {
    setBusy(true);
    const r = await fetch("/api/auth/2fa/setup", { method: "POST" }); const d = await r.json(); setBusy(false);
    if (!r.ok) return toast(d.error || "Error", "error");
    setQr(d.qr); setSecret(d.secret); setStep("setup");
  }
  async function enable() {
    setBusy(true);
    const r = await fetch("/api/auth/2fa/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: code }) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) return toast(d.error || "Invalid code", "error");
    setBackup(d.backupCodes || []); setEnabled(true); setCode(""); toast(t("2FA enabled", "2FAを有効化", "已啟用 2FA"), "success");
  }
  async function disable() {
    setBusy(true);
    const r = await fetch("/api/auth/2fa/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: code }) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) return toast(d.error || "Invalid code", "error");
    setEnabled(false); setStep("idle"); setCode(""); toast(t("2FA disabled", "2FAを無効化", "已停用 2FA"), "success");
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? <IconShieldCheck size={18} className="text-green" stroke={1.7} /> : <IconShieldLock size={18} className="text-muted" stroke={1.7} />}
          <div>
            <div className="font-display text-[13px] font-bold">{t("Two-factor authentication", "二段階認証", "兩步驟驗證")}</div>
            <div className="text-[11.5px] text-muted">{enabled ? t("Enabled — your account is protected with an authenticator app.", "有効 — 認証アプリで保護されています。", "已啟用 — 你的帳號受驗證器 App 保護。") : t("Add a second layer of security with an authenticator app.", "認証アプリでセキュリティを強化。", "用驗證器 App 增加一層安全性。")}</div>
          </div>
        </div>
        {step === "idle" && (enabled
          ? <button onClick={() => setStep("disable")} className="rounded-xl border border-rust/50 px-3.5 py-1.5 text-[12px] text-rust transition hover:bg-rust/10">{t("Disable", "無効化", "停用")}</button>
          : <button onClick={startSetup} disabled={busy} className="btn-glow rounded-xl border border-transparent px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50 bg-purple">{t("Enable", "有効化", "啟用")}</button>)}
      </div>

      {step === "setup" && !backup.length && (
        <div className="mt-4 space-y-3 border-t border-glassborder/15 pt-4">
          <div className="text-[12px] text-muted">{t("1. Scan this QR with Google Authenticator, Authy, 1Password, etc.", "1. Google Authenticator 等でこのQRをスキャン。", "1. 用 Google Authenticator、Authy、1Password 等掃描此 QR。")}</div>
          {qr && <img src={qr} alt="2FA QR" className="rounded-xl border border-glassborder/20 bg-white p-2 shadow-glow" width={160} height={160} />}
          <div className="flex items-center gap-2 text-[11px] text-faint">
            <span>{t("or enter key:", "またはキー:", "或輸入金鑰：")}</span>
            <code className="rounded-md border border-glassborder/20 bg-panel2/60 px-2 py-1 font-mono text-[10.5px] text-grad-neon backdrop-blur-sm">{secret}</code>
            <button onClick={() => { navigator.clipboard?.writeText(secret); toast(t("Copied", "コピー", "已複製"), "success"); }}><IconCopy size={13} className="text-muted" /></button>
          </div>
          <div className="text-[12px] text-muted">{t("2. Enter the 6-digit code to confirm.", "2. 6桁コードを入力して確認。", "2. 輸入 6 位數代碼確認。")}</div>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="w-40 rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-2 text-center font-display tracking-[0.25em] outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow" />
          <div className="flex gap-2">
            <button onClick={enable} disabled={busy} className="btn-glow rounded-xl border border-transparent px-4 py-2 text-[12.5px] font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50 bg-purple">{t("Confirm & enable", "確認して有効化", "確認並啟用")}</button>
            <button onClick={() => setStep("idle")} className="rounded-xl border border-glassborder/20 px-4 py-2 text-[12.5px] text-muted transition hover:text-text">{t("Cancel", "キャンセル", "取消")}</button>
          </div>
        </div>
      )}

      {backup.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-glassborder/15 pt-4">
          <div className="font-display text-[12px] font-bold text-amber">{t("Save your backup codes", "バックアップコードを保存", "儲存你的備用碼")}</div>
          <div className="text-[11px] text-muted">{t("Each can be used once if you lose your device. They won't be shown again.", "デバイス紛失時に各1回使用可。再表示されません。", "遺失裝置時每組可用一次，不會再顯示。")}</div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-glassborder/20 bg-panel2/50 p-3 font-mono text-[12px] backdrop-blur-sm">
            {backup.map((c) => <span key={c}>{c}</span>)}
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(backup.join("\n")); toast(t("Copied", "コピー", "已複製"), "success"); }} className="rounded-xl border border-glassborder/20 px-3 py-1.5 text-[12px] text-muted transition hover:text-text">{t("Copy all", "すべてコピー", "全部複製")}</button>
        </div>
      )}

      {step === "disable" && (
        <div className="mt-4 space-y-3 border-t border-glassborder/15 pt-4">
          <div className="text-[12px] text-muted">{t("Enter a current 6-digit code to disable 2FA.", "無効化するには現在の6桁コードを入力。", "輸入目前的 6 位數代碼以停用 2FA。")}</div>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="w-40 rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-2 text-center font-display tracking-[0.25em] outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow" />
          <div className="flex gap-2">
            <button onClick={disable} disabled={busy} className="rounded-xl border border-rust/50 px-4 py-2 text-[12.5px] text-rust transition hover:bg-rust/10 disabled:opacity-50">{t("Disable 2FA", "2FAを無効化", "停用 2FA")}</button>
            <button onClick={() => setStep("idle")} className="rounded-xl border border-glassborder/20 px-4 py-2 text-[12.5px] text-muted transition hover:text-text">{t("Cancel", "キャンセル", "取消")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
