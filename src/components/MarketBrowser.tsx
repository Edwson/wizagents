"use client";
import { useMemo, useState } from "react";
import AgentCard from "./AgentCard";
import { catLabel, PRIMARY_CATEGORIES } from "@/lib/categories";
import type { AgentDTO } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { AGENT_TYPES, typeLabel, typeGlyph } from "@/lib/agent-types";
import { IconTicket, IconSearchOff, IconX } from "@tabler/icons-react";
import { Reveal, SectionLabel } from "@/components/ui";

const SORTS = [
  { id: "trending", en: "Trending", ja: "人気", zh: "熱門" },
  { id: "renewal", en: "Renewal", ja: "継続率", zh: "續訂率" },
  { id: "priceLow", en: "Price: Low→High", ja: "価格 安い→高い", zh: "價格低→高" },
  { id: "priceHigh", en: "Price: High→Low", ja: "価格 高い→安い", zh: "價格高→低" },
];

const LANGS = [
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
  { id: "zh", label: "中文" },
];

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-[11.5px] transition-all duration-300 ${
    active
      ? "border-transparent text-white bg-purple"
      : "border-glassborder/20 bg-panel/40 text-muted backdrop-blur-sm hover:text-text hover:border-purple/40"
  }`;

export default function MarketBrowser({ agents, subscribedIds, hasPass }: { agents: AgentDTO[]; subscribedIds: string[]; hasPass: boolean }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("trending");
  const [cat, setCat] = useState("all");
  const [type, setType] = useState("all");
  const [lang, setLang] = useState<string>(locale); // default to UI language
  const subSet = useMemo(() => new Set(subscribedIds), [subscribedIds]);

  // Language-scoped base list: show the user's language first; "all" shows everything.
  const base = useMemo(() => (lang === "all" ? agents : agents.filter((a) => a.lang === lang)), [agents, lang]);

  const cats = useMemo(() => {
    const present = Array.from(new Set(base.map((a) => a.category)));
    const ordered = PRIMARY_CATEGORIES.filter((c) => present.includes(c));
    const rest = present.filter((c) => !ordered.includes(c)).sort();
    return [...ordered, ...rest];
  }, [base]);
  const counts = useMemo(() => { const m: Record<string, number> = {}; for (const a of base) m[a.category] = (m[a.category] || 0) + 1; return m; }, [base]);
  const recommended = useMemo(() => base.filter((a) => !subSet.has(a.id)).slice().sort((x, y) => y.rating - x.rating).slice(0, 3), [base, subSet]);
  const featured = useMemo(() => base.filter((a) => a.renewal >= 78).slice(0, 3), [base]);

  const filtered = useMemo(() => {
    let list = base.slice();
    if (cat !== "all") list = list.filter((a) => a.category === cat);
    if (type !== "all") list = list.filter((a) => a.agentType === type);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(s) || a.description.toLowerCase().includes(s) || a.creatorName.toLowerCase().includes(s));
    }
    switch (sort) {
      case "renewal": list.sort((a, b) => b.renewal - a.renewal); break;
      case "priceLow": list.sort((a, b) => a.price - b.price); break;
      case "priceHigh": list.sort((a, b) => b.price - a.price); break;
      default: list.sort((a, b) => Number(b.trending) - Number(a.trending) || b.subscribers - a.subscribers);
    }
    return list;
  }, [base, cat, type, q, sort]);

  const passCount = base.filter((a) => a.inPass).length;
  const filtersActive = cat !== "all" || type !== "all" || q.trim().length > 0 || lang !== locale;
  const clearFilters = () => { setQ(""); setCat("all"); setType("all"); setLang(locale); setSort("trending"); };

  return (
    <div>
      {/* Language filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-faint">{t("Language", "言語", "語言")}:</span>
        {LANGS.map((l) => (
          <button key={l.id} onClick={() => { setLang(l.id); setCat("all"); }} className={chip(lang === l.id)}>{l.label}</button>
        ))}
        <button onClick={() => { setLang("all"); setCat("all"); }} className={chip(lang === "all")}>{t("All languages", "すべての言語", "所有語言")}</button>
      </div>

      {/* Agent type filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-faint">{t("Type", "タイプ", "類型")}:</span>
        <button onClick={() => setType("all")} className={chip(type === "all")}>{t("All", "すべて", "全部")}</button>
        {AGENT_TYPES.map((ty) => (
          <button key={ty} onClick={() => setType(ty)} className={chip(type === ty)}><span className="font-display">{typeGlyph(ty)}</span> {typeLabel(ty, locale)}</button>
        ))}
      </div>

      {/* Pass banner */}
      <div className="glass-card border-grad mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2 text-[14px] font-bold text-amber"><IconTicket size={16} stroke={1.7} /> {t("Pass", "パス", "通行證")} {hasPass && <span className="rounded-full border border-green/40 px-2 py-0.5 text-[10px] text-green">{t("Active", "利用中", "使用中")}</span>}</div>
          <div className="mt-1 text-[12px] text-muted">{t("One flat monthly fee — subscribe to any Agent in the Pass, no checkout needed.", "毎月定額で、パスに含まれる Agent を自由に購読 — 個別決済は不要です。", "每月一筆固定費用，隨意訂閱所有加入通行證的 Agent — 不必逐一結帳。")}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-[19px] font-extrabold text-grad">$129<span className="text-[11px] font-normal text-muted">/mo</span></div>
          <div className="text-[11px] text-muted">{t(`${passCount} Agents covered`, `${passCount} 個の Agent を含む`, `${passCount} 個 Agent 已涵蓋`)}</div>
        </div>
      </div>

      {featured.length > 0 && cat === "all" && !q && (
        <div className="mb-8">
          <SectionLabel>{t("Featured · High renewal", "注目 · 高い継続率", "精選 · 高續訂率")}</SectionLabel>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{featured.map((a, i) => <Reveal key={a.id} className="h-full" delay={i * 70}><AgentCard a={a} subscribed={subSet.has(a.id)} hasPass={hasPass} /></Reveal>)}</div>
        </div>
      )}
      {recommended.length > 0 && cat === "all" && !q && (
        <div className="mb-8">
          <SectionLabel>{t("Recommended for you · Top rated", "あなたへのおすすめ · 高評価", "為你推薦 · 高評分")}</SectionLabel>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{recommended.map((a, i) => <Reveal key={a.id} className="h-full" delay={i * 70}><AgentCard a={a} subscribed={subSet.has(a.id)} hasPass={hasPass} /></Reveal>)}</div>
        </div>
      )}

      <div className="glass-card mb-4 flex flex-wrap items-center gap-2 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search Agents, experts or keywords…", "Agent・専門家・キーワードを検索…", "搜尋 Agent、專家或關鍵字…")}
          className="min-w-[220px] flex-1 rounded-lg border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-purple" />
        <div className="flex flex-wrap gap-1">
          {SORTS.map((s) => (
            <button key={s.id} onClick={() => setSort(s.id)} className={chip(sort === s.id)}>
              {t("Sort: ", "並び：", "排序：")}{t(s.en, s.ja, s.zh)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        <CatTab active={cat === "all"} onClick={() => setCat("all")}>{t("All", "すべて", "全部")}</CatTab>
        {cats.map((c) => (
          <CatTab key={c} active={cat === c} onClick={() => setCat(c)}>{catLabel(c, locale)} <span className={cat === c ? "opacity-70" : "text-faint"}>{counts[c]}</span></CatTab>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        <span>{t(`${filtered.length} Agents`, `${filtered.length} 個の Agent`, `${filtered.length} 個 Agent`)}</span>
        <span className="text-[10px] text-faint">· {t("Figures illustrative until measured", "数値は計測まで参考値です", "數據於實測前僅為示意")}</span>
      </div>
      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-panel2 text-faint">
            <IconSearchOff size={24} stroke={1.7} />
          </div>
          <div className="font-display text-[15px] font-bold text-text">{t("No Agents match your filters", "条件に一致する Agent がありません", "沒有符合篩選條件的 Agent")}</div>
          <div className="mt-1.5 max-w-sm text-[12.5px] leading-6 text-muted">{t("Try a different keyword, category or language — or clear your filters to see everything.", "キーワード・分類・言語を変えるか、フィルタをクリアするとすべて表示されます。", "換個關鍵字、分類或語言，或清除篩選以查看全部。")}</div>
          {filtersActive && (
            <button onClick={clearFilters} className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12.5px] text-text transition-colors hover:border-purple hover:text-purple">
              <IconX size={14} stroke={1.7} /> {t("Clear filters", "フィルタをクリア", "清除篩選")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((a, i) => <Reveal key={a.id} className="h-full" delay={Math.min(i, 8) * 55}><AgentCard a={a} subscribed={subSet.has(a.id)} hasPass={hasPass} /></Reveal>)}</div>
      )}
    </div>
  );
}

function CatTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={chip(active) + " !text-[12px] !px-3 !py-1.5"}>{children}</button>;
}
