import { db } from "./db";
import { getConfig } from "./config";
import { benefitsFor } from "./loyalty";

function today() { return new Date().toISOString().slice(0, 10); }

export type MeterResult = { allowed: boolean; remaining: number; limit: number; used: number };

/**
 * Record one billable request against a subscription and enforce the daily rate limit.
 * Returns allowed=false (without recording) when the daily cap is reached.
 */
export async function meter(subId: string, userId: string, agentId: string, kind: string): Promise<MeterResult> {
  const cfg = await getConfig();
  const sub = await db.subscription.findUnique({ where: { id: subId } });
  if (!sub) return { allowed: true, remaining: cfg.dailyRateLimit, limit: cfg.dailyRateLimit, used: 0 };
  // Loyalty: tenure raises the daily cap — staying subscribed gives you more headroom.
  const bonus = benefitsFor(sub.startedAt).rateLimitBonusPct;
  const limit = cfg.dailyRateLimit > 0 ? Math.round(cfg.dailyRateLimit * (1 + bonus / 100)) : 0;

  const d = today();
  const dayCount = sub.dayStamp === d ? sub.dayCount : 0;
  if (limit > 0 && dayCount >= limit) {
    return { allowed: false, remaining: 0, limit, used: dayCount };
  }
  await db.subscription.update({
    where: { id: subId },
    data: { requests: { increment: 1 }, dayStamp: d, dayCount: dayCount + 1 },
  });
  await db.usageEvent.create({ data: { userId, agentId, kind } });
  return { allowed: true, remaining: Math.max(0, limit - (dayCount + 1)), limit, used: dayCount + 1 };
}

/** Fire-and-forget usage log with no rate limit (e.g. trial). */
export async function logUsage(userId: string, agentId: string, kind: string) {
  try { await db.usageEvent.create({ data: { userId, agentId, kind } }); } catch {}
}
