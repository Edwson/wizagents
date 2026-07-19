import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import BlogClient from "./BlogClient";

export const dynamic = "force-dynamic";

/**
 * The creator's publishing home.
 *
 * Writing in the community is how an expert becomes findable: a post is public,
 * indexable, and can point at the Agent where the full reasoning lives. This page
 * shows what has been published, what is still a draft, and the plain numbers —
 * no streaks, no scores to chase.
 */
export default async function StudioBlogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Articles and case studies are published by creators — same rule the API enforces.
  if (user.role !== "creator" && user.role !== "admin") redirect("/studio");

  const [posts, acceptedAnswers] = await Promise.all([
    db.post.findMany({
      where: { authorId: user.id, status: { in: ["published", "draft"] } },
      orderBy: [{ status: "asc" }, { lastActivityAt: "desc" }],
      include: { agent: { select: { slug: true, name: true } } },
    }),
    // "Accepted answers" = replies this creator wrote that a post author marked as the answer.
    db.reply.count({ where: { authorId: user.id, accepted: true, status: "published" } }),
  ]);

  const rows = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    kind: p.kind,
    status: p.status,
    views: p.views,
    score: p.score,
    replyCount: p.replyCount,
    coverMediaId: p.coverMediaId,
    createdAt: p.createdAt.toISOString(),
    lastActivityAt: p.lastActivityAt.toISOString(),
    agent: p.agent ? { slug: p.agent.slug, name: p.agent.name } : null,
  }));

  const published = rows.filter((r) => r.status === "published");

  // Which Agent did each post drive attention to? Honest arithmetic: views on the posts
  // that carry the pointer. It is attention, not attribution of a sale.
  const byAgent = new Map<string, { slug: string; name: string; posts: number; views: number }>();
  for (const p of published) {
    if (!p.agent) continue;
    const cur = byAgent.get(p.agent.slug) || { slug: p.agent.slug, name: p.agent.name, posts: 0, views: 0 };
    cur.posts += 1;
    cur.views += p.views;
    byAgent.set(p.agent.slug, cur);
  }

  return (
    <BlogClient
      posts={rows}
      stats={{
        views: published.reduce((s, p) => s + p.views, 0),
        replies: published.reduce((s, p) => s + p.replyCount, 0),
        acceptedAnswers,
        unlinked: published.filter((p) => !p.agent).length,
      }}
      agents={Array.from(byAgent.values()).sort((a, b) => b.views - a.views)}
    />
  );
}
