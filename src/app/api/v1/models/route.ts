import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// OpenAI-compatible model list: the Agents this key is entitled to.
export async function GET(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return NextResponse.json({ error: { message: "Missing API key", code: "missing_api_key" } }, { status: 401 });
  const sub = await db.subscription.findFirst({ where: { mcpToken: m[1].trim() }, include: { agent: true } });
  if (!sub) return NextResponse.json({ error: { message: "Invalid API key", code: "invalid_api_key" } }, { status: 401 });
  return NextResponse.json({
    object: "list",
    data: [{
      id: `wizagents/${sub.agent.slug}`,
      object: "model",
      created: Math.floor(sub.startedAt.getTime() / 1000),
      owned_by: sub.agent.creatorName,
    }],
  });
}
