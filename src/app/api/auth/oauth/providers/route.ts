import { NextResponse } from "next/server";
import { enabledProviders } from "@/lib/oauth";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ providers: enabledProviders() }); }
