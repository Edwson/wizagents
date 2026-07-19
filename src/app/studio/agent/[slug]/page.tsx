import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseFeatures } from "@/lib/format";
import EditAgent from "@/components/EditAgent";
export const dynamic = "force-dynamic";
export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const a = await db.agent.findUnique({ where: { slug }, include: { knowledgeVersions: { orderBy: { createdAt: "desc" } } } });
  if (!a) notFound();
  if (a.creatorId !== user.id) redirect("/studio");
  return <EditAgent
    agent={{ slug: a.slug, name: a.name, category: a.category, description: a.description, price: a.price, features: parseFeatures(a.features), inPass: a.inPass, status: a.status, escalationPrice: a.escalationPrice, signaturePrice: a.signaturePrice, trialLimit: a.trialLimit, subscribers: a.subscribers, renewal: a.renewal, rating: a.rating, agentType: a.agentType, pitch: a.pitch, useCases: parseFeatures(a.useCases), notFor: a.notFor, sampleQuestions: parseFeatures(a.sampleQuestions), tags: parseFeatures(a.tags) }}
    versions={a.knowledgeVersions.map((v) => ({ version: v.version, note: v.note, docCount: v.docCount }))}
  />;
}
