"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconLock, IconCircleCheck, IconAlertTriangle } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { Btn } from "@/components/ui";

function ResetInner() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") || "";

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const hints: { ok: boolean; text: string }[] = [
    { ok: pw.length >= 8, text: t("At least 8 characters", "8文字以上", "至少 8 個字元") },
    { ok: /[a-zA-Z]/.test(pw) && /\d/.test(pw), text: t("Mixes letters and numbers", "英字と数字を含む", "英文字母與數字混用") },
    { ok: confirm.length > 0 && confirm === pw, text: t("Both fields match", "両方が一致", "兩次輸入相符") },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw !== confirm) {
      setErr(t("The two passwords don't match.", "パスワードが一致しません。", "兩次輸入的密碼不一致。"));
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setErr(d.error || t("This reset link is invalid or has expired.", "この再設定リンクは無効か、期限切れです。", "此重設連結無效或已過期。"));
        return;
      }
      setDone(true);
    } catch {
      setErr(t("Network error. Try again.", "通信エラー。再試行してください。", "連線錯誤，請再試一次。"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-md flex-col justify-center py-12">
      {/* not for the index — this URL is a one-time, private surface */}
      <title>Reset password — WizAgents</title>
      <meta name="robots" content="noindex, nofollow" />
      <Link href="/" className="mb-8 flex items-center justify-center gap-2">
        <span className="font-display text-lg text-text"><span className="font-medium">Wiz</span><span className="font-extrabold">Agents</span><span className="text-faint">.mcp</span></span>
      </Link>

      <div className="glass-card p-7">
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-faint">{t("Password reset", "パスワード再設定", "重設密碼")}</div>
        <h1 className="mb-4 font-display text-[24px] font-extrabold leading-tight tracking-tight text-text">
          {done
            ? t("Password updated", "パスワードを更新しました", "密碼已更新")
            : t("Set a new password", "新しいパスワードを設定", "設定新密碼")}
        </h1>

        {done ? (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-xl border border-green/40 bg-green/5 px-4 py-3 text-[12.5px] leading-6 text-green">
              <IconCircleCheck size={16} stroke={1.7} className="mt-1 shrink-0" />
              <span>{t(
                "Your password is set. Every device that was signed in has been signed out — sign in again with the new password.",
                "パスワードを設定しました。ログイン中だったすべてのデバイスはサインアウトされています。新しいパスワードで再度ログインしてください。",
                "新密碼已設定完成。所有原本登入中的裝置皆已登出 —— 請用新密碼重新登入。"
              )}</span>
            </div>
            <Btn href="/login" className="w-full">{t("Go to sign in", "ログインへ", "前往登入")}</Btn>
          </div>
        ) : !token ? (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-xl border border-amber/40 bg-amber/5 px-4 py-3 text-[12.5px] leading-6 text-amber">
              <IconAlertTriangle size={16} stroke={1.7} className="mt-1 shrink-0" />
              <span>{t(
                "This link is missing its reset token. Request a new one.",
                "このリンクには再設定トークンがありません。もう一度リクエストしてください。",
                "此連結缺少重設權杖，請重新申請。"
              )}</span>
            </div>
            <Btn href="/forgot" variant="outline" className="w-full">{t("Request a new link", "新しいリンクをリクエスト", "重新申請連結")}</Btn>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="flex gap-2 text-[12px] leading-6 text-muted">
              <IconLock size={15} stroke={1.7} className="mt-1 shrink-0 text-purple" />
              <span>{t(
                "Choose a new password. Setting it signs out every device on this account.",
                "新しいパスワードを設定します。設定すると、このアカウントのすべてのデバイスがサインアウトされます。",
                "選一組新密碼。設定後，此帳號的所有裝置都會被登出。"
              )}</span>
            </p>

            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{t("New password", "新しいパスワード", "新密碼")}</div>
              <input type="password" required autoFocus autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel2/50 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-purple" />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{t("Confirm new password", "新しいパスワード（確認）", "確認新密碼")}</div>
              <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel2/50 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-purple" />
            </div>

            {(pw.length > 0 || confirm.length > 0) && (
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

            <Btn type="submit" disabled={loading || !hints.every((h) => h.ok)} className="w-full">
              {loading ? t("Saving…", "保存中…", "儲存中…") : t("Set new password", "パスワードを設定", "設定新密碼")}
            </Btn>
            <div className="text-center">
              <Link href="/login" className="text-[12px] text-muted transition hover:text-text">{t("Back to sign in", "ログインに戻る", "返回登入")}</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPage() {
  return <Suspense><ResetInner /></Suspense>;
}
