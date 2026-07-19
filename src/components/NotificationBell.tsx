"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconBell, IconConfetti, IconCircleCheck, IconRefresh, IconStar, IconSignature, IconHandClick } from "@tabler/icons-react";
import { timeAgo } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

type N = { id: string; type: string; title: string; body: string; href: string; read: boolean; createdAt: string };

function Icon({ type }: { type: string }) {
  const p = { size: 15, stroke: 1.7 };
  switch (type) {
    case "subscription": return <IconConfetti {...p} className="text-purple" />;
    case "escalation_answered": return <IconCircleCheck {...p} className="text-green" />;
    case "knowledge_update": return <IconRefresh {...p} className="text-amber" />;
    case "review": return <IconStar {...p} className="text-amber" />;
    case "signed": return <IconSignature {...p} className="text-green" />;
    default: return <IconHandClick {...p} className="text-muted" />;
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications");
    if (!r.ok) return;
    const d = await r.json();
    setItems(d.notifications || []); setUnread(d.unread || 0);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  async function toggle() {
    const next = !open; setOpen(next);
    if (next && unread > 0) { await fetch("/api/notifications/read", { method: "POST" }); setUnread(0); setItems((x) => x.map((i) => ({ ...i, read: true }))); }
  }
  function goto(n: N) { setOpen(false); if (n.href) { router.push(n.href); router.refresh(); } }

  return (
    <div className="relative">
      <button onClick={toggle} className="relative rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-muted hover:text-text" aria-label="Notifications">
        <IconBell size={16} stroke={1.7} />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rust px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-[80] w-80 overflow-hidden rounded-lg border border-border bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><span className="text-[12px] font-bold">{t("Notifications", "通知", "通知")}</span><span className="text-[10.5px] text-faint">{items.length}</span></div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && <div className="px-4 py-8 text-center text-[12px] text-faint">{t("No notifications yet", "通知はありません", "目前沒有通知")}</div>}
            {items.map((n) => (
              <button key={n.id} onClick={() => goto(n)} className={`flex w-full gap-2.5 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-panel2 ${!n.read ? "bg-purple/5" : ""}`}>
                <span className="mt-0.5"><Icon type={n.type} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-text">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-[11px] leading-5 text-muted">{n.body}</div>}
                  <div className="mt-0.5 text-[10px] text-faint">{timeAgo(n.createdAt, locale)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
