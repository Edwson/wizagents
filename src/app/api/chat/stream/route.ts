import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateAgentReply, type AgentContext, type ChatTurn } from "@/lib/agent-engine";
import { typeFraming } from "@/lib/agent-types";
import { parseFeatures } from "@/lib/format";
import { meter, logUsage } from "@/lib/usage";
import { subscriptionAccess, lapseIfExpired, logSecurity } from "@/lib/access";
import { entitlementFor, auditSeatUse } from "@/lib/entitlement";
import { detectExtraction, refusalMessage, sanitizeOutput, watermark } from "@/lib/antidistill";
import { shouldAbstain } from "@/lib/abstain";
import { buildProvenance, provenanceLabels } from "@/lib/provenance";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";
function sse(obj: any) { return `data: ${JSON.stringify(obj)}\n\n`; }
const STRIKE_LIMIT = 5;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const enc = new TextEncoder();
  const fail = (msg: string, status: number, extra: any = {}) =>
    new Response(sse({ error: msg, ...extra }), { status, headers: { "Content-Type": "text/event-stream" } });

  if (!user) return fail("Please sign in", 401);
  const { slug, message, mode } = await req.json();
  if (!message?.trim()) return fail("Enter a message", 400);
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return fail("Agent not found", 404);

  const isTrial = mode === "trial";
  let subId: string | null = null;
  if (!isTrial) {
    // Entitlement: your own subscription, or an active enterprise seat on your org's.
    const ent = await entitlementFor(user.id, agent.id);
    if (!ent.ok) {
      if (ent.reason === "flagged") { await logSecurity(agent.id, user.id, null, "token_flagged", "blocked access"); return fail("This subscription is suspended for suspicious activity. Contact support.", 403, { flagged: true }); }
      if (ent.reason === "blacklisted") return fail("Your organization has blocked this Agent.", 403, { blacklisted: true });
      if (ent.reason === "expired") { await logSecurity(agent.id, user.id, null, "expired_access", "access after lapse"); return fail("Your subscription has ended — access to this Agent is closed. Renew to continue.", 403, { needSub: true, expired: true }); }
      return fail("An active subscription is required to continue.", 403, { needSub: true });
    }
    subId = ent.sub.id;
    const m = await meter(ent.sub.id, user.id, agent.id, "chat");
    if (!m.allowed) return fail(`Daily usage limit reached (${m.limit}/day). Try again tomorrow.`, 429, { rateLimited: true });
    if (ent.viaSeat) await auditSeatUse(ent.orgOwnerId, user.email, agent.id, agent.name, "query", message);
  }

  let convo = await db.conversation.findFirst({ where: { userId: user.id, agentId: agent.id, isTrial }, orderBy: { createdAt: "desc" } });
  if (!convo) convo = await db.conversation.create({ data: { userId: user.id, agentId: agent.id, isTrial } });
  if (isTrial) {
    const used = await db.message.count({ where: { conversationId: convo.id, role: "user" } });
    if (used >= agent.trialLimit) return fail("Free trial used up — subscribe to keep chatting.", 402, { trialExhausted: true });
    await logUsage(user.id, agent.id, "trial");
  }

  // ── Anti-distillation: refuse extraction attempts, log + strike ──
  const ext = detectExtraction(message);
  if (ext.hit) {
    await logSecurity(agent.id, user.id, subId, "extraction_attempt", ext.reason);
    if (subId) {
      const updated = await db.subscription.update({ where: { id: subId }, data: { extractionStrikes: { increment: 1 } } });
      if (updated.extractionStrikes >= STRIKE_LIMIT) { await db.subscription.update({ where: { id: subId }, data: { flagged: true } }); await logSecurity(agent.id, user.id, subId, "token_flagged", "strike limit reached"); }
    }
    const refusal = refusalMessage(agent.creatorName);
    await db.message.create({ data: { conversationId: convo.id, role: "user", content: message } });
    await db.message.create({ data: { conversationId: convo.id, role: "assistant", content: refusal } });
    const s = new ReadableStream({ start(c) { const step = 3; (async () => { for (let i = 0; i < refusal.length; i += step) { c.enqueue(enc.encode(sse({ delta: refusal.slice(i, i + step) }))); await new Promise(r => setTimeout(r, 10)); } c.enqueue(enc.encode(sse({ done: true, refused: true }))); c.close(); })(); } });
    return new Response(s, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }

  const history = await db.message.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: "asc" } });
  const feats = parseFeatures(agent.features);
  const ctx: AgentContext = { name: agent.name, category: agent.category, creatorName: agent.creatorName, description: agent.description, systemPrompt: (agent.systemPrompt || "") + "\n" + typeFraming(agent.agentType), knowledgeSummary: agent.knowledgeSummary, features: feats, lang: (agent.lang as any) || "en", regulated: (agent as any).regulated ?? false };
  const kv = await db.knowledgeVersion.findFirst({ where: { agentId: agent.id }, orderBy: { createdAt: "desc" } });
  const abstained = shouldAbstain({ name: agent.name, category: agent.category, features: feats, description: agent.description, regulated: (agent as any).regulated ?? false }, message).abstain;
  const turns: ChatTurn[] = history.map((m) => ({ role: m.role as any, content: m.content }));
  await db.message.create({ data: { conversationId: convo.id, role: "user", content: message } });
  let reply = await generateAgentReply(ctx, turns, message);
  reply = sanitizeOutput(reply, agent.systemPrompt);           // never leak internals
  if (subId) reply = watermark(reply, subId);                  // trace leaks to the subscriber
  await db.message.create({ data: { conversationId: convo.id, role: "assistant", content: reply } });

  let remaining: number | null = null;
  if (isTrial) { const used = await db.message.count({ where: { conversationId: convo.id, role: "user" } }); remaining = Math.max(0, agent.trialLimit - used); }

  const locale = await getLocale();
  const prov = buildProvenance({ creatorName: agent.creatorName, category: agent.category, fidelityScore: (agent as any).fidelityScore ?? 0, regulated: (agent as any).regulated ?? false, knowledgeVersions: kv ? [{ version: kv.version, createdAt: kv.createdAt, scanStatus: kv.scanStatus }] : [] }, abstained ? "abstained" : "grounded");
  const receipt = provenanceLabels(prov, locale);

  const stream = new ReadableStream({ async start(controller) {
    const step = 3;
    for (let i = 0; i < reply.length; i += step) { controller.enqueue(enc.encode(sse({ delta: reply.slice(i, i + step) }))); await new Promise((r) => setTimeout(r, 12)); }
    controller.enqueue(enc.encode(sse({ done: true, remaining, provenance: receipt })));
    controller.close();
  } });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
