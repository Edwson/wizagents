import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

/**
 * How buyers meet you.
 *
 * A creator sells their judgement, so the page that introduces them is part of the
 * product. Everything here is the creator's own words. The verification marks are NOT
 * editable — those are granted by review, never self-asserted, and the API refuses to
 * take them from this form.
 */
export default async function StudioProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "creator" && user.role !== "admin") redirect("/studio");

  const p = await db.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!p) redirect("/studio");

  let links: { label: string; url: string }[] = [];
  try {
    const parsed = JSON.parse(p.links || "[]");
    if (Array.isArray(parsed)) {
      links = parsed
        .filter((l: any) => l && typeof l.url === "string")
        .map((l: any) => ({ label: String(l.label || ""), url: String(l.url) }));
    }
  } catch { links = []; }

  return (
    <ProfileClient
      userId={user.id}
      profile={{
        displayName: p.displayName || user.name,
        bio: p.bio || "",
        headline: p.headline || "",
        about: p.about || "",
        howIWork: p.howIWork || "",
        location: p.location || "",
        verticalLabel: p.verticalLabel || "",
        coverMediaId: p.coverMediaId,
        avatarMediaId: p.avatarMediaId,
        links,
        verified: p.verified,
        identityVerified: p.identityVerified,
        verificationStatus: p.verificationStatus,
      }}
    />
  );
}
