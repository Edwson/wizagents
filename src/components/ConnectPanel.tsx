"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, Badge, SectionLabel, Reveal } from "@/components/ui";
import {
  IconPlugConnected, IconDownload, IconCopy, IconTerminal2,
  IconShieldLock, IconBrandOpenSource, IconEye, IconEyeOff, IconCheck,
} from "@tabler/icons-react";

/* ---------- API shape (mirrors GET /api/connect/[slug]) ---------- */
type ConfigKind = "mcp" | "openai";
type Field = { label: string; value: string; secret?: boolean };
type ConnectConfig = {
  id: string;
  label: string;
  kind: ConfigKind;
  file?: { name: string; content: string };
  fields?: Field[];
  snippet?: { lang: string; code: string };
  note: string;
};
type ConnectData = {
  ok: true;
  agent: { slug: string; name: string; creatorName: string };
  endpoints: { mcp: string; openai: string; model: string };
  token: string;
  configs: ConnectConfig[];
  protection: string;
};
type State =
  | { phase: "loading" }
  | { phase: "needSub" }
  | { phase: "error"; message: string }
  | { phase: "ready"; data: ConnectData };

const mask = (v: string) => (v.length <= 8 ? "•".repeat(v.length) : `${v.slice(0, 4)}${"•".repeat(Math.max(8, v.length - 8))}${v.slice(-4)}`);

