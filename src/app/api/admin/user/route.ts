import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id, action, role } = await req.json();
  if (action === "setRole" && ["buyer", "creator", "enterprise", "admin"].includes(role)) {
    await db.user.update({ where: { id }, data: { role } });
    return NextResponse.json({ ok: true, role });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
