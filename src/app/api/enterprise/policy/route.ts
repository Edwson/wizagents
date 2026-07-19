import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { orgContext } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const org = await orgContext(user as any);
  if (!org) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });
  const [owner, allow, block] = await Promise.all([
    db.user.findUnique({ where: { id: org.orgOwnerId }, select: { orgPolicy: true } }),
    db.orgAllowlist.findMany({ where: { orgOwnerId: org.orgOwnerId } }),
    db.blacklist.findMany({ where: { orgOwnerId: org.orgOwnerId } }),
  ]);
  return NextResponse.json({ ok: true, policy: owner?.orgPolicy || "open", allowlist: allow, blacklist: block });
}

/**
 * "open"      → seats may use any Agent the org subscribes to (blacklist still blocks)
 * "allowlist" → seats may ONLY use Agents on the allowlist
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const org = await orgContext(user as any);
  if (!org?.isAdmin) return NextResponse.json({ error: "Only an organization admin can change policy" }, { status: 403 });
  const b = await readJson(req); if (!b) return badRequest();

  if (b.policy) {
    const p = b.policy === "allowlist" ? "allowlist" : "open";
    await db.user.update({ where: { id: org.orgOwnerId }, data: { orgPolicy: p } });
    return NextResponse.json({ ok: true, policy: p });
  }
  if (b.addSlug || b.removeId) {
    if (b.removeId) {
      await db.orgAllowlist.deleteMany({ where: { id: String(b.removeId), orgOwnerId: org.orgOwnerId } });
      return NextResponse.json({ ok: true });
    }
    const agent = await db.agent.findUnique({ where: { slug: String(b.addSlug) } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    await db.orgAllowlist.upsert({
      where: { orgOwnerId_agentId: { orgOwnerId: org.orgOwnerId, agentId: agent.id } },
      update: {}, create: { orgOwnerId: org.orgOwnerId, agentId: agent.id, agentName: agent.name },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
}
