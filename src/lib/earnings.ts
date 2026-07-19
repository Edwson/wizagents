import { db } from "./db";
import { getConfig, creatorShare } from "./config";

export type Earnings = {
  lifetime: number;        // realized creator share, all time
  available: number;       // withdrawable now
  pending: number;         // requested, not yet paid
  withdrawn: number;       // paid out
  mrrGross: number;        // gross monthly recurring (list) across agents
  mrrNet: number;          // creator share of MRR
  subShare: number;        // lifetime from subscriptions
  addonShare: number;      // lifetime from escalations/signatures
  share: number;           // creator share fraction (e.g. 0.85)
  hasMethod: boolean;
  method: string;
  destinationMasked: string;
};

/** Compute a creator's full earnings ledger from the transaction record (source of truth). */
export async function creatorEarnings(userId: string): Promise<Earnings> {
  const cfg = await getConfig();
  const share = creatorShare(cfg);
  const addonKeep = 1 - cfg.escalationFeePct / 100;

  const [profile, agents] = await Promise.all([
    db.creatorProfile.findUnique({ where: { userId } }),
    db.agent.findMany({ where: { creatorId: userId }, select: { id: true, price: true, subscribers: true } }),
  ]);
  const agentIds = agents.map((a) => a.id);

  const txs = agentIds.length
    ? await db.transaction.findMany({ where: { agentId: { in: agentIds }, type: { in: ["subscription", "escalation", "signature"] }, status: "succeeded" } })
    : [];
  const subShare = Math.round(txs.filter((t) => t.type === "subscription").reduce((s, t) => s + t.amount * share, 0));
  const addonShare = Math.round(txs.filter((t) => t.type !== "subscription").reduce((s, t) => s + t.amount * addonKeep, 0));
  const lifetime = subShare + addonShare;

  const withdrawn = Math.round(profile?.withdrawnTotal || 0);
  const pending = Math.round(profile?.pendingPayout || 0);
  const available = Math.max(0, lifetime - withdrawn - pending);

  const mrrGross = agents.reduce((s, a) => s + a.subscribers * a.price, 0);
  const mrrNet = Math.round(mrrGross * share);

  return {
    lifetime, available, pending, withdrawn, mrrGross, mrrNet, subShare, addonShare, share,
    hasMethod: !!(profile?.payoutMethod && profile?.payoutVerified),
    method: profile?.payoutMethod || "",
    destinationMasked: profile?.payoutDetailMasked || "",
  };
}
