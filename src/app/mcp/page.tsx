import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import McpConnect, { type PublicSub } from "@/components/McpConnect";
import { SectionLabel, Badge } from "@/components/ui";
import { getLocale, pick } from "@/lib/locale";
import { IconPlugConnected, IconBrandOpenSource, IconShieldLock } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  const user = await getCurrentUser();

  // Public docs page: we only need names/slugs to personalise the template. No tokens here.
  let subs: PublicSub[] = [];
  if (user) {
    const rows = await db.subscription.findMany({ where: { userId: user.id, status: "active" }, include: { agent: true }, orderBy: { startedAt: "desc" } });
    subs = rows.map((r) => ({ slug: r.agent.slug, name: r.agent.name }));
  }

  return (
    <div className="animate-fadein">
      <div className="mb-1 flex items-center gap-2 text-[12px] text-muted"><span className="text-rust">$</span><span>connect wizagents://<span className="text-amber">mcp</span></span></div>
      <h1 className="mt-4 font-display text-[30px] font-extrabold tracking-tight">{P("Bring WizAgents into your AI tools", "WizAgents を AI ツールに接続", "把 WizAgents 接進你的 AI 工具")}</h1>
      <p className="mb-8 mt-2 max-w-2xl text-[13.5px] leading-7 text-muted">
        {P(
          "Every subscription opens two universal doors: a standard MCP endpoint, and an OpenAI-compatible API. Point Claude Desktop, Cursor, Open WebUI, LangChain — or plain curl — at it, and the expert Agent is on standby. The prompt and knowledge base always stay server-side; you receive the execution entry point, not the expert.",
          "どの購読も 2 つの汎用的な入口を開きます。標準の MCP エンドポイントと、OpenAI 互換 API です。Claude Desktop、Cursor、Open WebUI、LangChain、あるいは単なる curl を向けるだけで、専門家 Agent が待機します。プロンプトと知識ベースは常にサーバー側に残り、あなたが受け取るのは実行の入口であって、専門家そのものではありません。",
          "每個訂閱都開啟兩道通用大門：標準 MCP 端點，以及 OpenAI 相容 API。把 Claude Desktop、Cursor、Open WebUI、LangChain，甚至只是 curl 指過來，專家 Agent 就隨時待命。提示詞與知識庫永遠留在伺服器端 — 你拿到的是執行入口，不是專家本身。"
        )}
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionLabel>{P("How it works", "仕組み", "如何運作")}</SectionLabel>
          <div className="space-y-3">
            {[
              ["1", P("Subscribe to an Agent", "Agent を購読", "訂閱一個 Agent"), P("After subscribing in the market, you get a dedicated URL, model id and access token.", "マーケットで購読すると、専用 URL・モデル ID・アクセストークンが手に入ります。", "在市集訂閱後，你會拿到專屬 URL、模型 ID 與存取 Token。")],
              ["2", P("Pick a door", "入口を選ぶ", "選一道門"), P("MCP for assistant-style clients, or the OpenAI-compatible API for open-source stacks and SDKs.", "アシスタント型のクライアントには MCP、オープンソース環境や SDK には OpenAI 互換 API を。", "助理型客戶端走 MCP；開源環境與 SDK 走 OpenAI 相容 API。")],
              ["3", P("Consult or escalate anytime", "いつでも相談・人へエスカレーション", "隨時諮詢或升級真人"), P("Ask the expert; for high-stakes questions escalate to the human behind the Agent.", "専門家に相談し、リスクの高い質問は Agent の背後にいる人間へエスカレーションします。", "向專家諮詢；高風險問題可升級給 Agent 背後的真人。")],
            ].map(([n, title, d]) => (
              <div key={n} className="flex gap-3 rounded-xl border border-border bg-panel p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple text-[12px] font-bold text-white">{n}</span>
                <div><div className="text-[13px] font-bold">{title}</div><div className="mt-0.5 text-[12px] leading-6 text-muted">{d}</div></div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <SectionLabel>{P("Supported tools", "対応ツール", "支援的工具")}</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-panel p-4">
                <div className="flex items-center gap-1.5 text-[12px] font-bold"><IconPlugConnected size={14} stroke={1.7} className="text-purple" /> {P("MCP clients", "MCP クライアント", "MCP 客戶端")}</div>
                <div className="mt-1 text-[11.5px] leading-5 text-faint">{P("The expert shows up as a tool.", "専門家がツールとして現れます。", "專家會以「工具」出現。")}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["Claude Desktop", "Cursor", "Windsurf", "Continue", "OpenClaw"].map((x) => <Badge key={x} tone="purple">{x}</Badge>)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-panel p-4">
                <div className="flex items-center gap-1.5 text-[12px] font-bold"><IconBrandOpenSource size={14} stroke={1.7} className="text-purple" /> {P("OpenAI-compatible", "OpenAI 互換", "OpenAI 相容")}</div>
                <div className="mt-1 text-[11.5px] leading-5 text-faint">{P("The expert shows up as a model.", "専門家がモデルとして現れます。", "專家會以「模型」出現。")}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["Open WebUI", "LangChain", "LlamaIndex", "OpenAI SDK", "Hermes", "OpenClaw", "curl"].map((x) => <Badge key={x} tone="cyan">{x}</Badge>)}
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-panel2 px-3.5 py-3 font-mono text-[11px] leading-6 text-muted">
              <div><span className="text-faint">base_url</span> = https://wiz-agents.com/api/v1</div>
              <div><span className="text-faint">api_key</span>  = {P("your subscription token", "あなたの購読トークン", "你的訂閱 Token")}</div>
              <div><span className="text-faint">model</span>    = wizagents/&lt;agent-slug&gt;</div>
            </div>
          </div>

          <div className="mt-6">
            <SectionLabel>{P("Available MCP tools", "利用可能な MCP ツール", "可用的 MCP 工具")}</SectionLabel>
            <div className="space-y-2">
              <Tool name="ask_expert" desc={P("Consult the expert Agent; replies carry knowledge-base version traceability.", "専門家 Agent に相談。回答には知識ベースのバージョン追跡が付きます。", "向專家 Agent 諮詢，回覆帶知識庫版本溯源。")} />
              <Tool name="escalate_to_human" desc={P("Escalate to a human expert; reply within SLA, with real-name sign-off available.", "人間の専門家へエスカレーション。SLA 内に回答し、実名署名も可能。", "升級給真人專家，於 SLA 內回覆、可實名簽核。")} />
              <Tool name="resources/list" desc={P("List knowledge-base versions (audit-grade traceability).", "知識ベースのバージョンを一覧（監査レベルの追跡）。", "列出知識庫版本（稽核級溯源）。")} />
            </div>
          </div>
        </div>

        <div>
          <SectionLabel>{P("Config generator", "設定ジェネレーター", "設定產生器")}</SectionLabel>
          <McpConnect subs={subs} />

          <div id="protection" className="mt-8 scroll-mt-24">
            <SectionLabel>{P("Creator protection", "クリエイター保護", "創作者保護")}</SectionLabel>
            <div className="glass-card p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-panel2 text-purple">
                  <IconShieldLock size={17} stroke={1.7} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-[15px] font-bold">{P("Openness for you. Protection for the expert.", "あなたには開放性を。専門家には保護を。", "對你開放，對專家保護。")}</h2>
                  <p className="mt-2 text-[12.5px] leading-6 text-muted">
                    {P(
                      "The expert's Agent always executes on WizAgents' servers. Your tool merely calls it. This is what makes an expert willing to be reachable from a local, open-source stack in the first place.",
                      "専門家の Agent は常に WizAgents のサーバー上で実行されます。あなたのツールは、それを呼び出すだけです。だからこそ専門家は、ローカルのオープンソース環境からも到達可能でいられるのです。",
                      "專家的 Agent 永遠在 WizAgents 的伺服器上執行，你的工具只是「呼叫」它。正因如此，專家才願意讓本機、開源的環境也連得上。"
                    )}
                  </p>
                  <div className="mt-3 space-y-2">
                    {[
                      [P("Never downloaded — not even to a local model", "ダウンロードされません。ローカルモデルにも渡りません", "永不下載 — 連本機模型也拿不到"),
                       P("The system prompt and knowledge base are never sent to the caller: not to a cloud model, and not to a local Ollama model. Only the answer travels.", "システムプロンプトと知識ベースが呼び出し側に送られることはありません。クラウドのモデルにも、ローカルの Ollama モデルにも渡りません。移動するのは回答だけです。", "系統提示詞與知識庫永遠不會送到呼叫端：不給雲端模型，也不給本機的 Ollama 模型。只有回答會離開。")],
                      [P("Client system prompts are ignored", "クライアントのシステムプロンプトは無視されます", "呼叫端的 system prompt 一律忽略"),
                       P("A tool can ask the expert a question. It cannot override the expert's stance or instruct it to become someone else.", "ツールは専門家に質問できますが、専門家の立場を上書きしたり、別人になれと指示したりはできません。", "工具可以向專家提問，但無法覆寫專家的立場，也無法叫它變成別人。")],
                      [P("Watermarked and revocable", "ウォーターマーク付き・取り消し可能", "帶浮水印、可撤銷"),
                       P("Every answer is watermarked to the subscription that requested it, and access ends the moment the subscription does.", "すべての回答は、それを要求した購読に紐づいてウォーターマークされ、購読が終了した瞬間にアクセスも終了します。", "每則回答都以發出請求的訂閱加上浮水印；訂閱一結束，存取立即終止。")],
                    ].map(([h, d]) => (
                      <div key={h} className="rounded-lg border border-border bg-panel2 px-3 py-2.5">
                        <div className="text-[12px] font-semibold text-text">{h}</div>
                        <div className="mt-0.5 text-[11.5px] leading-5 text-faint">{d}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tool({ name, desc }: { name: string; desc: string }) {
  return <div className="rounded-lg border border-border bg-panel2 px-3 py-2.5"><code className="text-[12px] text-amber">{name}</code><div className="mt-0.5 text-[11.5px] text-muted">{desc}</div></div>;
}
