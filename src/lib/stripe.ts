// Live payout settlement via Stripe Connect.
//
// WizAgents is honest about its own state: if STRIPE_SECRET_KEY is not configured,
// payouts are recorded in the ledger and settled manually — and the UI says exactly
// that. When it IS configured, a withdrawal creates a real Stripe transfer to the
// creator's connected account.
//
// Set:  STRIPE_SECRET_KEY=sk_live_...   (and complete Connect onboarding per creator)
export function stripeEnabled() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim());
}

const API = "https://api.stripe.com/v1";

async function call(path: string, body?: Record<string, string>, method: "POST" | "GET" = "POST") {
  const key = process.env.STRIPE_SECRET_KEY!;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Stripe request failed");
  return data;
}

/** Create (or reuse) the creator's Connect account. */
export async function ensureConnectAccount(existingId: string, email: string, country = "US") {
  if (existingId) return existingId;
  const acct = await call("/accounts", {
    type: "express",
    country,
    email,
    "capabilities[transfers][requested]": "true",
  });
  return acct.id as string;
}

/** A hosted onboarding link the creator completes to receive money. */
export async function onboardingLink(accountId: string, origin: string) {
  const link = await call("/account_links", {
    account: accountId,
    refresh_url: `${origin}/studio/revenue?stripe=refresh`,
    return_url: `${origin}/studio/revenue?stripe=done`,
    type: "account_onboarding",
  });
  return link.url as string;
}

/** Has the creator finished onboarding and can they actually receive transfers? */
export async function accountReady(accountId: string) {
  const a = await call(`/accounts/${accountId}`, undefined, "GET");
  return !!a.payouts_enabled && !!a.charges_enabled;
}

/** Move money to the creator. Amount in whole USD. */
export async function transferToCreator(accountId: string, amountUsd: number, description: string) {
  const t = await call("/transfers", {
    amount: String(Math.round(amountUsd * 100)),
    currency: "usd",
    destination: accountId,
    description,
  });
  return t.id as string;
}

/**
 * Verify a Stripe webhook signature (t=…,v1=… scheme) with a constant-time compare.
 * Never act on an unverified event.
 */
export async function verifyStripeSignature(payload: string, sigHeader: string | null, secret: string): Promise<boolean> {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")) as [string, string][]);
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1) return false;

  // Reject replays older than 5 minutes.
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;

  const { createHmac, timingSafeEqual } = await import("crypto");
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
