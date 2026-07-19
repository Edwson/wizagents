import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe";

// Stripe sends events here. Signature is verified before any action is taken.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  const valid = await verifyStripeSignature(payload, sig, secret);
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  // const event = JSON.parse(payload);
  // switch (event.type) { case "checkout.session.completed": ... activate subscription ... }
  return NextResponse.json({ received: true });
}
