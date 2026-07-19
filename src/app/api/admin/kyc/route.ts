import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { notify } from "@/lib/notify";

// The review queue.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const rows = await db.kycSubmission.findMany({
    where: { status: { in: ["submitted", "in_review"] } },
    orderBy: { createdAt: "asc" }, take: 50,
    include: { user: { include: { creatorProfile: true } } },
  });
  const docIds = rows.flatMap((r) => [r.idDocId, r.selfieId, r.credentialDocId].filter(Boolean) as string[]);
  const docs = docIds.length ? await db.assetUpload.findMany({ where: { id: { in: docIds } } }) : [];
  const byId: Record<string, any> = {};
  for (const d of docs) byId[d.id] = { fileName: d.fileName, mime: d.mime, size: d.size, scanStatus: d.scanStatus, sha256: d.sha256.slice(0, 12) };
  return NextResponse.json({ ok: true, submissions: rows.map((r) => ({
    id: r.id, userId: r.userId, name: r.user.name, email: r.user.email,
    legalName: r.legalName, country: r.country, idType: r.idType,
    licenceNumber: r.licenceNumber, issuingBody: r.issuingBody,
    links: JSON.parse(r.links || "[]"), status: r.status, createdAt: r.createdAt,
    docs: { id: r.idDocId ? byId[r.idDocId] : null, selfie: r.selfieId ? byId[r.selfieId] : null, credential: r.credentialDocId ? byId[r.credentialDocId] : null },
  })) });
}

/**
 * Grant a verification tier after human review.
 *   grant: "identity" → Identity verified
 *   grant: "expert"   → Verified Expert (identity + credentials) — unlocks signing citations
 *   grant: "reject"   → rejected, with a reason
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const b = await readJson(req); if (!b) return badRequest();
  const { userId, grant, note } = b;
  if (!userId || !["identity", "expert", "reject"].includes(grant)) return NextResponse.json({ error: "Invalid grant" }, { status: 400 });

  const reject = grant === "reject";
  const expert = grant === "expert";
  await db.$transaction(async (tx) => {
    await tx.kycSubmission.update({ where: { userId }, data: {
      status: reject ? "rejected" : "approved",
      grantedLevel: reject ? "none" : grant,
      reviewerNote: String(note || "").slice(0, 500),
      reviewedAt: new Date(),
    } });
    await tx.creatorProfile.update({ where: { userId }, data: {
      identityVerified: !reject,                       // both tiers confirm a real human
      verified: expert,                                // only "expert" earns the Verified Expert mark
      kycStatus: reject ? "rejected" : "approved",
      verificationStatus: expert ? "approved" : reject ? "rejected" : "pending",
    } });
  });

  await notify(
    userId, "welcome",
    reject ? "Verification not approved" : expert ? "Verified Expert approved" : "Identity verified",
    reject
      ? `A reviewer could not approve your submission.${note ? ` Reason: ${note}` : ""} You can update your details and resubmit.`
      : expert
        ? "Your identity and credentials were confirmed. Your Agents now carry the Verified Expert mark, and you can sign citable endorsements."
        : "Your identity was confirmed. Add professional credentials to reach Verified Expert and unlock citable endorsements.",
    "/studio/verification"
  );
  return NextResponse.json({ ok: true, grant });
}
