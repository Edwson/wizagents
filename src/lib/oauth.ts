// OAuth provider registry. Providers activate automatically once their
// client id/secret are present in the environment. No secrets are hard-coded.
export type Provider = "google" | "github" | "apple";

type Cfg = { id: string; label: string; authUrl: string; tokenUrl: string; userUrl: string; scope: string; clientId?: string; clientSecret?: string };

export function providerConfig(p: Provider): Cfg | null {
  const base: Record<Provider, Omit<Cfg, "clientId" | "clientSecret">> = {
    google: { id: "google", label: "Google", authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", userUrl: "https://openidconnect.googleapis.com/v1/userinfo", scope: "openid email profile" },
    github: { id: "github", label: "GitHub", authUrl: "https://github.com/login/oauth/authorize", tokenUrl: "https://github.com/login/oauth/access_token", userUrl: "https://api.github.com/user", scope: "read:user user:email" },
    apple: { id: "apple", label: "Apple", authUrl: "https://appleid.apple.com/auth/authorize", tokenUrl: "https://appleid.apple.com/auth/token", userUrl: "", scope: "name email" },
  };
  const clientId = process.env[`${p.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${p.toUpperCase()}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  return { ...base[p], clientId, clientSecret };
}

export function enabledProviders(): { id: Provider; label: string }[] {
  return (["google", "github", "apple"] as Provider[])
    .map((p) => providerConfig(p))
    .filter(Boolean)
    .map((c) => ({ id: c!.id as Provider, label: c!.label }));
}

export function callbackUrl(p: Provider) {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  return `${origin}/api/auth/oauth/${p}/callback`;
}
