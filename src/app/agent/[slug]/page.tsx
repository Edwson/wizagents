import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { levelOf } from "@/lib/verification";
import { entitlementFor } from "@/lib/entitlement";
import { getAgentBySlug, getPublishedAgents } from "@/lib/data";
import { similarAgents } from "@/lib/recommend";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseFeatures } from "@/lib/format";
import { absUrl, agentJsonLd, breadcrumbJsonLd, metaDescription, jsonLdScript } from "@/lib/seo";
import AgentDetail, { type DetailAgent } from "@/components/AgentDetail";
import { getLocale, pick, type Locale } from "@/lib/locale";
import { kindLabel } from "@/lib/forum-shared";
import { IconBook, IconEye, IconMessage2 } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const a = await getAgentBySlug(slug, viewer ? { id: viewer.id, role: viewer.role } : null);
  if (!a) return { title: "Agent not found", robots: { index: false, follow: false } };

  const tags = parseFeatures(a.tags);
  const title = a.tagline ? `${a.name} — ${a.tagline}` : a.name;
  const description = metaDescription(a.tagline || a.pitch || a.description || "");
  const url = absUrl(`/agent/${a.slug}`);

  // An unpublished Agent is a private preview for its owner. It must never enter an index.
  if (a.status !== "published") {
    return { title, description, robots: { index: false, follow: false }, alternates: { canonical: url } };
  }

  return {
    title,
    description,
    keywords: [...tags, a.creatorName, "expert agent", "MCP"],
    authors: [{ name: a.creatorName, url: absUrl(`/creator/${a.creatorId}`) }],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "WizAgents",
      title: `${title} · WizAgents`,
      description,
      locale: a.lang === "ja" ? "ja_JP" : a.lang === "zh" ? "zh_TW" : "en_US",
    },
    twitter: { card: "summary_large_image", title: `${title} · WizAgents`, description },
  };
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const a = await getAgentBySlug(slug, user ? { id: user.id, role: user.role } : null);
  if (!a) notFound();

  // Preview: the owner (or an admin) may view an unpublished Agent exactly as a buyer would.
  // Everyone else gets a 404 — an unpublished Agent must not exist for the public.
  const canPreview = !!user && (a.creatorId === user.id || user.role === "admin");
  const preview = a.status !== "published";
  if (preview && !canPreview) notFound();

  let subscribed = false, token: string | null = null, hasPass = false, favorited = false;
  let viewerSub: { startedAt: string; lockedPrice?: number | null; credits?: number } | undefined;
  let viaSeat = false;
  if (user) {
    const ent = await entitlementFor(user.id, a.id);
    if (ent.ok) {
      subscribed = true;
      // A seat member uses the org's subscription; the org's token stays with the org.
      token = ent.viaSeat ? null : ent.sub.mcpToken;
      viaSeat = ent.viaSeat;
      viewerSub = { startedAt: ent.sub.startedAt.toISOString(), lockedPrice: ent.sub.lockedPrice, credits: ent.sub.credits };
    }
    hasPass = !!user.pass?.active;
    favorited = !!(await db.favorite.findUnique({ where: { userId_agentId: { userId: user.id, agentId: a.id } } }));
  }

  const dto: DetailAgent = {
    slug: a.slug, name: a.name, creatorId: a.creatorId, creatorName: a.creatorName, category: a.category, agentType: a.agentType, creatorLevel: levelOf((a as any).creator?.creatorProfile), price: a.price,
    renewal: a.renewal, subscribers: a.subscribers, rating: a.rating, description: a.description,
    features: parseFeatures(a.features), updatedLabel: a.updatedLabel, inPass: a.inPass,
    trialLimit: a.trialLimit, escalationPrice: a.escalationPrice, signaturePrice: a.signaturePrice,
    replacesRate: a.replacesRate, replacesRole: a.replacesRole, savesHrs: a.savesHrs,
    knowledgeSummary: a.knowledgeSummary,
    pitch: a.pitch || "",
    useCases: parseFeatures(a.useCases),
    notFor: a.notFor || "",
    sampleQuestions: parseFeatures(a.sampleQuestions),
    tags: parseFeatures(a.tags),
    status: a.status,
    knowledgeVersions: a.knowledgeVersions.map((k) => ({ version: k.version, note: k.note, docCount: k.docCount, createdAt: k.createdAt.toISOString() })),
    reviews: a.reviews.map((r) => ({ authorName: r.authorName, rating: r.rating, comment: r.comment })),
    metrics: a.metrics.map((m) => ({ month: m.month, subscribers: m.subscribers })),
    fidelityScore: a.fidelityScore, fidelityMeasuredAt: a.fidelityMeasuredAt?.toISOString() ?? null, fidelitySamplesN: a.fidelitySamples_n, regulated: a.regulated,
    verticalLabel: a.creator?.creatorProfile?.verticalLabel || "",
    creatorBio: a.creator?.creatorProfile?.bio || "",
    licenseInfo: a.creator?.creatorProfile?.licenseInfo || "",
  };

  const all = await getPublishedAgents();
  const target = all.find((x) => x.slug === slug);
  const similar = target ? similarAgents(target, all) : [];
  const more = all.filter((x) => x.creatorName === a.creatorName && x.slug !== slug).slice(0, 4);
  let subscribedIds: string[] = [];
  if (user) {
    const activeSubs = await db.subscription.findMany({ where: { userId: user.id, status: "active" }, select: { agentId: true } });
    subscribedIds = activeSubs.map((row) => row.agentId);
  }

  // The promotion loop: the expert's public writing about THIS Agent. Guides first — they are
  // written to teach a buyer how to get more out of it — then anything else linked to it.
  // Nothing published about it means nothing rendered; an empty state here would be clutter.
  const locale = await getLocale();
  const linkedPosts = await db.post.findMany({
    where: { agentId: a.id, status: "published" },
    orderBy: [{ lastActivityAt: "desc" }],
    select: { slug: true, kind: true, title: true, excerpt: true, views: true, replyCount: true },
  });
  const guides = [
    ...linkedPosts.filter((p) => p.kind === "guide"),
    ...linkedPosts.filter((p) => p.kind !== "guide"),
  ].slice(0, 6);

  // Structured data — only for a published Agent; a preview asserts nothing to the world.
  let jsonLd: string | null = null;
  let crumbs: string | null = null;
  if (!preview) {
    const reviewCount = await db.review.count({ where: { agentId: a.id } });
    jsonLd = jsonLdScript(
      agentJsonLd({
        slug: a.slug,
        name: a.name,
        tagline: a.tagline,
        description: a.pitch || a.description,
        price: a.price,
        rating: a.rating,
        reviewCount,
        subscribers: a.subscribers,
        tags: dto.tags,
        category: a.category,
        agentType: a.agentType,
        lang: a.lang,
        creatorId: a.creatorId,
        creatorName: a.creatorName,
        creatorLevel: dto.creatorLevel,
        creatorVertical: dto.verticalLabel,
      }),
    );
    crumbs = jsonLdScript(
      breadcrumbJsonLd([
        { name: "WizAgents", path: "/" },
        { name: "Marketplace", path: "/market" },
        { name: a.name, path: `/agent/${a.slug}` },
      ]),
    );
  }

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      {crumbs && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />}
      <AgentDetail agent={dto} subscribed={subscribed} token={token} hasPass={hasPass} loggedIn={!!user} favorited={favorited} similar={similar} more={more} subscribedIds={subscribedIds} preview={preview} subscription={viewerSub} viaSeat={viaSeat} />
      {guides.length > 0 && <GuidesFromTheExpert posts={guides} authorName={a.creatorName} locale={locale} />}
    </>
  );
}

