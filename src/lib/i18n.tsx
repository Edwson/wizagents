"use client";
import { createContext, useContext, useCallback, ReactNode } from "react";

export type Locale = "en" | "ja" | "zh";
type T = (en: string, ja?: string, zh?: string) => string;

const Ctx = createContext<{ locale: Locale; t: T }>({ locale: "en", t: (en) => en });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = useCallback<T>(
    (en, ja, zh) => (locale === "ja" ? ja ?? en : locale === "zh" ? zh ?? en : en),
    [locale]
  );
  return <Ctx.Provider value={{ locale, t }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
