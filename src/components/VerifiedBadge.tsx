"use client";
import { IconRosetteDiscountCheck, IconUserCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { levelLabel, levelBlurb, type Level } from "@/lib/verification";

/**
 * The one place a verification tier is rendered.
 *   expert   → Verified Expert (identity + credentials, human-reviewed)
 *   identity → Identity verified (a real, named human)
 *   none     → nothing at all. An absent badge is the honest default.
 */
export default function VerifiedBadge({ level, size = "md" }: { level: Level; size?: "sm" | "md" }) {
  const { locale } = useI18n();
  if (level === "none") return null;

  const expert = level === "expert";
  const px = size === "sm" ? 11 : 13;

  return (
    <span title={levelBlurb(level, locale)} className={size === "sm" ? "text-[10px]" : undefined}>
      <Badge tone={expert ? "purple" : "cyan"}>
        {expert ? (
          <IconRosetteDiscountCheck size={px} stroke={1.7} />
        ) : (
          <IconUserCheck size={px} stroke={1.7} />
        )}
        {levelLabel(level, locale)}
      </Badge>
    </span>
  );
}
