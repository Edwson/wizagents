import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

/** One vote per person per thing. Voting again with the same value clears it. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const rl = rateLimit("vote:" + user.id, 60, 60_000);   // 60 votes/min per account
  if (!rl.ok) return NextResponse.json({ error: "You're voting very fast. Slow down a moment." }, { status: 429 });
  const b = await readJson(req);
  if (!b) return badRequest();
  const value = b.value > 0 ? 1 : -1;
  const postId = b.postId ? String(b.postId) : null;
  const replyId = b.replyId ? String(b.replyId) : null;
  if (!postId && !replyId) return badRequest();

  const target = postId
    ? await db.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } })
    : await db.reply.findUnique({ where: { id: replyId! }, select: { id: true, authorId: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // You cannot vote your own work up. A reputation you can inflate is worth nothing.
  if (target.authorId === user.id) return NextResponse.json({ error: "You can't vote on your own post." }, { status: 400 });

  const existing = await db.vote.findFirst({ where: { userId: user.id, postId, replyId } });
  let delta = 0;
  let mine = 0;

  if (existing && existing.value === value) {
    await db.vote.delete({ where: { id: existing.id } });
    delta = -value;
    mine = 0;
  } else if (existing) {
    await db.vote.update({ where: { id: existing.id }, data: { value } });
    delta = value * 2;
    mine = value;
  } else {
    await db.vote.create({ data: { userId: user.id, postId, replyId, value } });
    delta = value;
    mine = value;
  }

  const updated = postId
    ? await db.post.update({ where: { id: postId }, data: { score: { increment: delta } }, select: { score: true } })
    : await db.reply.update({ where: { id: replyId! }, data: { score: { increment: delta } }, select: { score: true } });

  return NextResponse.json({ ok: true, score: updated.score, myVote: mine });
}
