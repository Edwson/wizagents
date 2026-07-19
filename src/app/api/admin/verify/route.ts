import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { readJson, badRequest } from "@/lib/req";

// Human review of an expert's credentials. The verified mark only ever comes from here.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await readJson(req); if (!body) return badRequest();
  const { userId, action, reason } = body;
  const approve = action === "approve";
  await db.creatorProfile.update({ where: { userId }, data: { verified: approve, verificationStatus: approve ? "approved" : "rejected" } });
  await notify(
    userId, "welcome",
    approve ? "Verification approved" : "Verification not approved",
    approve
      ? "A reviewer confirmed your credentials. Your Agents now carry the Verified Expert mark, and you can sign citable endorsements."
      : `A reviewer could not confirm your credentials.${reason ? ` Reason: ${reason}` : ""} You can update your details and resubmit.`,
    "/studio/verification"
  );
  return NextResponse.json({ ok: true, verified: approve });
}