type GuidePost = { slug: string; kind: string; title: string; excerpt: string; views: number; replyCount: number };

function GuidesFromTheExpert({ posts, authorName, locale }: { posts: GuidePost[]; authorName: string; locale: Locale }) {
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  return (
    <section className="animate-fadein mt-10">
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint">
        <span className="inline-block h-px w-6 bg-border" />
        {P("Guides from the expert", "専門家による使い方ガイド", "來自專家的指南")}
      </div>
      <p className="mb-3 text-[12px] leading-6 text-faint">
        {P(
          `Public writing by ${authorName} about this Agent — how to get more out of it. Free to read.`,
          `${authorName} がこのエージェントについて書いた公開記事です。使いこなすための解説を無料で読めます。`,
          `${authorName} 針對這個 Agent 撰寫的公開文章——如何用得更好。免費閱讀。`,
        )}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => {
          const isGuide = p.kind === "guide";
          return (
            <Link
              key={p.slug}
              href={`/community/${p.slug}`}
              className="glass-card group flex flex-col gap-2 p-5 transition-colors hover:border-borderlight"
            >
              <span
                className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${
                  isGuide ? "border-purple/40 bg-purple/10 text-purple" : "border-border bg-panel2 text-muted"
                }`}
              >
                {isGuide && <IconBook size={11} stroke={1.8} />}
                {kindLabel(p.kind, locale)}
              </span>
              <div className="font-display text-[15px] font-bold leading-6 text-text transition-colors group-hover:text-accent">{p.title}</div>
              {p.excerpt && <p className="line-clamp-2 text-[12.5px] leading-relaxed text-muted">{p.excerpt}</p>}
              <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] text-faint">
                <span className="flex items-center gap-1"><IconEye size={13} stroke={1.7} />{p.views}</span>
                <span className="flex items-center gap-1"><IconMessage2 size={13} stroke={1.7} />{p.replyCount}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
