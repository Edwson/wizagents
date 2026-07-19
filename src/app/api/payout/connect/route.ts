import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readStepUp } from "@/lib/session";
import { stripeEnabled, ensureConnectAccount, onboardingLink, accountReady } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Status of live settlement for this creator.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const p = await db.creatorProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    ok: true,
    stripeEnabled: stripeEnabled(),
    connected: !!p?.stripeAccountId,
    onboarded: !!p?.stripeOnboarded,
    note: stripeEnabled()
      ? "Withdrawals are transferred to your connected Stripe account."
      : "Live settlement is not configured on this deployment — withdrawals are recorded and settled manually. Nothing is hidden from you.",
  });
}

// Start / resume Stripe Connect onboarding. Step-up gated: this decides where money lands.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  if (!stripeEnabled()) return NextResponse.json({ error: "Live settlement is not configured on this deployment.", code: "not_configured" }, { status: 501 });

  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full?.twoFactorEnabled) return NextResponse.json({ error: "Enable two-factor authentication first.", code: "need_2fa" }, { status: 403 });
  const step = await readStepUp();
  if (!step || step.uid !== user.id) return NextResponse.json({ error: "Verification required.", code: "need_stepup" }, { status: 403 });

  const profile = await db.creatorProfile.findUnique({ where: { userId: user.id } });
  try {
    const acctId = await ensureConnectAccount(profile?.stripeAccountId || "", user.email);
    const ready = await accountReady(acctId).catch(() => false);
    await db.creatorProfile.upsert({
      where: { userId: user.id },
      update: { stripeAccountId: acctId, stripeOnboarded: ready },
      create: { userId: user.id, displayName: user.name, stripeAccountId: acctId, stripeOnboarded: ready },
    });
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const url = await onboardingLink(acctId, origin);
    return NextResponse.json({ ok: true, url, onboarded: ready });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not start Stripe onboarding" }, { status: 502 });
  }
}