export default function ConnectPanel({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [selected, setSelected] = useState<string>("claude-desktop");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let alive = true;
    setState({ phase: "loading" });
    fetch(`/api/connect/${slug}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok && d?.ok) {
          setState({ phase: "ready", data: d as ConnectData });
          const first = (d.configs as ConnectConfig[])[0];
          if (first) setSelected((s) => ((d.configs as ConnectConfig[]).some((c) => c.id === s) ? s : first.id));
        } else if (d?.code === "needSub" || r.status === 403) {
          setState({ phase: "needSub" });
        } else {
          setState({ phase: "error", message: typeof d?.error === "string" ? d.error : t("Could not load your connection details.", "接続情報を読み込めませんでした。", "無法載入你的連線資訊。") });
        }
      })
      .catch(() => { if (alive) setState({ phase: "error", message: t("Network error. Please try again.", "ネットワークエラーです。もう一度お試しください。", "網路錯誤，請重試。") }); });
    return () => { alive = false; };
  }, [slug, t]);

  const copy = useCallback((value: string, key: string) => {
    navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? "" : k)), 1600);
    toast(t("Copied to clipboard", "クリップボードにコピーしました", "已複製到剪貼簿"), "success");
  }, [toast, t]);

  const download = useCallback((name: string, content: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // A path-like name (".cursor/mcp.json") cannot be a filename — keep only the leaf.
    a.download = name.split("/").pop() || "config.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(t("Config file downloaded", "設定ファイルをダウンロードしました", "已下載設定檔"), "success");
  }, [toast, t]);

  const data = state.phase === "ready" ? state.data : null;
  const configs = useMemo(() => data?.configs ?? [], [data]);
  const mcpTools = useMemo(() => configs.filter((c) => c.kind === "mcp"), [configs]);
  const openTools = useMemo(() => configs.filter((c) => c.kind === "openai"), [configs]);
  const active = useMemo(() => configs.find((c) => c.id === selected) ?? configs[0], [configs, selected]);
  const curl = useMemo(() => configs.find((c) => c.id === "curl"), [configs]);

  /* ---------- Loading / gates ---------- */
  if (state.phase === "loading") {
    return (
      <div className="glass-card p-6">
        <div className="h-3 w-40 animate-pulse rounded bg-panel2" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-panel2" />)}
        </div>
      </div>
    );
  }

  if (state.phase === "needSub") {
    return (
      <div className="glass-card p-6">
        <Badge tone="amber">{t("Subscription required", "購読が必要です", "需要訂閱")}</Badge>
        <h2 className="mt-3 font-display text-[18px] font-bold">{t("Subscribe to connect this expert", "接続するには購読が必要です", "訂閱後即可接入這位專家")}</h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-muted">
          {t(
            "Connection details — the MCP URL, the OpenAI-compatible base URL and your private token — are issued to an active subscription. They stop answering the moment the subscription ends.",
            "接続情報（MCP の URL、OpenAI 互換のベース URL、専用トークン）は有効な購読に対して発行されます。購読が終了した瞬間に応答は停止します。",
            "連線資訊（MCP URL、OpenAI 相容 base URL 與你的專屬 Token）僅發給有效訂閱。訂閱一結束，端點便不再回應。"
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn href={`/agent/${slug}`} variant="primary"><IconPlugConnected size={15} stroke={1.7} /> {t("View plans", "プランを見る", "查看方案")}</Btn>
          <Btn href="/market" variant="outline">{t("Browse the market", "マーケットを見る", "瀏覽市集")}</Btn>
        </div>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="glass-card border border-rust/40 p-6">
        <div className="font-display text-[15px] font-bold text-rust">{t("Something went wrong", "問題が発生しました", "發生問題")}</div>
        <p className="mt-1 text-[12.5px] leading-6 text-muted">{state.message}</p>
        <Btn onClick={() => location.reload()} variant="outline" className="mt-3">{t("Retry", "再試行", "重試")}</Btn>
      </div>
    );
  }

  if (!data || !active) return null;

  return (
    <div className="space-y-6">
      {/* ---------- Protection ---------- */}
      <Reveal as="div">
        <div className="glass-card p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-panel2 text-purple">
              <IconShieldLock size={17} stroke={1.7} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[15px] font-bold">{t("The expert stays on WizAgents", "専門家は WizAgents 上に留まります", "專家永遠留在 WizAgents")}</h2>
                <Badge tone="green">{t("Creator protection", "クリエイター保護", "創作者保護")}</Badge>
              </div>
              <p className="mt-2 text-[12.5px] leading-6 text-muted">{data.protection}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  [t("Execution stays server-side", "実行はサーバー側で完結", "執行永遠在伺服器端"),
                   t("Your tool calls the Agent over the network; it never downloads it. The system prompt and knowledge base are never sent to the caller — not to a cloud model, and not to a local Ollama model.", "あなたのツールはネットワーク越しに Agent を呼び出すだけで、ダウンロードはしません。システムプロンプトと知識ベースが呼び出し側に送られることはありません。クラウドのモデルにも、ローカルの Ollama モデルにも渡りません。", "你的工具只是透過網路呼叫 Agent，不會把它下載下來。系統提示詞與知識庫永遠不會送到呼叫端 — 不會給雲端模型，也不會給本機的 Ollama 模型。")],
                  [t("The expert's stance cannot be overridden", "専門家の立場は上書きできません", "專家的立場無法被覆寫"),
                   t("Client-supplied system prompts are ignored. A tool can ask the expert a question; it cannot instruct the expert to become someone else.", "クライアントから渡されたシステムプロンプトは無視されます。ツールは専門家に質問できますが、別人になれと指示することはできません。", "呼叫端傳來的 system prompt 一律忽略。工具可以向專家提問，但無法要求專家變成別人。")],
                  [t("Every answer is watermarked", "すべての回答にウォーターマーク", "每則回答都有浮水印"),
                   t("Responses are traceable to your subscription, so leaked output is attributable.", "回答はあなたの購読に紐づいて追跡できるため、流出した出力は特定できます。", "回覆可溯源到你的訂閱，外流的輸出可被歸屬。")],
                  [t("Access ends with the subscription", "購読の終了と同時にアクセス終了", "訂閱結束，存取即結束"),
                   t("When the subscription stops, the endpoint stops answering. You rent living access to judgment, never a copy of it.", "購読が止まれば、エンドポイントも応答を止めます。あなたが借りるのは判断への生きたアクセスであり、その複製ではありません。", "訂閱停止，端點即停止回應。你租用的是判斷力的活體存取權，而非它的複本。")],
                ].map(([h, d]) => (
                  <div key={h} className="rounded-lg border border-border bg-panel2 px-3 py-2.5">
                    <div className="text-[12px] font-semibold text-text">{h}</div>
                    <div className="mt-0.5 text-[11.5px] leading-5 text-faint">{d}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] leading-5 text-faint">
                {t(
                  `This is exactly why ${data.agent.creatorName} is willing to be reachable from a local, open-source stack: openness for you, protection for the expert.`,
                  `${data.agent.creatorName} がローカルのオープンソース環境からも到達可能でいられるのは、まさにこの仕組みのためです。あなたには開放性を、専門家には保護を。`,
                  `這正是 ${data.agent.creatorName} 願意讓本機、開源環境也能連上的原因：對你開放，對專家保護。`
                )}
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------- Core endpoints ---------- */}
      <div>
        <SectionLabel>{t("Your endpoints", "あなたのエンドポイント", "你的端點")}</SectionLabel>
        <div className="glass-card p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ReadOnlyField label={t("MCP URL", "MCP URL", "MCP URL")} value={data.endpoints.mcp} fieldKey="ep-mcp" copied={copied} onCopy={copy} />
            <ReadOnlyField label={t("OpenAI base URL", "OpenAI 互換ベース URL", "OpenAI 相容 base URL")} value={data.endpoints.openai} fieldKey="ep-openai" copied={copied} onCopy={copy} />
            <ReadOnlyField label={t("Model id", "モデル ID", "模型 ID")} value={data.endpoints.model} fieldKey="ep-model" copied={copied} onCopy={copy} />
          </div>
          <div className="mt-3">
            <ReadOnlyField
              label={t("Access token", "アクセストークン", "存取 Token")}
              value={data.token}
              fieldKey="token"
              secret
              revealed={!!revealed.token}
              onToggle={() => setRevealed((r) => ({ ...r, token: !r.token }))}
              copied={copied}
              onCopy={copy}
            />
            <p className="mt-1.5 text-[11px] leading-5 text-faint">
              {t("Use this as the Bearer token for MCP and as the API key for the OpenAI-compatible endpoint. Treat it like a password — it is bound to your subscription.", "MCP では Bearer トークン、OpenAI 互換エンドポイントでは API キーとして使用します。購読に紐づく鍵なので、パスワードと同じ扱いにしてください。", "在 MCP 作為 Bearer token，在 OpenAI 相容端點作為 API key。它綁定你的訂閱，請當作密碼保管。")}
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Tool picker ---------- */}
      <div>
        <SectionLabel>{t("Choose your tool", "ツールを選択", "選擇你的工具")}</SectionLabel>
        <div className="glass-card p-5">
          <ToolGroup
            icon={<IconPlugConnected size={13} stroke={1.7} />}
            title={t("MCP clients", "MCP クライアント", "MCP 客戶端")}
            hint={t("The expert appears as a tool inside your assistant.", "専門家がアシスタント内のツールとして現れます。", "專家會以工具的形式出現在你的助理中。")}
            configs={mcpTools}
            selected={active.id}
            onSelect={setSelected}
          />
          <div className="mt-5">
            <ToolGroup
              icon={<IconBrandOpenSource size={13} stroke={1.7} />}
              title={t("OpenAI-compatible / open-source", "OpenAI 互換 / オープンソース", "OpenAI 相容 / 開源")}
              hint={t("The expert appears as a model — right next to your local Ollama models, but running on WizAgents.", "専門家がモデルとして現れます。ローカルの Ollama モデルの隣に並びますが、実行は WizAgents 上です。", "專家會以「模型」出現，就在你本機的 Ollama 模型旁邊，但實際執行在 WizAgents。")}
              configs={openTools}
              selected={active.id}
              onSelect={setSelected}
            />
          </div>

          {/* ---------- Selected tool setup ---------- */}
          <div className="mt-6 rounded-xl border border-border bg-panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[14px] font-bold">{active.label}</span>
              <Badge tone={active.kind === "mcp" ? "purple" : "cyan"}>{active.kind === "mcp" ? "MCP" : t("OpenAI-compatible", "OpenAI 互換", "OpenAI 相容")}</Badge>
            </div>
            <p className="mt-1.5 text-[12px] leading-6 text-muted">{active.note}</p>

            {active.file && (
              <div className="mt-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <code className="font-mono text-[11px] text-amber">{active.file.name}</code>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="primary" onClick={() => download(active.file!.name, active.file!.content)}>
                      <IconDownload size={13} stroke={1.7} /> {t("Download config", "設定をダウンロード", "下載設定檔")}
                    </Btn>
                    <Btn size="sm" variant="outline" onClick={() => copy(active.file!.content, `file-${active.id}`)}>
                      {copied === `file-${active.id}` ? <IconCheck size={13} stroke={2} /> : <IconCopy size={13} stroke={1.7} />}
                      {copied === `file-${active.id}` ? t("Copied", "コピー済み", "已複製") : t("Copy JSON", "JSON をコピー", "複製 JSON")}
                    </Btn>
                  </div>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-border bg-panel2 p-3.5 font-mono text-[11px] leading-6 text-text"><code>{active.file.content}</code></pre>
              </div>
            )}

            {active.fields && active.fields.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {active.fields.map((f, i) => {
                  const key = `${active.id}-f${i}`;
                  return (
                    <ReadOnlyField
                      key={key}
                      label={f.label}
                      value={f.value}
                      fieldKey={key}
                      secret={f.secret}
                      revealed={!!revealed[key]}
                      onToggle={() => setRevealed((r) => ({ ...r, [key]: !r[key] }))}
                      copied={copied}
                      onCopy={copy}
                    />
                  );
                })}
              </div>
            )}

            {active.snippet && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-faint">{active.snippet.lang}</span>
                  <Btn size="sm" variant="outline" onClick={() => copy(active.snippet!.code, `snip-${active.id}`)}>
                    {copied === `snip-${active.id}` ? <IconCheck size={13} stroke={2} /> : <IconCopy size={13} stroke={1.7} />}
                    {copied === `snip-${active.id}` ? t("Copied", "コピー済み", "已複製") : t("Copy", "コピー", "複製")}
                  </Btn>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-border bg-panel2 p-3.5 font-mono text-[11px] leading-6 text-text"><code>{active.snippet.code}</code></pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Test connection ---------- */}
      {curl?.snippet && (
        <div>
          <SectionLabel>{t("Test the connection", "接続をテスト", "測試連線")}</SectionLabel>
          <div className="glass-card p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-panel2 text-muted">
                <IconTerminal2 size={17} stroke={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-[14px] font-bold">{t("One command, one answer", "コマンド 1 つで確認", "一行指令，馬上見效")}</div>
                    <p className="mt-0.5 text-[12px] leading-6 text-muted">
                      {t("Paste this into a terminal. If you get an answer back, every other tool on this page will work too.", "ターミナルに貼り付けてください。回答が返ってくれば、このページの他のツールもすべて動作します。", "貼進終端機執行。只要有回覆，這頁其他工具也一定接得上。")}
                    </p>
                  </div>
                  <Btn size="sm" variant="primary" onClick={() => copy(curl.snippet!.code, "test-curl")}>
                    {copied === "test-curl" ? <IconCheck size={13} stroke={2} /> : <IconCopy size={13} stroke={1.7} />}
                    {copied === "test-curl" ? t("Copied", "コピー済み", "已複製") : t("Copy command", "コマンドをコピー", "複製指令")}
                  </Btn>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-panel2 p-3.5 font-mono text-[11px] leading-6 text-text"><code>{curl.snippet.code}</code></pre>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11.5px] leading-6 text-faint">
        {t("Need the protocol details or want to share the setup with a teammate?", "プロトコルの詳細が必要ですか？チームメンバーに共有しますか？", "需要協定細節，或想分享給隊友？")}{" "}
        <Link href="/mcp" className="text-purple hover:underline">{t("Read the public connection guide →", "公開の接続ガイドを読む →", "閱讀公開接入指南 →")}</Link>
      </p>
    </div>
  );
}

/* ---------- pieces ---------- */

function ToolGroup({
  icon, title, hint, configs, selected, onSelect,
}: {
  icon: React.ReactNode; title: string; hint: string;
  configs: ConnectConfig[]; selected: string; onSelect: (id: string) => void;
}) {
  if (configs.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-faint">
        <span className="text-purple">{icon}</span>{title}
      </div>
      <p className="mb-2.5 text-[11.5px] leading-5 text-muted">{hint}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {configs.map((c) => {
          const on = c.id === selected;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-pressed={on}
              className={`rounded-lg border px-3 py-2.5 text-left text-[12.5px] font-medium transition-colors ${
                on ? "border-purple bg-purple/10 text-text" : "border-border bg-panel2 text-muted hover:border-borderlight hover:text-text"
              }`}
            >
              <span className="block truncate">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReadOnlyField({
  label, value, fieldKey, secret = false, revealed = false, onToggle, copied, onCopy,
}: {
  label: string; value: string; fieldKey: string;
  secret?: boolean; revealed?: boolean; onToggle?: () => void;
  copied: string; onCopy: (value: string, key: string) => void;
}) {
  const { t } = useI18n();
  const hidden = secret && !revealed;
  return (
    <div className="min-w-0">
      <label htmlFor={`f-${fieldKey}`} className="mb-1 block text-[10.5px] uppercase tracking-[0.12em] text-faint">{label}</label>
      <div className="flex items-stretch gap-1.5">
        <input
          id={`f-${fieldKey}`}
          readOnly
          value={hidden ? mask(value) : value}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-border bg-panel2 px-2.5 py-2 font-mono text-[11px] text-text outline-none transition-colors focus:border-purple"
        />
        {secret && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={revealed ? t("Hide", "隠す", "隱藏") : t("Reveal", "表示", "顯示")}
            className="rounded-lg border border-border bg-panel2 px-2 text-muted transition-colors hover:border-borderlight hover:text-text"
          >
            {revealed ? <IconEyeOff size={14} stroke={1.7} /> : <IconEye size={14} stroke={1.7} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onCopy(value, fieldKey)}
          aria-label={t("Copy", "コピー", "複製")}
          className="rounded-lg border border-border bg-panel2 px-2 text-muted transition-colors hover:border-purple hover:text-purple"
        >
          {copied === fieldKey ? <IconCheck size={14} stroke={2} /> : <IconCopy size={14} stroke={1.7} />}
        </button>
      </div>
    </div>
  );
}
