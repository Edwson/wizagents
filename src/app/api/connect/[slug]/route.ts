import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ALL_TOOLS, configFor, apiBase, mcpUrl, modelId } from "@/lib/connectors";

export const dynamic = "force-dynamic";

// Everything the buyer needs to plug this expert into their own AI tools.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const sub = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
  if (!sub || sub.status !== "active") return NextResponse.json({ error: "An active subscription is required", code: "needSub" }, { status: 403 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const input = { slug: agent.slug, name: agent.name, token: sub.mcpToken, origin };

  return NextResponse.json({
    ok: true,
    agent: { slug: agent.slug, name: agent.name, creatorName: agent.creatorName },
    endpoints: { mcp: mcpUrl(input), openai: apiBase(input), model: modelId(input) },
    token: sub.mcpToken,
    configs: ALL_TOOLS.map((t) => configFor(t, input)),
    protection: "The expert's system prompt and knowledge base never leave WizAgents. Your tool calls the Agent; it does not download it. Client-supplied system prompts are ignored, every answer is watermarked to your subscription, and access ends when the subscription does.",
  });
}
