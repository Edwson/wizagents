import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { verifyTotpStepUp } from "@/lib/stepup";
import { setStepUp } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/security";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const rl = rateLimit(`stepup:${user.id}:${clientIp(req)}`, 8, 5 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, { status: 429 });
  const body = await readJson(req); if (!body) return badRequest();
  const ok = await verifyTotpStepUp(user.id, String(body.code || ""));
  if (!ok) return NextResponse.json({ error: "Invalid code", code: "bad_code" }, { status: 400 });
  await setStepUp(user.id);
  return NextResponse.json({ ok: true });
}
