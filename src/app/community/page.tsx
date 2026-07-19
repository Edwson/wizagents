import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getLocale, pick } from "@/lib/locale";
import { getCurrentUser } from "@/lib/auth";
import { excerptOf } from "@/lib/markdown";
import { hotScore } from "@/lib/forum";
import { levelOf } from "@/lib/verification";
import { absUrl, metaDescription } from "@/lib/seo";
import CommunityClient, { type PostRow } from "./CommunityClient";
import { IconPencilPlus, IconHelpCircle } from "@tabler/icons-react";
import { Btn } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const n = await db.post.count({ where: { status: "published" } });
  const title = "Community";
  const description = metaDescription(
    `${n} questions, discussions, articles and case studies from named experts on WizAgents. Ask a real question — the experts here answer, in the open, under their own name.`,
  );
  const url = absUrl("/community");
  return {
    title,
    description,
    keywords: ["expert community", "ask an expert", "Q&A", "case studies", "WizAgents"],
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: "WizAgents", title: `${title} · WizAgents`, description },
    twitter: { card: "summary_large_image", title: `${title} · WizAgents`, description },
  };
}

/** The public square. Server fetches the board; the client owns filtering and sorting. */
export default async function CommunityPage() {
  const [locale, user, posts] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    db.post.findMany({
      where: { status: "published" },
      orderBy: { lastActivityAt: "desc" },
      take: 120,
      include: {
        author: {
          select: {
            id: true, name: true, avatarColor: true, avatarMediaId: true, role: true,
            creatorProfile: { select: { verified: true, identityVerified: true, displayName: true, avatarMediaId: true } },
          },
        },
        agent: { select: { slug: true, name: true } },
      },
    }),
  ]);
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);

  const rows: PostRow[] = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    excerpt: p.excerpt || excerptOf(p.body),
    tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
    score: p.score,
    replyCount: p.replyCount,
    views: p.views,
    pinned: p.pinned,
    answered: !!p.acceptedReplyId,
    createdAt: p.createdAt.toISOString(),
    lastActivityAt: p.lastActivityAt.toISOString(),
    hot: hotScore(p.score, p.replyCount, p.lastActivityAt),
    author: {
      id: p.author.id,
      name: p.author.creatorProfile?.displayName || p.author.name,
      color: p.author.avatarColor,
      // A creator's storefront photo beats their account photo — same rule as the forum API.
      avatarMediaId: p.author.creatorProfile?.avatarMediaId || p.author.avatarMediaId,
      level: levelOf(p.author.creatorProfile),
    },
    agent: p.agent ? { slug: p.agent.slug, name: p.agent.name } : null,
  }));

  // Every tag anyone has actually used, most-used first — the real topics of the square.
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) counts.set(t, (counts.get(t) || 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 16);

  return (
    <div className="animate-fadein">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-glassborder/40 bg-panel/40 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulsedot" />
        <span>wizagents://community/<span className="text-grad-neon font-semibold">square</span></span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-[30px] font-bold">{P("Community", "コミュニティ", "社群")}</h1>
          <p className="text-[13px] text-muted">
            {P(
              "Ask a real question, and a named expert answers in the open — under their own name.",
              "本当の質問をすれば、実名の専門家が公開の場で答えます。",
              "提出真實的問題，具名的專家會在公開場合親自回答。",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn href="/community/new?kind=question" variant="primary" size="md">
            <IconHelpCircle size={15} stroke={1.8} />
            {P("Ask a question", "質問する", "提出問題")}
          </Btn>
          <Btn href="/community/new" variant="outline" size="md">
            <IconPencilPlus size={15} stroke={1.8} />
            {P("Write", "投稿する", "撰寫")}
          </Btn>
        </div>
      </div>

      <div className="mt-6">
        <CommunityClient posts={rows} tags={tags} signedIn={!!user} />
      </div>
    </div>
  );
}
