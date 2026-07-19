import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SERVEABLE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * Serve an uploaded image. Public by default (forum images, avatars, published covers).
 * The one exception: if this image is the cover of a post that is NOT published, it is
 * only served to its owner — a draft's cover shouldn't be reachable before the draft is.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await db.media.findUnique({ where: { id } });
  if (!m || !SERVEABLE.has(m.mime)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const draftCover = await db.post.findFirst({ where: { coverMediaId: id, status: { not: "published" } }, select: { id: true } });
  if (draftCover) {
    const user = await getCurrentUser();
    if (!user || (user.id !== m.ownerId && user.role !== "admin")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return new NextResponse(Buffer.from(m.bytes) as any, {
    headers: {
      "Content-Type": m.mime,
      "Content-Length": String(m.size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": draftCover ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  });
}
