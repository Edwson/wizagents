"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { IconFlag, IconTrash, IconCheck, IconExternalLink, IconLoader2, IconInfoCircle } from "@tabler/icons-react";

/**
 * Admin moderation queue for the public square.
 *
 * Nothing here is automatic. A report is a request for a human decision: an admin
 * either removes the content (a soft delete — the row stays in the database, the
 * author is NOT notified, and replies from other people remain attributable) or
 * dismisses the report and the content stands.
 */

type Target =
  | { title?: string | null; slug?: string | null; body?: string | null; authorId?: string | null; post?: { slug: string; title: string } | null }
  | null;

type Rep = {
  id: string;
  reporterId: string;
  targetType: string; // post | reply
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  target: Target;
};

export default function ModerationQueue() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<Rep[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/forum/report");
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) setRows(d.reports || []);
    else toast(d.error || t("Could not load the queue.", "キューを読み込めませんでした。", "無法載入佇列。"), "error");
    setLoaded(true);
  }, [t, toast]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: "remove" | "dismiss") {
    setBusy(id);
    const r = await fetch("/api/forum/report", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { toast(d.error || t("Action failed.", "操作に失敗しました。", "操作失敗。"), "error"); return; }
    setRows((xs) => xs.filter((x) => x.id !== id));
    toast(
      action === "remove"
        ? t("Content removed. The author was not notified.", "コンテンツを削除しました。作成者への通知は行われていません。", "內容已移除。作者未收到通知。")
        : t("Report dismissed. The content stands.", "報告を却下しました。コンテンツはそのまま残ります。", "已駁回檢舉，內容保留。"),
      "success",
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[18px] font-bold tracking-tight">{t("Moderation queue", "モデレーションキュー", "審核佇列")}</h2>
          <p className="mt-1 text-[12px] text-muted">
            {t(
              "Open reports on posts and replies in the community. Every decision here is made by a person — nothing is removed automatically.",
              "コミュニティの投稿・返信に対する未処理の報告です。判断はすべて人が行い、自動削除は行いません。",
              "社群貼文與回覆的未處理檢舉。每項決定都由人做出——不會自動移除任何內容。",
            )}
          </p>
        </div>
        <button onClick={() => { setLoaded(false); load(); }} className="rounded-lg border border-border bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-text">
          {t("Refresh", "更新", "重新整理")}
        </button>
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-xl border border-border bg-panel2 px-4 py-3 text-[11.5px] leading-6 text-faint">
        <IconInfoCircle size={15} stroke={1.7} className="mt-0.5 shrink-0" />
        <span>
          {t(
            "Remove is a soft delete: the content is hidden from the community and its status becomes \"removed\", but the record stays in the database and replies by other people remain attributable. The author is not notified automatically — if the removal needs explaining, contact them yourself.",
            "「削除」はソフト削除です。コンテンツはコミュニティから非表示になり status が removed になりますが、レコードはデータベースに残り、他の人の返信は帰属したまま保持されます。作成者への自動通知はありません。説明が必要な場合はご自身で連絡してください。",
            "「移除」是軟刪除：內容會從社群隱藏、狀態改為 removed，但記錄仍保留在資料庫中，其他人的回覆仍可歸屬。系統不會自動通知作者——若需要說明，請自行聯繫。",
          )}
        </span>
      </div>

      {!loaded && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-6 text-[12.5px] text-faint">
          <IconLoader2 size={15} className="animate-spin" /> {t("Loading reports…", "報告を読み込み中…", "載入檢舉中…")}
        </div>
      )}

      {loaded && rows.length === 0 && (
        <div className="rounded-xl border border-border bg-panel p-8 text-center">
          <IconFlag size={22} stroke={1.5} className="mx-auto text-faint" />
          <div className="mt-3 text-[13.5px] font-medium">{t("No open reports.", "未処理の報告はありません。", "沒有待處理的檢舉。")}</div>
          <div className="mx-auto mt-1 max-w-md text-[12px] leading-6 text-muted">
            {t(
              "Reports land here when a member flags a post or a reply. Until then there is nothing to decide.",
              "メンバーが投稿や返信を報告すると、ここに表示されます。それまで判断すべきものはありません。",
              "當成員檢舉貼文或回覆時，會出現在這裡。在那之前沒有需要判斷的項目。",
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const isPost = r.targetType === "post";
          const title = isPost ? r.target?.title : r.target?.post?.title;
          const slug = isPost ? r.target?.slug : r.target?.post?.slug;
          const body = r.target?.body || "";
          const gone = !r.target;
          return (
            <div key={r.id} className="rounded-xl border border-border bg-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-rust/40 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-rust">
                  <IconFlag size={11} stroke={1.8} />
                  {isPost ? t("Post", "投稿", "貼文") : t("Reply", "返信", "回覆")}
                </span>
                <span className="text-[13px] font-medium">
                  {gone ? t("Content no longer exists", "コンテンツは既に存在しません", "內容已不存在") : title || t("Untitled", "無題", "未命名")}
                </span>
                {slug && (
                  <Link href={`/community/${slug}`} target="_blank" className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline">
                    {t("Open", "開く", "開啟")} <IconExternalLink size={12} stroke={1.7} />
                  </Link>
                )}
                <span className="ml-auto text-[11px] text-faint">{new Date(r.createdAt).toLocaleString()}</span>
              </div>

              {body && (
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-panel2 p-3 text-[12px] leading-6 text-muted">
                  {body.length > 900 ? body.slice(0, 900) + "…" : body}
                </pre>
              )}

              <div className="mt-3 grid gap-2 text-[11.5px] sm:grid-cols-2">
                <div>
                  <span className="text-faint">{t("Reported by", "報告者", "檢舉者")}: </span>
                  <span className="font-mono text-muted">{r.reporterId}</span>
                </div>
                <div>
                  <span className="text-faint">{t("Reason given", "理由", "理由")}: </span>
                  <span className="text-muted">{r.reason || t("No reason written.", "理由の記載なし。", "未填寫理由。")}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={busy === r.id}
                  onClick={() => act(r.id, "remove")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rust/40 px-3 py-1.5 text-[12px] text-rust transition-colors hover:bg-rust/10 disabled:opacity-50"
                >
                  {busy === r.id ? <IconLoader2 size={13} className="animate-spin" /> : <IconTrash size={13} stroke={1.7} />}
                  {t("Remove (soft delete)", "削除（ソフト削除）", "移除（軟刪除）")}
                </button>
                <button
                  disabled={busy === r.id}
                  onClick={() => act(r.id, "dismiss")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted transition-colors hover:bg-panel2 hover:text-text disabled:opacity-50"
                >
                  <IconCheck size={13} stroke={1.7} />
                  {t("Dismiss report", "報告を却下", "駁回檢舉")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
