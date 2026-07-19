import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { notify } from "@/lib/notify";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const { action, name } = await req.json();

  if (action === "update") {
    const nm = (name || "").trim();
    if (!nm) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    await db.user.update({ where: { id: user.id }, data: { name: nm } });
    if (user.creatorProfile) await db.creatorProfile.update({ where: { userId: user.id }, data: { displayName: nm } });
    await createSession({ uid: user.id, role: user.role, email: user.email, name: nm, sv: user.sessionVersion });
    return NextResponse.json({ ok: true });
  }

  if (action === "become-creator") {
    if (user.role === "buyer") {
      await db.user.update({ where: { id: user.id }, data: { role: "creator" } });
      const prof = await db.creatorProfile.findUnique({ where: { userId: user.id } });
      if (!prof) await db.creatorProfile.create({ data: { userId: user.id, displayName: user.name } });
      await createSession({ uid: user.id, role: "creator", email: user.email, name: user.name, sv: user.sessionVersion });
      await notify(user.id, "welcome", "歡迎成為創作者！", "前往工作室，四步上架你的第一個專家 Agent。", "/studio/create");
    }
    return NextResponse.json({ ok: true, role: "creator" });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
