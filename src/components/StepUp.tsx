"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { stepUpWithPasskey, passkeySupported } from "@/lib/passkey";
import { Btn } from "./ui";
import { IconFingerprint, IconShieldLock, IconX } from "@tabler/icons-react";

/**
 * Step-up verification gate for money actions. On success the server sets a
 * 5-minute step-up cookie; onVerified() is called so the caller can proceed.
 */
export default function StepUp({ open, onClose, onVerified, title }: { open: boolean; onClose: () => void; onVerified: () => void; title?: string }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!open) return null;

  async function verifyCode() {
    setBusy(true); setErr("");
    const r = await fetch("/api/stepup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const d = await r.json(); setBusy(false);
    if (d.ok) { onVerified(); } else { setErr(d.error || t("Invalid code", "無効なコード", "驗證碼錯誤")); }
  }
  async function verifyBio() {
    setBusy(true); setErr("");
    const r = await stepUpWithPasskey(); setBusy(false);
    if (r.ok) onVerified(); else setErr(r.error || t("Biometric failed", "生体認証に失敗", "生物辨識失敗"));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="glass-card border-grad w-full max-w-sm p-6">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-bold"><IconShieldLock size={16} stroke={1.8} className="text-violet" />{title || t("Verify it's you", "本人確認", "驗證你的身分")}</div>
          <button onClick={onClose} className="text-faint hover:text-text"><IconX size={16} /></button>
        </div>
        <p className="mb-4 text-[11.5px] leading-6 text-muted">{t("This protects your money. Confirm with your authenticator code or biometric.", "資金保護のため、認証アプリのコードまたは生体認証で確認してください。", "為保護你的資金，請用驗證器代碼或生物辨識確認。")}</p>

        {passkeySupported() && (
          <button onClick={verifyBio} disabled={busy} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-glassborder/30 bg-panel2/50 py-2.5 text-[13px] font-semibold backdrop-blur-sm hover:border-violet disabled:opacity-50">
            <IconFingerprint size={18} stroke={1.8} className="text-violet" />{t("Use biometric / passkey", "生体認証・パスキー", "使用生物辨識／通行密鑰")}
          </button>
        )}

        <div className="mb-2 text-center text-[10px] uppercase tracking-[0.14em] text-faint">{t("or 2FA code", "または2FAコード", "或 2FA 代碼")}</div>
        <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verifyCode()} inputMode="numeric" maxLength={8}
          placeholder="000000" className="mb-3 w-full rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-2.5 text-center font-display text-lg tracking-[0.3em] outline-none backdrop-blur-sm focus:shadow-glow" />
        {err && <div className="mb-3 text-center text-[11px] text-rust">{err}</div>}
        <Btn onClick={verifyCode} variant="amber" size="md" className="w-full" >{busy ? t("Verifying…", "確認中…", "驗證中…") : t("Confirm", "確認", "確認")}</Btn>
      </div>
    </div>
  );
}
