import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { orgContext, orgSpend, SEAT_PRICE } from "@/lib/org";

function csv(rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

/** Compliance export — an organization can take its own record with it at any time. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const ctx = await orgContext(user);
  if (!ctx || !ctx.isAdmin) return NextResponse.json({ error: "Only an organization admin can export." }, { status: 403 });

  const kind = new URL(req.url).searchParams.get("kind") || "audit";
  const org = ctx.orgOwnerId;
  let rows: (string | number)[][] = [];
  let name = "wizagents-export.csv";

  if (kind === "audit") {
    const logs = await db.auditLog.findMany({ where: { orgOwnerId: org }, orderBy: { createdAt: "desc" }, take: 5000 });
    rows = [["timestamp", "member", "agent", "action", "detail"]];
    for (const l of logs) rows.push([l.createdAt.toISOString(), l.actorEmail, l.agentName || "", l.action, (l.query || "").slice(0, 200)]);
    name = "wizagents-audit-log.csv";
  } else if (kind === "spend") {
    const seats = await db.enterpriseSeat.findMany({ where: { orgOwnerId: org } });
    const subs = await db.subscription.findMany({ where: { userId: org, status: "active" }, include: { agent: { select: { name: true, price: true } } } });
    const s = await orgSpend(org);
    rows = [["line_item", "detail", "monthly_usd"]];
    for (const seat of seats.filter((x) => x.status === "active")) rows.push(["Seat", seat.memberEmail, SEAT_PRICE]);
    for (const sub of subs) rows.push(["Agent subscription", sub.agent.name, sub.agent.price]);
    rows.push(["TOTAL", `${s.seats} seats + ${subs.length} agents`, s.total]);
    name = "wizagents-spend.csv";
  } else if (kind === "seats") {
    const seats = await db.enterpriseSeat.findMany({ where: { orgOwnerId: org }, orderBy: { invitedAt: "desc" } });
    rows = [["email", "role", "status", "invited", "accepted", "daily_limit"]];
    for (const x of seats) rows.push([x.memberEmail, x.role, x.status, x.invitedAt.toISOString(), x.acceptedAt?.toISOString() || "", x.dailyLimit || "unlimited"]);
    name = "wizagents-seats.csv";
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 400 });
  }

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
