import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowLeft, IconTag } from "@tabler/icons-react";
import { db } from "@/lib/db";
import { getPublishedAgents, getUserSubscriptions, type AgentDTO } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, pick } from "@/lib/locale";
import { parseFeatures } from "@/lib/format";
import { catLabel } from "@/lib/categories";
import AgentCard from "@/components/AgentCard";
import TagChips from "@/components/TagChips";
import { SectionLabel } from "@/components/ui";
import { absUrl, breadcrumbJsonLd, itemListJsonLd, metaDescription, tagMatches, tagSlug, jsonLdScript } from "@/lib/seo";

export const dynamic = "force-dynamic";

type TagRow = { slug: string; tags: string[] };

/** Published agents with their parsed, expert-authored tags. SQLite has no JSON contains — we filter in JS. */
async function taggedAgents(): Promise<TagRow[]> {
  const rows = await db.agent.findMany({ where: { status: "published" }, select: { slug: true, tags: true } });
  return rows.map((r) => ({ slug: r.slug, tags: parseFeatures(r.tags).map((t) => String(t).trim()).filter(Boolean) }));
}

/** The human-readable label for a tag slug — the expert's own spelling wins over the URL form. */
function labelFor(slug: string, rows: TagRow[]): string {
  for (const r of rows) for (const t of r.tags) if (tagMatches(t, slug)) return t;
  return decodeURIComponent(slug).replace(/-/g, " ");
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  const rows = await taggedAgents();
  const label = labelFor(tag, rows);
  const matched = rows.filter((r) => r.tags.some((t) => tagMatches(t, tag)));
  const n = matched.length;
  const title = `Expert Agents on ${label}`;
  const description = metaDescription(
    n > 0
      ? `${n} expert-built Agent${n === 1 ? "" : "s"} on ${label}. Each one is authored and kept current by a named, accountable expert — subscribe with one MCP URL and use it inside any AI tool.`
      : `Expert-built Agents on ${label} — authored and maintained by named, accountable experts on WizAgents.`,
  );
  const url = absUrl(`/tag/${tagSlug(label)}`);
  return {
    title,
    description,
    keywords: [label, "expert agent", "MCP", "WizAgents"],
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: `${title} · WizAgents`, description, siteName: "WizAgents" },
    twitter: { card: "summary_large_image", title: `${title} · WizAgents`, description },
  };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const [rows, all, user, locale] = await Promise.all([taggedAgents(), getPublishedAgents(), getCurrentUser(), getLocale()]);
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);

  const label = labelFor(tag, rows);
  const tagsBySlug = new Map(rows.map((r) => [r.slug, r.tags] as const));
  const agents: AgentDTO[] = all.filter((a) => (tagsBySlug.get(a.slug) || []).some((t) => tagMatches(t, tag)));

  let subscribedIds: string[] = [];
  let hasPass = false;
  if (user) {
    const subs = await getUserSubscriptions(user.id);
    subscribedIds = subs.map((s) => s.agentId);
    hasPass = !!user.pass?.active;
  }
  const subSet = new Set(subscribedIds);

  // Related tags: what else the experts working on this topic tag their Agents with.
  const here = new Set(agents.map((a) => a.slug));
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!here.has(r.slug)) continue;
    for (const t of r.tags) {
      if (tagMatches(t, tag)) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  // No agents on this tag yet? Show the platform's most-used tags so the page is still a way in.
  if (counts.size === 0) {
    for (const r of rows) for (const t of r.tags) if (!tagMatches(t, tag)) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const related = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 14);

  const cats = Array.from(new Set(agents.map((a) => a.category))).slice(0, 4);
  const experts = Array.from(new Set(agents.map((a) => a.creatorName)));

  const crumbs = breadcrumbJsonLd([
    { name: "WizAgents", path: "/" },
    { name: "Marketplace", path: "/market" },
    { name: `Expert Agents on ${label}`, path: `/tag/${tagSlug(label)}` },
  ]);
  const list = itemListJsonLd(`Expert Agents on ${label}`, agents.map((a) => `/agent/${a.slug}`));

  return (
    <div className="animate-fadein">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(list) }} />

      <Link href="/market" className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-text">
        <IconArrowLeft size={14} stroke={1.7} /> {P("All Agents", "すべてのAgent", "所有 Agent")}
      </Link>

      <div className="glass-card p-7">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint">
          <IconTag size={14} stroke={1.7} /> {P("Topic", "トピック", "主題")}
        </div>
        <h1 className="mt-2 font-display text-[30px] font-bold">
          {P(`Experts on #${label}`, `#${label} の専門家`, `#${label} 的專家`)}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-7 text-muted">
          {agents.length > 0
            ? P(
                `${agents.length} Agent${agents.length === 1 ? "" : "s"} on this topic, built by ${experts.length} named expert${experts.length === 1 ? "" : "s"}. Each one carries the judgement of the person who wrote it — what it is for, what it refuses, and who answers when it is wrong. Subscribe and connect it to any AI tool with a single MCP URL.`,
                `このトピックのAgentは ${agents.length} 件、${experts.length} 名の実名の専門家が構築。各Agentは作成者の判断を引き継ぎます — 何のためにあり、何を断り、誤ったときに誰が責任を負うのか。購読してMCP URL一つでどのAIツールにも接続できます。`,
                `本主題共有 ${agents.length} 個 Agent，由 ${experts.length} 位具名專家打造。每個 Agent 都承載作者的判斷——它為何而生、拒絕什麼、出錯時由誰負責。訂閱後即可用一個 MCP URL 接入任何 AI 工具。`,
              )
            : P(
                `No expert has published an Agent on this topic yet. If this is your field, this page is yours to claim.`,
                `このトピックのAgentはまだ公開されていません。あなたの専門分野なら、このページはあなたのものです。`,
                `目前尚無專家在此主題發布 Agent。若這是你的領域，這個頁面就等你來占據。`,
              )}
        </p>
        {cats.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
            <span>{P("Categories", "カテゴリ", "分類")}:</span>
            {cats.map((c) => (
              <span key={c} className="rounded-full border border-border bg-panel2 px-2 py-0.5 text-muted">{catLabel(c, locale)}</span>
            ))}
          </div>
        )}
      </div>

      {agents.length === 0 ? (
        <div className="glass-card mt-8 py-16 text-center">
          <p className="text-[13.5px] text-muted">{P("Nothing published here yet.", "まだ公開されたAgentはありません。", "此主題尚無已發布的 Agent。")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[12.5px]">
            <Link href="/market" className="rounded-lg border border-border bg-panel2 px-3 py-1.5 text-muted hover:text-text">
              {P("Browse the marketplace", "マーケットを見る", "瀏覽市集")}
            </Link>
            <Link href="/studio/create" className="rounded-lg border border-border bg-panel2 px-3 py-1.5 text-muted hover:text-text">
              {P("Publish the first one", "最初のAgentを公開する", "成為第一個發布者")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 mt-8">
            <SectionLabel>{P("Agents on this topic", "このトピックのAgent", "此主題的 Agent")}</SectionLabel>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={a.id} a={a} subscribed={subSet.has(a.id)} hasPass={hasPass} />
            ))}
          </div>
        </>
      )}

      {related.length > 0 && (
        <div className="mt-10">
          <div className="mb-3">
            <SectionLabel>{P("Related topics", "関連トピック", "相關主題")}</SectionLabel>
          </div>
          <TagChips tags={related} />
        </div>
      )}
    </div>
  );
}
