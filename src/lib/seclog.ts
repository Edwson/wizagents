import { db } from "./db";
import { clientIp } from "./security";

export type SecKind =
  | "login" | "login_failed" | "password_changed" | "2fa_enabled" | "2fa_disabled"
  | "sessions_revoked" | "payout_method_changed" | "passkey_added" | "passkey_removed"
  | "token_rotated" | "data_exported" | "account_deleted" | "profile_updated";

/** Record an account-security event the user can review. Never throws. */
export async function seclog(userId: string, kind: SecKind, detail = "", req?: Request) {
  try {
    await db.securityLog.create({
      data: {
        userId, kind, detail: detail.slice(0, 300),
        ip: req ? clientIp(req) : "",
        userAgent: req ? (req.headers.get("user-agent") || "").slice(0, 200) : "",
      },
    });
  } catch {}
}
