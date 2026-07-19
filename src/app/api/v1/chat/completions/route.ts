import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateAgentReply, type AgentContext, type ChatTurn } from "@/lib/agent-engine";
import { typeFraming } from "@/lib/agent-types";
import { parseFeatures } from "@/lib/format";
import { meter } from "@/lib/usage";
import { subscriptionAccess, lapseIfExpired, logSecurity } from "@/lib/access";
import { detectExtraction, refusalMessage, sanitizeOutput, watermark } from "@/lib/antidistill";
import { shouldAbstain } from "@/lib/abstain";
import { buildProvenance, provenanceText } from "@/lib/provenance";
import { resolveApiToken } from "@/lib/org";
import { auditSeatUse } from "@/lib/entitlement";

export const dynamic = "force-dynamic";
const STRIKE_LIMIT = 5;

/**
 * OpenAI-compatible Chat Completions.
 *
 * Any tool that speaks the OpenAI API — Ollama front-ends (Open WebUI), LangChain,
 * LlamaIndex, Hermes-style agent frameworks, OpenClaw, Continue, the OpenAI SDKs —
 * connects with only:
 *     base_url = https://wiz-agents.com/api/v1
 *     api_key  = <your subscription token>
 *     model    = wizagents/<agent-slug>
 *
 * CREATOR PROTECTION (why this is safe to expose):
 *  - The expert's system prompt and knowledge base NEVER leave this server. The agent
 *    is executed here; the caller only ever receives the finished answer.
 *  - Client-supplied `system` (and `developer`) messages are DROPPED. A caller cannot
 *    override, replace, or interrogate the expert's stance from their own tool.
 *  - Every call runs the same shield as the web app: subscription/expiry check,
 *    extraction detection, output sanitization, watermarking, metering, audit events.
 */
