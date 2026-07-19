import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { readStepUp, clearStepUp } from "@/lib/session";
import { creatorEarnings } from "@/lib/earnings";
import { notify } from "@/lib/notify";
import { stripeEnabled, transferToCreator, accountReady } from "@/lib/stripe";

const MIN_PAYOUT = 50;
const PAYOUT_FEE_PCT = 0; // platform absorbs payout fees at v1

// List payout history
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const [earnings, payouts] = await Promise.all([
    creatorEarnings(user.id),
    db.payout.findMany({ where: { creatorId: user.id }, orderBy: { requestedAt: "desc" }, take: 50 }),
  ]);
  return NextResponse.json({ ok: true, earnings, payouts });
}

// Request a withdrawal — gated by mandatory 2FA + a fresh step-up proof.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full || (full.role !== "creator" && full.role !== "admin")) return NextResponse.json({ error: "Only creators can withdraw" }, { status: 403 });

  // Money-security gate: 2FA must be enabled, and re-verified within the last 5 minutes.
  if (!full.twoFactorEnabled) return NextResponse.json({ error: "Enable two-factor authentication before withdrawing.", code: "need_2fa" }, { status: 403 });
  const step = await readStepUp();
  if (!step || step.uid !== user.id) return NextResponse.json({ error: "Verification required to withdraw.", code: "need_stepup" }, { status: 403 });

  const body = await readJson(req); if (!body) return badRequest();
  const profile = await db.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!profile || !profile.payoutMethod || !profile.payoutVerified) return NextResponse.json({ error: "Add a verified payout method first.", code: "no_method" }, { status: 400 });

  const earnings = await creatorEarnings(user.id);
  const amount = Math.floor(Number(body.amount) || 0);
  if (amount < MIN_PAYOUT) return NextResponse.json({ error: `Minimum withdrawal is $${MIN_PAYOUT}.`, code: "min" }, { status: 400 });
  if (amount > earnings.available) return NextResponse.json({ error: `Amount exceeds your available balance ($${earnings.available}).`, code: "insufficient" }, { status: 400 });

  const feeAmount = Math.round((amount * PAYOUT_FEE_PCT) / 100);
  const netAmount = amount - feeAmount;

  // Live settlement when Stripe Connect is configured AND this creator is onboarded.
  let provider = "ledger";
  let providerRef = "";
  if (stripeEnabled() && profile.stripeAccountId) {
    const ready = await accountReady(profile.stripeAccountId).catch(() => false);
    if (!ready) return NextResponse.json({ error: "Finish Stripe onboarding before withdrawing.", code: "stripe_onboarding" }, { status: 400 });
    try {
      providerRef = await transferToCreator(profile.stripeAccountId, netAmount, `WizAgents payout · ${user.email}`);
      provider = "stripe";
    } catch (e: any) {
      return NextResponse.json({ error: `Payout provider declined: ${e?.message || "transfer failed"}`, code: "provider_failed" }, { status: 502 });
    }
  }

  const payout = await db.$transaction(async (tx) => {
    const p = await tx.payout.create({
      data: {
        creatorId: user.id, amount, feePct: PAYOUT_FEE_PCT, feeAmount, netAmount,
        method: provider === "stripe" ? "stripe" : profile.payoutMethod,
        destinationMasked: profile.payoutDetailMasked,
        status: provider === "stripe" ? "paid" : "processing",
        provider, providerRef,
        processedAt: provider === "stripe" ? new Date() : null,
      },
    });
    // move funds from available -> pending; record a payout transaction (negative to creator)
    if (provider === "stripe") {
      await tx.creatorProfile.update({ where: { userId: user.id }, data: { withdrawnTotal: { increment: amount } } });
    } else {
      await tx.creatorProfile.update({ where: { userId: user.id }, data: { pendingPayout: { increment: amount } } });
    }
    await tx.transaction.create({ data: { userId: user.id, type: "payout", amount: -amount, note: `Withdrawal to ${provider === "stripe" ? "Stripe" : profile.payoutMethod} ${profile.payoutDetailMasked}`, status: provider === "stripe" ? "succeeded" : "processing" } });
    return p;
  });

  await clearStepUp(); // consume the step-up proof (single-use)
  await notify(user.id, "welcome", provider === "stripe" ? "Withdrawal sent" : "Withdrawal requested", provider === "stripe" ? `$${netAmount} was transferred to your connected Stripe account.` : `$${netAmount} is on its way to ${profile.payoutMethod} ${profile.payoutDetailMasked}. Settled manually on this deployment — typically 1–3 business days.`, "/studio/revenue");
  return NextResponse.json({ ok: true, payout: { id: payout.id, amount, netAmount, status: payout.status, provider, providerRef } });
}
