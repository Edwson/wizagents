"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { kindLabel } from "@/lib/forum";
import { levelLabel, type Level } from "@/lib/verification";
import { Badge, Reveal } from "@/components/ui";
import Avatar from "@/components/Avatar";
import {
  IconArrowBigUp, IconMessage2, IconCircleCheck, IconRosetteDiscountCheck, IconShieldCheck,
  IconSearch, IconX, IconMessages, IconEye, IconSparkles, IconHelpCircle,
} from "@tabler/icons-react";

export type PostRow = {
  id: string;
  slug: string;
  kind: string;
  title: string;
  excerpt: string;
  tags: string[];
  score: number;
  replyCount: number;
  views: number;
  pinned: boolean;
  answered: boolean;
  createdAt: string;
  lastActivityAt: string;
  hot: number;
  author: { id: string; name: string; color: string; avatarMediaId?: string | null; level: Level };
  agent: { slug: string; name: string } | null;
};

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-[11.5px] transition-all duration-300 ${
    active
      ? "border-transparent bg-purple text-white"
      : "border-glassborder/20 bg-panel/40 text-muted backdrop-blur-sm hover:border-purple/40 hover:text-text"
  }`;

/** The badge an author has earned. Nothing is asserted that a human reviewer has not checked. */
export function VerifiedPill({ level }: { level: Level }) {
  const { locale } = useI18n();
  if (level === "expert")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple/40 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-purple backdrop-blur-sm">
        <IconRosetteDiscountCheck size={12} stroke={1.9} />
        {levelLabel("expert", locale)}
      </span>
    );
  if (level === "identity")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-muted backdrop-blur-sm">
        <IconShieldCheck size={12} stroke={1.8} />
        {levelLabel("identity", locale)}
      </span>
    );
  return null;
}

export default function CommunityClient({ posts, tags, signedIn }: { posts: PostRow[]; tags: string[]; signedIn: boolean }) {
  const { t } = useI18n();
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState<"hot" | "new" | "top">("hot");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");

  const KINDS = [
    { id: "all", label: t("All", "すべて", "全部") },
    { id: "question", label: t("Questions", "質問", "提問") },
    { id: "discussion", label: t("Discussions", "ディスカッション", "討論") },
    { id: "article", label: t("Articles", "記事", "文章") },
    { id: "case", label: t("Case studies", "ケーススタディ", "案例") },
  ];
  const SORTS: { id: "hot" | "new" | "top"; label: string }[] = [
    { id: "hot", label: t("Hot", "人気", "熱門") },
    { id: "new", label: t("New", "新着", "最新") },
    { id: "top", label: t("Top", "トップ", "最高分") },
  ];

  const filtered = useMemo(() => {
    let list = posts.slice();
    if (kind !== "all") list = list.filter((p) => p.kind === kind);
    if (tag) list = list.filter((p) => p.tags.includes(tag));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(s) || p.excerpt.toLowerCase().includes(s) || p.author.name.toLowerCase().includes(s),
      );
    }
    if (sort === "new") list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else if (sort === "top") list.sort((a, b) => b.score - a.score);
    else list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.hot - a.hot);
    return list;
  }, [posts, kind, tag, q, sort]);

  // Questions nobody has answered yet. Surfaced on purpose: this is where an expert
  // can be most useful, and most visible.
  const unanswered = useMemo(
    () => posts.filter((p) => p.kind === "question" && p.replyCount === 0).length,
    [posts],
  );
  const filtersOn = kind !== "all" || !!tag || q.trim().length > 0;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button key={k.id} onClick={() => setKind(k.id)} className={chip(kind === k.id)}>{k.label}</button>
        ))}
        <div className="mx-1 hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-1 rounded-full border border-border bg-panel2 p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`rounded-full px-3 py-1 text-[11.5px] transition-colors ${
                sort === s.id ? "bg-purple text-white" : "text-muted hover:text-text"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-1.5">
          <IconSearch size={14} stroke={1.7} className="text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search the square", "コミュニティを検索", "搜尋社群")}
            className="w-44 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label={t("Clear", "クリア", "清除")} className="text-faint hover:text-text">
              <IconX size={13} />
            </button>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{t("Topics", "トピック", "主題")}</span>
          {tags.map((x) => (
            <button key={x} onClick={() => setTag(tag === x ? "" : x)} className={chip(tag === x)}>{x}</button>
          ))}
        </div>
      )}

      {kind !== "question" && unanswered > 0 && (
        <button
          onClick={() => { setKind("question"); setSort("new"); }}
          className="mb-5 flex w-full items-center gap-2.5 rounded-xl border border-amber/30 bg-amber/5 px-4 py-2.5 text-left text-[12.5px] text-muted transition-colors hover:border-amber/50"
        >
          <IconSparkles size={15} stroke={1.7} className="shrink-0 text-amber" />
          <span>
            <span className="text-text">
              {t(
                `${unanswered} question${unanswered === 1 ? "" : "s"} waiting for an answer`,
                `${unanswered}件の質問が回答を待っています`,
                `${unanswered} 個問題正在等待回答`,
              )}
            </span>
            {" — "}
            {t("the fastest way for an expert to be seen.", "専門家が見つけてもらう最短の方法です。", "這是專家被看見最快的方式。")}
          </span>
        </button>
      )}

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 p-12 text-center">
          <IconMessages size={30} stroke={1.4} className="text-faint" />
          <div className="font-display text-[17px] font-semibold">
            {filtersOn
              ? t("Nothing matches that yet", "該当する投稿はまだありません", "目前沒有符合的內容")
              : t("The square is empty", "まだ誰も投稿していません", "廣場還是空的")}
          </div>
          <p className="max-w-md text-[13px] text-muted">
            {filtersOn
              ? t("Try another filter, or ask the question yourself.", "他のフィルタを試すか、自分で質問してみてください。", "換個篩選條件，或者由你來提問。")
              : t(
                  "Someone has to go first. Ask the question you actually have — the experts here answer real questions.",
                  "最初の一人になりましょう。本当に知りたいことを質問してください。ここの専門家は本物の質問に答えます。",
                  "總得有人先開始。問出你真正想知道的問題 — 這裡的專家回答真實的問題。",
                )}
          </p>
          <div className="mt-1 flex gap-2">
            {filtersOn && (
              <button
                onClick={() => { setKind("all"); setTag(""); setQ(""); }}
                className="rounded-lg border border-border px-4 py-2 text-[13px] text-text hover:bg-panel2"
              >
                {t("Clear filters", "フィルタを解除", "清除篩選")}
              </button>
            )}
            <Link
              href={signedIn ? "/community/new?kind=question" : "/login?next=/community/new"}
              className="inline-flex items-center gap-2 rounded-lg border border-purple bg-purple px-4 py-2 text-[13px] text-white hover:bg-purpledim"
            >
              <IconHelpCircle size={15} stroke={1.8} />
              {t("Ask the first question", "最初の質問をする", "提出第一個問題")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 8) * 30}>
              <Row p={p} onTag={setTag} />
            </Reveal>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="mt-6 text-center text-[11.5px] text-faint">
          {t(
            "Public answers are capped on purpose — enough to show how an expert thinks, not a free consultation.",
            "公開の回答には上限があります。考え方は示せますが、無料の相談ではありません。",
            "公開回答有字數上限：足以展現專家的思路，但不是免費諮詢。",
          )}
        </p>
      )}
    </div>
  );
}

