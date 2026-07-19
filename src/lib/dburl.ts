import path from "path";

/**
 * Resolve the SQLite connection URL consistently for both the Prisma CLI and
 * the Prisma Client. The CLI resolves relative `file:` paths against the schema
 * directory (prisma/), while the Client resolves against process.cwd(). To make
 * them agree on every OS we build an absolute `file:` URL to <cwd>/prisma/dev.db.
 *
 * If DATABASE_URL points to a non-sqlite/absolute target (e.g. Postgres in prod),
 * we honor it verbatim.
 */
export function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (raw && !/^file:\.\//.test(raw)) return raw; // honor explicit/absolute/non-file URLs
  const abs = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
  return "file:" + abs;
}
