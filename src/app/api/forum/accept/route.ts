import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Accept an answer.
 *
 * Only the person who asked can accept — that is what makes the mark mean anything.
 * An accepted answer is a public, dated data point about a named expert's judgement,
 * so it feeds their reputation ledger rather than a points balance.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const b = await readJson(req);
  if (!b) return badRequest();

  const reply = await db.reply.findUnique({ where: { id: String(b.replyId || "") }, include: { post: true } });
  if (!reply || reply.status !== "published") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const post = reply.post;
  if (post.authorId !== user.id) return NextResponse.json({ error: "Only the person who asked can accept an answer." }, { status: 403 });
  if (post.kind !== "question") return NextResponse.json({ error: "Only questions have accepted answers." }, { status: 400 });
  if (reply.authorId === user.id) return NextResponse.json({ error: "You can't accept your own answer." }, { status: 400 });

  const clearing = post.acceptedReplyId === reply.id;

  await db.$transaction(async (tx) => {
    if (post.acceptedReplyId) await tx.reply.update({ where: { id: post.acceptedReplyId }, data: { accepted: false } }).catch(() => {});
    if (!clearing) await tx.reply.update({ where: { id: reply.id }, data: { accepted: true } });
    await tx.post.update({
      where: { id: post.id },
      data: { acceptedReplyId: clearing ? null : reply.id, answeredById: clearing ? null : reply.authorId },
    });
  });

  if (!clearing) {
    await notify(reply.authorId, "reply", "Your answer was accepted", `“${post.title}” — the person who asked marked your answer as the one that helped.`, `/community/${post.slug}`).catch(() => {});
  }
  return NextResponse.json({ ok: true, accepted: !clearing });
}
