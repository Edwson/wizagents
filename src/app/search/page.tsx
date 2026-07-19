import { getPublishedAgents, getUserSubscriptions } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import SearchClient from "@/components/SearchClient";
import { getLocale, pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  const [agents, user] = await Promise.all([getPublishedAgents(), getCurrentUser()]);
  let subscribedIds: string[] = [];
  let hasPass = false;
  if (user) {
    const subs = await getUserSubscriptions(user.id);
    subscribedIds = subs.map((s) => s.agentId);
    hasPass = !!user.pass?.active;
  }
  return (
    <div className="animate-fadein">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-glassborder/40 bg-panel/40 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulsedot" />
        <span>wizagents://mcp.marketplace/<span className="text-grad-neon font-semibold">search</span></span>
      </div>
      <h1 className="mb-1 mt-4 font-display text-[30px] font-bold">{P("Advanced search","詳細検索","進階搜尋")}</h1>
      <p className="mb-7 text-[13px] text-muted">{P("Pinpoint the best expert Agent by keyword, category, price, renewal rate and Pass coverage.","キーワード・分類・価格・継続率・パス対象で、最適な専門家 Agent を的確に見つけましょう。","用關鍵字、分類、價格、續訂率與通行證涵蓋範圍，精準找到最合適的專家 Agent。")}</p>
      <SearchClient agents={agents} subscribedIds={subscribedIds} hasPass={hasPass} />
    </div>
  );
}
