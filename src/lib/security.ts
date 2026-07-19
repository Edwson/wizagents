import crypto from "crypto";

// ---- In-memory sliding-window rate limiter (per key, e.g. ip:action) ----
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local").slice(0, 64);
}

// ---- Password strength ----
export function passwordIssues(pw: string): string[] {
  const issues: string[] = [];
  if (!pw || pw.length < 8) issues.push("At least 8 characters");
  if (!/[a-z]/.test(pw)) issues.push("A lowercase letter");
  if (!/[A-Z]/.test(pw)) issues.push("An uppercase letter");
  if (!/[0-9]/.test(pw)) issues.push("A number");
  if (/^(.)\1+$/.test(pw || "")) issues.push("Not all the same character");
  const common = ["password", "12345678", "qwerty", "11111111", "letmein", "demo1234"];
  if (common.includes((pw || "").toLowerCase())) issues.push("Not a common password");
  return issues;
}
export function passwordStrong(pw: string) { return passwordIssues(pw).length === 0; }

// ---- Tokens & hashing ----
export function randomTokenHex(bytes = 32) { return crypto.randomBytes(bytes).toString("hex"); }
export function sha256(s: string) { return crypto.createHash("sha256").update(s).digest("hex"); }

// ---- Backup codes ----
export function generateBackupCodes(n = 10): { code: string; hash: string }[] {
  return Array.from({ length: n }, () => {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})(.{5})/, "$1-$2");
    return { code, hash: sha256(code) };
  });
}
