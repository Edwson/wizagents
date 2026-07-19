"use client";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { IconDownload, IconLink } from "@tabler/icons-react";

export default function ReputationExport({ id, isOwner }: { id: string; isOwner?: boolean }) {
  const { t } = useI18n();
  const { toast } = useToast();
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => { navigator.clipboard?.writeText(`${location.origin}/creator/${id}`); toast(t("Public link copied", "公開リンクをコピーしました", "已複製公開連結"), "success"); }}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-panel2 px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-text">
        <IconLink size={13} stroke={1.8} /> {t("Share", "共有", "分享")}
      </button>
      <a href={`/api/reputation/${id}?format=download`}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-panel2 px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-text">
        <IconDownload size={13} stroke={1.8} /> {isOwner ? t("Export my record", "記録をエクスポート", "匯出我的紀錄") : t("Export record", "記録をエクスポート", "匯出紀錄")}
      </a>
    </div>
  );
}
