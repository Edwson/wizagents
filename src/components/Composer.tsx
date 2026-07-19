"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { IconPhoto, IconBold, IconItalic, IconCode, IconList, IconQuote, IconLink, IconLoader2 } from "@tabler/icons-react";

/**
 * Markdown composer with image upload.
 * Images are uploaded to our own media endpoint and inserted as markdown — the editor
 * never handles raw HTML, and the renderer never trusts it.
 */
export default function Composer({
  value, onChange, placeholder, max, minRows = 8, hint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
  minRows?: number;
  hint?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const over = typeof max === "number" && value.length > max;
  const near = typeof max === "number" && !over && value.length > max * 0.85;

  function wrap(before: string, after = before, sample = "") {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const sel = value.slice(s, e) || sample;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }
  function prefix(p: string) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    onChange(value.slice(0, lineStart) + p + value.slice(lineStart));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + p.length, s + p.length); });
  }

  async function upload(file: File) {
    setErr(""); setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("alt", file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80));
    const r = await fetch("/api/media", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error || t("Upload failed.", "アップロードに失敗しました。", "上傳失敗。")); return; }
    onChange((value ? value.replace(/\s*$/, "\n\n") : "") + d.markdown + "\n");
  }

  return (
    <div className="rounded-xl border border-border bg-panel">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <ToolBtn onClick={() => wrap("**")} label={t("Bold", "太字", "粗體")}><IconBold size={15} stroke={1.8} /></ToolBtn>
        <ToolBtn onClick={() => wrap("*")} label={t("Italic", "斜体", "斜體")}><IconItalic size={15} stroke={1.8} /></ToolBtn>
        <ToolBtn onClick={() => wrap("`")} label={t("Code", "コード", "程式碼")}><IconCode size={15} stroke={1.8} /></ToolBtn>
        <ToolBtn onClick={() => prefix("- ")} label={t("List", "リスト", "清單")}><IconList size={15} stroke={1.8} /></ToolBtn>
        <ToolBtn onClick={() => prefix("> ")} label={t("Quote", "引用", "引用")}><IconQuote size={15} stroke={1.8} /></ToolBtn>
        <ToolBtn onClick={() => wrap("[", "](https://)", t("link", "リンク", "連結"))} label={t("Link", "リンク", "連結")}><IconLink size={15} stroke={1.8} /></ToolBtn>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolBtn onClick={() => fileRef.current?.click()} label={t("Image", "画像", "圖片")}>
          {busy ? <IconLoader2 size={15} className="animate-spin" /> : <IconPhoto size={15} stroke={1.8} />}
        </ToolBtn>
        <input
          ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
        <span className="ml-auto text-[11px] text-faint">
          {typeof max === "number" && (
            <span className={over ? "text-rust" : near ? "text-amber-500" : ""}>{value.length} / {max}</span>
          )}
        </span>
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        onPaste={(e) => {
          const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/"));
          if (f) { e.preventDefault(); upload(f); }
        }}
        className="w-full resize-y bg-transparent px-3 py-3 text-[13.5px] leading-relaxed outline-none placeholder:text-faint"
      />

      {(err || hint) && (
        <div className="border-t border-border px-3 py-2 text-[11.5px]">
          {err ? <span className="text-rust">{err}</span> : <span className="text-faint">{hint}</span>}
        </div>
      )}
    </div>
  );
}

function ToolBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="rounded-md p-1.5 text-muted transition-colors hover:bg-panel2 hover:text-text">
      {children}
    </button>
  );
}