function Row({ p, onTag }: { p: PostRow; onTag: (t: string) => void }) {
  const { t, locale } = useI18n();
  const unanswered = p.kind === "question" && p.replyCount === 0;

  return (
    <div
      className={`glass-card group flex gap-4 p-4 transition-colors hover:border-purple/30 ${
        unanswered ? "border-l-2 border-l-amber/50" : ""
      }`}
    >
      {/* score */}
      <div className="flex w-11 shrink-0 flex-col items-center justify-start gap-0.5 pt-0.5">
        <IconArrowBigUp size={16} stroke={1.7} className="text-faint" />
        <span className="font-display text-[15px] font-bold tabular-nums text-text">{p.score}</span>
        <span className="text-[10px] uppercase tracking-wide text-faint">{t("votes", "投票", "票")}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={p.kind === "question" ? "cyan" : p.kind === "article" ? "purple" : p.kind === "case" ? "green" : "muted"}>
            {kindLabel(p.kind, locale)}
          </Badge>
          {p.answered && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green/40 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-green backdrop-blur-sm">
              <IconCircleCheck size={12} stroke={1.9} />
              {t("Answered", "解決済み", "已解答")}
            </span>
          )}
          {unanswered && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-amber backdrop-blur-sm">
              {t("Unanswered", "未回答", "尚無回答")}
            </span>
          )}
          {p.pinned && <Badge tone="amber">{t("Pinned", "固定", "置頂")}</Badge>}
        </div>

        <Link href={`/community/${p.slug}`} className="block">
          <h2 className="font-display text-[16px] font-semibold leading-snug tracking-tight text-text transition-colors group-hover:text-purple">
            {p.title}
          </h2>
        </Link>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{p.excerpt}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-faint">
          <span className="flex items-center gap-1.5">
            <Avatar name={p.author.name} color={p.author.color} mediaId={p.author.avatarMediaId} size={24} />
            <Link href={`/creator/${p.author.id}`} className="text-muted hover:text-text">{p.author.name}</Link>
          </span>
          <VerifiedPill level={p.author.level} />
          <span className="flex items-center gap-1"><IconMessage2 size={13} stroke={1.7} />{p.replyCount}</span>
          <span className="flex items-center gap-1"><IconEye size={13} stroke={1.7} />{p.views}</span>
          <span>{timeAgo(p.lastActivityAt, locale)}</span>
          {p.tags.slice(0, 4).map((x) => (
            <button
              key={x}
              onClick={() => onTag(x)}
              className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10.5px] text-muted hover:border-purple/40 hover:text-text"
            >
              {x}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
