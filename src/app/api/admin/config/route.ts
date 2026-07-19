import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const b = await req.json();
  const data: any = {};
  for (const k of ["takeRatePct", "passPrice", "defaultTrial", "dailyRateLimit", "escalationFeePct"]) if (b[k] !== undefined) data[k] = Math.max(0, Number(b[k]));
  const cfg = await db.platformConfig.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  return NextResponse.json({ ok: true, config: cfg });
}
