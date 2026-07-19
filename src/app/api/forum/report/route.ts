import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Report a post or reply. Admin-reviewed — nothing disappears on one person's say-so. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const rl = rateLimit("report:" + user.id, 20, 3600_000);   // 20 reports/hour per account
  if (!rl.ok) return NextResponse.json({ error: "You've filed a lot of reports. Please give it some time." }, { status: 429 });
  const b = await readJson(req);
  if (!b) return badRequest();
  const targetType = b.targetType === "reply" ? "reply" : "post";
  const targetId = String(b.targetId || "");
  if (!targetId) return badRequest();

  const dup = await db.report.findFirst({ where: { reporterId: user.id, targetId, status: "open" } });
  if (dup) return NextResponse.json({ ok: true, already: true });

  await db.report.create({ data: { reporterId: user.id, targetType, targetId, reason: String(b.reason || "").slice(0, 300) } });
  return NextResponse.json({ ok: true });
}

/** Admin: the queue, and the decision. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const reports = await db.report.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { reporter: { select: { name: true, email: true } } },
  });
  const enriched = await Promise.all(
    reports.map(async (r) => {
      const t = r.targetType === "post"
        ? await db.post.findUnique({ where: { id: r.targetId }, select: { title: true, slug: true, body: true, authorId: true } })
        : await db.reply.findUnique({ where: { id: r.targetId }, select: { body: true, authorId: true, post: { select: { slug: true, title: true } } } });
      return { ...r, target: t };
    }),
  );
  return NextResponse.json({ ok: true, reports: enriched });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await readJson(req);
  if (!b) return badRequest();
  const r = await db.report.findUnique({ where: { id: String(b.id || "") } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (b.action === "remove") {
    if (r.targetType === "post") {
      await db.post.update({ where: { id: r.targetId }, data: { status: "removed" } }).catch(() => {});
    } else {
      // Removing a reply must keep the parent post's counters and "answered" state honest.
      const reply = await db.reply.findUnique({ where: { id: r.targetId }, include: { post: true } });
      if (reply && reply.status !== "removed") {
        await db.$transaction(async (tx) => {
          await tx.reply.update({ where: { id: reply.id }, data: { status: "removed", accepted: false } });
          const clearAccepted = reply.post.acceptedReplyId === reply.id;
          await tx.post.update({
            where: { id: reply.postId },
            data: {
              replyCount: { decrement: 1 },
              ...(clearAccepted ? { acceptedReplyId: null, answeredById: null } : {}),
            },
          });
        });
      }
    }
    await db.report.update({ where: { id: r.id }, data: { status: "actioned" } });
    return NextResponse.json({ ok: true, removed: true });
  }
  await db.report.update({ where: { id: r.id }, data: { status: "dismissed" } });
  return NextResponse.json({ ok: true, dismissed: true });
}
