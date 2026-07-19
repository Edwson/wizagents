import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import StudioClient from "@/components/StudioClient";
import EndorsementInbox from "@/components/EndorsementInbox";
import StudioCommunityPanel from "@/components/StudioCommunityPanel";
import { getConfig, creatorShare } from "@/lib/config";
import { getLocale, pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);

  const agentsRaw = await db.agent.findMany({
    where: { creatorId: user.id },
    include: { metrics: { orderBy: { month: "asc" } } },
    orderBy: { subscribers: "desc" },
  });
  const escRaw = await db.escalation.findMany({
    where: { expertUserId: user.id },
    include: { agent: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 12,
  });

  const agents = agentsRaw.map((a) => ({
    slug: a.slug, name: a.name, category: a.category, price: a.price, subscribers: a.subscribers,
    renewal: a.renewal, status: a.status, rating: a.rating, trend: a.metrics.map((m) => m.subscribers),
    stanceProfile: a.stanceProfile || "",
  }));
  const subscribers = agents.reduce((s, a) => s + a.subscribers, 0);
  const share = creatorShare(await getConfig());
  const mrr = Math.round(agentsRaw.reduce((s, a) => s + a.subscribers * a.price * share, 0));
  const avgRenewal = agents.length ? Math.round(agents.reduce((s, a) => s + a.renewal, 0) / agents.length) : 0;
  const earnings = Math.round(user.creatorProfile?.totalEarnings || mrr * 6);

  // Community: plain counts for the panel, plus which published Agents already have a guide.
  const [myPosts, acceptedAnswers] = await Promise.all([
    db.post.findMany({
      where: { authorId: user.id, status: { in: ["published", "draft"] } },
      select: { kind: true, status: true, views: true, agentId: true },
    }),
    db.reply.count({ where: { authorId: user.id, accepted: true, status: "published" } }),
  ]);
  const publishedPosts = myPosts.filter((p) => p.status === "published");
  const guidesByAgent = new Map<string, number>();
  for (const p of publishedPosts) {
    if (p.kind === "guide" && p.agentId) guidesByAgent.set(p.agentId, (guidesByAgent.get(p.agentId) || 0) + 1);
  }
  const communityStats = {
    published: publishedPosts.length,
    drafts: myPosts.length - publishedPosts.length,
    views: publishedPosts.reduce((s, p) => s + p.views, 0),
    acceptedAnswers,
  };
  const panelAgents = agentsRaw
    .filter((a) => a.status === "published")
    .map((a) => ({ slug: a.slug, name: a.name, guides: guidesByAgent.get(a.id) || 0 }));

  const escalations = escRaw.map((e) => ({
    id: e.id, agentName: e.agent.name, question: e.question, status: e.status, tier: e.tier, price: e.price, answer: e.answer, signed: e.signed,
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-panel2 px-4 py-2.5">
        <span className="text-[12px] text-muted">{P("Your public profile & reputation ledger", "公開プロフィールと信頼台帳", "你的公開檔案與信譽台帳")}</span>
        <a href={`/creator/${user.id}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-panel px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:text-text">{P("View & export", "表示・エクスポート", "查看與匯出")} →</a>
      </div>
      <StudioClient
        displayName={user.creatorProfile?.displayName || user.name}
        verified={!!user.creatorProfile?.verified}
        verticalLabel={user.creatorProfile?.verticalLabel || P("Vertical not set", "分野未設定", "尚未設定領域")}
        stats={{ subscribers, mrr, avgRenewal, earnings }}
        agents={agents}
        escalations={escalations}
      />
      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel p-5">
          <div className="max-w-xl">
            <div className="font-display text-[16px] font-bold tracking-tight">{P("Your introduction — how buyers meet you", "あなたの紹介 — 購入者との出会い方", "你的自我介紹 — 買家如何認識你")}</div>
            <p className="mt-1 text-[12.5px] leading-6 text-muted">
              {P(
                "Cover, portrait, headline, how you work. Buyers are not choosing a prompt — they are deciding whether to trust your judgement, and this page is most of what they have to go on.",
                "カバー、顔写真、ヘッドライン、進め方。購入者が選んでいるのはプロンプトではなく、あなたの判断を信頼するかどうかです。その判断材料のほとんどがこのページです。",
                "封面、照片、標題、你怎麼工作。買家挑的不是提示詞，而是在決定要不要信任你的判斷，而這一頁幾乎就是他們的全部依據。",
              )}
            </p>
          </div>
          <a href="/studio/profile" className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border bg-panel2 px-4 py-2 text-[13px] text-muted transition-colors hover:text-text">
            {P("Edit introduction", "紹介を編集", "編輯介紹")} →
          </a>
        </div>
      </div>

      <div className="mt-6">
        <StudioCommunityPanel stats={communityStats} agents={panelAgents} />
      </div>

      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel p-5">
          <div className="max-w-xl">
            <div className="font-display text-[16px] font-bold tracking-tight">{P("Writing", "執筆", "撰文")}</div>
            <p className="mt-1 text-[12.5px] leading-6 text-muted">
              {P(
                "Publish articles, case studies and answers in the community. It is how people find you before they know your name — and each post can point at the Agent where the full reasoning lives.",
                "コミュニティで記事・ケーススタディ・回答を公開します。あなたの名前を知らない人があなたを見つける経路であり、各投稿は完全な思考が置かれているエージェントへ導線を張れます。",
                "在社群發布文章、案例與解答。這是別人在還不認識你之前找到你的方式——每篇貼文都能指向完整推理所在的 Agent。",
              )}
            </p>
          </div>
          <a href="/studio/blog" className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border bg-panel2 px-4 py-2 text-[13px] text-muted transition-colors hover:text-text">
            {P("Open Writing", "執筆を開く", "開啟撰文")} →
          </a>
        </div>
      </div>

      <div className="mt-12">
        <EndorsementInbox show="expert" />
      </div>
    </>
  );
}
