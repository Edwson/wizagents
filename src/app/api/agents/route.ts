import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.agent.findMany({
    where: { status: "published" },
    select: { slug: true, name: true, creatorName: true, category: true, price: true },
    orderBy: { subscribers: "desc" },
  });
  return NextResponse.json({ agents: rows });
}
