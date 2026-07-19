import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const { slug } = await req.json();
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const sub = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
  if (sub && sub.status === "active") {
    await db.subscription.update({ where: { id: sub.id }, data: { status: "canceled", canceledAt: new Date() } });
    await db.agent.update({ where: { id: agent.id }, data: { subscribers: { decrement: 1 } } });
  }
  return NextResponse.json({ ok: true });
}
