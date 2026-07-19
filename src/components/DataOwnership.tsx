"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconDownload, IconTrash, IconAlertTriangle, IconShieldLock } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, SectionLabel, Reveal, Badge } from "@/components/ui";

type DeleteState = { canDelete: boolean; blockers: string[]; activeSubscriptions: number };

export default function DataOwnership() {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();

  const [state, setState] = useState<DeleteState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/account/delete");
        const d = await r.json();
        if (alive && d.ok) {
          setState({
            canDelete: !!d.canDelete,
            blockers: Array.isArray(d.blockers) ? d.blockers : [],
            activeSubscriptions: Number(d.activeSubscriptions || 0),
          });
        }
      } catch {
        /* ignore — deletion stays closed until we know the answer */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function doDelete(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm: confirm.trim().toUpperCase() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setErr(d.error || t("Could not delete the account.", "アカウントを削除できませんでした。", "無法刪除帳號。"));
        if (d.code === "blocked") {
          setState((s) => (s ? { ...s, canDelete: false } : s));
        }
        return;
      }
      toast(t("Your account has been deleted.", "アカウントを削除しました。", "你的帳號已刪除。"), "success");
      router.push("/");
      router.refresh();
    } catch {
      setErr(t("Network error. Try again.", "通信エラー。再試行してください。", "連線錯誤，請再試一次。"));
    } finally {
      setBusy(false);
    }
  }

  const confirmOk = confirm.trim().toUpperCase() === "DELETE";

  return (
    <Reveal className="space-y-4">
      <SectionLabel>{t("Your data", "あなたのデータ", "你的資料")}</SectionLabel>

      {/* ---------- Export ---------- */}
      <div className="glass-card p-6">
        <div className="font-display text-[15px] font-bold text-text">
          {t("Your record is yours. Take it with you.", "あなたの記録は、あなたのものです。持ち出せます。", "你的紀錄屬於你。隨時帶走。")}
        </div>
        <p className="mt-1.5 text-[11.5px] leading-6 text-muted">
          {t(
            "Not a summary, not a screenshot — the complete archive, as JSON, in one file. No request form, no waiting period.",
            "要約でもスクリーンショットでもなく、完全なアーカイブを JSON 1 ファイルで。申請フォームも待機期間もありません。",
            "不是摘要，也不是截圖 —— 是完整的封存檔，單一 JSON 檔案。無需申請表，也不用等待。"
          )}
        </p>

        <div className="mt-4 rounded-xl border border-border/60 bg-panel2/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <IconDownload size={16} stroke={1.7} className="text-cyan" />
            <span className="text-[12px] font-medium text-text">{t("What's inside", "含まれるもの", "檔案內容")}</span>
          </div>
          <ul className="grid gap-1 text-[11.5px] leading-6 text-muted sm:grid-cols-2">
            <li>· {t("Profile and account details", "プロフィールとアカウント情報", "個人資料與帳號資訊")}</li>
            <li>· {t("Subscriptions", "サブスクリプション", "訂閱")}</li>
            <li>· {t("Conversations", "会話履歴", "對話紀錄")}</li>
            <li>· {t("Transactions", "取引", "交易")}</li>
            <li>· {t("Endorsements", "推薦（エンドースメント）", "背書")}</li>
            <li>· {t("Reputation", "評判スコア", "信譽")}</li>
          </ul>
          <div className="mt-2 border-t border-border/60 pt-2 text-[11.5px] leading-6 text-muted">
            <span className="mr-1.5 align-middle"><Badge tone="purple">{t("Creators", "クリエイター", "創作者")}</Badge></span>
            {t(
              "your Agents, every knowledge version, and your fidelity samples.",
              "あなたの Agent、すべてのナレッジ版、フィデリティサンプル。",
              "你的 Agent、每一個知識版本，以及擬真度樣本。"
            )}
          </div>
        </div>

        <div className="mt-4">
          <Btn href="/api/account/export" variant="outline">
            <IconDownload size={14} stroke={1.7} />
            {t("Download my archive", "アーカイブをダウンロード", "下載我的封存檔")}
          </Btn>
        </div>
      </div>

      {/* ---------- Delete ---------- */}
      <div className="glass-card p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconTrash size={18} stroke={1.7} className="text-rust" />
          <div className="font-display text-[14px] font-bold">{t("Delete account", "アカウントを削除", "刪除帳號")}</div>
        </div>

        {!loaded ? (
          <div className="mt-3 text-[11.5px] text-faint">{t("Checking…", "確認中…", "檢查中…")}</div>
        ) : !state ? (
          <div className="mt-3 text-[11.5px] text-faint">
            {t("Couldn't check your account status. Reload the page.", "アカウント状態を確認できませんでした。ページを再読み込みしてください。", "無法確認帳號狀態，請重新整理頁面。")}
          </div>
        ) : !state.canDelete ? (
          <div className="mt-3 rounded-xl border border-amber/40 bg-amber/5 p-4">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-amber">
              <IconAlertTriangle size={16} stroke={1.7} />
              {t("Deletion is on hold", "削除は保留中です", "刪除暫時被保留")}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-6 text-muted">
              {t(
                "We won't let you vanish on people who paid you. Settle these first, then deletion opens up:",
                "お金を払ってくれた人たちを置き去りにはできません。まず以下を解消すれば、削除できるようになります：",
                "我們不會讓你在付過錢的人面前直接消失。先處理以下事項，刪除就會開放："
              )}
            </p>
            <ul className="mt-2 space-y-1.5">
              {state.blockers.map((b, i) => (
                <li key={i} className="flex gap-2 text-[11.5px] leading-6 text-amber">
                  <span className="mt-[9px] inline-block h-1 w-1 shrink-0 rounded-full bg-amber" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Btn variant="danger" size="sm" disabled>
                {t("Delete account", "アカウントを削除", "刪除帳號")}
              </Btn>
            </div>
          </div>
        ) : !open ? (
          <>
            <p className="mt-1 text-[11.5px] leading-6 text-muted">
              {t(
                "Permanent. Your personal data is erased and the account can never be used again.",
                "この操作は取り消せません。個人データは消去され、このアカウントは二度と使用できなくなります。",
                "此操作不可復原。你的個人資料會被清除，帳號永遠無法再使用。"
              )}
            </p>
            <div className="mt-3">
              <Btn variant="danger" onClick={() => setOpen(true)}>
                <IconTrash size={14} stroke={1.7} />
                {t("Delete my account", "アカウントを削除", "刪除我的帳號")}
              </Btn>
            </div>
          </>
        ) : (
          <form onSubmit={doDelete} className="mt-3 space-y-4 rounded-xl border border-rust/40 bg-rust/5 p-4">
            <div>
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-rust">
                <IconAlertTriangle size={16} stroke={1.7} />
                {t("What happens when you delete", "削除すると何が起きるか", "刪除後會發生什麼")}
              </div>
              <ul className="mt-2 space-y-1.5 text-[11.5px] leading-6 text-muted">
                <li>· {t(
                  "Your personal data is erased: profile, conversations, favorites, payment methods, passkeys, notifications.",
                  "個人データは消去されます：プロフィール、会話、お気に入り、支払い方法、パスキー、通知。",
                  "你的個人資料會被清除：個人檔案、對話、收藏、付款方式、通行密鑰、通知。"
                )}</li>
                <li className="flex gap-1.5">
                  <IconShieldLock size={14} stroke={1.7} className="mt-[5px] shrink-0 text-purple" />
                  <span>{t(
                    "Signed citations and the financial ledger are kept, anonymized: a citation must remain checkable, and a ledger must remain a ledger.",
                    "署名済みの引用と会計台帳は匿名化のうえ保持されます。引用は検証可能であり続けなければならず、台帳は台帳であり続けなければなりません。",
                    "已簽署的引用與財務帳本會以匿名形式保留：引用必須可被查證，帳本必須仍是帳本。"
                  )}</span>
                </li>
                <li>· {t(
                  "The account can never be used again. This cannot be undone.",
                  "このアカウントは二度と使用できません。取り消しはできません。",
                  "此帳號永遠無法再使用，且無法復原。"
                )}</li>
              </ul>
              <p className="mt-2 text-[11.5px] leading-6 text-faint">
                {t(
                  "Export your archive first if you want to keep a copy.",
                  "控えが必要な場合は、先にアーカイブをエクスポートしてください。",
                  "如果你想留一份副本，請先匯出封存檔。"
                )}
              </p>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{t("Your password", "パスワード", "你的密碼")}</div>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-panel2/50 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-rust"
              />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">
                {t("Type DELETE to confirm", "確認のため DELETE と入力", "輸入 DELETE 以確認")}
              </div>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl border border-border bg-panel2/50 px-3 py-2.5 font-mono text-[13px] tracking-[0.15em] text-text outline-none transition focus:border-rust"
              />
            </div>

            {err && <div className="rounded-lg border border-rust/40 bg-rust/10 px-3 py-2 text-[12px] text-rust">{err}</div>}

            <div className="flex gap-2">
              <Btn type="submit" variant="danger" disabled={busy || !password || !confirmOk}>
                {busy ? t("Deleting…", "削除中…", "刪除中…") : t("Permanently delete", "完全に削除", "永久刪除")}
              </Btn>
              <Btn variant="ghost" onClick={() => { setOpen(false); setErr(""); setPassword(""); setConfirm(""); }} disabled={busy}>
                {t("Cancel", "キャンセル", "取消")}
              </Btn>
            </div>
          </form>
        )}
      </div>
    </Reveal>
  );
}
