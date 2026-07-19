"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { catLabel } from "@/lib/categories";

type A = { slug: string; name: string; creatorName: string; category: string; price: number };
const PAGES: { href: string; label: [string, string, string]; hint: [string, string, string] }[] = [
  { href: "/market", label: ["Marketplace", "マーケット", "市集"], hint: ["Browse all agents", "すべてのAgentを見る", "瀏覽所有 Agent"] },
  { href: "/dashboard", label: ["My Subscriptions", "マイサブスク", "我的訂閱"], hint: ["Subscriptions & chats", "サブスクと会話", "訂閱與對話"] },
  { href: "/studio", label: ["Creator Studio", "クリエイタースタジオ", "創作者工作室"], hint: ["Publish & earnings", "出品と収益", "上架與收益"] },
  { href: "/enterprise", label: ["Enterprise Console", "エンタープライズ", "企業控制台"], hint: ["Seats & audit", "席と監査", "席位與審計"] },
  { href: "/studio/create", label: ["Publish New Agent", "新規Agent出品", "上架新 Agent"], hint: ["Four-step wizard", "4ステップウィザード", "四步精靈"] },
  { href: "/mcp", label: ["MCP Access", "MCP接続", "MCP 接入"], hint: ["Connect to Claude/Cursor", "Claude/Cursorに接続", "接進 Claude/Cursor"] },
  { href: "/search", label: ["Advanced Search", "詳細検索", "進階搜尋"], hint: ["Multi-filter search", "複数条件で絞り込み", "多條件篩選"] },
  { href: "/compare", label: ["Compare Agents", "Agent比較", "Agent 比較"], hint: ["Side-by-side", "横並び比較", "並排比較"] },
  { href: "/favorites", label: ["My Favorites", "お気に入り", "我的收藏"], hint: ["Saved list", "お気に入り一覧", "收藏清單"] },
  { href: "/studio/analytics", label: ["Analytics", "アナリティクス", "數據分析"], hint: ["Creator analytics", "クリエイター分析", "創作者分析"] },
];

export default function CommandPalette() {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [agents, setAgents] = useState<A[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    (window as any).__openPalette = () => setOpen(true);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ(""); setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      if (agents.length === 0) fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents || []));
    }
  }, [open]);

  if (!open) return null;
  const s = q.trim().toLowerCase();
  const tpages = PAGES.map((p) => ({ href: p.href, label: t(...p.label), hint: t(...p.hint) }));
  const pages = tpages.filter((p) => !s || p.label.toLowerCase().includes(s) || p.hint.toLowerCase().includes(s));
  const hits = s ? agents.filter((a) => a.name.toLowerCase().includes(s) || a.creatorName.toLowerCase().includes(s) || catLabel(a.category).includes(s)).slice(0, 8) : agents.slice(0, 6);
  const flat: { type: "page" | "agent"; href: string; a?: A; label?: string; hint?: string }[] = [
    ...pages.map((p) => ({ type: "page" as const, href: p.href, label: p.label, hint: p.hint })),
    ...hits.map((a) => ({ type: "agent" as const, href: `/agent/${a.slug}`, a })),
  ];
  const go = (i: number) => { const t = flat[i]; if (t) { router.push(t.href); setOpen(false); } };

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-borderlight bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-rust">$</span>
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(flat.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter") { e.preventDefault(); go(idx); }
            }}
            placeholder={t("Search agents, experts, or go to a page…","Agent・専門家・ページを検索…","搜尋 Agent、專家或前往頁面…")} className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-faint">ESC</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {flat.length === 0 && <div className="px-3 py-6 text-center text-[12px] text-faint">{t("No results","結果なし","沒有結果")}</div>}
          {pages.length > 0 && <div className="px-2 py-1 text-[10px] text-faint">{t("Go to","移動","前往")}</div>}
          {flat.map((t2, i) => (
            <button key={i} onMouseEnter={() => setIdx(i)} onClick={() => go(i)}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left ${idx === i ? "bg-purple/15" : ""}`}>
              {t2.type === "page" ? (
                <><span className="text-[13px] text-text">{t2.label}</span><span className="text-[10.5px] text-faint">{t2.hint}</span></>
              ) : (
                <><span className="flex items-center gap-2"><span className="text-[10px] text-muted">{catLabel(t2.a!.category)}</span><span className="text-[13px] text-text">{t2.a!.name}</span></span><span className="text-[10.5px] text-purple">${t2.a!.price}/mo</span></>
              )}
            </button>
          ))}
          {s && hits.length > 0 && <div className="px-2 py-1 text-[10px] text-faint">{t("↑↓ Navigate · ↵ Go","↑↓ 選択 · ↵ 移動","↑↓ 選擇 · ↵ 前往")}</div>}
        </div>
      </div>
    </div>
  );
}
