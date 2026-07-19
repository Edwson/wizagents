"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { timeAgo, money } from "@/lib/format";
import { kindLabel, REPLY_MAX } from "@/lib/forum";
import { type Level } from "@/lib/verification";
import Composer from "@/components/Composer";
import { Btn, Badge } from "@/components/ui";
import Avatar from "@/components/Avatar";
import { VerifiedPill } from "../CommunityClient";
import {
  IconArrowBigUp, IconArrowBigDown, IconCircleCheck, IconCheck, IconDots, IconFlag,
  IconArrowNarrowRight, IconEye, IconMessage2, IconAlertTriangle, IconLoader2, IconCornerDownRight,
} from "@tabler/icons-react";

type Author = { id: string; name: string; color: string; avatarMediaId?: string | null; level: Level; bio?: string };
export type ThreadReply = {
  id: string;
  html: string;
  score: number;
  accepted: boolean;
  createdAt: string;
  parentId: string | null;
  myVote: number;
  canEdit: boolean;
  author: Author;
  agent: { slug: string; name: string } | null;
};
export type ThreadPost = {
  id: string;
  slug: string;
  kind: string;
  title: string;
  html: string;
  tags: string[];
  score: number;
  views: number;
  status: string;
  createdAt: string;
  acceptedReplyId: string | null;
  myVote: number;
  canEdit: boolean;
  isAsker: boolean;
  author: Author;
  agent: { slug: string; name: string; price: number; tagline: string } | null;
  replies: ThreadReply[];
};

