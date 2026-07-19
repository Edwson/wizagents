"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconCircleCheck, IconAlertCircle } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";

function Inner() {
  const params = useSearchParams();
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    const token = params.get("token");
    if (!token) { setState("error"); return; }
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => setState(r.ok ? "ok" : "error")).catch(() => setState("error"));
  }, [params]);
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {state === "loading" && <div className="text-[14px] text-muted">{t("Verifying…", "確認中…", "驗證中…")}</div>}
      {state === "ok" && (<>
        <IconCircleCheck size={40} className="mx-auto text-green" stroke={1.7} />
        <div className="mt-3 text-[20px] font-bold">{t("Email verified", "メール認証完了", "信箱已驗證")}</div>
        <Link href="/market" className="mt-5 inline-block rounded-lg bg-purple px-4 py-2 text-[13px] font-bold text-white">{t("Go to marketplace", "マーケットへ", "前往市集")}</Link>
      </>)}
      {state === "error" && (<>
        <IconAlertCircle size={40} className="mx-auto text-rust" stroke={1.7} />
        <div className="mt-3 text-[20px] font-bold">{t("Verification failed", "認証に失敗", "驗證失敗")}</div>
        <p className="mt-2 text-[13px] text-muted">{t("The link is invalid or expired.", "リンクが無効か期限切れです。", "連結無效或已過期。")}</p>
        <Link href="/settings" className="mt-5 inline-block rounded-lg border border-border px-4 py-2 text-[13px] text-muted">{t("Account settings", "アカウント設定", "帳號設定")}</Link>
      </>)}
    </div>
  );
}
export default function VerifyEmailPage() { return <Suspense><Inner /></Suspense>; }
