import { db } from "./db";
import { levelOf, type Level } from "./verification";
import { parseFeatures } from "./format";

export type AgentDTO = {
  id: string;
  slug: string;
  name: string;
  creatorName: string;
  category: string;
  price: number;
  renewal: number;
  subscribers: number;
  rating: number;
  tagline: string;
  description: string;
  features: string[];
  updatedLabel: string;
  trending: boolean;
  inPass: boolean;
  replacesRate: number;
  replacesRole: string;
  savesHrs: number;
  escalationPrice: number;
  signaturePrice: number;
  lang: string;
  agentType: string;
  creatorLevel: Level;
};

function toDTO(a: any): AgentDTO {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    creatorName: a.creatorName,
    category: a.category,
    price: a.price,
    renewal: a.renewal,
    subscribers: a.subscribers,
    rating: a.rating,
    tagline: a.tagline,
    description: a.description,
    features: parseFeatures(a.features),
    updatedLabel: a.updatedLabel,
    trending: a.trending,
    inPass: a.inPass,
    replacesRate: a.replacesRate,
    replacesRole: a.replacesRole,
    savesHrs: a.savesHrs,
    escalationPrice: a.escalationPrice,
    signaturePrice: a.signaturePrice,
    lang: a.lang || "en",
    agentType: a.agentType || "mentor",
    creatorLevel: levelOf(a.creator?.creatorProfile),
  };
}

export async function getPublishedAgents(): Promise<AgentDTO[]> {
  const rows = await db.agent.findMany({
    where: { status: "published" },
    orderBy: [{ trending: "desc" }, { subscribers: "desc" }],
    include: { creator: { select: { name: true, avatarColor: true, avatarMediaId: true, creatorProfile: true } } },
  });
  return rows.map(toDTO);
}

/**
 * Fetch an Agent by slug. An UNPUBLISHED Agent is private: it resolves to null
 * unless the viewer is its owner or an admin. Enforced here (not just in the page)
 * so no caller can leak a draft by forgetting to check.
 */
export async function getAgentBySlug(slug: string, viewer?: { id?: string; role?: string } | null) {
  const a = await db.agent.findUnique({
    where: { slug },
    include: {
      knowledgeVersions: { orderBy: { createdAt: "desc" }, take: 5 },
      reviews: { orderBy: { createdAt: "desc" }, take: 8 },
      metrics: { orderBy: { month: "asc" } },
      creator: { select: { name: true, avatarColor: true, avatarMediaId: true, creatorProfile: true } },
    },
  });
  if (!a) return null;
  if (a.status !== "published") {
    const canView = viewer?.role === "admin" || (!!viewer?.id && a.creatorId === viewer.id);
    if (!canView) return null;
  }
  return a;
}

export async function getUserSubscriptions(userId: string) {
  return db.subscription.findMany({
    where: { userId, status: { in: ["active", "trial"] } },
    include: { agent: true },
    orderBy: { startedAt: "desc" },
  });
}

export async function platformStats() {
  const [agents, subs, creators] = await Promise.all([
    db.agent.count({ where: { status: "published" } }),
    db.subscription.count(),
    db.creatorProfile.count({ where: { verified: true } }),
  ]);
  return { agents, subs, creators };
}

export async function getCreatorStore(id: string) {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, avatarColor: true, avatarMediaId: true, createdAt: true, role: true, creatorProfile: true } });
  if (!user) return null;
  const rows = await db.agent.findMany({ where: { creatorId: id, status: "published" }, orderBy: [{ trending: "desc" }, { subscribers: "desc" }], include: { creator: { select: { name: true, avatarColor: true, avatarMediaId: true, creatorProfile: true } } } });
  const agents = rows.map(toDTO);
  const subscribers = rows.reduce((s, a) => s + a.subscribers, 0);
  const avgRenewal = rows.length ? Math.round(rows.reduce((s, a) => s + a.renewal, 0) / rows.length) : 0;
  const avgRating = rows.length ? (rows.reduce((s, a) => s + a.rating, 0) / rows.length) : 0;
  return {
    id: user.id, name: user.name,
    displayName: user.creatorProfile?.displayName || user.name,
    bio: user.creatorProfile?.bio || "",
    verticalLabel: user.creatorProfile?.verticalLabel || "",
    verified: !!user.creatorProfile?.verified,
    licenseInfo: user.creatorProfile?.licenseInfo || "",
    agents, subscribers, avgRenewal, avgRating,
  };
}

/** Categories the user engages with (from active subs + favorites) — for personalization. */
export async function getUserAffinityCats(userId: string): Promise<string[]> {
  const [subs, favs] = await Promise.all([
    db.subscription.findMany({ where: { userId }, include: { agent: { select: { category: true } } } }),
    db.favorite.findMany({ where: { userId }, include: { agent: { select: { category: true } } } }),
  ]);
  const cats = [...subs.map((s) => s.agent.category), ...favs.map((f) => f.agent.category)];
  return Array.from(new Set(cats));
}
