import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { rateLimit } from "@/lib/security";
import { guardText } from "@/lib/forum";

export const dynamic = "force-dynamic";

const LIMITS = { bio: 200, headline: 90, about: 6000, howIWork: 1500, location: 60 };

/** Only http(s) links, max 6, each with a short label. A profile is not a redirect service. */
function cleanLinks(raw: unknown): string {
  if (!Array.isArray(raw)) return "[]";
  const out = raw
    .filter((l: any) => l && typeof l.url === "string")
    .map((l: any) => ({ label: String(l.label || "").slice(0, 40), url: String(l.url).trim() }))
    .filter((l) => /^https?:\/\//i.test(l.url) && !/^javascript:/i.test(l.url) && l.url.length < 300)
    .slice(0, 6);
  return JSON.stringify(out);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const p = await db.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!p) return NextResponse.json({ error: "No creator profile" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    profile: {
      displayName: p.displayName, bio: p.bio, headline: p.headline, about: p.about,
      howIWork: p.howIWork, coverMediaId: p.coverMediaId, avatarMediaId: p.avatarMediaId,
      links: JSON.parse(p.links || "[]"), location: p.location, verticalLabel: p.verticalLabel,
      verified: p.verified, identityVerified: p.identityVerified,
    },
  });
}

/**
 * Edit your own introduction.
 * A creator sells their judgement, so the page that introduces them is part of the product.
 * The verification marks are NOT editable here — those are granted by review, never self-asserted.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const rl = rateLimit("profile:" + user.id, 30, 300_000);   // 30 saves / 5 min
  if (!rl.ok) return NextResponse.json({ error: "Too many changes at once. Try again shortly." }, { status: 429 });
  const p = await db.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!p) return NextResponse.json({ error: "You don't have a creator profile yet." }, { status: 404 });

  const b = await readJson(req);
  if (!b) return badRequest();

  const data: any = {};
  for (const k of ["bio", "headline", "about", "howIWork", "location"] as const) {
    if (typeof b[k] === "string") data[k] = b[k].trim().slice(0, (LIMITS as any)[k]);
  }
  if (typeof b.displayName === "string" && b.displayName.trim().length >= 2) data.displayName = b.displayName.trim().slice(0, 60);
  if (typeof b.verticalLabel === "string") data.verticalLabel = b.verticalLabel.trim().slice(0, 40);
  if ("links" in b) data.links = cleanLinks(b.links);
  if ("coverMediaId" in b) data.coverMediaId = b.coverMediaId ? String(b.coverMediaId) : null;
  if ("avatarMediaId" in b) data.avatarMediaId = b.avatarMediaId ? String(b.avatarMediaId) : null;

  // The same harvesting guard as everywhere else — a profile is public writing too.
  const text = [data.headline, data.about, data.howIWork, data.bio].filter(Boolean).join("\n");
  if (text) {
    const refusal = await guardText(user.id, text, "profile", null);
    if (refusal) return NextResponse.json({ error: refusal, code: "extraction" }, { status: 422 });
  }

  await db.creatorProfile.update({ where: { userId: user.id }, data });
  return NextResponse.json({ ok: true });
}
