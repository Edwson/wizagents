import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const isAdmin = scope === "admin" && user.role === "admin";

  const where = isAdmin ? {} : { agent: { creatorId: user.id } };

  const [rows, grouped] = await Promise.all([
    db.securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { agent: { select: { name: true, slug: true } } },
    }),
    db.securityEvent.groupBy({
      by: ["kind"],
      where,
      _count: { _all: true },
    }),
  ]);

  const events = rows.map((e) => ({
    id: e.id,
    kind: e.kind,
    detail: e.detail,
    agentName: e.agent?.name ?? "",
    agentSlug: e.agent?.slug ?? "",
    createdAt: e.createdAt,
    subId: e.subId,
  }));

  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.kind] = g._count._all;

  return NextResponse.json({ events, counts });
}
