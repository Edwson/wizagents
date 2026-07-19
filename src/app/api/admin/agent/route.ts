import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { notify } from "@/lib/notify";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id, action } = await req.json();
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const status = action === "suspend" ? "suspended" : action === "publish" ? "published" : agent.status;
  await db.agent.update({ where: { id }, data: { status } });
  await notify(agent.creatorId, "welcome", `你的 Agent 已${status === "suspended" ? "被平台下架" : "重新上架"}`, agent.name, `/studio/agent/${agent.slug}`);
  return NextResponse.json({ ok: true, status });
}
