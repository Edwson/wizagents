"use client";
import { useRef, useState } from "react";
import {
  IconUpload,
  IconShieldCheck,
  IconAlertTriangle,
  IconVirus,
  IconLoader2,
} from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";

type Verdict = "pending" | "clean" | "suspicious" | "infected" | "error";
type Row = { id: string; name: string; verdict: Verdict; detail: string };

const ACCEPT =
  ".pdf,.txt,.md,.csv,.json,.docx,.png,.jpg,.jpeg,application/pdf,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg";

export default function AssetUploader({ slug }: { slug?: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setRows((r) => [
        { id: key, name: file.name, verdict: "pending", detail: "" },
        ...r,
      ]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (slug) fd.append("slug", slug);
        const res = await fetch("/api/creator/asset", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok || !d.ok) throw new Error(d.error || "scan failed");
        const verdict = d.status as Verdict;
        setRows((r) =>
          r.map((x) =>
            x.id === key ? { ...x, id: d.id || key, verdict, detail: d.detail } : x,
          ),
        );
        if (verdict === "clean")
          toast(t("Asset scanned — clean", "アセットをスキャン — 安全", "資產已掃描 — 安全"), "success");
        else if (verdict === "infected")
          toast(t("Upload blocked — threat found", "アップロードをブロック — 脅威検出", "已封鎖上傳 — 偵測到威脅"), "error");
        else
          toast(t("Flagged for review", "レビュー対象としてフラグ", "已標記待審"), "error");
      } catch {
        setRows((r) =>
          r.map((x) =>
            x.id === key
              ? { ...x, verdict: "error", detail: t("Upload failed", "アップロード失敗", "上傳失敗") }
              : x,
          ),
        );
        toast(t("Upload failed", "アップロード失敗", "上傳失敗"), "error");
      }
    }
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition ${
          drag ? "border-purple bg-purple/5" : "border-border bg-panel2 hover:border-purple/60"
        }`}
      >
        <IconUpload size={22} stroke={1.7} className="text-purple" />
        <div className="text-[12.5px] text-text">
          {t("Drop a file or click to upload an asset", "ファイルをドロップ、またはクリックしてアップロード", "拖放檔案或點擊上傳資產")}
        </div>
        <div className="text-[11px] text-faint">
          {t("Every uploaded asset is scanned for malware before it can be attached to your Agent.", "アップロードされた全アセットは、エージェントに添付される前にマルウェアスキャンされます。", "每個上傳的資產在附加到你的 Agent 前，都會先進行惡意軟體掃描。")}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-panel2 px-3 py-2 text-[12px]"
            >
              <span className="truncate text-muted">{r.name}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {r.verdict === "pending" && (
                  <span className="flex items-center gap-1 text-faint">
                    <IconLoader2 size={14} stroke={1.8} className="animate-spin" />
                    {t("Scanning…", "スキャン中…", "掃描中…")}
                  </span>
                )}
                {r.verdict === "clean" && (
                  <span className="flex items-center gap-1 text-green">
                    <IconShieldCheck size={14} stroke={1.8} />
                    {t("Scanned — clean", "スキャン済み — 安全", "已掃描 — 安全")}
                  </span>
                )}
                {r.verdict === "suspicious" && (
                  <span className="flex items-center gap-1 text-amber">
                    <IconAlertTriangle size={14} stroke={1.8} />
                    {r.detail}
                  </span>
                )}
                {r.verdict === "infected" && (
                  <span className="flex items-center gap-1 text-rust">
                    <IconVirus size={14} stroke={1.8} />
                    {t("Blocked:", "ブロック:", "已封鎖:")} {r.detail}
                  </span>
                )}
                {r.verdict === "error" && (
                  <span className="flex items-center gap-1 text-rust">
                    <IconAlertTriangle size={14} stroke={1.8} />
                    {r.detail}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
