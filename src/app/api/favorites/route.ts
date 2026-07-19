import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ slugs: [] });

  const favorites = await db.favorite.findMany({
    where: { userId: user.id },
    include: { agent: true },
  });
  const slugs = favorites.map((f) => f.agent.slug);
  return NextResponse.json({ slugs });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const slug = body?.slug;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const existing = await db.favorite.findUnique({
    where: { userId_agentId: { userId: user.id, agentId: agent.id } },
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, favorited: false });
  }

  await db.favorite.create({ data: { userId: user.id, agentId: agent.id } });
  return NextResponse.json({ ok: true, favorited: true });
}
