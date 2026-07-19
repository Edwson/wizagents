import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { generateAgentReply, type AgentContext } from "@/lib/agent-engine";
import { parseFeatures } from "@/lib/format";
import { typeFraming } from "@/lib/agent-types";
import { synthesize, type CouncilAnswer } from "@/lib/council";
import { getLocale } from "@/lib/locale";
import { detectExtraction, refusalMessage, sanitizeOutput, watermark } from "@/lib/antidistill";
import { subscriptionAccess, lapseIfExpired, logSecurity } from "@/lib/access";
import { entitlementFor, auditSeatUse } from "@/lib/entitlement";
import { meter } from "@/lib/usage";

export const dynamic = "force-dynamic";
const MAX_PANEL = 4;
const STRIKE_LIMIT = 5;

/**
 * Ask a panel of expert avatars the same question, then triangulate.
 *
 * A council is NOT a back door. Every agent in the panel must be one this user
 * actively subscribes to; each answer is metered, shielded against extraction,
 * sanitized and watermarked exactly like a direct conversation.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();

  const question = String(body.question || "").trim();
  if (question.length < 3) return NextResponse.json({ error: "Enter a question for the council" }, { status: 400 });
  const slugs: string[] = Array.isArray(body.slugs) ? (Array.from(new Set(body.slugs)) as string[]).slice(0, MAX_PANEL) : [];
  if (slugs.length < 2) return NextResponse.json({ error: "Pick at least two experts you subscribe to", code: "min_panel" }, { status: 400 });

  const locale = await getLocale();
  const answers: CouncilAnswer[] = [];
  const skipped: { slug: string; reason: string }[] = [];

  for (const slug of slugs) {
    const agent = await db.agent.findUnique({ where: { slug } });
    if (!agent || agent.status !== "published") { skipped.push({ slug, reason: "unavailable" }); continue; }

    // --- entitlement: your own subscription, or an active enterprise seat ---
    const ent = await entitlementFor(user.id, agent.id);
    if (!ent.ok) {
      if (ent.reason === "flagged") await logSecurity(agent.id, user.id, null, "token_flagged", "council blocked");
      skipped.push({ slug, reason: ent.reason === "blacklisted" ? "blacklisted" : ent.reason === "flagged" ? "suspended" : "not_subscribed" });
      continue;
    }
    const sub = ent.sub;
    if (ent.viaSeat) await auditSeatUse(ent.orgOwnerId, user.email, agent.id, agent.name, "council", question);

    // --- anti-distillation: the shield applies to every panel member ---
    const ext = detectExtraction(question);
    if (ext.hit) {
      await logSecurity(agent.id, user.id, sub!.id, "extraction_attempt", `council:${ext.reason}`);
      const updated = await db.subscription.update({ where: { id: sub!.id }, data: { extractionStrikes: { increment: 1 } } });
      if (updated.extractionStrikes >= STRIKE_LIMIT) {
        await db.subscription.update({ where: { id: sub!.id }, data: { flagged: true } });
        await logSecurity(agent.id, user.id, sub!.id, "token_flagged", "strike limit (council)");
      }
      answers.push({ slug, name: agent.name, creatorName: agent.creatorName, type: agent.agentType, reply: refusalMessage(agent.creatorName) });
      continue;
    }

    // --- meter: a council question costs one request per expert consulted ---
    const m = await meter(sub!.id, user.id, agent.id, "council");
    if (!m.allowed) { skipped.push({ slug, reason: "rate_limited" }); continue; }

    const feats = parseFeatures(agent.features);
    const ctx: AgentContext = {
      name: agent.name, category: agent.category, creatorName: agent.creatorName, description: agent.description,
      systemPrompt: (agent.systemPrompt || "") + "\n" + typeFraming(agent.agentType),
      knowledgeSummary: agent.knowledgeSummary, features: feats,
      lang: (agent.lang as any) || "en", regulated: (agent as any).regulated ?? false,
    };
    let reply = await generateAgentReply(ctx, [], question);
    reply = sanitizeOutput(reply, agent.systemPrompt);
    reply = watermark(reply, sub!.id);
    answers.push({ slug, name: agent.name, creatorName: agent.creatorName, type: agent.agentType, reply });
  }

  if (answers.length < 2) {
    return NextResponse.json({
      error: "A council needs at least two experts you actively subscribe to.",
      code: "min_panel", skipped,
    }, { status: 403 });
  }
  return NextResponse.json({ ok: true, answers, summary: synthesize(answers, locale), skipped });
}
