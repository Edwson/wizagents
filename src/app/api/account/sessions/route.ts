import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createSession, clearStepUp } from "@/lib/session";
import { seclog } from "@/lib/seclog";

export const dynamic = "force-dynamic";

/** Revoke every session (all devices). This one is re-issued so you stay signed in here. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const updated = await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await clearStepUp();
  await createSession({ uid: updated.id, role: updated.role, email: updated.email, name: updated.name, sv: updated.sessionVersion });
  await seclog(user.id, "sessions_revoked", "Signed out of all other devices", req);
  return NextResponse.json({ ok: true });
}
