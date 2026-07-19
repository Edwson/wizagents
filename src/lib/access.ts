import { db } from "./db";

export type AccessState = "active" | "expired" | "flagged" | "none";

/** Determine whether a subscription still grants access — the "sever on lapse" gate. */
export function subscriptionAccess(sub: { status: string; flagged?: boolean; currentPeriodEnd?: Date | null } | null): AccessState {
  if (!sub) return "none";
  if (sub.flagged) return "flagged";
  if (sub.status !== "active") return "expired";
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) return "expired";
  return "active";
}

/** Lapse an expired subscription: sever the connection and free the seat count. */
export async function lapseIfExpired(sub: { id: string; agentId: string; status: string; currentPeriodEnd?: Date | null }) {
  if (sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
    await db.subscription.update({ where: { id: sub.id }, data: { status: "canceled", canceledAt: new Date() } });
    await db.agent.update({ where: { id: sub.agentId }, data: { subscribers: { decrement: 1 } } }).catch(() => {});
    return true;
  }
  return false;
}

export async function logSecurity(agentId: string | null, userId: string, subId: string | null, kind: string, detail = "") {
  try { await db.securityEvent.create({ data: { agentId: agentId || null, userId, subId, kind, detail } }); } catch {}
}
