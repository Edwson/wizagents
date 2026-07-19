"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconWorld, IconCheck } from "@tabler/icons-react";
import { useI18n, type Locale } from "@/lib/i18n";

const LANGS: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "繁體中文" },
];

export default function LanguageSwitcher() {
  const router = useRouter();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function choose(code: Locale) {
    document.cookie = `locale=${code};path=/;max-age=${60 * 60 * 24 * 365}`;
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Language"
        className="flex items-center gap-1 rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-muted hover:text-text">
        <IconWorld size={16} stroke={1.7} />
        <span className="text-[11.5px] uppercase">{locale}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-[90] w-36 rounded-lg border border-border bg-panel p-1 shadow-xl">
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => choose(l.code)}
              className="flex w-full items-center justify-between rounded px-3 py-1.5 text-[12.5px] text-muted hover:bg-panel2 hover:text-text">
              {l.label}
              {locale === l.code && <IconCheck size={14} stroke={2} className="text-purple" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
