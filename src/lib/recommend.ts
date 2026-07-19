import type { AgentDTO } from "./data";

/** Composite trending/quality score for ranking. */
export function score(a: AgentDTO): number {
  return a.subscribers * 0.4 + a.renewal * 2.2 + a.rating * 12 + (a.trending ? 40 : 0);
}

/** Agents similar to a target: same category first, then close price & high quality. */
export function similarAgents(target: AgentDTO, all: AgentDTO[], limit = 4): AgentDTO[] {
  return all
    .filter((a) => a.id !== target.id && a.lang === target.lang)
    .map((a) => {
      let s = 0;
      if (a.category === target.category) s += 100;
      s += Math.max(0, 30 - Math.abs(a.price - target.price) / 3); // price proximity
      s += a.rating * 5 + a.renewal * 0.3;
      return { a, s };
    })
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.a);
}

/**
 * Personalized ranking: boost agents in categories the user already engages with
 * (subscribed / favorited), exclude already-subscribed, respect language.
 */
export function personalized(all: AgentDTO[], opts: { subscribedIds: Set<string>; affinityCats: string[]; locale: string }, limit = 6): AgentDTO[] {
  const affinity = new Set(opts.affinityCats);
  return all
    .filter((a) => !opts.subscribedIds.has(a.id) && a.lang === opts.locale)
    .map((a) => ({ a, s: score(a) + (affinity.has(a.category) ? 60 : 0) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.a);
}
