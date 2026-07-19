import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, pick } from "@/lib/locale";
import { renderMarkdown, excerptOf } from "@/lib/markdown";
import { levelOf } from "@/lib/verification";
import { kindLabel } from "@/lib/forum";
import { absUrl, metaDescription, breadcrumbJsonLd, jsonLdScript, bcp47 } from "@/lib/seo";
import ThreadClient, { type ThreadPost } from "./ThreadClient";
import { IconArrowLeft } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

/** The one query the page needs. Same shape the forum API returns, read straight from the db. */
async function load(slug: string) {
  return db.post.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          id: true, name: true, avatarColor: true, avatarMediaId: true, role: true,
          creatorProfile: { select: { verified: true, identityVerified: true, displayName: true, bio: true, avatarMediaId: true } },
        },
      },
      agent: { select: { slug: true, name: true, price: true, tagline: true } },
      replies: {
        where: { status: "published" },
        orderBy: [{ accepted: "desc" }, { score: "desc" }, { createdAt: "asc" }],
        include: {
          author: {
            select: {
              id: true, name: true, avatarColor: true, avatarMediaId: true, role: true,
              creatorProfile: { select: { verified: true, identityVerified: true, displayName: true, avatarMediaId: true } },
            },
          },
          agent: { select: { slug: true, name: true } },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p || p.status === "removed") return { title: "Not found", robots: { index: false, follow: false } };

  const description = metaDescription(p.excerpt || excerptOf(p.body));
  const url = absUrl(`/community/${p.slug}`);
  const authorName = p.author.creatorProfile?.displayName || p.author.name;

  // A draft is private to its author. It must never enter an index.
  if (p.status !== "published") {
    return { title: p.title, description, robots: { index: false, follow: false }, alternates: { canonical: url } };
  }

  return {
    title: p.title,
    description,
    keywords: [...(p.tags ? p.tags.split(",").filter(Boolean) : []), authorName, kindLabel(p.kind)],
    authors: [{ name: authorName, url: absUrl(`/creator/${p.author.id}`) }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "WizAgents",
      title: `${p.title} · WizAgents`,
      description,
      publishedTime: p.createdAt.toISOString(),
      locale: p.lang === "ja" ? "ja_JP" : p.lang === "zh" ? "zh_TW" : "en_US",
    },
    twitter: { card: "summary_large_image", title: `${p.title} · WizAgents`, description },
  };
}

export default async function ThreadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, user, locale] = await Promise.all([load(slug), getCurrentUser(), getLocale()]);
  if (!p || p.status === "removed") notFound();

  const isOwner = !!user && (user.id === p.authorId || user.role === "admin");
  if (p.status === "draft" && !isOwner) notFound();
  if (!isOwner) await db.post.update({ where: { id: p.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const myVotes = user
    ? await db.vote.findMany({
        where: { userId: user.id, OR: [{ postId: p.id }, { replyId: { in: p.replies.map((r) => r.id) } }] },
      })
    : [];
  const voteOn = (postId: string | null, replyId: string | null) =>
    myVotes.find((v) => v.postId === postId && v.replyId === replyId)?.value || 0;

  const post: ThreadPost = {
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    // `html` is produced by our strict server-side renderer (src/lib/markdown.ts): every
    // character is escaped first and only a closed set of markdown constructs is re-introduced —
    // no raw HTML, no remote images, no javascript:/data: hrefs. It is therefore already
    // sanitized, which is why dangerouslySetInnerHTML is the correct call here.
    html: renderMarkdown(p.body),
    tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
    score: p.score,
    views: p.views,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    acceptedReplyId: p.acceptedReplyId,
    myVote: voteOn(p.id, null),
    canEdit: isOwner,
    isAsker: !!user && user.id === p.authorId,
    author: {
      id: p.author.id,
      name: p.author.creatorProfile?.displayName || p.author.name,
      color: p.author.avatarColor,
      // A creator's storefront photo beats their account photo — same rule as the forum API.
      avatarMediaId: p.author.creatorProfile?.avatarMediaId || p.author.avatarMediaId,
      bio: p.author.creatorProfile?.bio || "",
      level: levelOf(p.author.creatorProfile),
    },
    agent: p.agent ? { slug: p.agent.slug, name: p.agent.name, price: p.agent.price, tagline: p.agent.tagline || "" } : null,
    replies: p.replies.map((r) => ({
      id: r.id,
      html: renderMarkdown(r.body), // same strict renderer — already sanitized server-side
      score: r.score,
      accepted: r.accepted,
      createdAt: r.createdAt.toISOString(),
      parentId: r.parentId,
      myVote: voteOn(null, r.id),
      canEdit: !!user && (user.id === r.authorId || user.role === "admin"),
      author: {
        id: r.author.id,
        name: r.author.creatorProfile?.displayName || r.author.name,
        color: r.author.avatarColor,
        avatarMediaId: r.author.creatorProfile?.avatarMediaId || r.author.avatarMediaId,
        level: levelOf(r.author.creatorProfile),
      },
      agent: r.agent ? { slug: r.agent.slug, name: r.agent.name } : null,
    })),
  };

  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  const url = absUrl(`/community/${p.slug}`);
  const authorLd = { "@type": "Person", name: post.author.name, url: absUrl(`/creator/${post.author.id}`) };

  // A question with answers is a QAPage; anything else is a forum posting. We only
  // assert an accepted answer when the person who asked actually marked one.
  const accepted = post.replies.find((r) => r.accepted);
  const threadLd =
    post.kind === "question"
      ? {
          "@context": "https://schema.org",
          "@type": "QAPage",
          "@id": `${url}#thread`,
          inLanguage: bcp47(p.lang),
          mainEntity: {
            "@type": "Question",
            name: post.title,
            text: metaDescription(p.body, 500),
            answerCount: post.replies.length,
            upvoteCount: post.score,
            dateCreated: post.createdAt,
            author: authorLd,
            ...(accepted
              ? {
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: metaDescription(p.replies.find((r) => r.id === accepted.id)?.body || "", 500),
                    upvoteCount: accepted.score,
                    dateCreated: accepted.createdAt,
                    author: { "@type": "Person", name: accepted.author.name, url: absUrl(`/creator/${accepted.author.id}`) },
                  },
                }
              : {}),
          },
        }
      : {
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          "@id": `${url}#thread`,
          headline: post.title,
          url,
          inLanguage: bcp47(p.lang),
          datePublished: post.createdAt,
          author: authorLd,
          articleBody: metaDescription(p.body, 500),
          interactionStatistic: [
            { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: post.score },
            { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: post.replies.length },
          ],
        };

  const crumbs = breadcrumbJsonLd([
    { name: "Community", path: "/community" },
    { name: post.title, path: `/community/${post.slug}` },
  ]);

  return (
    <div className="animate-fadein">
      {post.status === "published" && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(threadLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(crumbs) }} />
        </>
      )}

      <Link href="/community" className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-text">
        <IconArrowLeft size={14} stroke={1.8} />
        {P("Community", "コミュニティ", "社群")}
      </Link>

      <ThreadClient post={post} viewerId={user?.id ?? null} />
    </div>
  );
}
