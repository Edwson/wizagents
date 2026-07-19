// SEO primitives: canonical URLs + schema.org JSON-LD.
//
// The point of this file is discovery: an expert who publishes an Agent here should
// be findable by the people who need them. Structured data is how a search engine
// learns that "WizAgents" hosts a *named human expert* with credentials — not an
// anonymous prompt. We only assert what the data actually supports: no rating when
// there are no reviews, no credential when the reviewer hasn't checked one.

import type { Level } from "./verification";

export type JsonLd = Record<string, unknown>;

const FALLBACK_ORIGIN = "https://wiz-agents.com";

/** Public origin of the site, without a trailing slash. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_ORIGIN;
  return raw.replace(/\/+$/, "");
}

/** Absolute URL for a site-relative path (canonical / OG / JSON-LD `url`). */
export function absUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${p}`;
}

/** One-line, length-capped copy for <meta name="description">. */
export function metaDescription(text: string, max = 155): string {
  const s = (text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const stop = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("、"), cut.lastIndexOf("，"));
  return `${(stop > max * 0.6 ? cut.slice(0, stop) : cut).trim()}…`;
}

/* ---------------- topic tags ---------------- */

/** URL-safe form of an expert-authored tag: "Series A" → "series-a". */
export function tagSlug(tag: string): string {
  return encodeURIComponent(
    (tag || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[/?#]/g, ""),
  );
}
/** Route for a topic tag landing page. */
export function tagHref(tag: string): string {
  return `/tag/${tagSlug(tag)}`;
}
/** True when a raw tag belongs on the page for `slug` (slug comparison, so case/spacing tolerant). */
export function tagMatches(tag: string, slug: string): boolean {
  return tagSlug(tag) === tagSlug(decodeURIComponent(slug));
}

/* ---------------- BCP-47 ---------------- */

export function bcp47(lang?: string): string {
  return lang === "ja" ? "ja-JP" : lang === "zh" ? "zh-TW" : "en-US";
}

/* ---------------- JSON-LD builders ---------------- */

export type SeoAgent = {
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  price: number;
  rating?: number;
  reviewCount?: number;
  subscribers?: number;
  tags?: string[];
  category?: string;
  agentType?: string;
  lang?: string;
  creatorId?: string;
  creatorName: string;
  creatorLevel?: Level;
  creatorVertical?: string;
  createdAt?: Date | string;
};

/**
 * schema.org `Product` for a subscribable Agent.
 * `brand`/`provider` is the expert as a Person — the trust anchor of the listing.
 */
export function agentJsonLd(a: SeoAgent): JsonLd {
  const url = absUrl(`/agent/${a.slug}`);
  const expert: JsonLd = {
    "@type": "Person",
    name: a.creatorName,
    ...(a.creatorId ? { url: absUrl(`/creator/${a.creatorId}`) } : {}),
    ...(a.creatorVertical ? { jobTitle: a.creatorVertical } : {}),
  };
  const tags = (a.tags || []).filter(Boolean);
  const hasRating = typeof a.rating === "number" && a.rating >= 1 && (a.reviewCount || 0) > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#agent`,
    name: a.name,
    url,
    description: metaDescription(a.description || a.tagline || "", 300),
    ...(a.tagline ? { slogan: a.tagline } : {}),
    ...(a.category ? { category: a.category } : {}),
    ...(tags.length ? { keywords: tags.join(", ") } : {}),
    inLanguage: bcp47(a.lang),
    brand: expert,
    // The expert stays the accountable party for what the Agent says.
    additionalProperty: [
      { "@type": "PropertyValue", name: "Agent type", value: a.agentType || "mentor" },
      ...(typeof a.subscribers === "number"
        ? [{ "@type": "PropertyValue", name: "Subscribers", value: String(a.subscribers) }]
        : []),
    ],
    offers: {
      "@type": "Offer",
      url,
      price: String(a.price),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      category: "subscription",
      seller: { "@type": "Organization", name: "WizAgents", url: siteUrl() },
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: a.price,
        priceCurrency: "USD",
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: "MON",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
    },
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(a.rating).toFixed(1),
            reviewCount: a.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export type SeoExpert = {
  id: string;
  name: string;
  bio?: string;
  vertical?: string;
  level?: Level;
  licenseInfo?: string;
  knowsAbout?: string[];
};

/** schema.org `Person` for an expert's public store. */
export function personJsonLd(e: SeoExpert): JsonLd {
  const url = absUrl(`/creator/${e.id}`);
  const knows = Array.from(new Set((e.knowsAbout || []).filter(Boolean)));
  const credentials: JsonLd[] = [];
  if (e.level === "expert") {
    credentials.push({
      "@type": "EducationalOccupationalCredential",
      name: "Verified Expert",
      credentialCategory: "Professional verification",
      description: "Identity and professional credentials checked by a human reviewer at WizAgents.",
      recognizedBy: { "@type": "Organization", name: "WizAgents", url: siteUrl() },
    });
  }
  if (e.licenseInfo) {
    credentials.push({
      "@type": "EducationalOccupationalCredential",
      name: e.licenseInfo,
      credentialCategory: "License",
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${url}#person`,
    name: e.name,
    url,
    ...(e.vertical ? { jobTitle: e.vertical } : {}),
    ...(e.bio ? { description: metaDescription(e.bio, 300) } : {}),
    ...(knows.length ? { knowsAbout: knows } : {}),
    ...(credentials.length ? { hasCredential: credentials } : {}),
    worksFor: { "@type": "Organization", name: "WizAgents", url: siteUrl() },
  };
}

export type Crumb = { name: string; path: string };

/** schema.org `BreadcrumbList` — `path` is site-relative. */
export function breadcrumbJsonLd(items: Crumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
}

/** schema.org `ItemList` — used by the topic tag landing pages. */
export function itemListJsonLd(name: string, paths: string[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: paths.length,
    itemListElement: paths.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absUrl(p) })),
  };
}

/**
 * Serialize JSON-LD for embedding in a <script> tag.
 * Agent names, taglines, tags and creator names are USER-CONTROLLED. A raw
 * JSON.stringify lets `</script>` break out of the tag and execute — stored XSS.
 * Escape the characters that can terminate the script context (and the JS line
 * separators that break JSON parsers).
 */
export function jsonLdScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
