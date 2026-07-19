import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateAgentReply, type AgentContext, type ChatTurn } from "@/lib/agent-engine";
import { typeFraming } from "@/lib/agent-types";
import { parseFeatures } from "@/lib/format";
import { meter, logUsage } from "@/lib/usage";
import { logSecurity } from "@/lib/access";
import { entitlementFor, auditSeatUse } from "@/lib/entitlement";
import { detectExtraction, refusalMessage, sanitizeOutput, watermark } from "@/lib/antidistill";

export const dynamic = "force-dynamic";
const STRIKE_LIMIT = 5;

/**
 * Non-streaming chat.
 *
 * This must carry EXACTLY the same shield as /api/chat/stream — entitlement, extraction
 * detection + strikes, metering, output sanitising and watermarking. A second door into an
 * Agent that skips any of those is a hole in the wall, so there are no shortcuts here.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to try or chat" }, { status: 401 });
  const { slug, message, mode } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Enter a message" }, { status: 400 });

  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const isTrial = mode === "trial";
  let subId: string | null = null;
  if (!isTrial) {
    const ent = await entitlementFor(user.id, agent.id);
    if (!ent.ok) {
      if (ent.reason === "flagged") { await logSecurity(agent.id, user.id, null, "token_flagged", "blocked access"); return NextResponse.json({ error: "This subscription is suspended for suspicious activity.", flagged: true }, { status: 403 }); }
      if (ent.reason === "blacklisted") return NextResponse.json({ error: "Your organization has blocked this Agent.", blacklisted: true }, { status: 403 });
      if (ent.reason === "expired") { await logSecurity(agent.id, user.id, null, "expired_access", "access after lapse"); return NextResponse.json({ error: "Your subscription has ended — access is closed. Renew to continue.", needSub: true, expired: true }, { status: 403 }); }
      return NextResponse.json({ error: "An active subscription is required to continue.", needSub: true }, { status: 403 });
    }
    subId = ent.sub.id;
    const m = await meter(ent.sub.id, user.id, agent.id, "chat");
    if (!m.allowed) return NextResponse.json({ error: `Daily usage limit reached (${m.limit}/day). Try again tomorrow.`, rateLimited: true }, { status: 429 });
    if (ent.viaSeat) await auditSeatUse(ent.orgOwnerId, user.email, agent.id, agent.name, "query", message);
  }

  let convo = await db.conversation.findFirst({ where: { userId: user.id, agentId: agent.id, isTrial }, orderBy: { createdAt: "desc" } });
  if (!convo) convo = await db.conversation.create({ data: { userId: user.id, agentId: agent.id, isTrial } });

  if (isTrial) {
    const used = await db.message.count({ where: { conversationId: convo.id, role: "user" } });
    if (used >= agent.trialLimit) return NextResponse.json({ trialExhausted: true, used, limit: agent.trialLimit, error: "Free trials used up — subscribe to continue" }, { status: 402 });
    await logUsage(user.id, agent.id, "trial");
  }

  // Anti-distillation: refuse extraction attempts, log + strike (trial included — a free
  // trial is still a door to the creator's material).
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
    return NextResponse.json({ ok: true, reply: refusal, refused: true, conversationId: convo.id });
  }

  const history = await db.message.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: "asc" } });
  const ctx: AgentContext = {
    name: agent.name, category: agent.category, creatorName: agent.creatorName, description: agent.description,
    systemPrompt: (agent.systemPrompt || "") + "\n" + typeFraming(agent.agentType),
    knowledgeSummary: agent.knowledgeSummary, features: parseFeatures(agent.features),
    lang: (agent.lang as any) || "en", regulated: (agent as any).regulated ?? false,
  };
  const turns: ChatTurn[] = history.map((m) => ({ role: m.role as any, content: m.content }));

  await db.message.create({ data: { conversationId: convo.id, role: "user", content: message } });
  let reply = await generateAgentReply(ctx, turns, message);
  reply = sanitizeOutput(reply, agent.systemPrompt);      // never leak internals
  if (subId) reply = watermark(reply, subId);             // trace leaks to the subscriber
  await db.message.create({ data: { conversationId: convo.id, role: "assistant", content: reply } });

  let remaining: number | null = null;
  if (isTrial) { const used = await db.message.count({ where: { conversationId: convo.id, role: "user" } }); remaining = Math.max(0, agent.trialLimit - used); }
  return NextResponse.json({ ok: true, reply, conversationId: convo.id, remaining });
}
