"use client";
import { useEffect, useState } from "react";
import { IconBrandGoogle, IconBrandGithub, IconBrandApple } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";

const ICON: Record<string, any> = { google: IconBrandGoogle, github: IconBrandGithub, apple: IconBrandApple };

export default function OAuthButtons() {
  const { t } = useI18n();
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => { fetch("/api/auth/oauth/providers").then((r) => r.json()).then((d) => setProviders(d.providers || [])).catch(() => {}); }, []);
  if (providers.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {providers.map((p) => {
        const I = ICON[p.id];
        return (
          <a key={p.id} href={`/api/auth/oauth/${p.id}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-glassborder/20 bg-panel2/40 px-4 py-2.5 text-[13px] font-medium backdrop-blur-sm transition-all hover:border-violet/40 hover:shadow-glow">
            {I && <I size={16} stroke={1.7} />} {t(`Continue with ${p.label}`, `${p.label}で続ける`, `使用 ${p.label} 繼續`)}
          </a>
        );
      })}
    </div>
  );
}
