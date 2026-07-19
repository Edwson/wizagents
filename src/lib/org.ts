import { db } from "./db";
import { randomToken } from "./auth";

export const SEAT_PRICE = 49;

/** Is this user an org admin (the owner, or a seat with the admin role)? */
export async function orgAdminOf(userId: string, orgOwnerId: string): Promise<boolean> {
  if (userId === orgOwnerId) return true;
  const seat = await db.enterpriseSeat.findFirst({
    where: { orgOwnerId, status: "active", role: "admin", OR: [{ memberUserId: userId }, {}] },
  });
  if (!seat) return false;
  return seat.memberUserId === userId;
}

/** The org this user administers (owner or admin seat), if any. */
export async function orgContext(user: { id: string; email: string; role: string }) {
  if (user.role === "enterprise" || user.role === "admin") return { orgOwnerId: user.id, isOwner: true, isAdmin: true };
  const seat = await db.enterpriseSeat.findFirst({
    where: { status: "active", role: "admin", OR: [{ memberUserId: user.id }, { memberEmail: user.email }] },
  });
  if (seat) return { orgOwnerId: seat.orgOwnerId, isOwner: false, isAdmin: true };
  return null;
}

/** The org's current monthly spend: active seats + the Agents it subscribes to. */
export async function orgSpend(orgOwnerId: string) {
  const [seats, subs] = await Promise.all([
    db.enterpriseSeat.count({ where: { orgOwnerId, status: "active" } }),
    db.subscription.findMany({ where: { userId: orgOwnerId, status: "active" }, include: { agent: true } }),
  ]);
  const seatCost = seats * SEAT_PRICE;
  const subsCost = subs.reduce((n, s) => n + (s.viaPass ? 0 : (s.lockedPrice ?? s.agent.price)), 0);
  return { seats, seatCost, subsCost, total: seatCost + subsCost };
}

/**
 * Would adding `extra` of monthly spend breach the org's budget?
 * A cap that isn't enforced is just decoration.
 */
export async function budgetCheck(orgOwnerId: string, extra = 0) {
  const owner = await db.user.findUnique({ where: { id: orgOwnerId }, select: { orgBudgetMonthly: true } });
  const cap = owner?.orgBudgetMonthly || 0;
  const { total } = await orgSpend(orgOwnerId);
  const projected = total + extra;
  if (cap <= 0) return { ok: true as const, cap: 0, current: total, projected };
  if (projected > cap) return { ok: false as const, cap, current: total, projected, over: projected - cap };
  return { ok: true as const, cap, current: total, projected, nearLimit: projected > cap * 0.8 };
}

/** Governance: may this org use this Agent at all? */
export async function orgAllows(orgOwnerId: string, agentId: string): Promise<{ ok: boolean; reason?: "blacklisted" | "not_allowlisted" }> {
  const blocked = await db.blacklist.findFirst({ where: { orgOwnerId, agentId } });
  if (blocked) return { ok: false, reason: "blacklisted" };
  const owner = await db.user.findUnique({ where: { id: orgOwnerId }, select: { orgPolicy: true } });
  if (owner?.orgPolicy === "allowlist") {
    const allowed = await db.orgAllowlist.findFirst({ where: { orgOwnerId, agentId } });
    if (!allowed) return { ok: false, reason: "not_allowlisted" };
  }
  return { ok: true };
}

/** Issue a per-seat MCP/API key (attributable to one person, revocable alone). */
export async function issueSeatToken(seatId: string, label = "") {
  return db.seatToken.create({ data: { seatId, token: randomToken("wz_seat_"), label } });
}

/**
 * Resolve an API bearer token to the subscription it may use.
 * Accepts BOTH a personal subscription token and a per-seat enterprise key. A seat key
 * grants the org's subscription, but usage is attributed to the individual — so an
 * organization can see who did what, and cut off one person without rotating everyone.
 */
export async function resolveApiToken(token: string, agentId: string): Promise<
  | { ok: true; sub: any; actorId: string; seat?: { id: string; orgOwnerId: string; email: string } }
  | { ok: false; reason: "invalid" | "revoked" | "seat_inactive" | "not_entitled" | "governance" }
> {
  const personal = await db.subscription.findFirst({ where: { mcpToken: token, agentId } });
  if (personal) return { ok: true, sub: personal, actorId: personal.userId };

  const st = await db.seatToken.findUnique({ where: { token }, include: { seat: true } });
  if (!st) return { ok: false, reason: "invalid" };
  if (st.revoked) return { ok: false, reason: "revoked" };
  if (st.seat.status !== "active") return { ok: false, reason: "seat_inactive" };

  const gov = await orgAllows(st.seat.orgOwnerId, agentId);
  if (!gov.ok) return { ok: false, reason: "governance" };

  const orgSub = await db.subscription.findUnique({ where: { userId_agentId: { userId: st.seat.orgOwnerId, agentId } } });
  if (!orgSub) return { ok: false, reason: "not_entitled" };

  await db.seatToken.update({ where: { id: st.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return {
    ok: true, sub: orgSub,
    actorId: st.seat.memberUserId || st.seat.orgOwnerId,
    seat: { id: st.seat.id, orgOwnerId: st.seat.orgOwnerId, email: st.seat.memberEmail },
  };
}
