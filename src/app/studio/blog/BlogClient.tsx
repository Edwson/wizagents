"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import {
  IconPlus, IconPencil, IconTrash, IconEye, IconMessageCircle, IconArrowBigUp,
  IconRobot, IconLoader2, IconArticle, IconEyeOff, IconWorld, IconExternalLink,
} from "@tabler/icons-react";

/** Local copy — @/lib/forum imports the database and must never reach the client bundle. */
const KIND_LABELS: Record<string, [string, string, string]> = {
  guide: ["Guide", "使い方ガイド", "使用指南"],
  article: ["Article", "記事", "文章"],
  question: ["Question", "質問", "提問"],
  discussion: ["Discussion", "ディスカッション", "討論"],
  case: ["Case study", "ケーススタディ", "案例"],
};
function kindLabel(k: string, l: "en" | "ja" | "zh") {
  const e = KIND_LABELS[k] || KIND_LABELS.discussion;
  return l === "ja" ? e[1] : l === "zh" ? e[2] : e[0];
}

type Row = {
  slug: string; title: string; kind: string; status: string;
  views: number; score: number; replyCount: number;
  coverMediaId: string | null; createdAt: string; lastActivityAt: string;
  agent: { slug: string; name: string } | null;
};
type Stats = { views: number; replies: number; acceptedAnswers: number; unlinked: number };
type AgentAttn = { slug: string; name: string; posts: number; views: number };

