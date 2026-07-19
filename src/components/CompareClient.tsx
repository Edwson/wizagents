"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { catLabel } from "@/lib/categories";
import type { AgentDTO } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { IconX, IconScale } from "@tabler/icons-react";
import { Reveal } from "@/components/ui";

type Row = {
  label: string;
  render: (a: AgentDTO) => React.ReactNode;
  value?: (a: AgentDTO) => number;
  best?: "min" | "max";
};

export default function CompareClient({
  agents,
  all,
}: {
  agents: AgentDTO[];
  all: { slug: string; name: string; lang?: string }[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pick, setPick] = useState("");

  const ROWS: Row[] = [
    { label: t("Monthly","月額","月費"), render: (a) => `$${a.price}/mo`, value: (a) => a.price, best: "min" },
    { label: t("90-day renewal","90 日継続率","90天續訂率"), render: (a) => `${a.renewal}%`, value: (a) => a.renewal, best: "max" },
    { label: t("Rating","評価","評分"), render: (a) => `★ ${a.rating.toFixed(1)}`, value: (a) => a.rating, best: "max" },
    { label: t("Subscribers","購読者","訂閱者"), render: (a) => a.subscribers.toLocaleString("en-US"), value: (a) => a.subscribers, best: "max" },
    { label: t("Category","分類","分類"), render: (a) => catLabel(a.category, locale) },
    { label: t("Escalation fee","エスカレーション費","真人升級費"), render: (a) => `$${a.escalationPrice}`, value: (a) => a.escalationPrice, best: "min" },
    { label: t("Sign-off fee","署名費","簽核費"), render: (a) => `$${a.signaturePrice}`, value: (a) => a.signaturePrice, best: "min" },
    { label: t("Pass","パス","通行證"), render: (a) => (a.inPass ? <span className="text-green">{t("Included","込み","含")}</span> : "—") },
    { label: t("Replaces hourly","代替する時給","取代時薪"), render: (a) => `$${a.replacesRate}/hr`, value: (a) => a.replacesRate, best: "max" },
    {
      label: t("Core capabilities","主な能力","核心能力"),
      render: (a) => (
        <span className="text-[11.5px] leading-5 text-muted">
          {a.features.length ? a.features.join(t(", ", "、", "、")) : "—"}
        </span>
      ),
    },
  ];

  const slugs = agents.map((a) => a.slug);
  const setIds = (next: string[]) => {
    if (next.length === 0) router.push("/compare");
    else router.push(`/compare?ids=${next.join(",")}`);
  };
  const remove = (slug: string) => setIds(slugs.filter((s) => s !== slug));
  const add = (slug: string) => {
    if (!slug || slugs.includes(slug) || slugs.length >= 3) return;
    setIds([...slugs, slug]);
    setPick("");
  };

  // Only offer Agents in the reader's current language so they don't add
  // Agents they can't read. Already-selected Agents (possibly of another
  // language) are kept as columns regardless.
  const available = all.filter(
    (x) => !slugs.includes(x.slug) && (x.lang == null || x.lang === locale),
  );

  // Precompute best index per row
  const bestFor = (row: Row): number | null => {
    if (!row.value || !row.best || agents.length < 2) return null;
    let bi = 0;
    let bv = row.value(agents[0]);
    for (let i = 1; i < agents.length; i++) {
      const v = row.value(agents[i]);
      if ((row.best === "min" && v < bv) || (row.best === "max" && v > bv)) {
        bv = v; bi = i;
      }
    }
    return bi;
  };

  const AddControl = (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={pick}
          onChange={(e) => add(e.target.value)}
          disabled={slugs.length >= 3 || available.length === 0}
          className="rounded-lg border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[12.5px] text-text outline-none backdrop-blur-sm transition-colors focus:border-purple disabled:opacity-50"
        >
          <option value="">
            {slugs.length >= 3 ? t("3 max reached","上限 3 個に達しました","已達 3 個上限") : available.length === 0 ? t("No Agents to add","追加できる Agent がありません","沒有可加入的 Agent") : t("+ Add Agent to compare…","＋ 比較する Agent を追加…","＋ 加入 Agent 比較…")}
          </option>
          {available.map((x) => (
            <option key={x.slug} value={x.slug}>{x.name}</option>
          ))}
        </select>
        <span className="text-[11px] text-faint">{slugs.length}/3</span>
      </div>
      <div className="text-[11px] text-faint">{t("Showing Agents in your current language.","現在の言語の Agent を表示しています。","僅顯示目前語言的 Agent。")}</div>
    </div>
  );

  if (agents.length === 0) {
    return (
      <div>
        <div className="mb-6">{AddControl}</div>
        <div className="glass-card flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-panel2 text-faint">
            <IconScale size={24} stroke={1.7} />
          </div>
          <div className="font-display text-[15px] font-bold text-text">{t("No Agents selected to compare yet","比較する Agent がまだ選択されていません","還沒有選擇要比較的 Agent")}</div>
          <div className="mt-1.5 max-w-md text-[12.5px] leading-6 text-muted">{t("Pick up to 3 Agents from the dropdown above to compare price, renewal and capabilities side by side.","上のドロップダウンから最大 3 個の Agent を選び、月額・継続率・能力を並べて比較しましょう。","從上方下拉選單挑選最多 3 個 Agent，並排比較月費、續訂率與能力。")}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">{AddControl}</div>
      <Reveal>
      <div className="glass-card overflow-x-auto p-0">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[130px] border-b border-glassborder/15 bg-panel/90 p-4 text-left text-[11px] tracking-[0.12em] text-rust backdrop-blur-sm">// {t("Item","項目","項目")}</th>
              {agents.map((a) => (
                <th key={a.slug} className="min-w-[180px] border-b border-l border-glassborder/15 bg-panel/90 p-4 text-left align-top backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/agent/${a.slug}`} className="font-display text-[14px] font-bold leading-5 text-text transition-colors hover:text-purple">
                      {a.name}
                    </Link>
                    <button
                      onClick={() => remove(a.slug)}
                      title={t("Remove","削除","移除")}
                      className="shrink-0 rounded-md border border-border px-1.5 text-[11px] text-muted hover:border-rust hover:text-rust"
                    >
                      <IconX size={12} stroke={2} />
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-muted">by {a.creatorName}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const best = bestFor(row);
              return (
                <tr key={row.label} className="border-b border-glassborder/10 last:border-0">
                  <td className="sticky left-0 z-10 bg-panel/90 p-4 align-top text-[12px] text-muted backdrop-blur-sm">{row.label}</td>
                  {agents.map((a, i) => (
                    <td key={a.slug} className={`border-l border-glassborder/10 p-4 align-top ${best === i ? "font-display font-bold text-green" : "text-text"}`}>
                      {row.render(a)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </Reveal>
    </div>
  );
}
