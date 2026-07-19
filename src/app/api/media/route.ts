import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const MAX = 5 * 1024 * 1024; // 5 MB

/**
 * Image upload for posts.
 *
 * The client's Content-Type is never trusted: the bytes are sniffed and the MIME is
 * derived from the magic number. A file that claims to be a PNG but starts with
 * "<script" or "MZ" is rejected. Bytes live in the database, so there is no upload
 * directory to traverse, no executable path to reach, and nothing extra to mount
 * when self-hosting.
 */
function sniff(buf: Buffer): { mime: string; w: number; h: number } | null {
  if (buf.length < 12) return null;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: "image/png", w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mime: "image/jpeg", h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { mime: "image/jpeg", w: 0, h: 0 };
  }
  // WebP  RIFF....WEBP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", w: 0, h: 0 };
  }
  // GIF
  if (buf.toString("ascii", 0, 3) === "GIF") {
    return { mime: "image/gif", w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  return null;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const rl = rateLimit("media:" + user.id, 40, 3600_000);   // 40 uploads/hour per account
  if (!rl.ok) return NextResponse.json({ error: "You've uploaded a lot of images recently. Try again later." }, { status: 429 });

  // A per-account ceiling on stored image bytes (100 MB) so the DB can't be bloated.
  const agg = await db.media.aggregate({ where: { ownerId: user.id }, _sum: { size: true }, _count: true });
  if ((agg._sum.size || 0) > 100 * 1024 * 1024 || agg._count > 500) {
    return NextResponse.json({ error: "You've reached your image storage limit. Remove some images first." }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "No image provided." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX) return NextResponse.json({ error: "Images must be under 5 MB." }, { status: 413 });

  const s = sniff(buf);
  if (!s) return NextResponse.json({ error: "That file is not a PNG, JPEG, WebP or GIF image." }, { status: 415 });

  // Belt and braces: an image that carries a script tag in its bytes is not an image
  // we want to serve from our own origin.
  const head = buf.toString("latin1", 0, Math.min(buf.length, 2048)).toLowerCase();
  if (head.includes("<script") || head.includes("<?php") || head.startsWith("mz")) {
    return NextResponse.json({ error: "That image contains embedded code and was rejected." }, { status: 415 });
  }

  const sha256 = createHash("sha256").update(buf).digest("hex");
  const alt = String(form?.get("alt") || "").slice(0, 160);

  const m = await db.media.create({
    data: { ownerId: user.id, mime: s.mime, size: buf.length, sha256, width: s.w, height: s.h, bytes: buf, alt },
    select: { id: true, mime: true, width: true, height: true },
  });
  return NextResponse.json({ ok: true, id: m.id, url: `/api/media/${m.id}`, markdown: `![${alt || "image"}](/api/media/${m.id})` });
}
