import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/market");

  const cfg = await getConfig();
  const [users, buyers, creators, agentsCount, published, suspended, activeSubs, subsAgg, passes, requests, pending] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "buyer" } }),
    db.user.count({ where: { role: "creator" } }),
    db.agent.count(),
    db.agent.count({ where: { status: "published" } }),
    db.agent.count({ where: { status: "suspended" } }),
    db.subscription.count({ where: { status: "active" } }),
    db.subscription.aggregate({ where: { status: "active", viaPass: false }, _sum: { price: true } }),
    db.pass.count({ where: { active: true } }),
    db.usageEvent.count(),
    db.creatorProfile.count({ where: { verificationStatus: { in: ["pending", "none"] } } }),
  ]);
  const [payPending, payPaid, escAgg] = await Promise.all([
    db.payout.aggregate({ where: { status: { in: ["requested", "processing"] } }, _sum: { netAmount: true } }),
    db.payout.aggregate({ where: { status: "paid" }, _sum: { netAmount: true } }),
    db.transaction.aggregate({ where: { type: { in: ["escalation", "signature"] }, status: "succeeded" }, _sum: { amount: true } }),
  ]);
  const gmv = (subsAgg._sum.price || 0) + passes * cfg.passPrice;
  const platformRev = Math.round(gmv * (cfg.takeRatePct / 100));
  const addonGmv = escAgg._sum.amount || 0;
  const mrr = gmv;
  const arr = gmv * 12;
  const arpu = activeSubs > 0 ? Math.round(gmv / activeSubs) : 0;
  const payoutPending = Math.round(payPending._sum.netAmount || 0);
  const payoutPaid = Math.round(payPaid._sum.netAmount || 0);

  const kpi = { users, creators, buyers, agents: agentsCount, published, suspended, activeSubs, gmv, platformRev, requests, pendingVerify: pending, mrr, arr, arpu, payoutPending, payoutPaid, addonGmv };

  const [agentRows, userRows, verRows, txRows] = await Promise.all([
    db.agent.findMany({ orderBy: { subscribers: "desc" }, take: 40 }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    db.creatorProfile.findMany({ where: { verificationStatus: { in: ["pending", "none"] } }, include: { user: true }, take: 30 }),
    db.transaction.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { user: true } }),
  ]);

  return (
    <AdminClient
      kpi={kpi}
      config={cfg}
      agents={agentRows.map((a) => ({ id: a.id, slug: a.slug, name: a.name, creatorName: a.creatorName, category: a.category, price: a.price, subscribers: a.subscribers, status: a.status, rating: a.rating }))}
      users={userRows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt.toISOString() }))}
      verifications={verRows.map((v) => ({ userId: v.userId, name: v.user.name, email: v.user.email, vertical: v.verticalLabel, license: v.licenseInfo, status: v.verificationStatus }))}
      transactions={txRows.map((t) => ({ type: t.type, amount: t.amount, note: t.note, createdAt: t.createdAt.toISOString(), email: t.user.email }))}
    />
  );
}
