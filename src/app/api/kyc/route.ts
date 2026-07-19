import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { notify } from "@/lib/notify";

// GET my KYC submission + current verification state.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const [kyc, profile] = await Promise.all([
    db.kycSubmission.findUnique({ where: { userId: user.id } }),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
  ]);
  return NextResponse.json({ ok: true, kyc, profile: profile ? { verified: profile.verified, identityVerified: profile.identityVerified, kycStatus: profile.kycStatus, verificationStatus: profile.verificationStatus } : null });
}

/**
 * Submit KYC for human review. Never self-approving.
 * Document bytes are NOT stored — the upload endpoint scans them in memory and we
 * keep only the AssetUpload reference (hash + scan verdict).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const b = await readJson(req); if (!b) return badRequest();

  const legalName = String(b.legalName || "").trim();
  const country = String(b.country || "").trim();
  const idType = ["passport", "national_id", "drivers_licence"].includes(b.idType) ? b.idType : "passport";
  if (legalName.length < 2) return NextResponse.json({ error: "Enter your full legal name" }, { status: 400 });
  if (country.length < 2) return NextResponse.json({ error: "Select your country" }, { status: 400 });
  if (!b.idDocId) return NextResponse.json({ error: "Upload a government ID document" }, { status: 400 });

  // Any uploaded document must have passed the malware scan and belong to this user.
  const docIds = [b.idDocId, b.selfieId, b.credentialDocId].filter(Boolean) as string[];
  const docs = await db.assetUpload.findMany({ where: { id: { in: docIds }, creatorId: user.id } });
  if (docs.length !== docIds.length) return NextResponse.json({ error: "One or more documents could not be found" }, { status: 400 });
  const bad = docs.find((d) => d.quarantined || d.scanStatus !== "clean");
  if (bad) return NextResponse.json({ error: `Document "${bad.fileName}" failed the safety scan and cannot be submitted.`, code: "unsafe_doc" }, { status: 400 });

  const links = Array.isArray(b.links) ? b.links.filter((x: any) => typeof x === "string" && x.trim()).slice(0, 5) : [];

  const data = {
    legalName, country, idType,
    idDocId: b.idDocId, selfieId: b.selfieId || null, credentialDocId: b.credentialDocId || null,
    licenceNumber: String(b.licenceNumber || "").trim(),
    issuingBody: String(b.issuingBody || "").trim(),
    links: JSON.stringify(links),
    status: "submitted", grantedLevel: "none", reviewerNote: "", reviewedAt: null,
  };
  await db.kycSubmission.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
  await db.creatorProfile.upsert({
    where: { userId: user.id },
    update: { kycStatus: "submitted" },
    create: { userId: user.id, displayName: user.name, kycStatus: "submitted" },
  });
  await notify(user.id, "welcome", "Verification submitted", "A human reviewer will check your identity and credentials. You'll be notified when the review completes.", "/studio/verification");
  return NextResponse.json({ ok: true, status: "submitted" });
}
