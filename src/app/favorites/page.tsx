import { levelOf } from "@/lib/verification";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import AgentCard from "@/components/AgentCard";
import { getUserSubscriptions, type AgentDTO } from "@/lib/data";
import { parseFeatures } from "@/lib/format";
import { getLocale, pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const favorites = await db.favorite.findMany({
    where: { userId: user.id },
    include: { agent: { include: { creator: { select: { name: true, avatarColor: true, avatarMediaId: true, creatorProfile: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const subs = await getUserSubscriptions(user.id);
  const subscribed = new Set(subs.map((x: any) => x.agent.slug));
  const hasPass = !!(user as any).pass?.active;

  const agents: AgentDTO[] = favorites.map((f) => {
    const a = f.agent;
    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      creatorName: a.creatorName,
      category: a.category,
      agentType: a.agentType,
      creatorLevel: levelOf((a as any).creator?.creatorProfile),
      price: a.price,
      renewal: a.renewal,
      subscribers: a.subscribers,
      rating: a.rating,
      tagline: a.tagline,
      description: a.description,
      features: parseFeatures(a.features),
      updatedLabel: a.updatedLabel,
      trending: a.trending,
      inPass: a.inPass,
      replacesRate: a.replacesRate,
      replacesRole: a.replacesRole,
      savesHrs: a.savesHrs,
      escalationPrice: a.escalationPrice,
      signaturePrice: a.signaturePrice,
      lang: a.lang || "en",
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {P("Favorites","お気に入り","收藏清單")}</div>
      <h1 className="text-2xl font-semibold text-text">{P("My favorites","マイお気に入り","我的收藏")}</h1>
      <p className="mt-1 text-sm text-muted">{P("Agents you've marked as favorites appear here.","お気に入りに登録した Agent がここに表示されます。","你標記為收藏的代理都會出現在這裡。")}</p>

      {agents.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-panel p-8 text-center">
          <div className="text-sm text-muted">{P("You haven't favorited any Agents yet.","まだお気に入りの Agent がありません。","你還沒有收藏任何代理。")}</div>
          <Link
            href="/market"
            className="mt-4 inline-block text-sm text-amber hover:text-text"
          >
            {P("Browse the market →","マーケットを見る →","去市集逛逛 →")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard
              key={a.id}
              a={a}
              subscribed={subscribed.has(a.slug)}
              hasPass={hasPass}
            />
          ))}
        </div>
      )}
    </div>
  );
}
