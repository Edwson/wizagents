import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import CouncilClient from "@/components/CouncilClient";
import AccountabilityTiers from "@/components/AccountabilityTiers";
import { SectionLabel } from "@/components/ui";
import { getLocale, pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function CouncilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await getLocale();

  const subsRaw = await db.subscription.findMany({
    where: { userId: user.id, status: "active" },
    include: { agent: true },
    orderBy: { startedAt: "desc" },
  });
  const subs = subsRaw
    .filter((s) => s.agent.status === "published")
    .map((s) => ({
      slug: s.agent.slug,
      name: s.agent.name,
      creatorName: s.agent.creatorName,
      category: s.agent.category,
      agentType: s.agent.agentType,
    }));

  return (
    <>
      <CouncilClient subs={subs} />
      <div className="mt-12">
        <SectionLabel>{pick(locale, "How accountability works", "責任の仕組み", "問責如何運作")}</SectionLabel>
        <AccountabilityTiers />
      </div>
    </>
  );
}
