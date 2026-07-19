"use client";
import Link from "next/link";
import { IconFlame, IconArrowRight } from "@tabler/icons-react";
import { catLabel } from "@/lib/categories";
import { typeLabel, typeGlyph } from "@/lib/agent-types";
import { useI18n } from "@/lib/i18n";
import type { AgentDTO } from "@/lib/data";
import { updatedLabelI18n } from "@/lib/format";
import { Badge } from "@/components/ui";
import VerifiedBadge from "./VerifiedBadge";
import type { Level } from "@/lib/verification";

export default function AgentCard({ a, subscribed = false, hasPass = false }: { a: AgentDTO; subscribed?: boolean; hasPass?: boolean }) {
  const { t, locale } = useI18n();
  const passCovered = hasPass && a.inPass;
  // The badge only appears when the DTO actually carries a reviewed level.
  // An absent badge is the honest default — we never assert verification we don't have.
  const creatorLevel: Level = (a as AgentDTO & { creatorLevel?: Level }).creatorLevel ?? "none";
  return (
    <Link href={`/agent/${a.slug}`} className="group glass-card flex h-full flex-col gap-2.5 p-[18px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="muted">{catLabel(a.category, locale)}</Badge>
          <Badge tone="purple"><span className="font-display">{typeGlyph(a.agentType)}</span> {typeLabel(a.agentType, locale)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {a.trending && <span className="flex items-center gap-0.5 text-[10px] font-bold text-rust"><IconFlame size={12} /> {t("Trending", "人気", "熱門")}</span>}
          {subscribed && <span className="text-[10px] font-bold text-grad">{t("Subscribed", "購読中", "已訂閱")}</span>}
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="font-display text-[15px] font-bold leading-6 text-text">{a.name}</div>
        <IconArrowRight size={16} stroke={1.8} className="mt-0.5 shrink-0 text-faint opacity-0 -translate-x-1 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-purple" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>{t("by", "by", "by")} {a.creatorName}</span>
        <VerifiedBadge level={creatorLevel} size="sm" />
        <span className="text-faint">·</span>
        {a.rating >= 1 ? <span className="text-amber">★ {a.rating.toFixed(1)}</span> : <span className="text-faint">{t("New","新着","新")}</span>}
      </div>

      <div className="rounded-lg border border-glassborder/10 bg-panel2/60 px-3 py-2.5 backdrop-blur-sm">
        <div className="text-[11px] leading-5 text-muted">
          {t("Replaces a", "", "取代")} <span className="font-display font-bold text-grad">${a.replacesRate}/hr</span> {t("expert", `/hrの専門家を代替`, `的${a.replacesRole}`)}
        </div>
        <div className="mt-0.5 text-[10.5px] text-green">{t(`Saves ~${a.savesHrs} hrs/mo`, `月〜${a.savesHrs}時間節約`, `每月省下 ~${a.savesHrs} 小時`)}</div>
      </div>

      <div className="flex-1 text-[12px] leading-6 text-muted line-clamp-2">{a.description}</div>

      <div className="flex items-center gap-1.5 text-[10.5px] text-purple">
        <span className="h-1.5 w-1.5 animate-pulsedot rounded-full bg-purple" />{t(...updatedLabelI18n(a.updatedLabel))}
      </div>

      <div className="flex items-center justify-between border-t border-glassborder/10 pt-2.5">
        <div className="font-display text-[16px] font-extrabold">
          {passCovered ? <span className="text-green">{t("In Pass", "パス対象", "通行證涵蓋")}</span> : <><span className="text-grad">${a.price}</span><span className="text-[10px] font-medium text-muted">/mo</span></>}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-green">
          <span className="h-1.5 w-1.5 rounded-full bg-green" />{t("Renewal", "継続", "續訂")} {a.renewal}%
        </div>
      </div>
    </Link>
  );
}
