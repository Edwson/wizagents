import { getPublishedAgents } from "@/lib/data";
import CompareClient from "@/components/CompareClient";
import { getLocale, pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  const sp = await searchParams;
  const agents = await getPublishedAgents();
  const all = agents.map((a) => ({ slug: a.slug, name: a.name, lang: a.lang }));

  const ids = (sp.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const selected = ids
    .map((slug) => agents.find((a) => a.slug === slug))
    .filter((a): a is (typeof agents)[number] => Boolean(a))
    .slice(0, 3);

  return (
    <div className="animate-fadein">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-glassborder/40 bg-panel/40 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulsedot" />
        <span>wizagents://mcp.marketplace/<span className="text-grad-neon font-semibold">compare</span></span>
      </div>
      <h1 className="mb-1 mt-4 font-display text-[30px] font-bold">{P("Agent comparison","Agent の比較","Agent 比較")}</h1>
      <p className="mb-7 text-[13px] text-muted">{P("Compare up to 3 Agents side by side on price, renewal, rating and core capabilities to decide fast.","最大 3 個の Agent を月額・継続率・評価・主な能力で並べて比較し、素早く判断できます。","並排比較最多 3 個 Agent 的月費、續訂率、評分與核心能力，快速做出訂閱決策。")}</p>
      <CompareClient agents={selected} all={all} />
    </div>
  );
}