function key(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
function err(message: string, status: number, code: string) {
  return NextResponse.json({ error: { message, type: "invalid_request_error", code } }, { status });
}
function modelToSlug(model: string) {
  return String(model || "").replace(/^wizagents\//i, "").trim();
}

export async function POST(req: Request) {
  const token = key(req);
  if (!token) return err("Missing API key. Use your WizAgents subscription token as the api_key.", 401, "missing_api_key");

  let body: any = {};
  try { body = await req.json(); } catch { return err("Invalid JSON body", 400, "invalid_body"); }

  const slug = modelToSlug(body.model);
  if (!slug) return err("Specify a model, e.g. wizagents/<agent-slug>", 400, "missing_model");

  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return err(`Unknown model "${body.model}"`, 404, "model_not_found");

  const resolved = await resolveApiToken(token, agent.id);
  if (!resolved.ok) {
    const msg = resolved.reason === "revoked" ? "This key was revoked."
      : resolved.reason === "seat_inactive" ? "Your organization seat is not active."
      : resolved.reason === "governance" ? "Your organization has blocked this Agent."
      : "This key is not authorized for that model.";
    return err(msg, 401, "invalid_api_key");
  }
  const sub = resolved.sub;
  const actorId = resolved.actorId;
  const seat = resolved.seat;

  // --- the shield: expiry / suspension severs access ---
  const access = subscriptionAccess(sub as any);
  if (access === "flagged") {
    await logSecurity(agent.id, sub.userId, sub.id, "token_flagged", "openai-api blocked");
    return err("This subscription is suspended for suspicious activity.", 403, "subscription_suspended");
  }
  if (access !== "active") {
    await lapseIfExpired(sub as any);
    await logSecurity(agent.id, sub.userId, sub.id, "expired_access", "openai-api after lapse");
    return err("Your subscription has ended — access is closed. Renew to continue.", 403, "subscription_ended");
  }

  const m = await meter(sub.id, actorId, agent.id, "api");
  if (!m.allowed) return err(`Daily limit reached (${m.limit}/day).`, 429, "rate_limit_exceeded");

  // --- messages: DROP any client system/developer prompt. The expert's stance is not overridable. ---
  const raw: any[] = Array.isArray(body.messages) ? body.messages : [];
  const dropped = raw.filter((x) => x?.role === "system" || x?.role === "developer").length;
  const convo = raw.filter((x) => x?.role === "user" || x?.role === "assistant");
  const last = [...convo].reverse().find((x) => x.role === "user");
  const question = typeof last?.content === "string" ? last.content : Array.isArray(last?.content) ? last.content.map((c: any) => c?.text || "").join(" ") : "";
  if (!question.trim()) return err("No user message provided.", 400, "no_user_message");
  // Enterprise attribution: the org sees which person used which Agent.
  if (seat) await auditSeatUse(seat.orgOwnerId, seat.email, agent.id, agent.name, "api", question);

  // --- anti-distillation ---
  const ext = detectExtraction(question);
  if (ext.hit) {
    await logSecurity(agent.id, sub.userId, sub.id, "extraction_attempt", `openai-api:${ext.reason}`);
    const updated = await db.subscription.update({ where: { id: sub.id }, data: { extractionStrikes: { increment: 1 } } });
    if (updated.extractionStrikes >= STRIKE_LIMIT) {
      await db.subscription.update({ where: { id: sub.id }, data: { flagged: true } });
      await logSecurity(agent.id, sub.userId, sub.id, "token_flagged", "strike limit (openai-api)");
    }
    return complete(refusalMessage(agent.creatorName), agent.slug, body.stream, { refused: true, dropped });
  }

  const feats = parseFeatures(agent.features);
  const ctx: AgentContext = {
    name: agent.name, category: agent.category, creatorName: agent.creatorName, description: agent.description,
    systemPrompt: (agent.systemPrompt || "") + "\n" + typeFraming(agent.agentType),
    knowledgeSummary: agent.knowledgeSummary, features: feats,
    lang: (agent.lang as any) || "en", regulated: (agent as any).regulated ?? false,
  };
  const history: ChatTurn[] = convo.slice(-8).map((x) => ({ role: x.role === "assistant" ? "assistant" : "user", content: String(x.content ?? "") }));
  const abstained = shouldAbstain({ name: agent.name, category: agent.category, features: feats, description: agent.description, regulated: (agent as any).regulated ?? false }, question).abstain;

  let reply = await generateAgentReply(ctx, history, question);
  reply = sanitizeOutput(reply, agent.systemPrompt);   // never leak internals
  reply = watermark(reply, sub.id);                    // trace any leak back to this subscriber

  // provenance travels with the answer, even outside the web app
  const kv = await db.knowledgeVersion.findFirst({ where: { agentId: agent.id }, orderBy: { createdAt: "desc" } });
  const prov = buildProvenance({
    creatorName: agent.creatorName, category: agent.category,
    fidelityScore: (agent as any).fidelityScore ?? 0, regulated: (agent as any).regulated ?? false,
    knowledgeVersions: kv ? [{ version: kv.version, createdAt: kv.createdAt, scanStatus: kv.scanStatus }] : [],
  }, abstained ? "abstained" : "grounded");
  reply = reply + "\n\n" + provenanceText(prov, (agent.lang as any) || "en");

  // persist to the buyer's conversation so the web app and their tool share one history
  let convoRow = await db.conversation.findFirst({ where: { userId: sub.userId, agentId: agent.id, isTrial: false } });
  if (!convoRow) convoRow = await db.conversation.create({ data: { userId: sub.userId, agentId: agent.id } });
  await db.message.create({ data: { conversationId: convoRow.id, role: "user", content: question } });
  await db.message.create({ data: { conversationId: convoRow.id, role: "assistant", content: reply } });

  return complete(reply, agent.slug, body.stream, { dropped, remaining: m.remaining, limit: m.limit });
}

/** Return an OpenAI-shaped completion, streaming as SSE when requested. */
function complete(text: string, slug: string, stream: boolean | undefined, meta: any) {
  const id = "chatcmpl-" + Math.random().toString(36).slice(2, 12);
  const created = Math.floor(Date.now() / 1000);
  const model = `wizagents/${slug}`;

  if (!stream) {
    return NextResponse.json({
      id, object: "chat.completion", created, model,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      _wizagents: meta,
    });
  }

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(c) {
      c.enqueue(enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] })}\n\n`));
      const step = 24;
      for (let i = 0; i < text.length; i += step) {
        const chunk = { id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { content: text.slice(i, i + step) }, finish_reason: null }] };
        c.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        await new Promise((r) => setTimeout(r, 8));
      }
      c.enqueue(enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`));
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
