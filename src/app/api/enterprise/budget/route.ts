import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { orgContext, orgSpend } from "@/lib/org";

/**
 * Set the organization's monthly spend cap (0 = unlimited).
 * Only the OWNER may move the cap — an admin seat can spend within it, but cannot raise it
 * on themselves. That separation is what makes the cap a real control rather than a suggestion.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const ctx = await orgContext(user);
  if (!ctx) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });
  if (!ctx.isOwner) return NextResponse.json({ error: "Only the organization owner can change the budget cap." }, { status: 403 });

  const body = await readJson(req); if (!body) return badRequest();
  const cap = Math.max(0, Math.floor(Number(body.budget) || 0));

  // Refuse a cap you are already over — otherwise the cap reads green while the org is in breach.
  if (cap > 0) {
    const { total } = await orgSpend(ctx.orgOwnerId);
    if (total > cap) {
      return NextResponse.json(
        { error: `You already spend $${total}/mo, which is above a $${cap} cap. Cancel subscriptions or seats first, or set a higher cap.`, code: "below_current_spend", current: total },
        { status: 409 },
      );
    }
  }
  await db.user.update({ where: { id: ctx.orgOwnerId }, data: { orgBudgetMonthly: cap } });
  return NextResponse.json({ ok: true, budget: cap });
}
