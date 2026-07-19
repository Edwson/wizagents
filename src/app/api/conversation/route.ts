import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ messages: [] });
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ messages: [] });
  const convo = await db.conversation.findFirst({ where: { userId: user.id, agentId: agent.id, isTrial: false }, orderBy: { createdAt: "desc" } });
  if (!convo) return NextResponse.json({ messages: [] });
  const messages = await db.message.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: "asc" }, take: 50 });
  return NextResponse.json({ messages: messages.map((m) => ({ role: m.role, content: m.content })) });
}
