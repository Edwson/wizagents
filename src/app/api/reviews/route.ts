import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { notify } from "@/lib/notify";
import { canReview } from "@/lib/rules";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req);
  if (!body) return badRequest();
  const { slug, rating, comment } = body;
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const sub = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
  const guard = canReview(user as any, agent as any, !!sub);
  if (!guard.ok) return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status });

  const r = Math.max(1, Math.min(5, Number(rating) || 5));
  const existing = await db.review.findFirst({ where: { agentId: agent.id, userId: user.id } });
  if (existing) {
    await db.review.update({ where: { id: existing.id }, data: { rating: r, comment: comment || "", authorName: user.name } });
  } else {
    await db.review.create({ data: { agentId: agent.id, userId: user.id, authorName: user.name, rating: r, comment: comment || "" } });
    await notify(agent.creatorId, "review", `New review: ${agent.name}`, `${user.name} rated ${r}★.`, `/studio/agent/${agent.slug}`);
  }
  const agg = await db.review.aggregate({ where: { agentId: agent.id }, _avg: { rating: true } });
  await db.agent.update({ where: { id: agent.id }, data: { rating: Math.round((agg._avg.rating || r) * 10) / 10 } });
  return NextResponse.json({ ok: true });
}
