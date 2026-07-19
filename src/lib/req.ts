import { NextResponse } from "next/server";

/** Safely parse a JSON request body; returns null on malformed/empty input. */
export async function readJson<T = any>(req: Request): Promise<T | null> {
  try { return (await req.json()) as T; } catch { return null; }
}
export function badRequest(msg = "Invalid request body") {
  return NextResponse.json({ error: msg }, { status: 400 });
}