export default function BlogClient({ posts, stats, agents }: { posts: Row[]; stats: Stats; agents: AgentAttn[] }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");

  const published = posts.filter((p) => p.status === "published");
  const drafts = posts.filter((p) => p.status === "draft");

  async function setStatus(slug: string, status: "draft" | "published") {
    setBusy(slug);
    const r = await fetch(`/api/forum/post/${slug}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { toast(d.error || t("Could not save.", "保存できませんでした。", "無法儲存。"), "error"); return; }
    toast(
      status === "published"
        ? t("Published. It is now public.", "公開しました。誰でも読めます。", "已發布，現在是公開的。")
        : t("Unpublished. Back to drafts — only you can see it.", "非公開にしました。下書きに戻り、あなただけが閲覧できます。", "已取消發布。回到草稿，只有你看得到。"),
      "success",
    );
    router.refresh();
  }

  async function remove(slug: string) {
    setBusy(slug);
    const r = await fetch(`/api/forum/post/${slug}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    setBusy(""); setConfirm("");
    if (!r.ok) { toast(d.error || t("Could not delete.", "削除できませんでした。", "無法刪除。"), "error"); return; }
    toast(t("Removed. Replies from other people stay attributable.", "削除しました。他の人の返信は帰属したまま残ります。", "已移除。其他人的回覆仍保留其歸屬。"), "success");
    router.refresh();
  }

  return (
    <div className="animate-fadein">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight">
            <span className="text-grad">{t("Writing", "執筆", "撰文")}</span>
          </h1>
          <p className="mt-1 max-w-xl text-[12.5px] leading-6 text-muted">
            {t(
              "What you publish in the community is public and indexable. It is how people find you before they know your name — and each piece can point at the Agent where the full reasoning lives.",
              "コミュニティで公開したものは公開・検索可能です。あなたの名前を知らない人があなたを見つける経路であり、各記事は完全な思考が置かれているエージェントへ導線を張れます。",
              "你在社群發布的內容是公開且可被檢索的。這是別人在還不認識你之前找到你的方式——每篇文章都能指向完整推理所在的 Agent。",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/community" className="rounded-xl border border-glassborder/20 bg-panel/40 px-4 py-2 text-[13px] text-muted backdrop-blur-sm transition hover:border-violet/40 hover:text-text">
            {t("Community", "コミュニティ", "社群")}
          </Link>
          <Link href="/studio/blog/new" className="btn-glow inline-flex items-center gap-1 rounded-xl border border-transparent bg-purple px-4 py-2 text-[13px] font-bold text-white shadow-glow transition hover:brightness-110">
            <IconPlus size={14} stroke={1.7} /> {t("Write", "執筆する", "撰寫")}
          </Link>
        </div>
      </div>

      {/* Honest numbers. Nothing is weighted, ranked or gamified. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat v={stats.views.toLocaleString()} l={t("Views on published posts", "公開記事の閲覧数", "已發布內容的瀏覽數")} />
        <Stat v={stats.replies.toLocaleString()} l={t("Replies received", "受け取った返信", "收到的回覆")} />
        <Stat v={stats.acceptedAnswers.toLocaleString()} l={t("Your replies marked as the answer", "回答として採用された返信", "被採納為答案的回覆")} />
        <Stat v={published.length.toLocaleString()} l={t("Published", "公開中", "已發布")} sub={drafts.length ? t(`${drafts.length} in drafts`, `下書き ${drafts.length} 件`, `草稿 ${drafts.length} 篇`) : undefined} />
      </div>

      {agents.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-panel p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint">
            <IconRobot size={13} stroke={1.7} /> {t("Attention your writing sent to your Agents", "執筆があなたのエージェントに送った注目", "你的文章為 Agent 帶來的關注")}
          </div>
          <div className="space-y-2">
            {agents.map((a) => (
              <div key={a.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-panel2 px-3 py-2">
                <Link href={`/agent/${a.slug}`} className="text-[12.5px] text-text hover:text-accent">{a.name}</Link>
                <span className="text-[11.5px] text-muted">
                  {t(`${a.posts} post${a.posts === 1 ? "" : "s"}`, `${a.posts} 件の投稿`, `${a.posts} 篇貼文`)} · {t(`${a.views.toLocaleString()} views`, `${a.views.toLocaleString()} 回の閲覧`, `${a.views.toLocaleString()} 次瀏覽`)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-faint">
            {t(
              "These are views on the posts that carry a pointer to the Agent. It is attention, not a claim that any of it became a subscription.",
              "これはエージェントへの導線を持つ投稿の閲覧数です。注目度であり、購読につながったという主張ではありません。",
              "這些是帶有 Agent 導向連結的貼文瀏覽數。這是關注度，並不代表其中任何一次轉為訂閱。",
            )}
          </p>
          {stats.unlinked > 0 && (
            <p className="mt-1 text-[11px] leading-5 text-faint">
              {t(
                `${stats.unlinked} published post${stats.unlinked === 1 ? " does" : "s do"} not point at any Agent.`,
                `${stats.unlinked} 件の公開投稿はどのエージェントにも紐づいていません。`,
                `有 ${stats.unlinked} 篇已發布貼文未指向任何 Agent。`,
              )}
            </p>
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <Empty />
      ) : (
        <div className="mt-8 space-y-8">
          <Section title={t("Published", "公開中", "已發布")} count={published.length} empty={t("Nothing published yet.", "まだ公開された記事はありません。", "尚未發布任何內容。")}>
            {published.map((p) => (
              <PostRow key={p.slug} p={p} locale={locale} t={t} busy={busy} confirm={confirm} setConfirm={setConfirm} onStatus={setStatus} onRemove={remove} />
            ))}
          </Section>
          <Section title={t("Drafts", "下書き", "草稿")} count={drafts.length} empty={t("No drafts. A draft is visible to you alone until you publish it.", "下書きはありません。下書きは公開するまであなただけが閲覧できます。", "沒有草稿。草稿在發布前只有你看得到。")}>
            {drafts.map((p) => (
              <PostRow key={p.slug} p={p} locale={locale} t={t} busy={busy} confirm={confirm} setConfirm={setConfirm} onStatus={setStatus} onRemove={remove} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Stat({ v, l, sub }: { v: React.ReactNode; l: string; sub?: string }) {
  return (
    <div className="glass-card p-4">
      <div className="font-display text-2xl font-bold text-text">{v}</div>
      <div className="mt-1 text-[10.5px] uppercase tracking-[0.08em] leading-4 text-faint">{l}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint">
        <span className="inline-block h-px w-6 bg-border" />
        {title} <span className="text-faint/70">({count})</span>
      </div>
      {count === 0 ? (
        <div className="rounded-xl border border-border bg-panel px-4 py-5 text-[12px] text-faint">{empty}</div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function PostRow({
  p, locale, t, busy, confirm, setConfirm, onStatus, onRemove,
}: {
  p: Row;
  locale: "en" | "ja" | "zh";
  t: (en: string, ja?: string, zh?: string) => string;
  busy: string;
  confirm: string;
  setConfirm: (s: string) => void;
  onStatus: (slug: string, status: "draft" | "published") => void;
  onRemove: (slug: string) => void;
}) {
  const isDraft = p.status === "draft";
  const working = busy === p.slug;
  return (
    <div className="rounded-xl border border-border bg-panel p-3 transition-colors hover:border-borderlight">
      <div className="flex items-start gap-3">
        <div className="hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-panel2 sm:block">
          {p.coverMediaId ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/media/${p.coverMediaId}`} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-faint"><IconArticle size={16} stroke={1.5} /></div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-border/70 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-muted">
              {kindLabel(p.kind, locale)}
            </span>
            {isDraft ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-amber">
                <IconEyeOff size={10} stroke={1.8} /> {t("Draft", "下書き", "草稿")}
              </span>
            ) : (
              <Link href={`/community/${p.slug}`} className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                {t("View", "表示", "查看")} <IconExternalLink size={11} stroke={1.7} />
              </Link>
            )}
            {p.agent && (
              <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                <IconRobot size={11} stroke={1.7} /> {p.agent.name}
              </span>
            )}
          </div>

          <div className="mt-1 truncate text-[13.5px] font-medium text-text">{p.title}</div>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-faint">
            {!isDraft && (
              <>
                <span className="inline-flex items-center gap-1"><IconEye size={12} stroke={1.7} /> {p.views.toLocaleString()}</span>
                <span className="inline-flex items-center gap-1"><IconArrowBigUp size={12} stroke={1.7} /> {p.score}</span>
                <span className="inline-flex items-center gap-1"><IconMessageCircle size={12} stroke={1.7} /> {p.replyCount}</span>
              </>
            )}
            <span>
              {isDraft ? t("Saved", "保存日", "儲存於") : t("Published", "公開日", "發布於")} {new Date(isDraft ? p.lastActivityAt : p.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Link href={`/studio/blog/new?edit=${p.slug}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-muted transition-colors hover:bg-panel2 hover:text-text">
            <IconPencil size={12} stroke={1.7} /> {t("Edit", "編集", "編輯")}
          </Link>
          <button
            disabled={working}
            onClick={() => onStatus(p.slug, isDraft ? "published" : "draft")}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-muted transition-colors hover:bg-panel2 hover:text-text disabled:opacity-50"
          >
            {working ? <IconLoader2 size={12} className="animate-spin" /> : isDraft ? <IconWorld size={12} stroke={1.7} /> : <IconEyeOff size={12} stroke={1.7} />}
            {isDraft ? t("Publish", "公開", "發布") : t("Unpublish", "非公開にする", "取消發布")}
          </button>
          {confirm === p.slug ? (
            <span className="inline-flex items-center gap-1">
              <button disabled={working} onClick={() => onRemove(p.slug)} className="rounded-lg border border-rust/40 px-2.5 py-1.5 text-[11.5px] text-rust transition-colors hover:bg-rust/10 disabled:opacity-50">
                {t("Confirm delete", "削除を確定", "確認刪除")}
              </button>
              <button onClick={() => setConfirm("")} className="rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-muted hover:text-text">
                {t("Cancel", "キャンセル", "取消")}
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirm(p.slug)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-muted transition-colors hover:border-rust/40 hover:text-rust">
              <IconTrash size={12} stroke={1.7} /> {t("Delete", "削除", "刪除")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty() {
  const { t } = useI18n();
  return (
    <div className="mt-8 rounded-xl border border-border bg-panel p-10 text-center">
      <IconArticle size={24} stroke={1.5} className="mx-auto text-faint" />
      <div className="mt-4 font-display text-[17px] font-bold tracking-tight">{t("You have not written anything yet.", "まだ何も執筆していません。", "你還沒有寫過任何內容。")}</div>
      <div className="mx-auto mt-3 max-w-xl space-y-2 text-[12.5px] leading-6 text-muted">
        <p>
          {t(
            "An Agent only sells to people who already trust the expert behind it. Writing is how that trust starts: a public post is readable by anyone, it is indexed, and it shows your judgement before anyone has paid you a cent.",
            "エージェントは、その背後にいる専門家を既に信頼している人にしか売れません。信頼はまず執筆から始まります。公開された記事は誰でも読め、検索に載り、誰かがお金を払う前にあなたの判断力を示します。",
            "Agent 只賣得動給已經信任背後專家的人。信任從寫作開始：公開的貼文任何人都能讀、會被檢索，並在有人付你一分錢之前就展現你的判斷力。",
          )}
        </p>
        <p>
          {t(
            "Each post can point at one of your Agents — the post shows the reasoning is real, the Agent is where the whole of it lives.",
            "各記事はあなたのエージェントの一つに紐づけられます。記事は思考が本物であることを示し、エージェントはその全体が置かれている場所です。",
            "每篇貼文都能指向你的一個 Agent——貼文證明推理是真的，Agent 則是完整推理的所在。",
          )}
        </p>
        <p className="text-faint">
          {t(
            "There is no schedule to keep and nothing to keep up. Write when you have something worth saying.",
            "守るべき投稿頻度も、維持すべき連続記録もありません。言う価値のあることがあるときに書いてください。",
            "沒有必須遵守的發文頻率，也沒有要維持的紀錄。有值得說的話時再寫。",
          )}
        </p>
      </div>
      <Link href="/studio/blog/new" className="btn-glow mt-6 inline-flex items-center gap-1 rounded-xl border border-transparent bg-purple px-4 py-2 text-[13px] font-bold text-white shadow-glow transition hover:brightness-110">
        <IconPlus size={14} stroke={1.7} /> {t("Write your first post", "最初の記事を書く", "撰寫第一篇")}
      </Link>
    </div>
  );
}
