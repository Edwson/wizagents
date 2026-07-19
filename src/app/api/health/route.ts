import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Liveness + DB readiness probe for load balancers / orchestrators.
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, status: "healthy", db: "up", ms: Date.now() - started, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, status: "degraded", db: "down" }, { status: 503 });
  }
}
