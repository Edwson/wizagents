import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ notifications: [], unread: 0 });
  const [notifications, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({
    notifications: notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, read: n.read, createdAt: n.createdAt.toISOString() })),
    unread,
  });
}
