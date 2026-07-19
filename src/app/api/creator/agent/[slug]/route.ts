import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { publishReady, isRegulated } from "@/lib/rules";
import { normTags } from "../route";
import { parseFeatures } from "@/lib/format";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent || agent.creatorId !== user.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await req.json();
  const data: any = {};
  for (const k of ["name", "description", "category", "replacesRole"]) if (b[k] !== undefined) data[k] = b[k];
  for (const k of ["price", "trialLimit", "escalationPrice", "signaturePrice", "replacesRate", "savesHrs"]) if (b[k] !== undefined) data[k] = Number(b[k]);
  if (b.inPass !== undefined) data.inPass = !!b.inPass;
  if (b.category !== undefined) data.regulated = isRegulated(b.category);
  if (typeof b.stanceProfile === "string") data.stanceProfile = b.stanceProfile;
  if (["en","ja","zh"].includes(b.lang)) data.lang = b.lang;
  if (["mentor","assistant","conversation","discussion"].includes(b.agentType)) data.agentType = b.agentType;
  if (typeof b.pitch === "string") data.pitch = b.pitch.slice(0, 1200);
  if (typeof b.notFor === "string") data.notFor = b.notFor.slice(0, 600);
  if (Array.isArray(b.useCases)) data.useCases = JSON.stringify(b.useCases.filter(Boolean).slice(0, 8));
  if (Array.isArray(b.sampleQuestions)) data.sampleQuestions = JSON.stringify(b.sampleQuestions.filter(Boolean).slice(0, 6));
  if (b.tags !== undefined) data.tags = JSON.stringify(normTags(b.tags));
  if (b.status) data.status = b.status;
  if (Array.isArray(b.features)) data.features = JSON.stringify(b.features.filter(Boolean));
  if (data.status === "published") {
    const g = publishReady({ name: data.name ?? agent.name, description: data.description ?? agent.description, features: data.features ? JSON.parse(data.features) : parseFeatures(agent.features), price: data.price ?? agent.price });
    if (!g.ok) return NextResponse.json({ error: g.error, code: g.code }, { status: g.status });
  }
  const updated = await db.agent.update({ where: { id: agent.id }, data });
  return NextResponse.json({ ok: true, status: updated.status });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent || agent.creatorId !== user.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const active = await db.subscription.count({ where: { agentId: agent.id, status: "active" } });
  if (active > 0) return NextResponse.json({ error: `Cannot delete: ${active} active subscriber(s). Suspend it instead.`, code: "has_subscribers" }, { status: 409 });
  await db.agent.delete({ where: { id: agent.id } });
  return NextResponse.json({ ok: true });
}
