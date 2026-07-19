import { NextResponse } from "next/server";
import { reputationFor } from "@/lib/reputation";

// Public, portable reputation record. ?format=download streams a signed-looking JSON file
// the expert can take with them — reputation you can trace and carry.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await reputationFor(id);
  if (!rec) return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "download") {
    const body = JSON.stringify({ issuer: "WizAgents", kind: "expert-reputation-record", note: "Illustrative until independently audited. Portable and owned by the expert.", record: rec }, null, 2);
    return new NextResponse(body, { headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="wizagents-reputation-${id.slice(0,8)}.json"`,
    } });
  }
  return NextResponse.json({ ok: true, record: rec });
}
