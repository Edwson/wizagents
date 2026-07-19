import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const agents = await db.agent.findMany({ select: { id: true } });
  let updated = 0;
  for (const a of agents) {
    const [subs, agg] = await Promise.all([
      db.subscription.count({ where: { agentId: a.id, status: "active" } }),
      db.review.aggregate({ where: { agentId: a.id }, _avg: { rating: true } }),
    ]);
    await db.agent.update({ where: { id: a.id }, data: { subscribers: subs, ...(agg._avg.rating ? { rating: Math.round(agg._avg.rating * 10) / 10 } : {}) } });
    updated++;
  }
  return NextResponse.json({ ok: true, updated });
}
