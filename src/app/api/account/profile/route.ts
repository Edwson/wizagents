import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { rateLimit } from "@/lib/security";
import { guardText } from "@/lib/forum";
import { seclog } from "@/lib/seclog";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Anyone's own account details — buyer, creator, enterprise alike. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const u = await db.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, role: true, avatarColor: true, avatarMediaId: true, bio: true, location: true, website: true, orgName: true, emailVerified: true },
  });
  return NextResponse.json({ ok: true, profile: u });
}

/**
 * Edit your own details.
 *
 * Note what is NOT here: email, role, and every verification or payout field. Those either
 * change who you are or what the platform vouches for, so they do not belong on the form
 * you use to pick a photo.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const rl = rateLimit("profile:" + user.id, 30, 300_000);   // 30 saves / 5 min
  if (!rl.ok) return NextResponse.json({ error: "Too many changes at once. Try again shortly." }, { status: 429 });
  const b = await readJson(req);
  if (!b) return badRequest();

  const data: any = {};

  if (typeof b.name === "string") {
    const n = b.name.trim().slice(0, 60);
    if (n.length < 2) return NextResponse.json({ error: "Your name needs at least 2 characters." }, { status: 400 });
    data.name = n;
  }
  if (typeof b.bio === "string") data.bio = b.bio.trim().slice(0, 200);
  if (typeof b.location === "string") data.location = b.location.trim().slice(0, 60);
  if (typeof b.orgName === "string" && (user.role === "enterprise" || user.role === "admin")) {
    data.orgName = b.orgName.trim().slice(0, 80);
  }
  if (typeof b.website === "string") {
    const w = b.website.trim();
    if (w && !/^https?:\/\//i.test(w)) return NextResponse.json({ error: "A website has to start with http:// or https://." }, { status: 400 });
    data.website = w.slice(0, 200);
  }
  if (typeof b.avatarColor === "string") {
    if (!HEX.test(b.avatarColor)) return NextResponse.json({ error: "That colour isn't a valid hex value." }, { status: 400 });
    data.avatarColor = b.avatarColor;
  }

  // An avatar must be an image YOU uploaded. Pointing at someone else's media id would let
  // one account quietly attach itself to another's file.
  if ("avatarMediaId" in b) {
    if (!b.avatarMediaId) data.avatarMediaId = null;
    else {
      const m = await db.media.findUnique({ where: { id: String(b.avatarMediaId) }, select: { ownerId: true, mime: true } });
      if (!m || m.ownerId !== user.id) {
        await seclog(user.id, "profile_updated", `denied: tried to attach an image owned by another account`, req).catch(() => {});
        return NextResponse.json({ error: "That image isn't yours." }, { status: 403 });
      }
      if (!m.mime.startsWith("image/")) return NextResponse.json({ error: "An avatar has to be an image." }, { status: 415 });
      data.avatarMediaId = String(b.avatarMediaId);
    }
  }

  // Your bio is public writing, so it goes through the same harvesting guard as everything else.
  const text = [data.bio, data.name].filter(Boolean).join("\n");
  if (text) {
    const refusal = await guardText(user.id, text, "account-profile", null);
    if (refusal) return NextResponse.json({ error: refusal, code: "extraction" }, { status: 422 });
  }

  await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}
