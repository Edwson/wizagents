import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { readStepUp } from "@/lib/session";

const METHODS = ["bank", "paypal", "stripe", "wise"];

// Set/replace the payout destination. Step-up gated; stores only a masked tail — never full account/IBAN.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full?.twoFactorEnabled) return NextResponse.json({ error: "Enable two-factor authentication first.", code: "need_2fa" }, { status: 403 });
  const step = await readStepUp();
  if (!step || step.uid !== user.id) return NextResponse.json({ error: "Verification required.", code: "need_stepup" }, { status: 403 });

  const body = await readJson(req); if (!body) return badRequest();
  const method = String(body.method || "");
  if (!METHODS.includes(method)) return NextResponse.json({ error: "Unsupported payout method" }, { status: 400 });
  const raw = String(body.account || "").replace(/\s/g, "");
  if (raw.length < 4) return NextResponse.json({ error: "Enter a valid account/email" }, { status: 400 });
  const masked = method === "paypal" ? maskEmail(raw) : "•••• " + raw.slice(-4);

  await db.creatorProfile.update({ where: { userId: user.id }, data: { payoutMethod: method, payoutDetailMasked: masked, payoutVerified: true } });
  return NextResponse.json({ ok: true, method, destinationMasked: masked });
}

function maskEmail(e: string) { const [u, d] = e.split("@"); if (!d) return "•••• " + e.slice(-4); return (u[0] || "") + "•••@" + d; }
