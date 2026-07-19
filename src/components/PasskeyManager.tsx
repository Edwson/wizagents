"use client";
import { useEffect, useState } from "react";
import { IconFingerprint, IconShieldLock, IconTrash, IconPlus } from "@tabler/icons-react";
import { enrollPasskey, passkeySupported } from "@/lib/passkey";
import { useToast } from "./Toast";
import { useI18n } from "@/lib/i18n";
import { Btn } from "@/components/ui";

type Credential = { id: string; deviceName: string; createdAt: string; lastUsedAt: string | null };

export default function PasskeyManager() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = passkeySupported();

  async function load() {
    try {
      const r = await fetch("/api/webauthn/credentials");
      const d = await r.json();
      if (d.ok) setCreds(d.credentials || []);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    const platform = typeof navigator !== "undefined" ? navigator.platform || "" : "";
    const suggested = platform || t("This device", "このデバイス", "此裝置");
    const label = typeof window !== "undefined"
      ? window.prompt(t("Name this passkey / device", "このパスキー・デバイスの名前", "為此通行密鑰／裝置命名"), suggested)
      : suggested;
    if (label === null) return; // cancelled the label prompt
    const deviceName = label.trim() || suggested;
    setBusy(true);
    const r = await enrollPasskey(deviceName);
    setBusy(false);
    if (r.ok) {
      toast(t("Passkey added", "パスキーを追加しました", "已新增通行密鑰"), "success");
      load();
    } else {
      toast(r.error || t("Could not add passkey", "パスキーを追加できませんでした", "無法新增通行密鑰"), "error");
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/webauthn/credentials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const d = await r.json();
      if (r.ok && d.ok) {
        toast(t("Passkey removed", "パスキーを削除しました", "已移除通行密鑰"), "success");
        setCreds((cs) => cs.filter((c) => c.id !== id));
      } else {
        toast(d.error || t("Could not remove passkey", "パスキーを削除できませんでした", "無法移除通行密鑰"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  const fmt = (s: string | null) => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString();
  };

  return (
    <div className="glass-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconFingerprint size={18} className="text-violet" stroke={1.8} />
          <div className="font-display text-[14px] font-bold">{t("Passkeys & biometric", "パスキー・生体認証", "通行密鑰與生物辨識")}</div>
        </div>
        {supported && (
          <Btn onClick={add} disabled={busy} variant="outline" size="sm">
            <IconPlus size={13} stroke={1.8} />{t("Add passkey / biometric", "パスキー・生体認証を追加", "新增通行密鑰／生物辨識")}
          </Btn>
        )}
      </div>

      <p className="mb-4 text-[11.5px] leading-6 text-muted">
        {t(
          "Passkeys let you approve withdrawals and payments with Face ID, Touch ID or Windows Hello — no password to type. A passkey or 2FA is required to move money.",
          "パスキーを使うと、Face ID・Touch ID・Windows Hello で出金や支払いを承認できます（パスワード入力は不要）。資金の移動にはパスキーまたは 2FA が必須です。",
          "通行密鑰讓你用 Face ID、Touch ID 或 Windows Hello 核准提領與付款，免輸入密碼。移動資金必須使用通行密鑰或 2FA。"
        )}
      </p>

      {!supported ? (
        <div className="rounded-lg border border-dashed border-glassborder/40 py-5 text-center text-[11.5px] text-faint">
          {t("Not available on this device / browser.", "このデバイス・ブラウザでは利用できません。", "此裝置／瀏覽器不支援。")}
        </div>
      ) : (
        <div className="space-y-2">
          {loaded && creds.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-glassborder/40 px-4 py-5 text-[11.5px] text-muted">
              <IconShieldLock size={15} stroke={1.8} className="text-faint" />
              {t("No passkeys enrolled yet. Add one to approve payments with biometrics.", "まだパスキーが登録されていません。生体認証で支払いを承認するには追加してください。", "尚未註冊通行密鑰。新增一組即可用生物辨識核准付款。")}
            </div>
          )}
          {creds.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border-grad glass-card px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-violet/25 to-cyan/15 text-violet"><IconFingerprint size={17} stroke={1.8} /></span>
                <div>
                  <div className="font-display text-[13px] font-bold">{c.deviceName || t("Passkey", "パスキー", "通行密鑰")}</div>
                  <div className="text-[10.5px] text-faint">
                    {fmt(c.createdAt) && <>{t("Added", "追加", "新增")} {fmt(c.createdAt)}</>}
                    {fmt(c.lastUsedAt) && <> · {t("Last used", "最終使用", "最近使用")} {fmt(c.lastUsedAt)}</>}
                  </div>
                </div>
              </div>
              <button onClick={() => remove(c.id)} disabled={busy} aria-label={t("Remove passkey", "パスキーを削除", "移除通行密鑰")} className="text-muted transition-colors hover:text-rust disabled:opacity-50">
                <IconTrash size={15} stroke={1.8} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
