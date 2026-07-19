import { db } from "./db";
import { verifyToken } from "./totp";
import { sha256 } from "./security";

/** Verify a fresh TOTP or one-time backup code for a step-up (money) action. */
export async function verifyTotpStepUp(userId: string, code: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) return false;
  const c = (code || "").trim();
  if (!c) return false;
  if (verifyToken(c, user.twoFactorSecret)) return true;
  const bc = await db.backupCode.findFirst({ where: { userId, used: false, codeHash: sha256(c.toUpperCase()) } });
  if (bc) { await db.backupCode.update({ where: { id: bc.id }, data: { used: true } }); return true; }
  return false;
}
