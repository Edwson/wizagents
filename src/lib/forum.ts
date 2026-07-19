import { db } from "@/lib/db";
import { detectExtraction } from "@/lib/antidistill";
import { logSecurity } from "@/lib/access";
import { excerptOf } from "@/lib/markdown";

/**
 * Community rules.
 *
 * The forum exists so experts can be SEEN — publish, argue, teach, promote. It must
 * never become the free back door to the thing buyers pay for. So public answers are
 * bounded: long enough to prove judgement, short enough that the full reasoning still
 * lives behind the subscription. Everything is scanned for harvesting.
 */

export * from "@/lib/forum-shared";
import { POST_KINDS, TAGS_MAX } from "@/lib/forum-shared";


export function normalizeTags(raw: string): string {
  return Array.from(
    new Set(
      String(raw || "")
        .split(/[,#，、]/)
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9぀-ヿ一-鿿-]/g, ""))
        .filter((t) => t.length >= 2 && t.length <= 24),
    ),
  )
    .slice(0, TAGS_MAX)
    .join(",");
}

export async function uniquePostSlug(title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "post";
  let slug = base;
  for (let i = 2; i < 200; i++) {
    const hit = await db.post.findUnique({ where: { slug } });
    if (!hit) return slug;
    slug = base + "-" + i;
  }
  return base + "-" + Date.now().toString(36);
}

/**
 * Guard every piece of public writing. Returns null when the text is fine, or a
 * refusal when someone is using the forum to harvest an expert's asset.
 */
export async function guardText(userId: string, text: string, where: string, agentId?: string | null): Promise<string | null> {
  const hit = detectExtraction(text);
  if (!hit.hit) return null;   // detectExtraction returns an OBJECT — truthiness alone would refuse everything
  // The same detector that guards the Agents guards the public square. Someone who
  // tries to farm an expert's material in the open is logged exactly like someone
  // who tries it over MCP.
  await logSecurity(agentId ?? null, userId, null, "extraction_attempt", `forum:${where} (${hit.reason}) — ${excerptOf(text, 120)}`);
  return "This reads as an attempt to extract an expert's underlying material rather than to ask a real question. Ask what you actually want to know — the experts here answer real questions.";
}

/** Hot ranking: recent activity beats raw score, so a live thread stays on top. */
export function hotScore(score: number, replies: number, lastActivity: Date): number {
  const hours = (Date.now() - lastActivity.getTime()) / 3_600_000;
  return (score * 2 + replies * 3 + 1) / Math.pow(hours + 2, 1.15);
}
