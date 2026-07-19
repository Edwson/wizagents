import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserWithSecrets, verifyPassword } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { destroySession } from "@/lib/session";
import { seclog } from "@/lib/seclog";

export const dynamic = "force-dynamic";

// What stands in the way of deletion right now (so we can tell the truth up front).
export async function GET() {
  const user = await getCurrentUserWithSecrets();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const [activeSubscribers, openEscalations, pendingPayout, mySubs] = await Promise.all([
    db.subscription.count({ where: { agent: { creatorId: user.id }, status: "active" } }),
    db.escalation.count({ where: { expertUserId: user.id, status: { in: ["queued", "in_progress"] } } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { pendingPayout: true } }),
    db.subscription.count({ where: { userId: user.id, status: "active" } }),
  ]);
  const blockers: string[] = [];
  if (activeSubscribers > 0) blockers.push(`${activeSubscribers} people still subscribe to your Agents. Unpublish them and let the subscriptions lapse first — we won't cut off people who paid you.`);
  if (openEscalations > 0) blockers.push(`${openEscalations} escalation(s) are still awaiting your answer. Someone paid for those.`);
  if ((pendingPayout?.pendingPayout || 0) > 0) blockers.push(`You have $${Math.round(pendingPayout!.pendingPayout)} of earnings still settling. Wait for it to land.`);
  return NextResponse.json({ ok: true, canDelete: blockers.length === 0, blockers, activeSubscriptions: mySubs });
}

/**
 * Delete the account. Confirmed with the password, and blocked while other people
 * still depend on you. Your own data goes; what other people paid for (their signed
 * citations, their audit records) is anonymized rather than erased — a citation must
 * remain verifiable, and a ledger must remain a ledger.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserWithSecrets();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const b = await readJson(req); if (!b) return badRequest();

  if (!(await verifyPassword(String(b.password || ""), user.passwordHash))) {
    return NextResponse.json({ error: "Password is incorrect." }, { status: 400 });
  }
  if (String(b.confirm || "").trim().toUpperCase() !== "DELETE") {
    return NextResponse.json({ error: 'Type DELETE to confirm.', code: "need_confirm" }, { status: 400 });
  }

  const [activeSubscribers, openEscalations] = await Promise.all([
    db.subscription.count({ where: { agent: { creatorId: user.id }, status: "active" } }),
    db.escalation.count({ where: { expertUserId: user.id, status: { in: ["queued", "in_progress"] } } }),
  ]);
  if (activeSubscribers > 0 || openEscalations > 0) {
    return NextResponse.json({ error: "You still have people depending on you. Resolve those first.", code: "blocked" }, { status: 409 });
  }

  const stamp = Date.now().toString(36);
  await db.$transaction(async (tx) => {
    // 1) Purge everything personal.
    await tx.conversation.deleteMany({ where: { userId: user.id } });
    await tx.favorite.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.paymentMethod.deleteMany({ where: { userId: user.id } });
    await tx.webAuthnCredential.deleteMany({ where: { userId: user.id } });
    await tx.backupCode.deleteMany({ where: { userId: user.id } });
    await tx.emailToken.deleteMany({ where: { userId: user.id } });
    await tx.kycSubmission.deleteMany({ where: { userId: user.id } });
    await tx.assetUpload.deleteMany({ where: { creatorId: user.id } });
    await tx.securityLog.deleteMany({ where: { userId: user.id } });

    // 2) Stop the world cleanly.
    await tx.subscription.updateMany({ where: { userId: user.id, status: "active" }, data: { status: "canceled", canceledAt: new Date() } });
    await tx.agent.updateMany({ where: { creatorId: user.id }, data: { status: "suspended" } });

    // 3) Anonymize the identity. We do NOT hard-delete the row, because a signed
    //    citation must stay verifiable and a financial ledger must stay a ledger —
    //    erasing those would be dishonest to the people who relied on them. The
    //    expert's NAME on an existing citation is what it attests, and that stays;
    //    the account behind it is severed and can never be used again.
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${user.id.slice(0, 8)}-${stamp}@deleted.invalid`,
        name: "Deleted account",
        passwordHash: `deleted-${stamp}`,          // unusable — bcrypt compare can never match
        twoFactorEnabled: false, twoFactorSecret: null, currentChallenge: null,
        avatarColor: "#666666", orgName: null,
        sessionVersion: { increment: 1 },          // every device signed out, immediately
        deletedAt: new Date(),
      },
    });
    await tx.creatorProfile.updateMany({
      where: { userId: user.id },
      data: { displayName: "Deleted account", bio: "", licenseInfo: "", payoutMethod: "", payoutDetailMasked: "", payoutVerified: false, stripeAccountId: "", stripeOnboarded: false },
    });
  });

  await seclog(user.id, "account_deleted", "Account deleted by the owner").catch(() => {});
  await destroySession();
  return NextResponse.json({ ok: true });
}
