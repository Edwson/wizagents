import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCreatorStore, getUserSubscriptions } from "@/lib/data";
import { reputationFor } from "@/lib/reputation";
import { getCurrentUser } from "@/lib/auth";
import AgentCard from "@/components/AgentCard";
import { getLocale, pick, type Locale } from "@/lib/locale";
import {
  IconLicense, IconShieldCheck, IconStar, IconRefresh, IconFileCertificate, IconMessages, IconUsers,
  IconHistory, IconMapPin, IconLink, IconEye, IconMessage2, IconBook, IconArrowRight,
} from "@tabler/icons-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import { levelOf } from "@/lib/verification";
import { db } from "@/lib/db";
import ReputationExport from "@/components/ReputationExport";
import { parseFeatures } from "@/lib/format";
import { catLabel } from "@/lib/categories";
import { renderMarkdown } from "@/lib/markdown";
import { kindLabel } from "@/lib/forum-shared";
import { absUrl, breadcrumbJsonLd, metaDescription, personJsonLd, jsonLdScript } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** The profile fields the storefront renders. Kept in one place so metadata and the page agree. */
const PROFILE_SELECT = {
  verified: true, identityVerified: true, headline: true, about: true, howIWork: true,
  coverMediaId: true, avatarMediaId: true, links: true, location: true,
} as const;

type ProfileRow = {
  verified: boolean; identityVerified: boolean; headline: string; about: string; howIWork: string;
  coverMediaId: string | null; avatarMediaId: string | null; links: string; location: string;
} | null;

