import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { notify } from "@/lib/notify";

/**
 * Submit credentials for HUMAN review. Verification is the core product, not a
 * self-serve badge — a creator can never mark themselves verified. An admin
 * reviews and approves (see /api/admin/verify). Re-submitting after a rejection
 * moves the profile back into the queue.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const b = await readJson(req); if (!b) return badRequest();

  const licenseInfo = String(b.licenseInfo || "").trim();
  const bio = String(b.bio || "").trim();
  const verticalLabel = String(b.verticalLabel || "").trim();
  if (licenseInfo.length < 8) return NextResponse.json({ error: "Describe your credentials / licence so a human can verify them (min 8 chars)." }, { status: 400 });
  if (bio.length < 20) return NextResponse.json({ error: "Add a fuller professional bio (min 20 chars) — a reviewer reads this." }, { status: 400 });

  const existing = await db.creatorProfile.findUnique({ where: { userId: user.id } });
  if (existing?.verified) {
    // already verified — allow profile edits without touching verification state
    await db.creatorProfile.update({ where: { userId: user.id }, data: { licenseInfo, bio, verticalLabel: verticalLabel || existing.verticalLabel } });
    return NextResponse.json({ ok: true, status: "approved", alreadyVerified: true });
  }

  await db.creatorProfile.upsert({
    where: { userId: user.id },
    update: { licenseInfo, bio, verticalLabel: verticalLabel || undefined, verificationStatus: "pending", verified: false },
    create: { userId: user.id, displayName: user.name, licenseInfo, bio, verticalLabel: verticalLabel || "", verificationStatus: "pending", verified: false },
  });
  await notify(user.id, "welcome", "Verification submitted", "A human reviewer will check your credentials. You'll be notified when the review completes.", "/studio/verification");
  return NextResponse.json({ ok: true, status: "pending" });
}
