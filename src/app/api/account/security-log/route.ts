import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Your account's security history — you should be able to see what happened to it.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const logs = await db.securityLog.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, kind: true, detail: true, ip: true, userAgent: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, logs });
}