/** `links` is a JSON string the expert controls. Parse defensively; http(s) only. */
function parseLinks(raw: string): { label: string; url: string }[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({ label: String(x?.label ?? "").trim(), url: String(x?.url ?? "").trim() }))
      .filter((x) => x.url && /^https?:\/\//i.test(x.url))
      .map((x) => ({ label: x.label || x.url.replace(/^https?:\/\//i, "").replace(/\/+$/, ""), url: x.url }))
      .slice(0, 8);
  } catch {
    return [];
  }
}

/** Topics an expert demonstrably works on: their own tags, plus the categories they publish into. */
async function expertise(id: string): Promise<string[]> {
  const rows = await db.agent.findMany({ where: { creatorId: id, status: "published" }, select: { tags: true, category: true } });
  const out: string[] = [];
  for (const r of rows) {
    for (const t of parseFeatures(r.tags)) { const v = String(t).trim(); if (v) out.push(v); }
    out.push(catLabel(r.category, "en"));
  }
  return Array.from(new Set(out));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [store, profile] = await Promise.all([
    getCreatorStore(id),
    db.creatorProfile.findUnique({ where: { userId: id }, select: PROFILE_SELECT }) as Promise<ProfileRow>,
  ]);
  if (!store) return { title: "Expert not found", robots: { index: false, follow: false } };

  const level = levelOf(profile);
  const isExpert = level === "expert";
  const n = store.agents.length;
  const titleBits = [store.displayName, profile?.headline || store.verticalLabel, isExpert ? "Verified Expert" : ""].filter(Boolean);
  const title = titleBits.join(" — ");
  const description = metaDescription(
    profile?.headline ||
      store.bio ||
      `${store.displayName}${store.verticalLabel ? `, ${store.verticalLabel}` : ""}${isExpert ? " — a Verified Expert on WizAgents" : ""}. ${n} published Agent${n === 1 ? "" : "s"} you can subscribe to and use in any AI tool.`,
  );
  const url = absUrl(`/creator/${id}`);
  const topics = await expertise(id);
  const cover = profile?.coverMediaId ? [{ url: absUrl(`/api/media/${profile.coverMediaId}`) }] : undefined;

  return {
    title,
    description,
    keywords: [store.displayName, store.verticalLabel, ...topics].filter(Boolean),
    alternates: { canonical: url },
    // An expert with nothing published has no public listing worth indexing.
    ...(n === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "profile", url, siteName: "WizAgents", title: `${title} · WizAgents`, description, ...(cover ? { images: cover } : {}) },
    twitter: { card: "summary_large_image", title: `${title} · WizAgents`, description },
  };
}

export default async function CreatorStore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  const [store, rep, profile, posts] = await Promise.all([
    getCreatorStore(id),
    reputationFor(id),
    // getCreatorStore only exposes `verified`; the tier needs identityVerified too.
    db.creatorProfile.findUnique({ where: { userId: id }, select: PROFILE_SELECT }) as Promise<ProfileRow>,
    // What the expert has published in public — the part a buyer can read before paying.
    db.post.findMany({
      where: { authorId: id, status: "published" },
      orderBy: { lastActivityAt: "desc" },
      take: 8,
      select: {
        slug: true, kind: true, title: true, excerpt: true, views: true, replyCount: true,
        agent: { select: { name: true, slug: true } },
      },
    }),
  ]);
  if (!store) notFound();
  const level = levelOf(profile);
  const user = await getCurrentUser();
  let subscribedIds: string[] = [], hasPass = false;
  if (user) { const subs = await getUserSubscriptions(user.id); subscribedIds = subs.map((s) => s.agentId); hasPass = !!user.pass?.active; }
  const subSet = new Set(subscribedIds);
  const isOwner = user?.id === store.id;

  const links = parseLinks(profile?.links || "[]");
  const guides = posts.filter((p) => p.kind === "guide");
  const writing = posts.filter((p) => p.kind !== "guide");

  const person = jsonLdScript(personJsonLd({
    id: store.id,
    name: store.displayName,
    bio: profile?.headline || store.bio,
    vertical: store.verticalLabel,
    level,
    licenseInfo: store.licenseInfo,
    knowsAbout: await expertise(store.id),
  }));
  const crumbs = jsonLdScript(breadcrumbJsonLd([
    { name: "WizAgents", path: "/" },
    { name: "Marketplace", path: "/market" },
    { name: store.displayName, path: `/creator/${store.id}` },
  ]));

  const ledger = rep ? [
    { icon: IconStar, v: rep.avgRating >= 1 ? rep.avgRating.toFixed(1) : "—", l: P("Avg. rating", "平均評価", "平均評分") },
    { icon: IconRefresh, v: `${rep.avgRenewal}%`, l: P("Avg. renewal", "平均更新率", "平均續訂率") },
    { icon: IconUsers, v: rep.subscribers.toLocaleString(), l: P("Subscribers", "登録者", "訂閱者") },
    { icon: IconFileCertificate, v: rep.endorsementsSigned, l: P("Citations signed", "署名した引用", "已簽核背書") },
    { icon: IconMessages, v: rep.escalationsResolved, l: P("Escalations resolved", "解決した対応", "已解決升級") },
    { icon: IconHistory, v: rep.correctionsShipped, l: P("Corrections shipped", "改善の反映", "已推送修正") },
  ] : [];

  return (
    <div className="animate-fadein">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: person }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />

      {/* header */}
      <div className="glass-card overflow-hidden">
        {/* cover */}
        {profile?.coverMediaId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/${profile.coverMediaId}`}
            alt=""
            className="h-40 w-full border-b border-border object-cover sm:h-52"
          />
        )}

        <div className="p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {profile?.avatarMediaId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/${profile.avatarMediaId}`}
                  alt={store.displayName}
                  className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple text-[22px] font-bold text-white font-display">{store.displayName.slice(0, 1)}</div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[24px] font-bold">{store.displayName}</h1>
                  <VerifiedBadge level={level} />
                </div>
                {profile?.headline && <p className="mt-1 max-w-xl text-[14px] leading-6 text-text">{profile.headline}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                  {profile?.location && (
                    <span className="inline-flex items-center gap-1 text-faint"><IconMapPin size={13} stroke={1.7} />{profile.location}</span>
                  )}
                  {profile?.location && store.verticalLabel && <span className="text-faint">·</span>}
                  {store.verticalLabel && <span>{store.verticalLabel}</span>}
                  {rep && <span className="text-faint"> · {P("Member since", "登録", "加入於")} {rep.memberSince}</span>}
                </div>
                {store.bio && <p className="mt-2 max-w-xl text-[13px] leading-7 text-muted">{store.bio}</p>}
                {store.licenseInfo && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green"><IconLicense size={13} stroke={1.8} /> {store.licenseInfo}</div>}
                {links.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel2 px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:border-borderlight hover:text-text"
                      >
                        <IconLink size={12} stroke={1.7} className="text-faint" />
                        {l.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {rep && (
              <div className="flex flex-col items-end gap-2">
                <div className="glass-card px-5 py-3 text-center">
                  <div className="font-display text-[30px] font-bold text-text">{rep.standing}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-faint">{P("Standing", "スタンディング", "信譽指數")}</div>
                  <div className="mt-0.5 text-[9px] text-faint">{P("illustrative", "参考値", "示意")}</div>
                </div>
                {rep.cleanRecord && <span className="inline-flex items-center gap-1 text-[10.5px] text-green"><IconShieldCheck size={13} stroke={1.8} /> {P("Clean safety record", "クリーンな安全記録", "安全紀錄良好")}</span>}
              </div>
            )}
          </div>

          {/* reputation ledger */}
          {rep && (
            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint"><span className="inline-block h-px w-6 bg-border" />{P("Reputation ledger", "信頼台帳", "信譽台帳")}</div>
                <ReputationExport id={store.id} isOwner={isOwner} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {ledger.map((x) => (
                  <div key={x.l} className="rounded-lg border border-border bg-panel2 px-3 py-3">
                    <x.icon size={16} stroke={1.7} className="text-muted" />
                    <div className="mt-1.5 font-display text-[18px] font-bold">{x.v}</div>
                    <div className="text-[10.5px] leading-4 text-faint">{x.l}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10.5px] leading-5 text-faint">{P("A traceable record the expert owns and can take with them — recognition as demonstrated usefulness, not a gatekept title. Figures illustrative until independently audited.", "専門家が所有し持ち運べる追跡可能な記録 — 称号ではなく実証された有用性としての評価。数値は独立監査まで参考値。", "一份由專家擁有、可隨身帶走的可追溯紀錄——以實證的有用性、而非被把關的頭銜來被認可。數據於獨立稽核前僅為示意。")}</p>
            </div>
          )}
        </div>
      </div>

      {/* about / how I work */}
      {(profile?.about || profile?.howIWork) && (
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {profile?.about && (
            <section className="glass-card p-6">
              <SectionTitle>{P("About", "プロフィール", "關於")}</SectionTitle>
              {/* renderMarkdown() escapes everything first and re-introduces only a closed set of
                  markdown constructs — no raw HTML, no remote images, no javascript:/data: URLs. */}
              <div
                className="mt-3 text-[13.5px] leading-7 text-text [&_p]:text-muted [&_li]:text-muted"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(profile.about) }}
              />
            </section>
          )}
          {profile?.howIWork && (
            <section className="glass-card p-6">
              <SectionTitle>{P("How I work", "仕事の進め方", "我如何工作")}</SectionTitle>
              <div
                className="mt-3 text-[13.5px] leading-7 text-text [&_p]:text-muted [&_li]:text-muted"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(profile.howIWork) }}
              />
            </section>
          )}
        </div>
      )}

      {/* agents */}
      <div className="mb-3 mt-8 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint"><span className="inline-block h-px w-6 bg-border" />{P(`${store.displayName}’s Agents`, `${store.displayName} のエージェント`, `${store.displayName} 的 Agent`)}</div>
      {store.agents.length === 0 ? (
        <div className="glass-card py-16 text-center text-muted">{P("This expert hasn’t published any Agents yet.", "この専門家はまだエージェントを公開していません。", "這位專家尚未發布 Agent")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.agents.map((a) => <AgentCard key={a.id} a={a} subscribed={subSet.has(a.id)} hasPass={hasPass} />)}
        </div>
      )}

      {/* guides — how to get more out of these Agents */}
      {guides.length > 0 && (
        <>
          <div className="mb-1 mt-10 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="inline-block h-px w-6 bg-border" />
            {P("Guides to these Agents", "エージェントの使い方ガイド", "這些 Agent 的使用指南")}
          </div>
          <p className="mb-3 text-[12px] leading-6 text-faint">
            {P(
              "Written by the expert: how to get more out of the Agents above.",
              "専門家自身が書いた、上のエージェントを使いこなすための解説です。",
              "由專家親自撰寫：如何更好地使用上面的 Agent。",
            )}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {guides.map((p) => <PostRow key={p.slug} p={p} locale={locale} />)}
          </div>
        </>
      )}

      {/* writing */}
      {writing.length > 0 && (
        <>
          <div className="mb-3 mt-10 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="inline-block h-px w-6 bg-border" />
            {P("Writing", "執筆", "文章")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {writing.map((p) => <PostRow key={p.slug} p={p} locale={locale} />)}
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint">
      <span className="inline-block h-px w-6 bg-border" />
      {children}
    </div>
  );
}

type PostRowData = {
  slug: string; kind: string; title: string; excerpt: string; views: number; replyCount: number;
  agent: { name: string; slug: string } | null;
};

/** One published post, as a buyer sees it before paying anything. */
function PostRow({ p, locale }: { p: PostRowData; locale: Locale }) {
  const isGuide = p.kind === "guide";
  return (
    <Link
      href={`/community/${p.slug}`}
      className="glass-card group flex flex-col gap-2 p-5 transition-colors hover:border-borderlight"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${
            isGuide ? "border-purple/40 bg-purple/10 text-purple" : "border-border bg-panel2 text-muted"
          }`}
        >
          {isGuide && <IconBook size={11} stroke={1.8} />}
          {kindLabel(p.kind, locale)}
        </span>
        {p.agent && (
          <span className="inline-flex items-center gap-1 text-[10.5px] text-faint">
            <IconArrowRight size={11} stroke={1.8} />
            {p.agent.name}
          </span>
        )}
      </div>
      <div className="font-display text-[15px] font-bold leading-6 text-text transition-colors group-hover:text-accent">{p.title}</div>
      {p.excerpt && <p className="line-clamp-2 text-[12.5px] leading-relaxed text-muted">{p.excerpt}</p>}
      <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] text-faint">
        <span className="flex items-center gap-1"><IconEye size={13} stroke={1.7} />{p.views}</span>
        <span className="flex items-center gap-1"><IconMessage2 size={13} stroke={1.7} />{p.replyCount}</span>
      </div>
    </Link>
  );
}
