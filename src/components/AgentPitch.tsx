"use client";
import { IconCheck, IconQuote, IconAlertTriangle } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui";

/**
 * The expert's own presentation of their Agent, in their own words.
 * Purely presentational — every block is optional and renders nothing when empty,
 * so agents created before these fields existed degrade to nothing at all.
 */
export default function AgentPitch({
  pitch = "", creatorName, useCases = [], notFor = "", tags = [], className = "",
}: {
  pitch?: string;
  creatorName: string;
  useCases?: string[];
  notFor?: string;
  tags?: string[];
  className?: string;
}) {
  const { t } = useI18n();
  const clean = (xs: string[]) => xs.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  const cases = clean(useCases);
  const topics = clean(tags);
  const story = (pitch || "").trim();
  const limits = (notFor || "").trim();
  if (!story && !cases.length && !limits && !topics.length) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {story && (
        <figure className="relative rounded-xl border border-border bg-panel/40 px-4 py-3.5">
          <IconQuote size={16} stroke={1.7} className="absolute left-3.5 top-3 text-faint" aria-hidden />
          <blockquote className="whitespace-pre-wrap pl-6 text-[13px] leading-7 text-text">{story}</blockquote>
          <figcaption className="mt-2 pl-6 text-[11.5px] text-muted">— {creatorName}</figcaption>
        </figure>
      )}

      {cases.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-faint">
            {t("Best for", "こんな用途に", "最適用途")}
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {cases.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] leading-6 text-muted">
                <IconCheck size={14} stroke={1.7} className="mt-1 shrink-0 text-green" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {limits && (
        <div className="flex items-start gap-2 rounded-lg border border-amber/25 bg-amber/[0.04] px-3 py-2.5">
          <IconAlertTriangle size={14} stroke={1.7} className="mt-0.5 shrink-0 text-amber" aria-hidden />
          <div className="text-[12px] leading-6 text-muted">
            <span className="font-medium text-amber">{t("Not for", "対象外", "不適用於")}: </span>
            {limits}
          </div>
        </div>
      )}

      {topics.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {topics.map((tag) => (
            <Badge key={tag} tone="muted">#{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
