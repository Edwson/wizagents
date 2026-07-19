import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { excerptOf } from "@/lib/markdown";
import { BODY_MAX, TITLE_MAX, POST_KINDS, guardText, normalizeTags, uniquePostSlug, hotScore } from "@/lib/forum";
import { levelOf } from "@/lib/verification";

export const dynamic = "force-dynamic";

/** List posts. Public — this is the square. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind");
  const tag = q.get("tag");
  const author = q.get("author"); // creator id
  const sort = q.get("sort") || "hot";
  const search = (q.get("q") || "").trim();
  const agentSlug = q.get("agent");

  const posts = await db.post.findMany({
    where: {
      status: "published",
      ...(kind && POST_KINDS.includes(kind as any) ? { kind } : {}),
      ...(tag ? { tags: { contains: tag } } : {}),
      ...(author ? { authorId: author } : {}),
      ...(agentSlug ? { agent: { slug: agentSlug } } : {}),
      ...(search ? { OR: [{ title: { contains: search } }, { body: { contains: search } }] } : {}),
    } as any,
    orderBy: sort === "new" ? { createdAt: "desc" } : sort === "top" ? { score: "desc" } : { lastActivityAt: "desc" },
    take: 60,
    include: {
      author: { select: { id: true, name: true, avatarColor: true, avatarMediaId: true, role: true, creatorProfile: { select: { verified: true, identityVerified: true, displayName: true, avatarMediaId: true } } } },
      agent: { select: { slug: true, name: true } },
    },
  });

  const rows = posts.map((p) => ({
    id: p.id, slug: p.slug, kind: p.kind, title: p.title, excerpt: p.excerpt || excerptOf(p.body),
    tags: p.tags ? p.tags.split(",") : [], lang: p.lang, score: p.score, replyCount: p.replyCount,
    views: p.views, pinned: p.pinned, answered: !!p.acceptedReplyId, createdAt: p.createdAt,
    lastActivityAt: p.lastActivityAt, coverMediaId: p.coverMediaId,
    author: { id: p.author.id, name: p.author.creatorProfile?.displayName || p.author.name, color: p.author.avatarColor, avatarMediaId: p.author.creatorProfile?.avatarMediaId || p.author.avatarMediaId, role: p.author.role, level: levelOf(p.author.creatorProfile) },
    agent: p.agent ? { slug: p.agent.slug, name: p.agent.name } : null,
    hot: hotScore(p.score, p.replyCount, p.lastActivityAt),
  }));
  if (sort === "hot") rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.hot - a.hot);
  return NextResponse.json({ ok: true, posts: rows });
}

/** Create a post. Anyone signed in may post; only a creator may publish an "article". */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const b = await readJson(req);
  if (!b) return badRequest();

  const title = String(b.title || "").trim().slice(0, TITLE_MAX);
  const body = String(b.body || "").trim();
  const kind = POST_KINDS.includes(b.kind) ? b.kind : "discussion";
  if (title.length < 6) return NextResponse.json({ error: "Give it a title of at least 6 characters." }, { status: 400 });
  if (body.length < 20) return NextResponse.json({ error: "Write at least a couple of sentences." }, { status: 400 });
  if (body.length > BODY_MAX) return NextResponse.json({ error: `Posts are capped at ${BODY_MAX} characters.` }, { status: 400 });

  if ((kind === "article" || kind === "case" || kind === "guide") && user.role !== "creator" && user.role !== "admin") {
    return NextResponse.json({ error: "Articles, guides and case studies are published by creators. Post it as a discussion instead." }, { status: 403 });
  }

  // Rate limit: an account cannot flood the square.
  const recent = await db.post.count({ where: { authorId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= 5) return NextResponse.json({ error: "You've posted a lot in the last hour. Give it a little time." }, { status: 429 });

  // An Agent may only be promoted by the person who owns it.
  let agentId: string | null = null;
  if (b.agentSlug) {
    const a = await db.agent.findUnique({ where: { slug: String(b.agentSlug) } });
    if (a && a.creatorId === user.id && a.status === "published") agentId = a.id;
    else if (a) return NextResponse.json({ error: "You can only link an Agent you own and have published." }, { status: 403 });
  }

  const draft = b.status === "draft";

  // A guide teaches people to get more out of a specific Agent. We require the Agent to
  // PUBLISH — but not to draft: you should be able to start writing before you've decided
  // which Agent it belongs to.
  if (kind === "guide" && !agentId && !draft) {
    return NextResponse.json({ error: "A guide has to be about one of your Agents — pick which one it teaches before you publish.", code: "guide_needs_agent" }, { status: 400 });
  }

  const refusal = await guardText(user.id, title + "\n" + body, "post", agentId);
  if (refusal) return NextResponse.json({ error: refusal, code: "extraction" }, { status: 422 });

  const post = await db.post.create({
    data: {
      slug: await uniquePostSlug(title),
      authorId: user.id,
      kind,
      title,
      body,
      excerpt: excerptOf(body),
      tags: normalizeTags(String(b.tags || "")),
      lang: ["en", "ja", "zh"].includes(b.lang) ? b.lang : "en",
      agentId,
      coverMediaId: b.coverMediaId ? String(b.coverMediaId) : null,
      status: draft ? "draft" : "published",
      lastActivityAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true, slug: post.slug, status: post.status });
}
