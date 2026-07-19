import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { expertSignedAnswer, type AgentContext } from "@/lib/agent-engine";
import { parseFeatures } from "@/lib/format";
import { notify } from "@/lib/notify";
import { readJson, badRequest } from "@/lib/req";

/**
 * Escalation lifecycle — the human half of the product.
 *
 * HONESTY RULE: an answer may only ever be attributed to the named expert when that
 * expert actually acted. A buyer can NEVER cause an answer to appear, and machine text
 * can never be marked "signed". The expert may generate a DRAFT to edit ("draft"), but
 * publishing ("answer") and signing ("sign") are explicit expert actions.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();
  const { action, answer, sign } = body;

  const esc = await db.escalation.findUnique({ where: { id }, include: { agent: true } });
  if (!esc) return NextResponse.json({ error: "Escalation not found" }, { status: 404 });

  const isExpert = esc.agent.creatorId === user.id || esc.expertUserId === user.id;
  if (!isExpert) return NextResponse.json({ error: "Only this Agent's expert can act on an escalation" }, { status: 403 });

  // --- draft: a starting point for the EXPERT to edit. Never published, never signed. ---
  if (action === "draft") {
    const ctx: AgentContext = {
      name: esc.agent.name, category: esc.agent.category, creatorName: esc.agent.creatorName,
      description: esc.agent.description, systemPrompt: "", knowledgeSummary: esc.agent.knowledgeSummary,
      features: parseFeatures(esc.agent.features), lang: (esc.agent.lang as any) || "en",
    };
    const draft = expertSignedAnswer(ctx, esc.question, (esc.agent.lang as any) || "en");
    await db.escalation.update({ where: { id }, data: { status: "in_progress" } });
    return NextResponse.json({ ok: true, draft, note: "This is a draft for you to edit. It is not published and not signed until you say so." });
  }

  // --- answer: the expert publishes their reply ---
  if (action === "answer") {
    const text = String(answer || "").trim();
    if (text.length < 10) return NextResponse.json({ error: "Write your answer before publishing it (min 10 chars)." }, { status: 400 });
    const signed = !!sign;
    const updated = await db.escalation.update({
      where: { id },
      data: { status: signed ? "signed" : "answered", answer: text, answeredAt: new Date(), signed, expertUserId: esc.expertUserId || esc.agent.creatorId },
    });
    if (signed) {
      await db.transaction.create({ data: { userId: esc.userId, type: "signature", amount: esc.agent.signaturePrice, agentId: esc.agentId, note: "Signed expert answer" } });
    }
    await notify(
      esc.userId, "escalation_answered", `Your escalation was answered: ${esc.agent.name}`,
      signed ? `${esc.agent.creatorName} answered and signed it — admissible for your audit file.` : `${esc.agent.creatorName} answered within SLA.`,
      "/dashboard"
    );
    return NextResponse.json({ ok: true, escalation: updated });
  }

  // --- sign: attach a named sign-off to an already-published answer ---
  if (action === "sign") {
    if (!esc.answer?.trim()) return NextResponse.json({ error: "Publish an answer before signing it." }, { status: 409 });
    const updated = await db.escalation.update({ where: { id }, data: { signed: true, status: "signed" } });
    await db.transaction.create({ data: { userId: esc.userId, type: "signature", amount: esc.agent.signaturePrice, agentId: esc.agentId, note: "Signed expert answer" } });
    await notify(esc.userId, "signed", `Expert signed: ${esc.agent.name}`, "Carries the expert's professional identity and a timestamp — admissible for your audit file.", "/dashboard");
    return NextResponse.json({ ok: true, escalation: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
