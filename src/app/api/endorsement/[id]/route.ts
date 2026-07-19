import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { notify } from "@/lib/notify";

/**
 * Endorsement lifecycle, owned by the named expert.
 *   accept  → reviewing   (the expert has picked it up)
 *   sign    → signed      (a public, citable sign-off; requires a VERIFIED expert)
 *   decline → declined    (the fee is genuinely refunded)
 *   revoke  → revoked     (integrity: a signed citation can be withdrawn, publicly)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const e = await db.endorsement.findUnique({ where: { id }, include: { agent: true } });
  if (!e) return NextResponse.json({ error: "Endorsement not found" }, { status: 404 });
  if (e.expertUserId !== user.id) return NextResponse.json({ error: "Only the named expert can act on this" }, { status: 403 });
  const body = await readJson(req); if (!body) return badRequest();
  const action = String(body.action || "");

  // ---- accept: begin review ----
  if (action === "accept") {
    if (e.status !== "requested") return NextResponse.json({ error: "Only a new request can be accepted" }, { status: 409 });
    await db.endorsement.update({ where: { id }, data: { status: "reviewing", acceptedAt: new Date() } });
    await notify(e.userId, "signed", `Under review: ${e.agent.name}`, `${e.expertName} has picked up your endorsement request (${e.refCode}).`, "/dashboard");
    return NextResponse.json({ ok: true, status: "reviewing" });
  }

  // ---- decline: refund the fee for real ----
  if (action === "decline") {
    if (!["requested", "reviewing"].includes(e.status)) return NextResponse.json({ error: "This request is already resolved" }, { status: 409 });
    const reason = String(body.reason || "").slice(0, 500);
    await db.$transaction(async (tx) => {
      await tx.endorsement.update({ where: { id }, data: { status: "declined", declinedAt: new Date(), refundedAt: new Date(), revokeReason: reason } });
      // genuine refund: a negative counter-entry against the original charge
      await tx.transaction.create({ data: { userId: e.userId, type: "signature", amount: -e.price, agentId: e.agentId, note: `Refund · endorsement declined · ${e.refCode}`, status: "succeeded" } });
    });
    await notify(e.userId, "signed", `Endorsement declined: ${e.agent.name}`, `${e.expertName} declined to endorse "${e.subject}".${reason ? ` Reason: ${reason}` : ""} Your $${e.price} fee has been refunded.`, "/dashboard");
    return NextResponse.json({ ok: true, status: "declined", refunded: e.price });
  }

  // ---- revoke: withdraw a signed citation ----
  if (action === "revoke") {
    if (e.status !== "signed") return NextResponse.json({ error: "Only a signed endorsement can be revoked" }, { status: 409 });
    const reason = String(body.reason || "").slice(0, 500);
    if (reason.length < 5) return NextResponse.json({ error: "A revocation must state a reason — it is a public record." }, { status: 400 });
    await db.endorsement.update({ where: { id }, data: { status: "revoked", revokedAt: new Date(), revokeReason: reason } });
    await notify(e.userId, "signed", `Endorsement revoked: ${e.refCode}`, `${e.expertName} withdrew this sign-off. Reason: ${reason}. The public citation now shows as revoked.`, `/verify/${e.refCode}`);
    return NextResponse.json({ ok: true, status: "revoked" });
  }

  // ---- sign ----
  if (action !== "sign") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!["requested", "reviewing"].includes(e.status)) return NextResponse.json({ error: "This request is already resolved" }, { status: 409 });

  // Trust gate: an unverified human may not put their name on a public citation.
  const profile = await db.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!profile?.verified) {
    return NextResponse.json({ error: "You must be a verified expert to sign a citable endorsement. Submit your credentials for review.", code: "not_verified" }, { status: 403 });
  }

  const statement = String(body.statement || "").trim() ||
    `I, ${e.expertName}, have reviewed the submission "${e.subject}" and, on my professional judgment against knowledge-base ${e.knowledgeVersion || "current"}, I endorse it as sound. This is an attributable sign-off; my name stands behind it.`;
  const updated = await db.endorsement.update({ where: { id }, data: { status: "signed", statement, signedAt: new Date() } });
  await notify(e.userId, "signed", `Endorsement signed: ${e.agent.name}`, `Your citable reference ${e.refCode} is ready — verify at /verify/${e.refCode}.`, `/verify/${e.refCode}`);
  return NextResponse.json({ ok: true, status: "signed", refCode: updated.refCode });
}
