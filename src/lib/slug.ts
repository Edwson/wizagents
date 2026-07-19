export function slugify(name: string): string {
  const base = name.toLowerCase().replace(/agent/gi, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "agent";
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}
