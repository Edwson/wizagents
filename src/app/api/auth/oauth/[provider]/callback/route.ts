import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { providerConfig, callbackUrl, type Provider } from "@/lib/oauth";
import { createSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { randomTokenHex } from "@/lib/security";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const cfg = providerConfig(provider as Provider);
  if (!cfg) return NextResponse.redirect(new URL("/login?oauth=unconfigured", req.url));
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = (await cookies()).get("oauth_state")?.value;
  if (!code || !state || state !== saved) return NextResponse.redirect(new URL("/login?oauth=state_error", req.url));

  try {
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: cfg.clientId!, client_secret: cfg.clientSecret!, code, grant_type: "authorization_code", redirect_uri: callbackUrl(provider as Provider) }),
    });
    const tok = await tokenRes.json();
    const access = tok.access_token;
    if (!access) return NextResponse.redirect(new URL("/login?oauth=token_error", req.url));
    const profRes = await fetch(cfg.userUrl, { headers: { Authorization: `Bearer ${access}`, Accept: "application/json", "User-Agent": "WizAgents" } });
    const prof = await profRes.json();
    const email = (prof.email || prof.login && `${prof.login}@users.noreply.github.com` || "").toLowerCase();
    const name = prof.name || prof.login || (email.split("@")[0]) || "User";
    if (!email) return NextResponse.redirect(new URL("/login?oauth=no_email", req.url));

    let user = await db.user.findUnique({ where: { email } });
    if (!user) user = await db.user.create({ data: { email, name, role: "buyer", authProvider: provider, providerId: String(prof.id || prof.sub || ""), emailVerified: true, passwordHash: await hashPassword(randomTokenHex(16)) } });
    await createSession({ uid: user.id, role: user.role, email: user.email, name: user.name, sv: user.sessionVersion });
    return NextResponse.redirect(new URL(user.role === "creator" ? "/studio" : user.role === "enterprise" ? "/enterprise" : "/market", req.url));
  } catch {
    return NextResponse.redirect(new URL("/login?oauth=error", req.url));
  }
}
