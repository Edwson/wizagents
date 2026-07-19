import { cookies } from "next/headers";

export type Locale = "en" | "ja" | "zh";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get("locale")?.value;
  return v === "ja" || v === "zh" ? v : "en";
}

/** Server-side translate: pick a string for the given locale (English default). */
export function pick(locale: Locale, en: string, ja?: string, zh?: string): string {
  return locale === "ja" ? ja ?? en : locale === "zh" ? zh ?? en : en;
}
