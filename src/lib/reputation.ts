import { db } from "./db";

// The portable, exportable expert reputation ledger (Product Master §10.3).
// Recognition as demonstrated usefulness the expert owns — reviews, renewal,
// citations given, corrections shipped, a clean safety record — traceable, not
// gatekept by a title. Every figure is illustrative until independently audited.
export type ReputationRecord = {
  creatorId: string;
  displayName: string;
  vertical: string;
  verified: boolean;
  licenseInfo: string;
  memberSince: string;         // ISO date
  agents: number;              // published agents
  subscribers: number;         // total active-ish subscribers across agents
  avgRating: number;           // 0–5
  avgRenewal: number;          // %
  endorsementsSigned: number;  // citable sign-offs given
  escalationsResolved: number; // human answers delivered
  correctionsShipped: number;  // knowledge-base updates beyond the initial version
  safetyIncidents: number;     // flagged security events on their agents (lower is better)
  cleanRecord: boolean;
  standing: number;            // 0–100 composite (illustrative)
  generatedAt: string;
};

export async function reputationFor(creatorId: string): Promise<ReputationRecord | null> {
  const user = await db.user.findUnique({ where: { id: creatorId }, include: { creatorProfile: true } });
  if (!user) return null;
  const agents = await db.agent.findMany({ where: { creatorId, status: "published" }, select: { id: true, rating: true, renewal: true, subscribers: true } });
  const agentIds = agents.map((a) => a.id);

  const [endorsementsSigned, escalationsResolved, kvCount, incidents] = await Promise.all([
    db.endorsement.count({ where: { expertUserId: creatorId, status: "signed" } }),
    db.escalation.count({ where: { expertUserId: creatorId, status: { in: ["answered", "signed"] } } }),
    agentIds.length ? db.knowledgeVersion.count({ where: { agentId: { in: agentIds } } }) : Promise.resolve(0),
    agentIds.length ? db.securityEvent.count({ where: { agentId: { in: agentIds }, kind: { in: ["token_flagged"] } } }) : Promise.resolve(0),
  ]);

  const n = agents.length;
  const subscribers = agents.reduce((s, a) => s + a.subscribers, 0);
  const avgRating = n ? Math.round((agents.reduce((s, a) => s + a.rating, 0) / n) * 10) / 10 : 0;
  const avgRenewal = n ? Math.round(agents.reduce((s, a) => s + a.renewal, 0) / n) : 0;
  const correctionsShipped = Math.max(0, kvCount - n); // versions beyond each agent's initial v1

  // Illustrative composite standing. Weighted, capped, and clearly labeled elsewhere.
  const tenureMonths = Math.max(0, (Date.now() - user.createdAt.getTime()) / (30 * 86400000));
  const standing = Math.min(100, Math.round(
    (avgRenewal * 0.4) +
    (avgRating / 5 * 100 * 0.25) +
    (Math.min(20, endorsementsSigned) * 0.6) +
    (Math.min(30, escalationsResolved) * 0.3) +
    (Math.min(24, tenureMonths) * 0.4) +
    (user.creatorProfile?.verified ? 8 : 0) -
    (incidents * 5)
  ));

  return {
    creatorId, displayName: user.creatorProfile?.displayName || user.name,
    vertical: user.creatorProfile?.verticalLabel || "",
    verified: !!user.creatorProfile?.verified,
    licenseInfo: user.creatorProfile?.licenseInfo || "",
    memberSince: user.createdAt.toISOString().slice(0, 10),
    agents: n, subscribers, avgRating, avgRenewal,
    endorsementsSigned, escalationsResolved, correctionsShipped,
    safetyIncidents: incidents, cleanRecord: incidents === 0,
    standing: Math.max(0, standing),
    generatedAt: new Date().toISOString(),
  };
}
