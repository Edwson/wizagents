import Link from "next/link";
import { Badge } from "@/components/ui";
import { tagHref } from "@/lib/seo";

/**
 * Expert-authored topic tags, rendered as links into the public tag landing pages.
 * Presentational only — the caller decides which tags are worth showing.
 */
export default function TagChips({
  tags,
  limit,
  tone = "muted",
  className = "",
}: {
  tags: string[];
  limit?: number;
  tone?: "muted" | "purple" | "green" | "amber" | "cyan" | "rust";
  className?: string;
}) {
  const list = Array.from(new Set((tags || []).map((t) => t.trim()).filter(Boolean)));
  const shown = typeof limit === "number" ? list.slice(0, limit) : list;
  if (shown.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {shown.map((t) => (
        <Link key={t} href={tagHref(t)} className="transition-opacity hover:opacity-80">
          <Badge tone={tone}>
            <span className="text-faint">#</span>
            {t}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
