import { db } from "./db";

export async function notify(userId: string, type: string, title: string, body = "", href = "") {
  try {
    await db.notification.create({ data: { userId, type, title, body, href } });
  } catch (e) {
    console.error("notify failed", e);
  }
}

/** Notify every active subscriber of an agent (e.g. knowledge update). */
export async function notifyAgentSubscribers(agentId: string, type: string, title: string, body = "", href = "") {
  const subs = await db.subscription.findMany({ where: { agentId, status: "active" }, select: { userId: true } });
  if (subs.length === 0) return;
  await db.notification.createMany({ data: subs.map((s) => ({ userId: s.userId, type, title, body, href })) });
}
