import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { uniqueRefCode } from "@/lib/endorsement";
import { notify } from "@/lib/notify";
import { canEscalate } from "@/lib/rules";
import { discountedPrice } from "@/lib/loyalty";

// GET: my endorsements (as requester) + those awaiting me (as expert)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  // SECURITY: never include a raw User row — it carries passwordHash / twoFactorSecret.
  // Select only what each side is entitled to see.
  const agentSel = { select: { slug: true, name: true, creatorName: true, signaturePrice: true } };
  const requesterSel = { select: { name: true, email: true } };

  const [requested, toSign, signed] = await Promise.all([
    db.endorsement.findMany({ where: { userId: user.id }, include: { agent: agentSel }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.endorsement.findMany({ where: { expertUserId: user.id, status: { in: ["requested", "reviewing"] } }, include: { agent: agentSel, user: requesterSel }, orderBy: { createdAt: "asc" } }),
    // the expert's own signed/revoked citations — so a mistaken sign-off can always be withdrawn
    db.endorsement.findMany({ where: { expertUserId: user.id, status: { in: ["signed", "revoked"] } }, include: { agent: agentSel, user: requesterSel }, orderBy: { signedAt: "desc" }, take: 30 }),
  ]);
  return NextResponse.json({ ok: true, requested, toSign, signed });
}

// POST: request a citable endorsement from the human expert behind an agent.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();
  const agent = await db.agent.findUnique({ where: { slug: body.slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // must have an active subscription (same gate as escalation) and not own the agent
  const sub = await db.subscription.findUnique({ where: { userId_agentId: { userId: user.id, agentId: agent.id } } });
  const guard = canEscalate(user as any, agent as any, sub?.status === "active");
  if (!guard.ok) return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status });

  const subject = String(body.subject || "").trim();
  if (subject.length < 3) return NextResponse.json({ error: "Describe what needs endorsing" }, { status: 400 });

  // Trust gate: only a credential-checked human may put their name on a public citation.
  const expertProfile = await db.creatorProfile.findUnique({ where: { userId: agent.creatorId } });
  if (!expertProfile?.verified) {
    return NextResponse.json({ error: "This expert is not verified yet. Endorsements can only be signed by a credential-checked human.", code: "expert_unverified" }, { status: 409 });
  }

  const scope = body.scope === "engaged" ? "engaged" : "reviewed";
  const listPrice = scope === "engaged" ? agent.signaturePrice * 4 : agent.signaturePrice;
  const { price: afterLoyalty, saved, pct } = discountedPrice(listPrice, sub!.startedAt);
  const wantCredits = body.useCredits !== false;
  const creditsApplied = wantCredits ? Math.min(sub!.credits, afterLoyalty) : 0;
  const price = Math.max(0, afterLoyalty - creditsApplied);
  const slaHours = scope === "engaged" ? 168 : 72; // engaged = a real engagement, 7d; reviewed = 72h
  const slaDueAt = new Date(Date.now() + slaHours * 3600 * 1000);
  const kv = await db.knowledgeVersion.findFirst({ where: { agentId: agent.id }, orderBy: { createdAt: "desc" } });
  const refCode = await uniqueRefCode();

  const e = await db.$transaction(async (tx) => {
    const created = await tx.endorsement.create({
      data: {
        refCode, agentId: agent.id, userId: user.id, expertUserId: agent.creatorId, expertName: agent.creatorName,
        subject, context: String(body.context || "").slice(0, 4000), scope, price, status: "requested",
        knowledgeVersion: kv?.version || "", slaDueAt,
      },
    });
    await tx.transaction.create({ data: { userId: user.id, type: "signature", amount: price, agentId: agent.id, note: `Endorsement request · ${scope} · ${refCode}${creditsApplied ? ` · ${creditsApplied} credits applied` : ""}` } });
    if (creditsApplied > 0) await tx.subscription.update({ where: { id: sub!.id }, data: { credits: { decrement: creditsApplied } } });
    return created;
  });
  await notify(agent.creatorId, "signed", `Endorsement requested: ${agent.name}`, `${user.name} requested a ${scope} sign-off (${refCode}).`, `/studio`);
  return NextResponse.json({ ok: true, endorsement: { id: e.id, refCode: e.refCode, status: e.status, price, listPrice, saved, loyaltyPct: pct, creditsApplied, creditsLeft: sub!.credits - creditsApplied, slaDueAt, scope } });
}
