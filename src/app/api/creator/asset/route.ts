import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { scanAsset } from "@/lib/scan";

export const dynamic = "force-dynamic";

// Upload a creator asset. The file bytes are scanned in-memory and NEVER
// persisted — only the scan verdict + metadata are stored in AssetUpload.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const slug = form.get("slug");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const { status, detail, sha256 } = await scanAsset(file.name, file.type, buf);

  // Resolve agentId from slug only when the agent belongs to this creator.
  let agentId: string | null = null;
  if (slug && typeof slug === "string") {
    const agent = await db.agent.findUnique({ where: { slug } });
    if (agent && agent.creatorId === user.id) agentId = agent.id;
  }

  const row = await db.assetUpload.create({
    data: {
      creatorId: user.id,
      agentId,
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      size: buf.length,
      sha256,
      scanStatus: status,
      scanDetail: detail,
      quarantined: status !== "clean",
    },
  });

  // 200 even when flagged so the UI can render the verdict.
  return NextResponse.json({
    ok: true,
    status,
    detail,
    id: row.id,
    quarantined: row.quarantined,
  });
}

// Recent uploads for the signed-in creator.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const uploads = await db.assetUpload.findMany({
    where: { creatorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ uploads });
}
