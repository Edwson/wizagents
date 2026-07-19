import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { notify } from "@/lib/notify";
import { REPLY_MAX, guardText } from "@/lib/forum";

export const dynamic = "force-dynamic";

/**
 * Post a public reply.
 *
 * A public answer is a SAMPLE of an expert's judgement — capped, deliberately. The
 * cap is not a paywall trick: it is the honest boundary between "here is how I think
 * about this" (free, in the open) and "here is the full reasoning applied to your
 * situation" (that is what a subscription buys). We say so in the response.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const b = await readJson(req);
  if (!b) return badRequest();

  const post = await db.post.findUnique({ where: { slug: String(b.slug || "") } });
  if (!post || post.status !== "published") return NextResponse.json({ error: "That thread is not open." }, { status: 404 });

  const body = String(b.body || "").trim();
  if (body.length < 2) return NextResponse.json({ error: "Write something." }, { status: 400 });
  if (body.length > REPLY_MAX) {
    return NextResponse.json(
      {
        error: `Public replies are capped at ${REPLY_MAX} characters. This is the boundary of the square: share how you think about it here, and let the full reasoning live in your Agent, where you are paid for it.`,
        code: "reply_too_long",
        max: REPLY_MAX,
        over: body.length - REPLY_MAX,
      },
      { status: 413 },
    );
  }

  const recent = await db.reply.count({ where: { authorId: user.id, createdAt: { gt: new Date(Date.now() - 600_000) } } });
  if (recent >= 10) return NextResponse.json({ error: "Slow down a moment — you've replied a lot in the last ten minutes." }, { status: 429 });

  // An expert may point at their own Agent — and only their own.
  let agentId: string | null = null;
  if (b.agentSlug) {
    const a = await db.agent.findUnique({ where: { slug: String(b.agentSlug) } });
    if (a && a.creatorId === user.id && a.status === "published") agentId = a.id;
    else if (a) return NextResponse.json({ error: "You can only link an Agent you own." }, { status: 403 });
  }

  const refusal = await guardText(user.id, body, "reply", post.agentId);
  if (refusal) return NextResponse.json({ error: refusal, code: "extraction" }, { status: 422 });

  let parentId: string | null = null;
  if (b.parentId) {
    const parent = await db.reply.findUnique({ where: { id: String(b.parentId) } });
    if (parent && parent.postId === post.id) parentId = parent.parentId ? parent.parentId : parent.id; // one level only
  }

  const reply = await db.$transaction(async (tx) => {
    const r = await tx.reply.create({ data: { postId: post.id, authorId: user.id, body, parentId, agentId } });
    await tx.post.update({ where: { id: post.id }, data: { replyCount: { increment: 1 }, lastActivityAt: new Date() } });
    return r;
  });

  if (post.authorId !== user.id) {
    await notify(post.authorId, "reply", `New reply: ${post.title}`, body.slice(0, 120), `/community/${post.slug}`).catch(() => {});
  }
  return NextResponse.json({ ok: true, id: reply.id });
}

/** Edit or remove your own reply. */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const b = await readJson(req);
  if (!b) return badRequest();
  const r = await db.reply.findUnique({ where: { id: String(b.id || "") } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.authorId !== user.id && user.role !== "admin") return NextResponse.json({ error: "Not your reply." }, { status: 403 });

  if (b.action === "remove") {
    if (r.status === "removed") return NextResponse.json({ ok: true, removed: true }); // idempotent — never double-decrement
    const post = await db.post.findUnique({ where: { id: r.postId }, select: { acceptedReplyId: true } });
    const wasAccepted = post?.acceptedReplyId === r.id;
    await db.$transaction(async (tx) => {
      await tx.reply.update({ where: { id: r.id }, data: { status: "removed", accepted: false } });
      await tx.post.update({
        where: { id: r.postId },
        data: {
          replyCount: { decrement: 1 },
          // If the accepted answer is withdrawn, the question is open again.
          ...(wasAccepted ? { acceptedReplyId: null, answeredById: null } : {}),
        },
      });
    });
    return NextResponse.json({ ok: true, removed: true });
  }

  const body = String(b.body || "").trim();
  if (body.length < 2 || body.length > REPLY_MAX) return NextResponse.json({ error: `Replies are capped at ${REPLY_MAX} characters.` }, { status: 400 });
  const refusal = await guardText(user.id, body, "reply-edit", null);
  if (refusal) return NextResponse.json({ error: refusal, code: "extraction" }, { status: 422 });
  await db.reply.update({ where: { id: r.id }, data: { body } });
  return NextResponse.json({ ok: true });
}
