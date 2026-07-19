import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson } from "@/lib/req";
import { renderMarkdown, excerptOf } from "@/lib/markdown";
import { levelOf } from "@/lib/verification";
import { BODY_MAX, TITLE_MAX, POST_KINDS, guardText, normalizeTags } from "@/lib/forum";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const p = await db.post.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, avatarColor: true, avatarMediaId: true, role: true, creatorProfile: { select: { verified: true, identityVerified: true, displayName: true, bio: true, avatarMediaId: true } } } },
      agent: { select: { slug: true, name: true, price: true, tagline: true } },
      replies: {
        where: { status: "published" },
        orderBy: [{ accepted: "desc" }, { score: "desc" }, { createdAt: "asc" }],
        include: {
          author: { select: { id: true, name: true, avatarColor: true, avatarMediaId: true, role: true, creatorProfile: { select: { verified: true, identityVerified: true, displayName: true, avatarMediaId: true } } } },
          agent: { select: { slug: true, name: true } },
        },
      },
    },
  });

  // A draft belongs to its author alone.
  if (!p || p.status === "removed") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = user && (user.id === p.authorId || user.role === "admin");
  if (p.status === "draft" && !isOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isOwner) await db.post.update({ where: { id: p.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const myVotes = user
    ? await db.vote.findMany({ where: { userId: user.id, OR: [{ postId: p.id }, { replyId: { in: p.replies.map((r) => r.id) } }] } })
    : [];
  const voteOn = (postId: string | null, replyId: string | null) =>
    myVotes.find((v) => v.postId === postId && v.replyId === replyId)?.value || 0;

  return NextResponse.json({
    ok: true,
    post: {
      id: p.id, slug: p.slug, kind: p.kind, title: p.title, body: p.body, html: renderMarkdown(p.body),
      tags: p.tags ? p.tags.split(",") : [], lang: p.lang, score: p.score, views: p.views,
      status: p.status, pinned: p.pinned, coverMediaId: p.coverMediaId,
      createdAt: p.createdAt, acceptedReplyId: p.acceptedReplyId,
      myVote: voteOn(p.id, null),
      canEdit: !!isOwner,
      author: {
        id: p.author.id, name: p.author.creatorProfile?.displayName || p.author.name,
        color: p.author.avatarColor, avatarMediaId: p.author.creatorProfile?.avatarMediaId || p.author.avatarMediaId, role: p.author.role, bio: p.author.creatorProfile?.bio || "",
        level: levelOf(p.author.creatorProfile),
      },
      agent: p.agent,
      replies: p.replies.map((r) => ({
        id: r.id, body: r.body, html: renderMarkdown(r.body), score: r.score, accepted: r.accepted,
        createdAt: r.createdAt, parentId: r.parentId, myVote: voteOn(null, r.id),
        canEdit: !!user && (user.id === r.authorId || user.role === "admin"),
        author: {
          id: r.author.id, name: r.author.creatorProfile?.displayName || r.author.name,
          color: r.author.avatarColor, avatarMediaId: r.author.creatorProfile?.avatarMediaId || r.author.avatarMediaId, role: r.author.role, level: levelOf(r.author.creatorProfile),
        },
        agent: r.agent,
      })),
    },
  });
}

/** Edit or unpublish your own post. */
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const p = await db.post.findUnique({ where: { slug } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.authorId !== user.id && user.role !== "admin") return NextResponse.json({ error: "Not your post." }, { status: 403 });

  const b = await readJson(req);
  const data: any = {};
  if (typeof b?.title === "string") {
    const t = b.title.trim().slice(0, TITLE_MAX);
    if (t.length < 6) return NextResponse.json({ error: "Give it a title of at least 6 characters." }, { status: 400 });
    data.title = t;
  }
  if (typeof b?.body === "string") {
    const body = b.body.trim();
    if (body.length < 20 || body.length > BODY_MAX) return NextResponse.json({ error: "Body length is out of range." }, { status: 400 });
    const refusal = await guardText(user.id, body, "post-edit", p.agentId);
    if (refusal) return NextResponse.json({ error: refusal, code: "extraction" }, { status: 422 });
    data.body = body;
    data.excerpt = excerptOf(body);
  }
  if (typeof b?.tags === "string") data.tags = normalizeTags(b.tags);

  // Kind is editable — but a buyer still cannot promote a post into an article.
  if (typeof b?.kind === "string" && POST_KINDS.includes(b.kind)) {
    if ((b.kind === "article" || b.kind === "case") && user.role !== "creator" && user.role !== "admin") {
      return NextResponse.json({ error: "Articles and case studies are published by creators." }, { status: 403 });
    }
    data.kind = b.kind;
  }

  // Re-link (or unlink) an Agent — only ever one you own.
  if (typeof b?.agentSlug === "string") {
    if (!b.agentSlug) data.agentId = null;
    else {
      const a = await db.agent.findUnique({ where: { slug: b.agentSlug } });
      if (!a || a.creatorId !== user.id || a.status !== "published") {
        return NextResponse.json({ error: "You can only link an Agent you own and have published." }, { status: 403 });
      }
      data.agentId = a.id;
    }
  }
  if (typeof b?.coverMediaId === "string") data.coverMediaId = b.coverMediaId || null;
  if (b?.status === "draft" || b?.status === "published") data.status = b.status;
  if (user.role === "admin" && typeof b?.pinned === "boolean") data.pinned = b.pinned;

  // The same rule on the way out: you may draft a guide with no Agent, but you may not
  // publish one. Otherwise "save as draft, then publish" would walk straight around the check.
  const finalKind = data.kind ?? p.kind;
  const finalAgent = "agentId" in data ? data.agentId : p.agentId;
  const finalStatus = data.status ?? p.status;
  if (finalKind === "guide" && !finalAgent && finalStatus === "published") {
    return NextResponse.json({ error: "A guide has to be about one of your Agents — pick which one it teaches before you publish.", code: "guide_needs_agent" }, { status: 400 });
  }

  const up = await db.post.update({ where: { id: p.id }, data });
  return NextResponse.json({ ok: true, slug: up.slug, status: up.status });
}

/** Remove your own post. Soft delete: replies from other people stay attributable. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const p = await db.post.findUnique({ where: { slug } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.authorId !== user.id && user.role !== "admin") return NextResponse.json({ error: "Not your post." }, { status: 403 });
  await db.post.update({ where: { id: p.id }, data: { status: "removed", coverMediaId: null } });
  // Don't leave the cover image's bytes sitting in the database forever.
  if (p.coverMediaId) await db.media.deleteMany({ where: { id: p.coverMediaId, ownerId: p.authorId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
