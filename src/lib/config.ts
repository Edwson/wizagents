import { db } from "./db";

export type PlatformConfig = {
  takeRatePct: number; passPrice: number; defaultTrial: number; dailyRateLimit: number; escalationFeePct: number;
};
const DEFAULTS: PlatformConfig = { takeRatePct: 15, passPrice: 129, defaultTrial: 3, dailyRateLimit: 200, escalationFeePct: 15 };

export async function getConfig(): Promise<PlatformConfig> {
  const c = await db.platformConfig.findUnique({ where: { id: "singleton" } });
  if (!c) return DEFAULTS;
  return { takeRatePct: c.takeRatePct, passPrice: c.passPrice, defaultTrial: c.defaultTrial, dailyRateLimit: c.dailyRateLimit, escalationFeePct: c.escalationFeePct };
}
export function creatorShare(cfg: PlatformConfig) { return (100 - cfg.takeRatePct) / 100; }
