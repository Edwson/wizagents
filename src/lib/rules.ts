// Centralized business rules for the marketplace. Pure, dependency-light guards
// used across API routes so behaviour is consistent and edge-cases are covered.

export type AgentLite = { id: string; creatorId: string; status: string; inPass: boolean; price: number };
export type UserLite = { id: string; pass?: { active: boolean } | null };

export type Guard = { ok: true } | { ok: false; code: string; error: string; status: number };
const deny = (code: string, error: string, status = 400): Guard => ({ ok: false, code, error, status });
const allow: Guard = { ok: true };

export function isOwnAgent(user: UserLite, agent: AgentLite) {
  return agent.creatorId === user.id;
}
export function passCovers(user: UserLite, agent: AgentLite) {
  return !!(agent.inPass && user.pass?.active);
}

/** Can this user start a NEW subscription to this agent? */
export function canSubscribe(user: UserLite, agent: AgentLite, alreadyActive: boolean): Guard {
  if (alreadyActive) return deny("already", "You already subscribe to this Agent", 409);
  if (isOwnAgent(user, agent)) return deny("own_agent", "You can't subscribe to your own Agent", 403);
  if (agent.status !== "published") return deny("not_published", "This Agent is not available for subscription", 409);
  return allow;
}

/** Can this user review this agent? (must have subscribed, can't review own) */
export function canReview(user: UserLite, agent: AgentLite, hasSubscription: boolean): Guard {
  if (isOwnAgent(user, agent)) return deny("own_agent", "You can't review your own Agent", 403);
  if (!hasSubscription) return deny("not_subscriber", "Only subscribers can review", 403);
  return allow;
}

/** Can this user escalate on this agent? (active subscription, not own) */
export function canEscalate(user: UserLite, agent: AgentLite, hasActiveSub: boolean): Guard {
  if (isOwnAgent(user, agent)) return deny("own_agent", "You can't escalate on your own Agent", 403);
  if (!hasActiveSub) return deny("not_subscriber", "An active subscription is required", 403);
  return allow;
}

/** Validate an agent is complete enough to be PUBLISHED. */
export function publishReady(a: { name?: string; description?: string; features?: any[]; price?: number }): Guard {
  if (!a.name || a.name.trim().length < 2) return deny("name", "Agent needs a name", 400);
  if (!a.description || a.description.trim().length < 10) return deny("desc", "Add a longer description before publishing", 400);
  if (!a.features || a.features.filter((f: string) => f && f.trim()).length < 1) return deny("features", "Add at least one capability", 400);
  if (!a.price || a.price < 1) return deny("price", "Price must be at least $1", 400);
  return allow;
}

/** Regulated verticals — surface the "informational, not licensed advice" disclaimer
 *  and accountability routing. Single source of truth (seed + creator create + edit). */
export const REGULATED_CATEGORIES = ["legal", "finance", "compliance", "transaction", "healthcare", "insurance", "realestate"];
export function isRegulated(category: string): boolean {
  return REGULATED_CATEGORIES.includes(category);
}
