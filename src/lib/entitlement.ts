import { db } from "./db";
import { subscriptionAccess, lapseIfExpired } from "./access";
import { orgAllows } from "./org";

/**
 * Who is allowed to use an Agent, and under which subscription.
 *
 * Two ways to be entitled:
 *   1. You subscribe yourself.
 *   2. You hold an ACTIVE enterprise seat, and your org subscribes. The org's
 *      subscription is used (and metered), your usage is written to the org's audit
 *      log, and the org's blacklist can block an Agent for the whole company.
 *
 * A seat is not a loophole: expiry, suspension, blacklist and metering all still apply.
 */
export type Entitlement =
  | { ok: true; sub: any; viaSeat: false }
  | { ok: true; sub: any; viaSeat: true; orgOwnerId: string; seatId: string }
  | { ok: false; reason: "none" | "expired" | "flagged" | "blacklisted" };

export async function entitlementFor(userId: string, agentId: string): Promise<Entitlement> {
  // 1) the user's own subscription wins
  const own = await db.subscription.findUnique({ where: { userId_agentId: { userId, agentId } } });
  if (own) {
    const a = subscriptionAccess(own as any);
    if (a === "active") return { ok: true, sub: own, viaSeat: false };
    if (a === "flagged") return { ok: false, reason: "flagged" };
    await lapseIfExpired(own as any);
    // fall through — an org seat may still cover them
  }

  // 2) an active enterprise seat
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return { ok: false, reason: own ? "expired" : "none" };

  const seats = await db.enterpriseSeat.findMany({
    where: { status: "active", OR: [{ memberUserId: userId }, { memberEmail: user.email }] },
  });

  for (const seat of seats) {
    // org governance: blacklist blocks; in allowlist mode only approved Agents pass
    const gov = await orgAllows(seat.orgOwnerId, agentId);
    if (!gov.ok) return { ok: false, reason: "blacklisted" };

    const orgSub = await db.subscription.findUnique({ where: { userId_agentId: { userId: seat.orgOwnerId, agentId } } });
    if (!orgSub) continue;
    const a = subscriptionAccess(orgSub as any);
    if (a === "active") return { ok: true, sub: orgSub, viaSeat: true, orgOwnerId: seat.orgOwnerId, seatId: seat.id };
    if (a === "flagged") return { ok: false, reason: "flagged" };
    await lapseIfExpired(orgSub as any);
  }

  return { ok: false, reason: own ? "expired" : "none" };
}

/** Record a seat member's use of an org subscription in the org's audit log. */
export async function auditSeatUse(orgOwnerId: string, actorEmail: string, agentId: string, agentName: string, action: string, query = "") {
  try {
    await db.auditLog.create({ data: { orgOwnerId, actorEmail, agentId, agentName, action, query: query.slice(0, 300) } });
  } catch {}
}

/**
 * Attach pending invites to a real account — but NEVER auto-join.
 *
 * An organization can type any email address. If signing in silently made you a member,
 * a stranger could enrol you into their org and your Agent usage would start flowing
 * into their audit log without your knowledge. So we only resolve the account link;
 * the seat stays "invited" until the person explicitly accepts it.
 */
export async function linkSeatsForUser(userId: string, email: string) {
  try {
    await db.enterpriseSeat.updateMany({
      where: { memberEmail: email, memberUserId: null },
      data: { memberUserId: userId },          // link only — status is untouched
    });
  } catch {}
}
