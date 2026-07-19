import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getConfig } from "@/lib/config";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const cfg = await getConfig();
  const existing = await db.pass.findUnique({ where: { userId: user.id } });

  if (existing?.active) {
    // Cancelling the Pass lapses all Pass-covered (free) subscriptions.
    await db.pass.update({ where: { userId: user.id }, data: { active: false } });
    const lapsed = await db.subscription.findMany({ where: { userId: user.id, status: "active", viaPass: true } });
    for (const s of lapsed) {
      await db.subscription.update({ where: { id: s.id }, data: { status: "canceled", canceledAt: new Date() } });
      await db.agent.update({ where: { id: s.agentId }, data: { subscribers: { decrement: 1 } } });
    }
    return NextResponse.json({ ok: true, active: false, lapsed: lapsed.length });
  }

  // Activate / re-activate.
  await db.pass.upsert({ where: { userId: user.id }, update: { active: true, monthlyPrice: cfg.passPrice }, create: { userId: user.id, active: true, monthlyPrice: cfg.passPrice } });
  await db.transaction.create({ data: { userId: user.id, type: "pass", amount: cfg.passPrice, note: "Pass activated" } });
  return NextResponse.json({ ok: true, active: true });
}
