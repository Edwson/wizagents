import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgContext, SEAT_PRICE } from "@/lib/org";
import EnterpriseClient from "@/components/EnterpriseClient";
export const dynamic = "force-dynamic";

export default async function EnterprisePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await orgContext(user as any);

  /* ---------------- member view: no admin rights ---------------- */
  if (!ctx) {
    const seat = await db.enterpriseSeat.findFirst({
      where: { OR: [{ memberUserId: user.id }, { memberEmail: user.email }] },
      orderBy: { createdAt: "desc" },
    });

    let orgAgents: { id: string; slug: string; name: string; price: number }[] = [];
    let orgName = "";
    let requests: any[] = [];

    if (seat) {
      const [owner, subs, blocked, allowed, myReqs] = await Promise.all([
        db.user.findUnique({ where: { id: seat.orgOwnerId }, select: { name: true, orgName: true, orgPolicy: true } }),
        db.subscription.findMany({ where: { userId: seat.orgOwnerId, status: "active" }, include: { agent: true } }),
        db.blacklist.findMany({ where: { orgOwnerId: seat.orgOwnerId }, select: { agentId: true } }),
        db.orgAllowlist.findMany({ where: { orgOwnerId: seat.orgOwnerId }, select: { agentId: true } }),
        db.accessRequest.findMany({ where: { requesterId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      ]);
      orgName = owner?.orgName || owner?.name || "";
      const blockedIds = new Set(blocked.map((b) => b.agentId));
      const allowedIds = new Set(allowed.map((a) => a.agentId));
      const allowlistMode = owner?.orgPolicy === "allowlist";
      orgAgents = subs
        .filter((s) => s.agent && !blockedIds.has(s.agentId) && (!allowlistMode || allowedIds.has(s.agentId)))
        .map((s) => ({ id: s.agent.id, slug: s.agent.slug, name: s.agent.name, price: s.agent.price }));
      requests = myReqs;
    }

    return <EnterpriseClient
      orgName={orgName}
      isAdmin={false}
      isOwner={false}
      mySeat={seat ? {
        id: seat.id, memberEmail: seat.memberEmail, memberName: seat.memberName, role: seat.role,
        status: seat.status, dailyLimit: seat.dailyLimit, linked: !!seat.memberUserId,
        invitedAt: seat.invitedAt.toISOString(), acceptedAt: seat.acceptedAt?.toISOString() ?? null,
      } : null}
      seats={[]}
      audit={[]}
      blacklist={[]}
      allowlist={[]}
      policy="open"
      requests={requests.map((r) => ({
        id: r.id, requesterEmail: r.requesterEmail, agentName: r.agentName, reason: r.reason,
        status: r.status, note: r.note, createdAt: r.createdAt.toISOString(),
      }))}
      orgAgents={orgAgents}
      teamSubs={0}
      seatCount={0}
      activeSeatCount={0}
      orgSpend={0}
      subsCost={0}
      budget={0}
      seatPrice={SEAT_PRICE}
    />;
  }

  /* ---------------- admin view ---------------- */
  const orgOwnerId = ctx.orgOwnerId;
  const [owner, seats, audit, blacklist, allowlist, requests, ownerSubs] = await Promise.all([
    db.user.findUnique({ where: { id: orgOwnerId }, select: { name: true, orgName: true, orgBudgetMonthly: true, orgPolicy: true } }),
    db.enterpriseSeat.findMany({ where: { orgOwnerId }, orderBy: { createdAt: "asc" } }),
    db.auditLog.findMany({ where: { orgOwnerId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.blacklist.findMany({ where: { orgOwnerId }, orderBy: { createdAt: "desc" } }),
    db.orgAllowlist.findMany({ where: { orgOwnerId }, orderBy: { createdAt: "desc" } }),
    db.accessRequest.findMany({ where: { orgOwnerId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.subscription.findMany({ where: { userId: orgOwnerId, status: "active" }, include: { agent: true } }),
  ]);

  const seatCount = seats.length;
  const activeSeatCount = seats.filter((s) => s.status === "active").length;
  const seatCost = activeSeatCount * SEAT_PRICE;
  const subsCost = ownerSubs.reduce((sum, s) => sum + (s.viaPass ? 0 : (s.lockedPrice ?? s.agent?.price ?? s.price ?? 0)), 0);
  const orgSpend = seatCost + subsCost;

  return <EnterpriseClient
    orgName={owner?.orgName || owner?.name || user.name}
    isAdmin
    isOwner={!!ctx.isOwner}
    mySeat={null}
    seats={seats.map((s) => ({
      id: s.id, memberEmail: s.memberEmail, memberName: s.memberName, role: s.role, status: s.status,
      dailyLimit: s.dailyLimit, linked: !!s.memberUserId,
      invitedAt: s.invitedAt.toISOString(), acceptedAt: s.acceptedAt?.toISOString() ?? null,
    }))}
    audit={audit.map((a) => ({ actorEmail: a.actorEmail, agentName: a.agentName, action: a.action, query: a.query, createdAt: a.createdAt.toISOString() }))}
    blacklist={blacklist.map((b) => ({ id: b.id, agentName: b.agentName, reason: b.reason }))}
    allowlist={allowlist.map((a) => ({ id: a.id, agentName: a.agentName }))}
    policy={owner?.orgPolicy || "open"}
    requests={requests.map((r) => ({
      id: r.id, requesterEmail: r.requesterEmail, agentName: r.agentName, reason: r.reason,
      status: r.status, note: r.note, createdAt: r.createdAt.toISOString(),
    }))}
    orgAgents={ownerSubs.filter((s) => s.agent).map((s) => ({ id: s.agent.id, slug: s.agent.slug, name: s.agent.name, price: s.agent.price }))}
    teamSubs={ownerSubs.length}
    seatCount={seatCount}
    activeSeatCount={activeSeatCount}
    orgSpend={orgSpend}
    subsCost={subsCost}
    budget={owner?.orgBudgetMonthly ?? 0}
    seatPrice={SEAT_PRICE}
  />;
}
