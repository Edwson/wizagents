"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { IconSearch, IconMenu2, IconChevronDown } from "@tabler/icons-react";
import CommandPalette from "./CommandPalette";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import Avatar from "./Avatar";

type U = { name: string; role: string; email: string; avatarColor?: string | null; avatarMediaId?: string | null } | null;

export default function Nav({ user }: { user: U }) {
  const path = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);

  const ALL_TABS = [
    { href: "/market", label: t("Marketplace", "マーケット", "市集"), roles: ["*"] },
    { href: "/community", label: t("Community", "コミュニティ", "社群"), roles: ["*"] },
    { href: "/dashboard", label: t("My Subscriptions", "購読管理", "我的訂閱"), roles: ["*"] },
    { href: "/studio", label: t("Creator Studio", "クリエイター", "創作者工作室"), roles: ["*"] },
    { href: "/council", label: t("Council", "評議会", "評議會"), roles: ["*"] },
    { href: "/enterprise", label: t("Enterprise", "エンタープライズ", "企業"), roles: ["enterprise", "admin"] },
    { href: "/admin", label: t("Admin", "管理", "管理"), roles: ["admin"] },
  ];
  const tabs = ALL_TABS.filter((x) => x.roles.includes("*") || (user && x.roles.includes(user.role)));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false); router.push("/"); router.refresh();
  }
  const openPalette = () => (window as any).__openPalette?.();

  return (
    <div className="sticky top-0 z-50 border-b border-border glass-strong">
      <CommandPalette />
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-text" />
            <span className="font-display text-[16px] tracking-tight text-text"><span className="font-medium">Wiz</span><span className="font-bold">Agents</span><span className="text-faint">.mcp</span></span>
          </Link>
          <div className="hidden items-center gap-1 rounded-xl border border-glassborder/30 bg-panel2/50 p-1 backdrop-blur-sm md:flex">
            {tabs.map((x) => {
              const active = path.startsWith(x.href);
              return <Link key={x.href} href={x.href} className={`rounded-lg px-3 py-1.5 text-[12.5px] transition-all duration-300 ${active ? "bg-purple text-white" : "text-muted hover:text-text hover:bg-panel2"}`}>{x.label}</Link>;
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={openPalette} aria-label={t("Search", "検索", "搜尋")} className="hidden items-center gap-2 rounded-lg border border-border bg-panel2 px-3 py-1.5 text-[11.5px] text-faint hover:text-muted sm:flex">
            <IconSearch size={15} stroke={1.7} /><kbd className="rounded border border-border px-1 text-[10px]">⌘K</kbd>
          </button>
          <LanguageSwitcher />
          <ThemeToggle />
          {user && <NotificationBell />}

          {user ? (
            <div className="relative">
              <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-border bg-panel2 px-3 py-1.5 text-[12px] text-muted hover:text-text">
                <Avatar name={user.name} color={user.avatarColor} mediaId={user.avatarMediaId} size={22} />
                <span className="hidden sm:inline">{user.name}</span><IconChevronDown size={13} stroke={1.7} className="text-faint" />
              </button>
              {open && (
                <div className="absolute right-0 top-11 w-52 rounded-lg border border-border bg-panel p-1 shadow-xl">
                  <div className="px-3 py-2 text-[11px] text-faint">{user.email}</div>
                  <div className="px-3 pb-1 text-[11px] text-muted">{t("Role", "ロール", "角色")}: {roleLabel(user.role, t)}</div>
                  <div className="my-1 h-px bg-border" />
                  {tabs.map((x) => <Link key={x.href} href={x.href} onClick={() => setOpen(false)} className="block rounded px-3 py-1.5 text-[12px] text-muted hover:bg-panel2 hover:text-text">{x.label}</Link>)}
                  <Link href="/settings" onClick={() => setOpen(false)} className="block rounded px-3 py-1.5 text-[12px] text-muted hover:bg-panel2 hover:text-text">{t("Account settings", "アカウント設定", "帳號設定")}</Link>
                  <div className="my-1 h-px bg-border" />
                  <button onClick={logout} className="block w-full rounded px-3 py-1.5 text-left text-[12px] text-rust hover:bg-rust/10">{t("Sign out", "ログアウト", "登出")}</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="text-[12.5px] text-muted hover:text-text">{t("Sign in", "ログイン", "登入")}</Link>
              <Link href="/login?mode=register" className="rounded-lg bg-purple px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-purpledim">{t("Start free", "無料で始める", "免費開始")}</Link>
            </>
          )}

          <button onClick={() => setMobile((v) => !v)} aria-label="Menu" className="rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-muted md:hidden"><IconMenu2 size={16} stroke={1.7} /></button>
        </div>
      </div>

      {mobile && (
        <div className="border-t border-border bg-panel px-6 py-2 md:hidden">
          {tabs.map((x) => <Link key={x.href} href={x.href} onClick={() => setMobile(false)} className="block rounded px-2 py-2 text-[13px] text-muted hover:text-text">{x.label}</Link>)}
          <Link href="/settings" onClick={() => setMobile(false)} className="block rounded px-2 py-2 text-[13px] text-muted">{t("Account settings", "アカウント設定", "帳號設定")}</Link>
        </div>
      )}
    </div>
  );
}

function roleLabel(r: string, t: (en: string, ja?: string, zh?: string) => string) {
  return ({ buyer: t("Buyer", "バイヤー", "買家"), creator: t("Creator", "クリエイター", "創作者"), enterprise: t("Enterprise", "エンタープライズ", "企業"), admin: t("Admin", "管理者", "管理員") } as Record<string, string>)[r] || r;
}
