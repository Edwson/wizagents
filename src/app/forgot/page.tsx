"use client";
import { useState } from "react";
import Link from "next/link";
import { IconMail, IconInfoCircle } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { Btn } from "@/components/ui";

export default function ForgotPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [delivery, setDelivery] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || t("Something went wrong.", "エラーが発生しました。", "發生錯誤。"));
        return;
      }
      setDelivery(typeof d.deliveryConfigured === "boolean" ? d.deliveryConfigured : null);
      setSent(true);
    } catch {
      setErr(t("Network error. Try again.", "通信エラー。再試行してください。", "連線錯誤，請再試一次。"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-md flex-col justify-center py-12">
      {/* not for the index — this URL is a one-time, private surface */}
      <title>Forgot password — WizAgents</title>
      <meta name="robots" content="noindex, nofollow" />
      <Link href="/" className="mb-8 flex items-center justify-center gap-2">
        <span className="font-display text-lg text-text"><span className="font-medium">Wiz</span><span className="font-extrabold">Agents</span><span className="text-faint">.mcp</span></span>
      </Link>

      <div className="glass-card p-7">
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-faint">{t("Password reset", "パスワード再設定", "重設密碼")}</div>
        <h1 className="mb-4 font-display text-[24px] font-extrabold leading-tight tracking-tight text-text">
          {t("Forgot your password?", "パスワードをお忘れですか？", "忘記密碼了嗎？")}
        </h1>

        {sent ? (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-xl border border-border bg-panel2/40 px-4 py-3 text-[12.5px] leading-6 text-text">
              <IconMail size={16} stroke={1.7} className="mt-1 shrink-0 text-purple" />
              <span>{t(
                "If that address has an account, a reset link is on its way. The link is valid for one hour.",
                "そのアドレスのアカウントが存在する場合、再設定リンクを送信しました。リンクの有効期限は1時間です。",
                "如果該地址有帳號，重設連結已在寄送途中。連結一小時內有效。"
              )}</span>
            </div>
            <p className="text-[11.5px] leading-6 text-faint">
              {t(
                "We don't say whether an account exists for that address — that would tell anyone who asks.",
                "そのアドレスにアカウントがあるかどうかはお伝えしません。誰にでも分かってしまうためです。",
                "我們不會透露該地址是否有帳號 —— 否則任何人一問就知道。"
              )}
            </p>
            {delivery === false && (
              <div className="flex gap-2 rounded-xl border border-amber/40 bg-amber/5 px-4 py-3 text-[11.5px] leading-6 text-amber">
                <IconInfoCircle size={15} stroke={1.7} className="mt-1 shrink-0" />
                <span>{t(
                  "Email delivery isn't configured on this deployment, so no message was actually sent. The reset link is written to the server log — ask the operator for it.",
                  "このデプロイではメール送信が設定されていないため、実際にはメールは送信されていません。再設定リンクはサーバーログに出力されます。運用者にお問い合わせください。",
                  "此部署尚未設定郵件寄送，因此並未真的寄出郵件。重設連結會寫入伺服器日誌 —— 請向維運人員索取。"
                )}</span>
              </div>
            )}
            <Btn href="/login" variant="outline" className="w-full">{t("Back to sign in", "ログインに戻る", "返回登入")}</Btn>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-[12px] leading-6 text-muted">
              {t(
                "Enter the email address on your account and we'll send a link to set a new password.",
                "アカウントのメールアドレスを入力してください。新しいパスワードを設定するリンクをお送りします。",
                "輸入你帳號的電子郵件地址，我們會寄出設定新密碼的連結。"
              )}
            </p>
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{t("Email", "メール", "Email")}</div>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel2/50 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-purple"
              />
            </div>
            {err && <div className="rounded-lg border border-rust/40 bg-rust/10 px-3 py-2 text-[12px] text-rust">{err}</div>}
            <Btn type="submit" disabled={loading} className="w-full">
              {loading ? t("Sending…", "送信中…", "傳送中…") : t("Send reset link", "再設定リンクを送信", "寄送重設連結")}
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
