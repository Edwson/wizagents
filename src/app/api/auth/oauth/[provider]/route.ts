import { NextResponse } from "next/server";
import { providerConfig, callbackUrl, type Provider } from "@/lib/oauth";
import { randomTokenHex } from "@/lib/security";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const cfg = providerConfig(provider as Provider);
  if (!cfg) return NextResponse.redirect(new URL("/login?oauth=unconfigured", req.url));
  const state = randomTokenHex(16);
  (await cookies()).set("oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  const u = new URL(cfg.authUrl);
  u.searchParams.set("client_id", cfg.clientId!);
  u.searchParams.set("redirect_uri", callbackUrl(provider as Provider));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", cfg.scope);
  u.searchParams.set("state", state);
  return NextResponse.redirect(u.toString());
}
