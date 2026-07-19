"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "./Toast";
import { useI18n } from "@/lib/i18n";
import { Btn, Badge } from "@/components/ui";
import { IconCopy, IconPlugConnected, IconBrandOpenSource, IconPlayerPlay } from "@tabler/icons-react";

/** Public docs: no token is ever rendered here — subscribers get theirs on /connect/[slug]. */
export type PublicSub = { slug: string; name: string };

type Door = "mcp" | "openai";

export default function McpConnect({ subs }: { subs: PublicSub[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [sel, setSel] = useState(0);
  const [door, setDoor] = useState<Door>("mcp");
  const [client, setClient] = useState<"claude" | "cursor" | "openwebui" | "python" | "curl">("claude");

  const s = subs[sel];
  const slug = s?.slug || "<agent-slug>";
  const origin = "https://wiz-agents.com";
  const mcp = `${origin}/api/mcp/${slug}`;
  const base = `${origin}/api/v1`;
  const model = `wizagents/${slug}`;
  const TOKEN = "<your-subscription-token>";

  const mcpJson = useMemo(() => JSON.stringify({
    mcpServers: { [`wizagents-${slug}`]: { type: "http", url: mcp, headers: { Authorization: `Bearer ${TOKEN}` } } },
  }, null, 2), [slug, mcp]);

  const snippets: Record<string, string> = {
    claude: mcpJson,
    cursor: mcpJson,
    openwebui: `API Base URL : ${base}
API Key      : ${TOKEN}
Model        : ${model}`,
    python: `from openai import OpenAI

client = OpenAI(base_url="${base}", api_key="${TOKEN}")

r = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "${t("How should I approach this?", "どう進めるべきですか？", "我該怎麼著手？")}"}],
)
print(r.choices[0].message.content)`,
    curl: `curl ${base}/chat/completions \\
  -H "Authorization: Bearer ${TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${model}","messages":[{"role":"user","content":"${t("How should I approach this?", "どう進めるべきですか？", "我該怎麼著手？")}"}]}'`,
  };

  const notes: Record<string, string> = {
    claude: t("Merge into claude_desktop_config.json and restart Claude Desktop — the expert appears as a tool.", "claude_desktop_config.json にマージして Claude Desktop を再起動すると、専門家がツールとして現れます。", "合併進 claude_desktop_config.json 並重啟 Claude Desktop，專家就會以工具出現。"),
    cursor: t("Save as .cursor/mcp.json in your project (Windsurf, Continue and OpenClaw take the same shape).", "プロジェクトの .cursor/mcp.json に保存します（Windsurf・Continue・OpenClaw も同じ形式です）。", "存成專案裡的 .cursor/mcp.json（Windsurf、Continue、OpenClaw 格式相同）。"),
    openwebui: t("Add WizAgents as an OpenAI-compatible connection. The expert lists next to your local Ollama models — but executes on WizAgents.", "WizAgents を OpenAI 互換の接続として追加します。専門家はローカルの Ollama モデルの隣に並びますが、実行は WizAgents 上です。", "把 WizAgents 加為 OpenAI 相容連線。專家會列在你本機 Ollama 模型旁邊，但實際在 WizAgents 上執行。"),
    python: t("The OpenAI SDK, LangChain, LlamaIndex and most agent frameworks need nothing more than base_url, api_key and model.", "OpenAI SDK、LangChain、LlamaIndex、そして多くのエージェントフレームワークは base_url・api_key・model だけで動きます。", "OpenAI SDK、LangChain、LlamaIndex 與多數代理框架，只需要 base_url、api_key 與 model。"),
    curl: t("If it speaks the OpenAI API, it can speak to your expert.", "OpenAI API を話せる環境なら、専門家と話せます。", "只要它會講 OpenAI API，就能跟你的專家對話。"),
  };

  const tabs: [Door, string, string][] = [
    ["mcp", "claude", "Claude Desktop"],
    ["mcp", "cursor", t("Cursor / Windsurf / Continue", "Cursor / Windsurf / Continue", "Cursor / Windsurf / Continue")],
    ["openai", "openwebui", t("Open WebUI / Ollama", "Open WebUI / Ollama", "Open WebUI / Ollama")],
    ["openai", "python", t("OpenAI SDK / LangChain", "OpenAI SDK / LangChain", "OpenAI SDK / LangChain")],
    ["openai", "curl", "cURL"],
  ];
  const visible = tabs.filter(([d]) => d === door);

  function pickDoor(d: Door) {
    setDoor(d);
    setClient(d === "mcp" ? "claude" : "openwebui");
  }
  function copy() {
    navigator.clipboard?.writeText(snippets[client]);
    toast(t("Configuration copied", "設定をコピーしました", "已複製設定"), "success");
  }

  return (
    <div className="glass-card p-5">
      {subs.length > 0 ? (
        <div className="mb-4">
          <div className="mb-1 text-[11px] text-faint">{t("Select an Agent you subscribe to", "購読中の Agent を選択", "選擇你訂閱的 Agent")}</div>
          <select value={sel} onChange={(e) => setSel(+e.target.value)} className="w-full rounded-lg hairline bg-panel/40 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-purple">
            {subs.map((x, i) => <option key={x.slug} value={i}>{x.name}</option>)}
          </select>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel2 px-3 py-2.5">
            <span className="flex-1 text-[11.5px] leading-5 text-muted">
              {t("Your private token is never shown on this public page. Open your connect page to download a ready-made config.", "あなたの専用トークンは、この公開ページには表示されません。接続ページを開くと、そのまま使える設定をダウンロードできます。", "你的專屬 Token 不會出現在這個公開頁面。開啟接入頁即可下載可直接使用的設定檔。")}
            </span>
            <Btn href={`/connect/${slug}`} size="sm" variant="primary" className="shrink-0">
              <IconPlugConnected size={14} stroke={1.7} /> {t("Open connect page", "接続ページを開く", "開啟接入頁")}
            </Btn>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-border bg-panel2 px-3 py-2.5 text-[12px] leading-6 text-muted">
          {t("Not subscribed yet — below is a generic template. Once you subscribe, WizAgents generates a one-click config with your dedicated endpoint and token.", "まだ購読していません。以下は汎用テンプレートです。購読すると、専用エンドポイントとトークン入りの設定がワンクリックで生成されます。", "尚未訂閱 — 以下為通用範本。訂閱後，WizAgents 會替你產生含專屬端點與 Token 的一鍵設定。")}
        </div>
      )}

      {/* Two universal doors */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {([
          ["mcp", <IconPlugConnected key="i" size={14} stroke={1.7} />, "MCP", t("Claude, Cursor, Windsurf, Continue, OpenClaw", "Claude・Cursor・Windsurf・Continue・OpenClaw", "Claude、Cursor、Windsurf、Continue、OpenClaw")],
          ["openai", <IconBrandOpenSource key="i" size={14} stroke={1.7} />, t("OpenAI-compatible", "OpenAI 互換", "OpenAI 相容"), t("Open WebUI, LangChain, agent frameworks, SDKs", "Open WebUI・LangChain・エージェント基盤・SDK", "Open WebUI、LangChain、代理框架、SDK")],
        ] as [Door, React.ReactNode, string, string][]).map(([d, icon, title, sub]) => (
          <button key={d} onClick={() => pickDoor(d)} aria-pressed={door === d}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${door === d ? "border-purple bg-purple/10" : "border-border bg-panel2 hover:border-borderlight"}`}>
            <span className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${door === d ? "text-text" : "text-muted"}`}>{icon}{title}</span>
            <span className="mt-0.5 block text-[10.5px] leading-4 text-faint">{sub}</span>
          </button>
        ))}
      </div>

      {door === "openai" && (
        <div className="mb-3 grid grid-cols-1 gap-1.5 rounded-lg border border-border bg-panel2 p-3 sm:grid-cols-3">
          <Kv k={t("Base URL", "ベース URL", "Base URL")} v={base} />
          <Kv k={t("API key", "API キー", "API key")} v={t("your subscription token", "あなたの購読トークン", "你的訂閱 Token")} />
          <Kv k={t("Model", "モデル", "模型")} v={model} />
        </div>
      )}
      {door === "mcp" && (
        <div className="mb-3">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-faint">{t("MCP endpoint", "MCP エンドポイント", "MCP 端點")}</div>
          <code className="block break-all rounded-lg border border-border bg-panel2 px-3 py-2 font-mono text-[11.5px] text-purple">{mcp}</code>
        </div>
      )}

      <div className="mb-3 flex gap-1 rounded-lg hairline bg-panel/40 p-1 backdrop-blur-sm">
        {visible.map(([, k, l]) => (
          <button key={k} onClick={() => setClient(k as typeof client)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors ${client === k ? "bg-purple text-white" : "text-muted hover:text-text"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="text-[11px] leading-5 text-faint">{notes[client]}</div>
      <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-panel2 p-3.5 font-mono text-[11px] leading-6 text-text"><code>{snippets[client]}</code></pre>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn onClick={copy} variant="outline"><IconCopy size={14} stroke={1.7} /> {t("Copy configuration", "設定をコピー", "複製設定")}</Btn>
        <Btn href={subs.length > 0 ? `/connect/${slug}` : "/market"} variant="primary">
          <IconPlayerPlay size={14} stroke={1.7} />
          {subs.length > 0 ? t("Get my real config", "自分の設定を取得", "取得我的正式設定") : t("Find an expert", "専門家を探す", "尋找專家")}
        </Btn>
        <Badge tone="muted">{t("Token issued after subscribing", "トークンは購読後に発行", "訂閱後才發放 Token")}</Badge>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-faint">
        {t("Whichever door you use, the expert executes on WizAgents. ", "どちらの入口でも、専門家は WizAgents 上で実行されます。", "無論走哪道門，專家都在 WizAgents 上執行。")}
        <Link href="#protection" className="text-purple hover:underline">{t("How creators are protected →", "クリエイター保護の仕組み →", "創作者如何受到保護 →")}</Link>
      </p>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-faint">{k}</div>
      <div className="truncate font-mono text-[11px] text-text" title={v}>{v}</div>
    </div>
  );
}