export default function ThreadClient({ post, viewerId }: { post: ThreadPost; viewerId: string | null }) {
  const { t, locale } = useI18n();
  const router = useRouter();

  // Votes are optimistic: the arrow answers instantly, the server is the source of truth.
  const [votes, setVotes] = useState<Record<string, { score: number; mine: number }>>(() => {
    const m: Record<string, { score: number; mine: number }> = { [post.id]: { score: post.score, mine: post.myVote } };
    for (const r of post.replies) m[r.id] = { score: r.score, mine: r.myVote };
    return m;
  });
  const [accepted, setAccepted] = useState<string | null>(post.acceptedReplyId);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [voteErr, setVoteErr] = useState("");

  async function vote(kind: "post" | "reply", id: string, value: 1 | -1) {
    const cur = votes[id] || { score: 0, mine: 0 };
    const clearing = cur.mine === value;
    const optimistic = {
      score: cur.score + (clearing ? -value : cur.mine === 0 ? value : value * 2),
      mine: clearing ? 0 : value,
    };
    setVotes((v) => ({ ...v, [id]: optimistic }));
    setVoteErr("");
    const r = await fetch("/api/forum/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kind === "post" ? { postId: id, value } : { replyId: id, value }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setVotes((v) => ({ ...v, [id]: cur })); // roll back
      setVoteErr(d.error || t("Could not register that vote.", "投票を記録できませんでした。", "無法記錄這次投票。"));
      return;
    }
    setVotes((v) => ({ ...v, [id]: { score: d.score, mine: d.myVote } }));
  }

  async function accept(replyId: string) {
    const r = await fetch("/api/forum/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replyId }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setVoteErr(d.error || t("Could not accept that answer.", "回答を承認できませんでした。", "無法採納這個回答。")); return; }
    setAccepted(d.accepted ? replyId : null);
    router.refresh();
  }

  const isQuestion = post.kind === "question";
  const roots = post.replies.filter((r) => !r.parentId);
  const childrenOf = (id: string) => post.replies.filter((r) => r.parentId === id);
  const answerWord = isQuestion
    ? t("answer", "回答", "回答")
    : t("reply", "返信", "回覆");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        {/* ---------------- the post ---------------- */}
        <article className="glass-card p-6">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Badge tone={isQuestion ? "cyan" : post.kind === "article" ? "purple" : post.kind === "case" ? "green" : "muted"}>
              {kindLabel(post.kind, locale)}
            </Badge>
            {accepted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green/40 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-green backdrop-blur-sm">
                <IconCircleCheck size={12} stroke={1.9} />
                {t("Answered", "解決済み", "已解答")}
              </span>
            )}
            {post.status === "draft" && <Badge tone="amber">{t("Draft", "下書き", "草稿")}</Badge>}
            <div className="ml-auto">
              <Overflow targetType="post" targetId={post.id} />
            </div>
          </div>

          <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight">{post.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-faint">
            <span className="flex items-center gap-1.5">
              <Avatar name={post.author.name} color={post.author.color} mediaId={post.author.avatarMediaId} size={32} />
              <Link href={`/creator/${post.author.id}`} className="text-muted hover:text-text">{post.author.name}</Link>
            </span>
            <VerifiedPill level={post.author.level} />
            <span>{timeAgo(post.createdAt, locale)}</span>
            <span className="flex items-center gap-1"><IconEye size={13} stroke={1.7} />{post.views}</span>
            <span className="flex items-center gap-1"><IconMessage2 size={13} stroke={1.7} />{post.replies.length}</span>
          </div>

          <div className="mt-5 flex gap-5">
            <Voter
              score={votes[post.id]?.score ?? post.score}
              mine={votes[post.id]?.mine ?? 0}
              onVote={(v) => vote("post", post.id, v)}
            />
            {/*
              post.html comes from renderMarkdown() in src/lib/markdown.ts — a strict renderer that
              escapes everything first and only re-introduces a closed set of markdown constructs.
              No raw HTML, no remote images, no javascript:/data: URLs survive it. The HTML is
              already sanitized server-side, so injecting it here is intentional and safe.
            */}
            <div
              className="min-w-0 flex-1 text-[14px] leading-relaxed text-text [&_p]:text-muted"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          </div>

          {post.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5 border-t border-border pt-4">
              {post.tags.map((x) => (
                <span key={x} className="rounded-md border border-border/70 px-2 py-0.5 text-[11px] text-muted">{x}</span>
              ))}
            </div>
          )}
        </article>

        {voteErr && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rust/40 bg-rust/5 px-4 py-3 text-[12.5px] text-rust">
            <IconAlertTriangle size={15} stroke={1.8} className="mt-0.5 shrink-0" />
            <span>{voteErr}</span>
          </div>
        )}

        {/* ---------------- replies ---------------- */}
        <div className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 text-[13px] uppercase tracking-[0.14em] text-faint">
            <span className="inline-block h-px w-6 bg-border" />
            {post.replies.length}{" "}
            {isQuestion
              ? t(post.replies.length === 1 ? "answer" : "answers", "件の回答", "個回答")
              : t(post.replies.length === 1 ? "reply" : "replies", "件の返信", "則回覆")}
          </h2>

          {post.replies.length === 0 && (
            <div className="glass-card p-8 text-center text-[13px] text-muted">
              {isQuestion
                ? t(
                    "No answers yet. If you know this, this is the moment to be useful.",
                    "まだ回答がありません。分かる方は、いま力を貸してください。",
                    "還沒有回答。如果你知道答案，現在正是出手的時候。",
                  )
                : t("Nothing said yet. Say the first thing.", "まだ何もありません。最初の一言をどうぞ。", "還沒有人發言，來說第一句吧。")}
            </div>
          )}

          <div className="space-y-3">
            {roots.map((r) => (
              <div key={r.id}>
                <ReplyCard
                  r={r}
                  post={post}
                  viewerId={viewerId}
                  votes={votes}
                  accepted={accepted}
                  onVote={(v) => vote("reply", r.id, v)}
                  onAccept={() => accept(r.id)}
                  onReply={() => setReplyTo(replyTo === r.id ? null : r.id)}
                  replying={replyTo === r.id}
                />
                {childrenOf(r.id).length > 0 && (
                  <div className="mt-3 space-y-3 border-l border-border pl-4 sm:pl-6">
                    {childrenOf(r.id).map((c) => (
                      <ReplyCard
                        key={c.id}
                        r={c}
                        post={post}
                        viewerId={viewerId}
                        votes={votes}
                        accepted={accepted}
                        nested
                        onVote={(v) => vote("reply", c.id, v)}
                        onAccept={() => accept(c.id)}
                      />
                    ))}
                  </div>
                )}
                {replyTo === r.id && (
                  <div className="mt-3 border-l border-border pl-4 sm:pl-6">
                    <ReplyForm slug={post.slug} parentId={r.id} onDone={() => { setReplyTo(null); router.refresh(); }} viewerId={viewerId} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ---------------- your reply ---------------- */}
          <div className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-[13px] uppercase tracking-[0.14em] text-faint">
              <span className="inline-block h-px w-6 bg-border" />
              {t(`Your ${answerWord}`, "あなたの回答", "你的回覆")}
            </h2>
            <ReplyForm slug={post.slug} parentId={null} onDone={() => router.refresh()} viewerId={viewerId} />
          </div>
        </div>
      </div>

      {/* ---------------- sidebar ---------------- */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {post.agent && (
          <div className="glass-card border-grad p-5">
            <div className="text-[11px] uppercase tracking-[0.14em] text-faint">
              {t("Written alongside", "関連するAgent", "相關 Agent")}
            </div>
            <Link href={`/agent/${post.agent.slug}`} className="mt-2 block font-display text-[17px] font-semibold leading-snug hover:text-purple">
              {post.agent.name}
            </Link>
            {post.agent.tagline && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{post.agent.tagline}</p>}
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-[20px] font-bold">{money(post.agent.price)}</span>
              <span className="text-[11.5px] text-faint">{t("/ month", "/ 月", "/ 月")}</span>
            </div>
            <Btn href={`/agent/${post.agent.slug}`} variant="primary" size="md" className="mt-3 w-full">
              {t("Subscribe", "購読する", "訂閱")}
            </Btn>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              {t(
                "The post above is public. The Agent is where the same expert applies this to your own situation.",
                "上の投稿は公開されています。Agentでは、同じ専門家があなたの状況にこれを適用します。",
                "上面的貼文是公開的。Agent 則是同一位專家把這套想法用在你自己的處境上。",
              )}
            </p>
          </div>
        )}

        <div className="glass-card p-5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-faint">{t("Author", "投稿者", "作者")}</div>
          <div className="mt-2 flex items-center gap-2.5">
            <Avatar name={post.author.name} color={post.author.color} mediaId={post.author.avatarMediaId} size={32} />
            <div className="min-w-0">
              <Link href={`/creator/${post.author.id}`} className="block truncate text-[13.5px] font-semibold hover:text-purple">
                {post.author.name}
              </Link>
              <div className="mt-0.5"><VerifiedPill level={post.author.level} /></div>
            </div>
          </div>
          {post.author.bio && <p className="mt-3 line-clamp-4 text-[12px] leading-relaxed text-muted">{post.author.bio}</p>}
        </div>

        <div className="glass-card p-5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-faint">{t("House rule", "この場のルール", "廣場守則")}</div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {t(
              `Public replies are capped at ${REPLY_MAX} characters. Show how you think here; let the full reasoning live in your Agent, where you are paid for it.`,
              `公開の返信は${REPLY_MAX}文字までです。考え方はここで示し、完全な推論は報酬が支払われるAgentに置いてください。`,
              `公開回覆上限為 ${REPLY_MAX} 個字元。在這裡展示你的思路，把完整的推理留在你的 Agent 裡 — 那裡你才會獲得報酬。`,
            )}
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ---------------- vote arrows ---------------- */
function Voter({ score, mine, onVote, small = false }: { score: number; mine: number; onVote: (v: 1 | -1) => void; small?: boolean }) {
  const { t } = useI18n();
  const size = small ? 16 : 19;
  return (
    <div className="flex w-9 shrink-0 flex-col items-center gap-0.5">
      <button
        onClick={() => onVote(1)}
        aria-label={t("Upvote", "賛成", "贊成")}
        aria-pressed={mine === 1}
        className={`rounded-md p-1 transition-colors hover:bg-panel2 ${mine === 1 ? "text-purple" : "text-faint hover:text-text"}`}
      >
        <IconArrowBigUp size={size} stroke={1.7} fill={mine === 1 ? "currentColor" : "none"} />
      </button>
      <span className={`font-display text-[14px] font-bold tabular-nums ${mine !== 0 ? "text-text" : "text-muted"}`}>{score}</span>
      <button
        onClick={() => onVote(-1)}
        aria-label={t("Downvote", "反対", "反對")}
        aria-pressed={mine === -1}
        className={`rounded-md p-1 transition-colors hover:bg-panel2 ${mine === -1 ? "text-rust" : "text-faint hover:text-text"}`}
      >
        <IconArrowBigDown size={size} stroke={1.7} fill={mine === -1 ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/* ---------------- one reply ---------------- */
function ReplyCard({
  r, post, viewerId, votes, accepted, nested = false, onVote, onAccept, onReply, replying,
}: {
  r: ThreadReply;
  post: ThreadPost;
  viewerId: string | null;
  votes: Record<string, { score: number; mine: number }>;
  accepted: string | null;
  nested?: boolean;
  onVote: (v: 1 | -1) => void;
  onAccept: () => void;
  onReply?: () => void;
  replying?: boolean;
}) {
  const { t, locale } = useI18n();
  const isAccepted = accepted === r.id;
  // Only the person who asked can accept, and never their own answer — that is what
  // makes the mark mean something.
  const canAccept = post.kind === "question" && post.isAsker && r.author.id !== viewerId;

  return (
    <div className={`glass-card p-5 ${isAccepted ? "border-green/50 bg-green/[0.03]" : ""}`}>
      {isAccepted && (
        <div className="mb-3 flex items-center gap-1.5 text-[11.5px] font-medium text-green">
          <IconCircleCheck size={14} stroke={1.9} />
          {t("Accepted answer", "採用された回答", "採納的回答")}
          <span className="font-normal text-faint">
            {t("— marked by the person who asked", "— 質問者が選びました", "— 由提問者選出")}
          </span>
        </div>
      )}

      <div className="flex gap-4">
        <Voter score={votes[r.id]?.score ?? r.score} mine={votes[r.id]?.mine ?? 0} onVote={onVote} small />

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-faint">
            <Avatar name={r.author.name} color={r.author.color} mediaId={r.author.avatarMediaId} size={26} />
            <Link href={`/creator/${r.author.id}`} className="text-muted hover:text-text">{r.author.name}</Link>
            <VerifiedPill level={r.author.level} />
            <span>{timeAgo(r.createdAt, locale)}</span>
            <div className="ml-auto"><Overflow targetType="reply" targetId={r.id} /></div>
          </div>

          {/* Already sanitized by the strict server-side renderer (src/lib/markdown.ts). */}
          <div
            className="text-[13.5px] leading-relaxed [&_p]:my-2 [&_p]:text-muted"
            dangerouslySetInnerHTML={{ __html: r.html }}
          />

          {r.agent && <AgentPointer slug={r.agent.slug} name={r.agent.name} />}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!nested && onReply && (
              <button
                onClick={onReply}
                className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 text-[11.5px] text-muted transition-colors hover:bg-panel2 hover:text-text"
              >
                <IconCornerDownRight size={13} stroke={1.8} />
                {replying ? t("Cancel", "キャンセル", "取消") : t("Reply", "返信", "回覆")}
              </button>
            )}
            {canAccept && (
              <button
                onClick={onAccept}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] transition-colors ${
                  isAccepted
                    ? "border-green/50 text-green hover:bg-green/10"
                    : "border-border text-muted hover:border-green/50 hover:text-green"
                }`}
              >
                <IconCheck size={13} stroke={2} />
                {isAccepted
                  ? t("Unaccept", "採用を取り消す", "取消採納")
                  : t("Accept this answer", "この回答を採用する", "採納這個回答")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- "the full reasoning lives here" ---------------- */
function AgentPointer({ slug, name }: { slug: string; name: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/agent/${slug}`}
      className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-panel2/60 px-3 py-2 text-[12px] text-muted transition-colors hover:border-purple/40 hover:text-text"
    >
      <span className="min-w-0 flex-1">
        {t("The full reasoning lives in", "詳しい推論は", "完整的推理在")}{" "}
        <span className="font-medium text-text">{name}</span>
        {t("", "にあります", "裡")}
      </span>
      <IconArrowNarrowRight size={15} stroke={1.8} className="shrink-0 text-purple" />
    </Link>
  );
}

/* ---------------- report (quiet, in an overflow) ---------------- */
function Overflow({ targetType, targetId }: { targetType: "post" | "reply"; targetId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function report() {
    setBusy(true);
    const reason = window.prompt(t("What is wrong with this?", "何が問題ですか？", "這則內容有什麼問題？") || "") || "";
    if (!reason.trim()) { setBusy(false); setOpen(false); return; }
    await fetch("/api/forum/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason: reason.slice(0, 300) }),
    }).catch(() => {});
    setBusy(false);
    setDone(true);
    setOpen(false);
  }

  if (done) return <span className="text-[11px] text-faint">{t("Reported — an admin will look.", "報告しました。管理者が確認します。", "已檢舉，管理員會查看。")}</span>;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("More", "その他", "更多")}
        className="rounded-md p-1 text-faint transition-colors hover:bg-panel2 hover:text-text"
      >
        <IconDots size={15} stroke={1.8} />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
            <button
              onClick={report}
              disabled={busy}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-muted hover:bg-panel2 hover:text-text disabled:opacity-50"
            >
              {busy ? <IconLoader2 size={13} className="animate-spin" /> : <IconFlag size={13} stroke={1.8} />}
              {t("Report", "報告する", "檢舉")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- the reply composer ---------------- */
function ReplyForm({
  slug, parentId, onDone, viewerId,
}: { slug: string; parentId: string | null; onDone: () => void; viewerId: string | null }) {
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [refusal, setRefusal] = useState("");

  if (!viewerId) {
    return (
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-[13px] text-muted">
          {t("Sign in to reply.", "返信するにはサインインしてください。", "登入後即可回覆。")}
        </p>
        <Btn href={`/login?next=/community/${slug}`} variant="outline" size="sm">
          {t("Sign in", "サインイン", "登入")}
        </Btn>
      </div>
    );
  }

  async function submit() {
    if (body.trim().length < 2 || busy) return;
    setBusy(true); setErr(""); setRefusal("");
    const r = await fetch("/api/forum/reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, body, ...(parentId ? { parentId } : {}) }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      // The cap and the extraction refusal both explain themselves. Show them word for word —
      // paraphrasing a boundary is how a boundary stops being believed.
      if (d.code === "reply_too_long" || d.code === "extraction") setRefusal(String(d.error || ""));
      else setErr(String(d.error || t("Could not post that.", "投稿できませんでした。", "無法送出。")));
      return;
    }
    setBody("");
    onDone();
  }

  return (
    <div>
      <Composer
        value={body}
        onChange={(v) => { setBody(v); if (refusal) setRefusal(""); }}
        max={REPLY_MAX}
        minRows={5}
        placeholder={t(
          "Say how you think about it. Be specific — this is public, under your name.",
          "あなたの考え方を書いてください。公開され、あなたの名前が残ります。",
          "說說你怎麼想。具體一點 — 這是公開的，並且會署上你的名字。",
        )}
        hint={t(
          `Up to ${REPLY_MAX} characters. A public reply is a sample of your judgement, not a consultation.`,
          `${REPLY_MAX}文字まで。公開の返信はあなたの判断のサンプルであり、相談ではありません。`,
          `最多 ${REPLY_MAX} 個字元。公開回覆是你判斷力的樣本，而不是一次諮詢。`,
        )}
      />

      {refusal && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/5 px-4 py-3 text-[12.5px] leading-relaxed text-amber">
          <IconAlertTriangle size={15} stroke={1.8} className="mt-0.5 shrink-0" />
          <span>{refusal}</span>
        </div>
      )}
      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rust/40 bg-rust/5 px-4 py-3 text-[12.5px] text-rust">
          <IconAlertTriangle size={15} stroke={1.8} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Btn onClick={submit} variant="primary" size="md" disabled={busy || body.trim().length < 2 || body.length > REPLY_MAX}>
          {busy && <IconLoader2 size={14} className="animate-spin" />}
          {t("Post reply", "返信する", "送出回覆")}
        </Btn>
      </div>
    </div>
  );
}
