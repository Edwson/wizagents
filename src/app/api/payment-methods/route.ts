import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readJson, badRequest } from "@/lib/req";
import { detectBrand, luhnValid, expValid } from "@/lib/cards";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const cards = await db.paymentMethod.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ methods: cards.map((c) => ({ id: c.id, brand: c.brand, last4: c.last4, expMonth: c.expMonth, expYear: c.expYear, holderName: c.holderName, isDefault: c.isDefault })) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body) return badRequest();

  // set-default action
  if (body.action === "default" && body.id) {
    const owns = await db.paymentMethod.findFirst({ where: { id: body.id, userId: user.id } });
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.paymentMethod.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    await db.paymentMethod.update({ where: { id: body.id }, data: { isDefault: true } });
    return NextResponse.json({ ok: true });
  }

  // add card — validate then store ONLY brand/last4/exp/holder (PAN & CVV are discarded)
  const number = String(body.number || "").replace(/\s/g, "");
  const [mm, yy] = String(body.exp || "").split("/").map((x: string) => parseInt(x.trim(), 10));
  const expMonth = mm, expYear = yy > 100 ? yy : 2000 + (yy || 0);
  if (!luhnValid(number)) return NextResponse.json({ error: "Invalid card number", code: "bad_card" }, { status: 400 });
  if (!expValid(expMonth, expYear)) return NextResponse.json({ error: "Card is expired or has an invalid date", code: "bad_exp" }, { status: 400 });
  if (!body.holderName?.trim()) return NextResponse.json({ error: "Cardholder name is required", code: "no_name" }, { status: 400 });

  const count = await db.paymentMethod.count({ where: { userId: user.id } });
  const card = await db.paymentMethod.create({
    data: { userId: user.id, brand: detectBrand(number), last4: number.slice(-4), expMonth, expYear, holderName: body.holderName.trim(), isDefault: count === 0 },
  });
  return NextResponse.json({ ok: true, method: { id: card.id, brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear, holderName: card.holderName, isDefault: card.isDefault } });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await readJson(req); if (!body?.id) return badRequest();
  const card = await db.paymentMethod.findFirst({ where: { id: body.id, userId: user.id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.paymentMethod.delete({ where: { id: card.id } });
  if (card.isDefault) {
    const next = await db.paymentMethod.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    if (next) await db.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return NextResponse.json({ ok: true });
}
