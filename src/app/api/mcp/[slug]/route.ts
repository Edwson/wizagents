import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateAgentReply, type AgentContext } from "@/lib/agent-engine";
import { typeFraming } from "@/lib/agent-types";
import { shouldAbstain } from "@/lib/abstain";
import { buildProvenance, provenanceText } from "@/lib/provenance";
import { discountedPrice } from "@/lib/loyalty";
import { resolveApiToken } from "@/lib/org";
import { auditSeatUse } from "@/lib/entitlement";
import { parseFeatures } from "@/lib/format";
import { meter } from "@/lib/usage";
import { subscriptionAccess, lapseIfExpired, logSecurity } from "@/lib/access";
import { detectExtraction, refusalMessage, sanitizeOutput, watermark } from "@/lib/antidistill";

const STRIKE_LIMIT = 5;
function bearer(req: Request): string | null { const h = req.headers.get("authorization") || ""; const m = h.match(/^Bearer\s+(.+)$/i); return m ? m[1].trim() : null; }
async function authAgent(slug: string, token: string | null) {
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return { error: "agent_not_found" as const };
  if (!token) return { agent, error: "missing_token" as const };
  // Personal subscription token OR a per-seat enterprise key.
  const r = await resolveApiToken(token, agent.id);
  if (!r.ok) return { agent, error: "invalid_token" as const };
  return { agent, sub: r.sub, actorId: r.actorId, seat: r.seat };
}
function jrpc(id: any, result: any) { return { jsonrpc: "2.0", id, result }; }
function jrpcErr(code: number, message: string, id: any = null) { return { jsonrpc: "2.0", id, error: { code, message } }; }

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = await db.agent.findUnique({ where: { slug }, include: { knowledgeVersions: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  return NextResponse.json({
    protocol: "mcp", protocolVersion: "2024-11-05",
    server: { name: agent.name, vendor: "WizAgents", version: "1.0.0", creator: agent.creatorName },
    endpoint: `https://mcp.wiz-agents.com/a/${agent.slug}`, auth: "Bearer <your-subscription-token>",
    tools: [
      { name: "ask_expert", description: `Consult ${agent.name}: ${agent.description}`, inputSchema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] } },
      { name: "escalate_to_human", description: "Escalate a high-stakes question to the human expert (SLA reply, optional signed answer)", inputSchema: { type: "object", properties: { question: { type: "string" }, tier: { type: "string", enum: ["standard", "urgent"] } } } },
    ],
    resources: [{ uri: `wizagents://${agent.slug}/knowledge`, name: "Knowledge base versions", description: agent.knowledgeSummary }],
    notice: "System prompt and knowledge base stay on the server and are never returned. Access ends when the subscription lapses.",
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const token = bearer(req);
  const auth = await authAgent(slug, token);
  if ("error" in auth && auth.error === "agent_not_found") return NextResponse.json(jrpcErr(-32601, "agent not found"), { status: 404 });

  let body: any = {}; try { body = await req.json(); } catch {}
  const { id = null, method, params: p = {} } = body;

  if (method === "initialize") return NextResponse.json(jrpc(id, { protocolVersion: "2024-11-05", serverInfo: { name: auth.agent!.name, version: "1.0.0" }, capabilities: { tools: {}, resources: {} } }));
  if (method === "tools/list") return NextResponse.json(jrpc(id, { tools: [
    { name: "ask_expert", description: `Consult ${auth.agent!.name}`, inputSchema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] } },
    { name: "escalate_to_human", description: "Escalate to the human expert", inputSchema: { type: "object", properties: { question: { type: "string" }, tier: { type: "string" } } } },
  ] }));
  if (method === "resources/list") {
    const kvs = await db.knowledgeVersion.findMany({ where: { agentId: auth.agent!.id }, orderBy: { createdAt: "desc" }, take: 10 });
    return NextResponse.json(jrpc(id, { resources: kvs.map((k) => ({ uri: `wizagents://${slug}/knowledge/${k.version}`, name: `${k.version} · ${k.note}`, mimeType: "text/plain", description: `${k.docCount} documents` })) }));
  }

  if (method === "tools/call") {
    if ("error" in auth && (auth.error === "missing_token" || auth.error === "invalid_token"))
      return NextResponse.json(jrpcErr(-32001, "unauthorized: valid subscription token required", id), { status: 401 });
    const agent = auth.agent!; const sub = auth.sub!;

    // sever on lapse / flag
    const access = subscriptionAccess(sub as any);
    if (access === "flagged") { await logSecurity(agent.id, sub.userId, sub.id, "token_flagged", "mcp blocked"); return NextResponse.json(jrpcErr(-32003, "subscription suspended", id), { status: 403 }); }
    if (access !== "active") { await lapseIfExpired(sub as any); await logSecurity(agent.id, sub.userId, sub.id, "expired_access", "mcp after lapse"); return NextResponse.json(jrpcErr(-32002, "subscription ended — access closed. Renew to continue.", id), { status: 403 }); }

    const name = p.name; const args = p.arguments || {};
    if (name === "escalate_to_human") {
      // Reuse any still-open case (no double charge), and bill exactly like the web app.
      const open = await db.escalation.findFirst({ where: { userId: sub.userId, agentId: agent.id, status: { in: ["queued", "in_progress"] } }, orderBy: { createdAt: "desc" } });
      if (open) return NextResponse.json(jrpc(id, { content: [{ type: "text", text: `You already have an open case with ${agent.creatorName} (${open.id.slice(0, 8)}). It will be answered within SLA.` }] }));

      const listPrice = args.tier === "urgent" ? Math.round(agent.escalationPrice * 1.8) : agent.escalationPrice;
      const { price: afterLoyalty } = discountedPrice(listPrice, sub.startedAt);
      const creditsApplied = Math.min(sub.credits, afterLoyalty);
      const price = Math.max(0, afterLoyalty - creditsApplied);
      const hours = args.tier === "urgent" ? 4 : 48;
      const esc = await db.$transaction(async (tx) => {
        const e = await tx.escalation.create({ data: { agentId: agent.id, userId: sub.userId, expertUserId: agent.creatorId, status: "queued", tier: args.tier || "standard", price, question: args.question || "", slaDueAt: new Date(Date.now() + hours * 3600 * 1000) } });
        await tx.transaction.create({ data: { userId: sub.userId, type: "escalation", amount: price, agentId: agent.id, note: `Human escalation via MCP · ${args.tier === "urgent" ? "urgent" : "standard"}` } });
        if (creditsApplied > 0) await tx.subscription.update({ where: { id: sub.id }, data: { credits: { decrement: creditsApplied } } });
        return e;
      });
      return NextResponse.json(jrpc(id, { content: [{ type: "text", text: `Escalated to ${agent.creatorName} (case ${esc.id.slice(0, 8)}). A named human replies within ${hours}h. Fee $${price}${creditsApplied ? ` (${creditsApplied} loyalty credits applied)` : ""}.` }] }));
    }

    // anti-distillation on the MCP path too
    const ext = detectExtraction(args.question || "");
    if (ext.hit) {
      await logSecurity(agent.id, sub.userId, sub.id, "extraction_attempt", `mcp:${ext.reason}`);
      const updated = await db.subscription.update({ where: { id: sub.id }, data: { extractionStrikes: { increment: 1 } } });
      if (updated.extractionStrikes >= STRIKE_LIMIT) { await db.subscription.update({ where: { id: sub.id }, data: { flagged: true } }); await logSecurity(agent.id, sub.userId, sub.id, "token_flagged", "strike limit (mcp)"); }
      return NextResponse.json(jrpc(id, { content: [{ type: "text", text: refusalMessage(agent.creatorName) }], _meta: { refused: true } }));
    }

    const actorId = (auth as any).actorId || sub.userId;
    const seat = (auth as any).seat;
    const m = await meter(sub.id, actorId, agent.id, "mcp");
    if (seat) await auditSeatUse(seat.orgOwnerId, seat.email, agent.id, agent.name, "mcp", args?.question || "");
    if (!m.allowed) return NextResponse.json(jrpcErr(-32029, `rate limit exceeded: ${m.limit}/day`, id), { status: 429 });

    const feats = parseFeatures(agent.features);
    const ctx: AgentContext = { name: agent.name, category: agent.category, creatorName: agent.creatorName, description: agent.description, systemPrompt: (agent.systemPrompt || "") + "\n" + typeFraming(agent.agentType), knowledgeSummary: agent.knowledgeSummary, features: feats, lang: (agent.lang as any) || "en", regulated: (agent as any).regulated ?? false };
    const kv = await db.knowledgeVersion.findFirst({ where: { agentId: agent.id }, orderBy: { createdAt: "desc" } });
    const abstained = shouldAbstain({ name: agent.name, category: agent.category, features: feats, description: agent.description, regulated: (agent as any).regulated ?? false }, args.question || "").abstain;
    let reply = await generateAgentReply(ctx, [], args.question || "");
    reply = watermark(sanitizeOutput(reply, agent.systemPrompt), sub.id);
    const prov = buildProvenance({ creatorName: agent.creatorName, category: agent.category, fidelityScore: (agent as any).fidelityScore ?? 0, regulated: (agent as any).regulated ?? false, knowledgeVersions: kv ? [{ version: kv.version, createdAt: kv.createdAt, scanStatus: kv.scanStatus }] : [] }, abstained ? "abstained" : "grounded");
    reply = reply + "\n\n" + provenanceText(prov, ((agent.lang as any) || "en"));
    let convo = await db.conversation.findFirst({ where: { userId: sub.userId, agentId: agent.id, isTrial: false } });
    if (!convo) convo = await db.conversation.create({ data: { userId: sub.userId, agentId: agent.id } });
    await db.message.create({ data: { conversationId: convo.id, role: "user", content: args.question || "" } });
    await db.message.create({ data: { conversationId: convo.id, role: "assistant", content: reply } });
    return NextResponse.json(jrpc(id, { content: [{ type: "text", text: reply }], _meta: { remaining: m.remaining, limit: m.limit } }));
  }
  return NextResponse.json(jrpcErr(-32601, "method not found", id), { status: 400 });
}
