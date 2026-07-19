import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { parseFeatures } from "@/lib/format";
import { absUrl, tagSlug } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agents = await db.agent.findMany({
    where: { status: "published" },
    select: { slug: true, creatorId: true, tags: true, createdAt: true, subscribers: true },
  });

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absUrl("/market"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absUrl("/accountability"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const agentEntries: MetadataRoute.Sitemap = agents.map((a) => ({
    url: absUrl(`/agent/${a.slug}`),
    lastModified: a.createdAt,
    changeFrequency: "weekly",
    // A widely-subscribed Agent is a page more people are looking for.
    priority: a.subscribers >= 100 ? 0.9 : 0.8,
  }));

  // Only experts with something published deserve an indexed store page.
  const creatorLast = new Map<string, Date>();
  for (const a of agents) {
    const prev = creatorLast.get(a.creatorId);
    if (!prev || a.createdAt > prev) creatorLast.set(a.creatorId, a.createdAt);
  }
  const creatorEntries: MetadataRoute.Sitemap = [...creatorLast.entries()].map(([id, last]) => ({
    url: absUrl(`/creator/${id}`),
    lastModified: last,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const tagLast = new Map<string, { last: Date; slug: string }>();
  for (const a of agents) {
    for (const raw of parseFeatures(a.tags)) {
      const t = String(raw).trim();
      if (!t) continue;
      const key = tagSlug(t);
      if (!key) continue;
      const prev = tagLast.get(key);
      if (!prev || a.createdAt > prev.last) tagLast.set(key, { last: a.createdAt, slug: key });
    }
  }
  const tagEntries: MetadataRoute.Sitemap = [...tagLast.values()].map((t) => ({
    url: absUrl(`/tag/${t.slug}`),
    lastModified: t.last,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...agentEntries, ...creatorEntries, ...tagEntries];
}
