import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { generateAgentReply, type AgentContext } from "@/lib/agent-engine";
import { typeFraming } from "@/lib/agent-types";
import { parseFeatures } from "@/lib/format";
import { scoreSample, aggregate, MIN_SAMPLES, METHOD_NOTE, type SampleScore } from "@/lib/fidelity";

export const dynamic = "force-dynamic";

async function ownedAgent(slug: string, userId: string) {
  const agent = await db.agent.findUnique({ where: { slug } });
  if (!agent || agent.creatorId !== userId) return null;
  return agent;
}

// The expert's held-out samples + the latest measured run.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const agent = await ownedAgent(slug, user.id);
  if (!agent) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const [samples, runs] = await Promise.all([
    db.fidelitySample.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: "desc" } }),
    db.fidelityRun.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return NextResponse.json({
    ok: true, minSamples: MIN_SAMPLES, method: METHOD_NOTE,
    samples: samples.map((s) => ({ id: s.id, question: s.question, expertAnswer: s.expertAnswer })),
    runs: runs.map((r) => ({ id: r.id, score: r.score, samples: r.samples, createdAt: r.createdAt, detail: JSON.parse(r.detail || "[]") })),
    current: { score: agent.fidelityScore, measuredAt: agent.fidelityMeasuredAt, samples: agent.fidelitySamples_n },
  });
}

// Add a held-out sample, delete one, or RUN the harness.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const agent = await ownedAgent(slug, user.id);
  if (!agent) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await readJson(req); if (!b) return badRequest();

  if (b.action === "add") {
    const question = String(b.question || "").trim();
    const expertAnswer = String(b.expertAnswer || "").trim();
    if (question.length < 8) return NextResponse.json({ error: "Write the question you were actually asked (min 8 chars)." }, { status: 400 });
    if (expertAnswer.length < 40) return NextResponse.json({ error: "Paste YOUR real answer — the harness scores the avatar against it (min 40 chars)." }, { status: 400 });
    const s = await db.fidelitySample.create({ data: { agentId: agent.id, question, expertAnswer } });
    return NextResponse.json({ ok: true, id: s.id });
  }

  if (b.action === "remove") {
    await db.fidelitySample.deleteMany({ where: { id: String(b.id || ""), agentId: agent.id } });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "run") {
    const samples = await db.fidelitySample.findMany({ where: { agentId: agent.id } });
    if (samples.length < MIN_SAMPLES) {
      return NextResponse.json({ error: `Add at least ${MIN_SAMPLES} held-out answers before measuring.`, code: "too_few" }, { status: 400 });
    }
    const ctx: AgentContext = {
      name: agent.name, category: agent.category, creatorName: agent.creatorName, description: agent.description,
      systemPrompt: (agent.systemPrompt || "") + "\n" + typeFraming(agent.agentType),
      knowledgeSummary: agent.knowledgeSummary, features: parseFeatures(agent.features),
      lang: (agent.lang as any) || "en", regulated: (agent as any).regulated ?? false,
    };
    const detail: SampleScore[] = [];
    for (const s of samples) {
      const answer = await generateAgentReply(ctx, [], s.question);   // blind: the avatar never sees the expert's answer
      detail.push(scoreSample(s.question, answer, s.expertAnswer));
    }
    const score = aggregate(detail);
    const run = await db.$transaction(async (tx) => {
      const r = await tx.fidelityRun.create({ data: { agentId: agent.id, score, samples: samples.length, detail: JSON.stringify(detail) } });
      await tx.agent.update({ where: { id: agent.id }, data: { fidelityScore: score, fidelityMeasuredAt: new Date(), fidelitySamples_n: samples.length } });
      return r;
    });
    return NextResponse.json({ ok: true, run: { id: run.id, score, samples: samples.length, detail } });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
