import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { reputationFor } from "@/lib/reputation";
import { seclog } from "@/lib/seclog";

export const dynamic = "force-dynamic";

/**
 * Take everything with you.
 *
 * "Your knowledge stays yours … you can leave and take your record with you."
 * This returns a complete, portable JSON archive of what this account owns —
 * profile, subscriptions, conversations, transactions, endorsements, reputation,
 * and (for a creator) their Agents, knowledge versions and fidelity samples.
 *
 * It never includes another party's private data, and never any secret of ours or theirs.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const [subs, convos, txs, endorsementsMade, endorsementsGiven, escalations, favorites, reviews, notifications, payouts, agents, secLogs] =
    await Promise.all([
      db.subscription.findMany({ where: { userId: user.id }, include: { agent: { select: { slug: true, name: true, creatorName: true } } } }),
      db.conversation.findMany({ where: { userId: user.id }, include: { agent: { select: { slug: true, name: true } }, messages: { select: { role: true, content: true, createdAt: true } } } }),
      db.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      db.endorsement.findMany({ where: { userId: user.id }, include: { agent: { select: { slug: true, name: true } } } }),
      db.endorsement.findMany({ where: { expertUserId: user.id }, select: { refCode: true, subject: true, statement: true, status: true, signedAt: true, createdAt: true } }),
      db.escalation.findMany({ where: { userId: user.id }, include: { agent: { select: { slug: true, name: true } } } }),
      db.favorite.findMany({ where: { userId: user.id }, include: { agent: { select: { slug: true, name: true } } } }),
      db.review.findMany({ where: { userId: user.id }, include: { agent: { select: { slug: true, name: true } } } }),
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.payout.findMany({ where: { creatorId: user.id } }),
      db.agent.findMany({
        where: { creatorId: user.id },
        include: {
          knowledgeVersions: { select: { version: true, note: true, docCount: true, createdAt: true } },
          fidelitySamples: { select: { question: true, expertAnswer: true, createdAt: true } },
          fidelityRuns: { select: { score: true, samples: true, createdAt: true } },
        },
      }),
      db.securityLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, select: { kind: true, detail: true, ip: true, createdAt: true } }),
    ]);

  const reputation = await reputationFor(user.id).catch(() => null);

  const archive = {
    _about: "Your complete WizAgents record. It is yours: portable, and yours to take anywhere.",
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id, email: user.email, name: user.name, role: user.role,
      emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    },
    creatorProfile: user.creatorProfile
      ? { displayName: user.creatorProfile.displayName, bio: user.creatorProfile.bio, verticalLabel: user.creatorProfile.verticalLabel,
          verified: user.creatorProfile.verified, identityVerified: user.creatorProfile.identityVerified,
          totalEarnings: user.creatorProfile.totalEarnings, withdrawnTotal: user.creatorProfile.withdrawnTotal }
      : null,
    reputation,
    // as a buyer
    subscriptions: subs.map((s) => ({ agent: s.agent, status: s.status, price: s.price, lockedPrice: s.lockedPrice, credits: s.credits, startedAt: s.startedAt, currentPeriodEnd: s.currentPeriodEnd })),
    conversations: convos,
    escalations,
    endorsementsRequested: endorsementsMade,
    favorites: favorites.map((f) => f.agent),
    reviews,
    transactions: txs,
    notifications,
    // as a creator — your Agents and the work behind them
    agents,
    endorsementsSigned: endorsementsGiven,
    payouts,
    securityActivity: secLogs,
  };

  await seclog(user.id, "data_exported", "Full account archive downloaded", req);

  return new NextResponse(JSON.stringify(archive, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="wizagents-archive-${user.id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
