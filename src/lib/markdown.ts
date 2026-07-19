/**
 * Strict markdown renderer. User text is the most dangerous input a forum takes,
 * so everything is escaped FIRST and only a small closed set of markdown constructs
 * is re-introduced. No raw HTML, no remote images, no javascript:/data: URLs.
 */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (/^javascript:/i.test(url) || /^data:/i.test(url) || /^vbscript:/i.test(url)) return null;
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) return null;
  return url;
}
function safeImg(raw: string): string | null {
  // Own-origin media only. A remote image would leak every reader's IP to whoever the author picked.
  return /^\/api\/media\/[A-Za-z0-9_-]+$/.test(raw.trim()) ? raw.trim() : null;
}
function inline(text: string): string {
  let s = esc(text);
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => { codes.push('<code class="rounded bg-panel2 px-1 py-0.5 text-[0.9em]">' + c + "</code>"); return "  " + (codes.length - 1) + "  "; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
    const u = safeImg(url);
    return u ? '<img src="' + u + '" alt="' + alt + '" loading="lazy" class="my-4 max-h-[520px] w-auto rounded-xl border border-border" />' : alt;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, url) => {
    const u = safeHref(url);
    if (!u) return t;
    const ext = /^https?:\/\//i.test(u);
    return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="nofollow noopener noreferrer"' : "") + ' class="text-accent underline underline-offset-2">' + t + "</a>";
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/  (\d+)  /g, (_m, i) => codes[Number(i)]);
  return s;
}
export function renderMarkdown(src: string): string {
  const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listOpen: "ul" | "ol" | null = null;
  const closeList = () => { if (listOpen) { out.push("</" + listOpen + ">"); listOpen = null; } };
  const flushCode = () => { out.push('<pre class="my-4 overflow-x-auto rounded-xl border border-border bg-panel2 p-4 text-[12.5px]"><code>' + esc(codeBuf.join("\n")) + "</code></pre>"); codeBuf = []; };
  for (const line of lines) {
    if (/^```/.test(line)) { if (inCode) { flushCode(); inCode = false; } else { closeList(); inCode = true; } continue; }
    if (inCode) { codeBuf.push(line); continue; }
    if (!line.trim()) { closeList(); continue; }
    let m = line.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      closeList();
      const lvl = Math.min(m[1].length + 1, 5);
      const size = ["", "", "text-[22px]", "text-[18px]", "text-[16px]", "text-[15px]"][lvl];
      out.push("<h" + lvl + ' class="mt-6 mb-2 font-semibold tracking-tight ' + size + '">' + inline(m[2]) + "</h" + lvl + ">");
      continue;
    }
    if (/^>\s?/.test(line)) { closeList(); out.push('<blockquote class="my-3 border-l-2 border-accent/40 pl-4 text-muted">' + inline(line.replace(/^>\s?/, "")) + "</blockquote>"); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { closeList(); out.push('<hr class="my-6 border-border" />'); continue; }
    m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) { if (listOpen !== "ul") { closeList(); out.push('<ul class="my-3 list-disc space-y-1 pl-5">'); listOpen = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }
    m = line.match(/^\s*\d+\.\s+(.*)$/);
    if (m) { if (listOpen !== "ol") { closeList(); out.push('<ol class="my-3 list-decimal space-y-1 pl-5">'); listOpen = "ol"; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }
    closeList();
    out.push('<p class="my-3 leading-relaxed">' + inline(line) + "</p>");
  }
  if (inCode && codeBuf.length) flushCode();
  closeList();
  return out.join("\n");
}
export function excerptOf(src: string, max = 180): string {
  const t = String(src || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}
