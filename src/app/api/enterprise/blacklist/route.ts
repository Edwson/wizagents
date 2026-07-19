import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { orgContext } from "@/lib/org";

/** Block an Agent for the whole organization. A block always wins over the allowlist. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const ctx = await orgContext(user);
  if (!ctx || !ctx.isAdmin) return NextResponse.json({ error: "Only an organization admin can change governance." }, { status: 403 });
  const org = ctx.orgOwnerId;

  const { slug, reason, removeId } = await req.json();
  if (removeId) {
    await db.blacklist.deleteMany({ where: { id: removeId, orgOwnerId: org } });
    return NextResponse.json({ ok: true });
  }
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const existing = await db.blacklist.findFirst({ where: { orgOwnerId: org, agentId: agent.id } });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, already: true });
  const bl = await db.blacklist.create({ data: { orgOwnerId: org, agentId: agent.id, agentName: agent.name, reason: reason || "" } });
  return NextResponse.json({ ok: true, id: bl.id });
}
