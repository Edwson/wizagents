import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyAgentSubscribers } from "@/lib/notify";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const agent = await db.agent.findUnique({ where: { slug }, include: { knowledgeVersions: true } });
  if (!agent || agent.creatorId !== user.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await req.json();
  const n = agent.knowledgeVersions.length + 1;
  const kv = await db.knowledgeVersion.create({ data: { agentId: agent.id, version: `v${n}.0`, note: b.note || "推送知識庫更新", docCount: Number(b.docCount) || 0 } });
  await db.agent.update({ where: { id: agent.id }, data: { updatedLabel: "剛剛更新" } });
  await notifyAgentSubscribers(agent.id, "knowledge_update", `${agent.name} 知識庫已更新`, b.note || `已更新至 ${kv.version}，你的 Agent 即時生效。`, `/agent/${agent.slug}`);
  return NextResponse.json({ ok: true, version: kv.version });
}
