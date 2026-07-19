"use client";
import { useEffect, useState } from "react";
import {
  IconShieldLock,
  IconShieldCheck,
  IconAlertTriangle,
  IconClockX,
  IconBan,
} from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";

type Ev = {
  id: string;
  kind: string;
  detail: string;
  agentName: string;
  agentSlug: string;
  createdAt: string;
  subId: string | null;
};

export default function ProtectionPanel({ scope }: { scope?: "admin" }) {
  const { t, locale } = useI18n();
  const [events, setEvents] = useState<Ev[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/security-events${scope === "admin" ? "?scope=admin" : ""}`)
      .then((r) => (r.ok ? r.json() : { events: [], counts: {} }))
      .then((d) => {
        if (!alive) return;
        setEvents(d.events || []);
        setCounts(d.counts || {});
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [scope]);

  function kindLabel(kind: string) {
    switch (kind) {
      case "extraction_attempt":
        return t("Extraction attempt blocked", "抽出試行をブロック", "已攔截抽取嘗試");
      case "expired_access":
        return t("Access after subscription ended", "購読終了後のアクセス", "訂閱到期後的存取");
      case "token_flagged":
        return t("Token auto-suspended", "トークンを自動停止", "token 已自動停用");
      case "rate_limit":
        return t("Rate limit hit", "レート制限", "觸發速率限制");
      default:
        return kind;
    }
  }

  function kindIcon(kind: string) {
    switch (kind) {
      case "extraction_attempt":
        return <IconAlertTriangle size={15} stroke={1.7} className="text-amber" />;
      case "expired_access":
        return <IconClockX size={15} stroke={1.7} className="text-muted" />;
      case "token_flagged":
        return <IconBan size={15} stroke={1.7} className="text-rust" />;
      case "rate_limit":
        return <IconShieldLock size={15} stroke={1.7} className="text-muted" />;
      default:
        return <IconShieldCheck size={15} stroke={1.7} className="text-muted" />;
    }
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2">
        <IconShieldLock size={16} stroke={1.7} className="text-green" />
        <span className="font-display text-[13px] font-bold">{t("Protection", "保護", "保護")}</span>
      </div>
      <p className="mt-1 text-[11.5px] leading-6 text-muted">
        {t(
          "WizAgents blocks attempts to extract your system prompt or knowledge base, and severs access when a subscription lapses.",
          "WizAgentsはシステムプロンプトや知識ベースの抽出を阻止し、購読終了時にアクセスを遮断します。",
          "WizAgents 會阻擋抽取你的系統提示與知識庫的行為，並在訂閱到期時切斷存取。"
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip
          icon={<IconAlertTriangle size={14} stroke={1.7} className="text-amber" />}
          v={counts["extraction_attempt"] || 0}
          l={t("Extraction attempts", "抽出試行", "抽取嘗試")}
          tone="text-amber"
        />
        <Chip
          icon={<IconClockX size={14} stroke={1.7} className="text-muted" />}
          v={counts["expired_access"] || 0}
          l={t("Expired-access hits", "期限切れアクセス", "到期存取")}
          tone="text-muted"
        />
        <Chip
          icon={<IconBan size={14} stroke={1.7} className="text-rust" />}
          v={counts["token_flagged"] || 0}
          l={t("Flagged tokens", "フラグ付きトークン", "已標記 token")}
          tone="text-rust"
        />
      </div>

      <div className="mt-4 space-y-2">
        {!loading && events.length === 0 && (
          <div className="glass-card border-dashed p-6 text-center text-[12px] text-muted">
            {t(
              "No security events — your knowledge is protected.",
              "セキュリティイベントなし — あなたの知識は保護されています。",
              "沒有安全事件 — 你的知識受到保護。"
            )}
          </div>
        )}
        {events.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-2.5 rounded-xl border border-glassborder/20 bg-panel2/40 px-3 py-2.5 backdrop-blur-sm transition hover:border-borderlight"
          >
            <div className="mt-0.5 shrink-0">{kindIcon(e.kind)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[12px] font-bold">{kindLabel(e.kind)}</span>
                <span className="shrink-0 text-[10.5px] text-faint">{timeAgo(e.createdAt, locale)}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted">{e.agentName}</div>
              {e.detail && (
                <div className="mt-0.5 text-[11px] leading-5 text-faint">{e.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({
  icon,
  v,
  l,
  tone,
}: {
  icon: React.ReactNode;
  v: number;
  l: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-glassborder/20 bg-panel2/40 px-3 py-2 backdrop-blur-sm">
      {icon}
      <div>
        <div className={`font-display text-[15px] font-extrabold ${tone}`}>{v}</div>
        <div className="text-[9.5px] text-faint">{l}</div>
      </div>
    </div>
  );
}
