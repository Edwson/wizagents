"use client";
import { useEffect, useState } from "react";
import {
  IconLock, IconDeviceLaptop, IconHistory, IconShieldLock, IconAlertTriangle,
  IconLogin, IconKey, IconFingerprint, IconRefresh, IconDownload, IconTrash, IconCreditCard,
} from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { useToast } from "./Toast";
import { Btn, SectionLabel, Reveal } from "@/components/ui";

type LogKind =
  | "login" | "login_failed" | "password_changed" | "2fa_enabled" | "2fa_disabled"
  | "sessions_revoked" | "payout_method_changed" | "passkey_added" | "passkey_removed"
  | "token_rotated" | "data_exported" | "account_deleted";

type SecurityLog = {
  id: string;
  kind: string;
  detail: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

const KIND_META: Record<LogKind, { icon: typeof IconLock; tone: string; label: [string, string, string] }> = {
  login:                { icon: IconLogin,        tone: "text-muted",  label: ["Signed in", "ログイン", "登入"] },
  login_failed:         { icon: IconAlertTriangle,tone: "text-amber",  label: ["Failed sign-in attempt", "ログイン失敗", "登入失敗"] },
  password_changed:     { icon: IconLock,         tone: "text-purple", label: ["Password changed", "パスワードを変更", "已變更密碼"] },
  "2fa_enabled":        { icon: IconShieldLock,   tone: "text-green",  label: ["Two-factor enabled", "二段階認証を有効化", "已啟用兩步驟驗證"] },
  "2fa_disabled":       { icon: IconShieldLock,   tone: "text-amber",  label: ["Two-factor disabled", "二段階認証を無効化", "已停用兩步驟驗證"] },
  sessions_revoked:     { icon: IconDeviceLaptop, tone: "text-purple", label: ["Signed out of other devices", "他のデバイスからサインアウト", "已登出其他裝置"] },
  payout_method_changed:{ icon: IconCreditCard,   tone: "text-amber",  label: ["Payout method changed", "受取方法を変更", "已變更收款方式"] },
  passkey_added:        { icon: IconFingerprint,  tone: "text-green",  label: ["Passkey added", "パスキーを追加", "已新增通行密鑰"] },
  passkey_removed:      { icon: IconFingerprint,  tone: "text-muted",  label: ["Passkey removed", "パスキーを削除", "已移除通行密鑰"] },
  token_rotated:        { icon: IconRefresh,      tone: "text-muted",  label: ["API token rotated", "APIトークンを再発行", "已更換 API 權杖"] },
  data_exported:        { icon: IconDownload,     tone: "text-cyan",   label: ["Data exported", "データをエクスポート", "已匯出資料"] },
  account_deleted:      { icon: IconTrash,        tone: "text-rust",   label: ["Account deleted", "アカウントを削除", "已刪除帳號"] },
};

function shortUA(ua: string | null): string {
  if (!ua) return "";
  const s = ua.trim();
  return s.length > 46 ? s.slice(0, 46) + "…" : s;
}

export default function AccountSecurity() {
  const { t, locale } = useI18n();
  const { toast } = useToast();

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [revoking, setRevoking] = useState(false);
  const [askRevoke, setAskRevoke] = useState(false);

  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  async function loadLogs() {
    try {
      const r = await fetch("/api/account/security-log");
      const d = await r.json();
      if (d.ok) setLogs(Array.isArray(d.logs) ? d.logs : []);
    } catch {
      /* ignore — the section simply shows its empty state */
    } finally {
      setLogsLoaded(true);
    }
  }
  useEffect(() => { loadLogs(); }, []);

  // Live, honest hints — the server is still the authority on what it accepts.
  const hints: { ok: boolean; text: string }[] = [
    { ok: next.length >= 8, text: t("At least 8 characters", "8文字以上", "至少 8 個字元") },
    { ok: /[a-zA-Z]/.test(next) && /\d/.test(next), text: t("Mixes letters and numbers", "英字と数字を含む", "英文字母與數字混用") },
    { ok: next.length > 0 && next !== cur, text: t("Different from your current password", "現在のパスワードと異なる", "與目前的密碼不同") },
    { ok: confirm.length > 0 && confirm === next, text: t("Both new-password fields match", "新しいパスワードが一致", "兩次輸入的新密碼相符") },
  ];
  const canSubmit = !busy && cur.length > 0 && hints.every((h) => h.ok);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (next !== confirm) { setErr(t("The two new-password fields don't match.", "新しいパスワードが一致しません。", "兩次輸入的新密碼不一致。")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error || t("Could not change your password.", "パスワードを変更できませんでした。", "無法變更密碼。")); return; }
      setCur(""); setNext(""); setConfirm("");
      toast(t(
        "Password changed — all other devices signed out.",
        "パスワードを変更しました — 他のすべてのデバイスをサインアウトしました。",
        "已變更密碼 — 其他所有裝置皆已登出。"
      ), "success");
      loadLogs();
    } catch {
      setErr(t("Network error. Try again.", "通信エラー。再試行してください。", "連線錯誤，請再試一次。"));
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    setRevoking(true);
    try {
      const r = await fetch("/api/account/sessions", { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        toast(d.error || t("Could not sign out other devices.", "他のデバイスをサインアウトできませんでした。", "無法登出其他裝置。"), "error");
        return;
      }
      setAskRevoke(false);
      toast(t(
        "Every other session was revoked. This device stays signed in.",
        "他のすべてのセッションを無効化しました。このデバイスはログインしたままです。",
        "已撤銷其他所有工作階段，此裝置維持登入。"
      ), "success");
      loadLogs();
    } catch {
      toast(t("Network error. Try again.", "通信エラー。再試行してください。", "連線錯誤，請再試一次。"), "error");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Reveal className="space-y-4">
      <SectionLabel>{t("Account security", "アカウントセキュリティ", "帳號安全")}</SectionLabel>

      {/* ---------- Change password ---------- */}
      <div className="glass-card p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconLock size={18} stroke={1.7} className="text-purple" />
          <div className="font-display text-[14px] font-bold">{t("Change password", "パスワードを変更", "變更密碼")}</div>
        </div>
        <p className="mb-4 text-[11.5px] leading-6 text-muted">
          {t(
            "Changing your password signs out every other device immediately. This one stays signed in.",
            "パスワードを変更すると、他のすべてのデバイスが直ちにサインアウトされます。このデバイスはログインしたままです。",
            "變更密碼會立即登出其他所有裝置；此裝置維持登入。"
          )}
        </p>

        <form onSubmit={changePassword} className="space-y-3">
          <PwField label={t("Current password", "現在のパスワード", "目前的密碼")} value={cur} onChange={setCur} autoComplete="current-password" />
          <PwField label={t("New password", "新しいパスワード", "新密碼")} value={next} onChange={setNext} autoComplete="new-password" />
          <PwField label={t("Confirm new password", "新しいパスワード（確認）", "確認新密碼")} value={confirm} onChange={setConfirm} autoComplete="new-password" />

          {(next.length > 0 || confirm.length > 0) && (
            <ul className="space-y-1 rounded-xl border border-border/60 bg-panel2/40 px-3 py-2.5">
              {hints.map((h, i) => (
                <li key={i} className={`flex items-center gap-2 text-[11.5px] ${h.ok ? "text-green" : "text-faint"}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${h.ok ? "bg-green" : "bg-border"}`} />
                  {h.text}
                </li>
              ))}
            </ul>
          )}

          {err && <div className="rounded-lg border border-rust/40 bg-rust/10 px-3 py-2 text-[12px] text-rust">{err}</div>}

          <Btn type="submit" disabled={!canSubmit}>
            {busy ? t("Saving…", "保存中…", "儲存中…") : t("Change password", "パスワードを変更", "變更密碼")}
          </Btn>
        </form>
      </div>

      {/* ---------- Sign out everywhere ---------- */}
      <div className="glass-card p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconDeviceLaptop size={18} stroke={1.7} className="text-purple" />
          <div className="font-display text-[14px] font-bold">{t("Sign out everywhere", "すべての端末からサインアウト", "登出所有裝置")}</div>
        </div>
        <p className="mb-4 text-[11.5px] leading-6 text-muted">
          {t(
            "If you think someone else has access, this immediately revokes every other session — including theirs. This device stays signed in.",
            "第三者にアクセスされている可能性がある場合、これで他のすべてのセッション（相手のものを含む）を直ちに無効化します。このデバイスはログインしたままです。",
            "如果你懷疑有人擅自存取你的帳號，這會立即撤銷其他所有工作階段 —— 包含對方的。此裝置維持登入。"
          )}
        </p>

        {askRevoke ? (
          <div className="rounded-xl border border-amber/40 bg-amber/5 p-4">
            <div className="flex items-start gap-2 text-[12px] text-amber">
              <IconAlertTriangle size={16} stroke={1.7} className="mt-0.5 shrink-0" />
              <span>{t(
                "Every other signed-in device will have to sign in again. Continue?",
                "他のすべてのデバイスは再度サインインが必要になります。続行しますか？",
                "其他所有已登入的裝置都必須重新登入。要繼續嗎？"
              )}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Btn variant="danger" size="sm" onClick={signOutEverywhere} disabled={revoking}>
                {revoking ? t("Revoking…", "無効化中…", "撤銷中…") : t("Yes, sign out everywhere", "はい、すべてサインアウト", "是，登出所有裝置")}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => setAskRevoke(false)} disabled={revoking}>
                {t("Cancel", "キャンセル", "取消")}
              </Btn>
            </div>
          </div>
        ) : (
          <Btn variant="outline" onClick={() => setAskRevoke(true)}>
            <IconDeviceLaptop size={14} stroke={1.7} />
            {t("Sign out of all other devices", "他のすべてのデバイスをサインアウト", "登出其他所有裝置")}
          </Btn>
        )}
      </div>

      {/* ---------- Security activity ---------- */}
      <div className="glass-card p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconHistory size={18} stroke={1.7} className="text-purple" />
          <div className="font-display text-[14px] font-bold">{t("Security activity", "セキュリティ履歴", "安全活動紀錄")}</div>
        </div>
        <p className="mb-4 text-[11.5px] leading-6 text-muted">
          {t(
            "Everything that touched your account's security. If you see something you didn't do, change your password and sign out everywhere.",
            "アカウントのセキュリティに関わったすべての操作です。心当たりのない項目があれば、パスワードを変更し、すべての端末からサインアウトしてください。",
            "所有與帳號安全相關的動作。若看到不是你做的操作，請變更密碼並登出所有裝置。"
          )}
        </p>

        {logsLoaded && logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-[11.5px] text-faint">
            {t("No security activity recorded yet.", "セキュリティ履歴はまだありません。", "尚無安全活動紀錄。")}
          </div>
        ) : (
          <ol className="relative space-y-0">
            {logs.map((l, i) => {
              const meta = KIND_META[l.kind as LogKind];
              const Icon = meta?.icon || IconShieldLock;
              const label = meta ? t(meta.label[0], meta.label[1], meta.label[2]) : l.kind;
              const last = i === logs.length - 1;
              return (
                <li key={l.id} className="relative flex gap-3 pb-4">
                  {!last && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-px bg-border/70" />}
                  <span className={`relative z-[1] mt-0.5 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border border-border bg-panel2 ${meta?.tone || "text-muted"}`}>
                    <Icon size={14} stroke={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[12.5px] font-medium text-text">{label}</span>
                      <span className="text-[11px] text-faint">{timeAgo(l.createdAt, locale)}</span>
                    </div>
                    {l.detail && <div className="mt-0.5 text-[11.5px] leading-5 text-muted">{l.detail}</div>}
                    {(l.ip || l.userAgent) && (
                      <div className="mt-0.5 truncate text-[10.5px] text-faint">
                        {l.ip}{l.ip && l.userAgent ? " · " : ""}{shortUA(l.userAgent)}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Reveal>
  );
}

function PwField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-panel2/50 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-purple"
      />
    </div>
  );
}
