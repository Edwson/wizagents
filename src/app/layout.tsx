import "./globals.css";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { I18nProvider } from "@/lib/i18n";
import Nav from "@/components/Nav";
import { Aurora } from "@/components/ui";
import { ToastProvider } from "@/components/Toast";
import { siteUrl } from "@/lib/seo";

const DESCRIPTION =
  "Subscribe to hosted expert Agents built by named, accountable specialists — compliance, legal, finance, design and more. One MCP URL connects an expert\u2019s judgement to any AI tool you already use.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "WizAgents — Subscribe to an expert, not a prompt",
    template: "%s · WizAgents",
  },
  description: DESCRIPTION,
  applicationName: "WizAgents",
  keywords: ["expert agents", "MCP", "Model Context Protocol", "AI marketplace", "verified experts", "AI subscription"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "WizAgents",
    url: "/",
    title: "WizAgents — Subscribe to an expert, not a prompt",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "WizAgents — Subscribe to an expert, not a prompt",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

const themeScript = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [me, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  // A creator's storefront photo is the one they chose to show the public, so it wins.
  const user = me
    ? {
        name: me.name,
        role: me.role,
        email: me.email,
        avatarColor: me.avatarColor,
        avatarMediaId: me.creatorProfile?.avatarMediaId || me.avatarMediaId,
      }
    : null;
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <ToastProvider>
            <Aurora />
            <Nav user={user} />
            <main className="mx-auto min-h-[calc(100vh-56px)] max-w-[1180px] px-6 pb-28 pt-6">{children}</main>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
