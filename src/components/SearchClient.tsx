"use client";
import { useMemo, useState } from "react";
import AgentCard from "./AgentCard";
import { catLabel } from "@/lib/categories";
import type { AgentDTO } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { IconX, IconSearchOff } from "@tabler/icons-react";
import { Reveal } from "@/components/ui";

const SORTS = [
  { id: "trending", en: "Trending", ja: "人気", zh: "熱門" },
  { id: "renewal", en: "Renewal", ja: "継続率", zh: "續訂率" },
  { id: "priceLow", en: "Price: Low→High", ja: "価格 安い→高い", zh: "價格低→高" },
  { id: "priceHigh", en: "Price: High→Low", ja: "価格 高い→安い", zh: "價格高→低" },
  { id: "rating", en: "Rating", ja: "評価", zh: "評分" },
];

const LANGS = [
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
  { id: "zh", label: "中文" },
];

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-[12px] transition-all duration-300 ${
    active
      ? "border-transparent text-white bg-purple"
      : "border-glassborder/20 bg-panel/40 text-muted backdrop-blur-sm hover:text-text hover:border-purple/40"
  }`;
const chipSm = (active: boolean) =>
  `rounded-full border px-2.5 py-1.5 text-[11.5px] transition-all duration-300 ${
    active
      ? "border-transparent text-white bg-purple"
      : "border-glassborder/20 bg-panel/40 text-muted backdrop-blur-sm hover:text-text hover:border-purple/40"
  }`;

export default function SearchClient({
  agents,
  subscribedIds,
  hasPass,
}: {
  agents: AgentDTO[];
  subscribedIds: string[];
  hasPass: boolean;
}) {
  const { t, locale } = useI18n();
  const [langFilter, setLangFilter] = useState<string>(locale);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("trending");
  const [selCats, setSelCats] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [minRenewal, setMinRenewal] = useState("");
  const [passOnly, setPassOnly] = useState(false);

  const subSet = useMemo(() => new Set(subscribedIds), [subscribedIds]);

  // Base list scoped to the selected language first.
  const base = useMemo(
    () => (langFilter === "all" ? agents : agents.filter((a) => a.lang === langFilter)),
    [agents, langFilter],
  );

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of base) m[a.category] = (m[a.category] || 0) + 1;
    return m;
  }, [base]);

  const cats = useMemo(() => Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a]), [catCounts]);

  const toggleCat = (c: string) =>
    setSelCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const filtered = useMemo(() => {
    let list = base.slice();
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(s) ||
          a.description.toLowerCase().includes(s) ||
          a.creatorName.toLowerCase().includes(s),
      );
    }
    if (selCats.length) list = list.filter((a) => selCats.includes(a.category));
    const pMin = priceMin.trim() === "" ? null : Number(priceMin);
    const pMax = priceMax.trim() === "" ? null : Number(priceMax);
    if (pMin != null && !Number.isNaN(pMin)) list = list.filter((a) => a.price >= pMin);
    if (pMax != null && !Number.isNaN(pMax)) list = list.filter((a) => a.price <= pMax);
    const rMin = minRenewal.trim() === "" ? null : Number(minRenewal);
    if (rMin != null && !Number.isNaN(rMin)) list = list.filter((a) => a.renewal >= rMin);
    if (passOnly) list = list.filter((a) => a.inPass);
    switch (sort) {
      case "renewal": list.sort((a, b) => b.renewal - a.renewal); break;
      case "priceLow": list.sort((a, b) => a.price - b.price); break;
      case "priceHigh": list.sort((a, b) => b.price - a.price); break;
      case "rating": list.sort((a, b) => b.rating - a.rating); break;
      default: list.sort((a, b) => Number(b.trending) - Number(a.trending) || b.subscribers - a.subscribers);
    }
    return list;
  }, [base, q, selCats, priceMin, priceMax, minRenewal, passOnly, sort]);

  const activeFilters = selCats.length > 0 || priceMin || priceMax || minRenewal || passOnly || q || langFilter !== locale;
  const reset = () => {
    setQ(""); setSelCats([]); setPriceMin(""); setPriceMax(""); setMinRenewal(""); setPassOnly(false); setSort("trending"); setLangFilter(locale);
  };

  return (
    <div>
      <div className="glass-card p-5 md:p-6">
        {/* Language (language-first) */}
        <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Language","言語","語言")}</div>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {LANGS.map((l) => {
            const active = langFilter === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setLangFilter(l.id)}
                className={chip(active)}
              >
                {l.label}
              </button>
            );
          })}
          <button
            onClick={() => setLangFilter("all")}
            className={chip(langFilter === "all")}
          >
            {t("All languages","すべての言語","所有語言")}
          </button>
        </div>

        {/* Text search */}
        <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Keyword","キーワード","關鍵字")}</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Search Agent name, description or expert…","Agent 名・説明・専門家で検索…","搜尋 Agent 名稱、描述或專家…")}
          className="mb-5 w-full rounded-lg border border-glassborder/20 bg-panel2/50 px-3.5 py-2.5 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-purple"
        />

        {/* Categories */}
        {cats.length > 0 && (
          <>
            <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Category","分類","分類")}</div>
            <div className="mb-5 flex flex-wrap gap-1.5">
              {cats.map((c) => {
                const active = selCats.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCat(c)}
                    className={chip(active)}
                  >
                    {catLabel(c, locale)} <span className={active ? "opacity-70" : "text-faint"}>{catCounts[c]}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Price + renewal + pass */}
        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Monthly price range","月額の範囲","月費範圍")}</div>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="numeric" min={0} value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)} placeholder={t("Min","最低","最低")}
                className="w-full rounded-lg border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-purple"
              />
              <span className="text-faint">–</span>
              <input
                type="number" inputMode="numeric" min={0} value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)} placeholder={t("Max","最高","最高")}
                className="w-full rounded-lg border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-purple"
              />
            </div>
          </div>
          <div>
            <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Min renewal %","最低継続率 %","最低續訂率 %")}</div>
            <input
              type="number" inputMode="numeric" min={0} max={100} value={minRenewal}
              onChange={(e) => setMinRenewal(e.target.value)} placeholder={t("e.g. 75","例：75","例如 75")}
              className="w-full rounded-lg border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-purple"
            />
          </div>
          <div>
            <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Pass","パス","通行證")}</div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[13px] text-muted backdrop-blur-sm">
              <input
                type="checkbox" checked={passOnly}
                onChange={(e) => setPassOnly(e.target.checked)}
                className="accent-amber"
              />
              {t("Pass-covered only","パス対象のみ","只看通行證涵蓋")}
            </label>
          </div>
        </div>

        {/* Sort */}
        <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Sort","並び替え","排序")}</div>
        <div className="flex flex-wrap gap-1">
          {SORTS.map((s) => (
            <button
              key={s.id} onClick={() => setSort(s.id)}
              className={chipSm(sort === s.id)}
            >
              {t(s.en, s.ja, s.zh)}
            </button>
          ))}
        </div>
      </div>

      {/* Result bar */}
      <div className="mb-4 mt-6 flex items-center justify-between">
        <div className="text-[12px] text-muted">
          {t("Found ","","找到 ")}<span className="font-display font-bold text-grad">{filtered.length}</span>{t(" Agents"," 件の Agent が見つかりました"," 個 Agent")}
        </div>
        {activeFilters && (
          <button onClick={reset} className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-text">{t("Clear filters","フィルタをクリア","清除篩選")} <IconX size={12} stroke={2} /></button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-panel2 text-faint">
            <IconSearchOff size={24} stroke={1.7} />
          </div>
          <div className="mb-2 font-display text-[15px] font-bold text-text">{t("No Agents match your filters","条件に一致するAgentがありません","沒有符合條件的 Agent")}</div>
          {langFilter !== "all" && (
            <div className="mb-4 text-[12.5px] text-muted">
              {t("Try switching to ","","試著切換到 ")}
              <button onClick={() => setLangFilter("all")} className="text-purple underline underline-offset-2 hover:text-purple/80">
                {t("All languages","すべての言語","所有語言")}
              </button>
              {t(" to see Agents in every language.","「すべての言語」に切り替えると、すべての言語の Agent が表示されます。"," 以查看所有語言的 Agent。")}
            </div>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[12px] text-muted hover:border-purple hover:text-purple"
          >
            {t("Clear filters","フィルタをクリア","清除篩選")} <IconX size={12} stroke={2} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a, i) => (
            <Reveal key={a.id} className="h-full" delay={Math.min(i, 8) * 55}>
              <AgentCard a={a} subscribed={subSet.has(a.id)} hasPass={hasPass} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
