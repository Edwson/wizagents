import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, randomToken } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";

// Rotate the per-subscription MCP token (revokes the old one instantly).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();
  const agent = await db.agent.findUnique({ where: { slug: body.slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const sub = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
  if (!sub || sub.status !== "active") return NextResponse.json({ error: "No active subscription" }, { status: 403 });
  const token = randomToken();
  await db.subscription.update({ where: { id: sub.id }, data: { mcpToken: token } });
  return NextResponse.json({ ok: true, token });
}
