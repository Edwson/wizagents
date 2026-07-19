import type { Metadata } from "next";
import { getPublishedAgents, getUserSubscriptions } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, pick } from "@/lib/locale";
import { db } from "@/lib/db";
import { parseFeatures } from "@/lib/format";
import MarketBrowser from "@/components/MarketBrowser";
import TagChips from "@/components/TagChips";
import { absUrl, metaDescription } from "@/lib/seo";
import { IconSearch, IconScale, IconHeart, IconBolt } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const n = await db.agent.count({ where: { status: "published" } });
  const title = "Agent Marketplace";
  const description = metaDescription(
    `Browse ${n} expert Agents on WizAgents — each authored by a named, accountable specialist and kept current by them. Subscribe with one MCP URL and use it inside any AI tool.`,
  );
  const url = absUrl("/market");
  return {
    title,
    description,
    keywords: ["expert agents", "AI marketplace", "MCP", "verified experts", "subscribe to an expert"],
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: "WizAgents", title: `${title} · WizAgents`, description },
    twitter: { card: "summary_large_image", title: `${title} · WizAgents`, description },
  };
}

/** The topics experts actually tag their Agents with — each one a crawlable landing page. */
async function popularTags(limit = 12): Promise<string[]> {
  const rows = await db.agent.findMany({ where: { status: "published" }, select: { tags: true } });
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const raw of parseFeatures(r.tags)) {
      const t = String(raw).trim();
      if (t) counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, limit);
}

export default async function MarketPage() {
  const [agents, user, locale, tags] = await Promise.all([getPublishedAgents(), getCurrentUser(), getLocale(), popularTags()]);
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  let subscribedIds: string[] = [];
  let hasPass = false;
  if (user) {
    const subs = await getUserSubscriptions(user.id);
    subscribedIds = subs.map((s) => s.agentId);
    hasPass = !!user.pass?.active;
  }
  const links = [
    { href: "/search", icon: <IconSearch size={14} stroke={1.7} />, label: P("Advanced search", "詳細検索", "進階搜尋") },
    { href: "/compare", icon: <IconScale size={14} stroke={1.7} />, label: P("Compare", "比較", "Agent 比較") },
    { href: "/favorites", icon: <IconHeart size={14} stroke={1.7} />, label: P("Favorites", "お気に入り", "我的收藏") },
    { href: "/mcp", icon: <IconBolt size={14} stroke={1.7} />, label: P("MCP access", "MCP接続", "MCP 接入") },
  ];
  return (
    <div className="animate-fadein">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-glassborder/40 bg-panel/40 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulsedot" />
        <span>wizagents://mcp.marketplace/<span className="text-grad-neon font-semibold">browse</span></span>
      </div>
      <h1 className="mb-1 mt-4 font-display text-[30px] font-bold">{P("Agent Marketplace", "Agent マーケット", "Agent 市集")}</h1>
      <p className="mb-3 text-[13px] text-muted">{P("Browse verified expert Agents · subscribe with one URL into any AI tool", "認証済み専門家Agentを閲覧 · URL一つでどのAIツールにも接続", "瀏覽已驗證的專家 Agent · 訂閱一個 URL 即可接入任何 AI 工具")}</p>
      <div className="mb-6 flex flex-wrap gap-2 text-[12px]">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="flex items-center gap-1.5 rounded-lg border border-border bg-panel2 px-3 py-1.5 text-muted hover:text-text">{l.icon}{l.label}</a>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{P("Topics", "トピック", "主題")}</span>
          <TagChips tags={tags} />
        </div>
      )}
      <MarketBrowser agents={agents} subscribedIds={subscribedIds} hasPass={hasPass} />
    </div>
  );
}
