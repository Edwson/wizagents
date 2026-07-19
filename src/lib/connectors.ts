// One-click connection to the user's own AI tools.
//
// Two universal doors — no copy-pasting protocol details:
//   1. MCP        → Claude Desktop, Cursor, Windsurf, Continue, any MCP client.
//   2. OpenAI API → Ollama front-ends (Open WebUI), LangChain/LlamaIndex, Hermes-style
//                   agent frameworks, OpenClaw, the OpenAI SDKs — anything that speaks
//                   base_url + api_key.
//
// PROTECTION: in every case the expert's Agent runs on WizAgents' servers. The tool
// only ever *calls* it. The system prompt and knowledge base are never sent to the
// caller — not to a cloud model, and not to a local Ollama model.
export type Tool =
  | "claude-desktop" | "cursor" | "windsurf" | "continue"
  | "open-webui" | "langchain" | "openai-sdk" | "hermes" | "openclaw" | "curl";

export type ConnectInput = { slug: string; name: string; token: string; origin: string };

export type ConnectConfig = {
  id: Tool;
  label: string;
  kind: "mcp" | "openai";
  /** A file the user can download and drop in, when the tool is config-file based. */
  file?: { name: string; content: string };
  /** Fields to paste when the tool is settings-based. */
  fields?: { label: string; value: string; secret?: boolean }[];
  /** A runnable snippet. */
  snippet?: { lang: string; code: string };
  note: string;
};

export function mcpUrl(o: ConnectInput) { return `${o.origin}/api/mcp/${o.slug}`; }
export function apiBase(o: ConnectInput) { return `${o.origin}/api/v1`; }
export function modelId(o: ConnectInput) { return `wizagents/${o.slug}`; }

export function configFor(tool: Tool, o: ConnectInput): ConnectConfig {
  const url = mcpUrl(o), base = apiBase(o), model = modelId(o);
  const serverKey = `wizagents-${o.slug}`;

  const mcpJson = (wrapper: "mcpServers" | "servers") => JSON.stringify({
    [wrapper]: { [serverKey]: { type: "http", url, headers: { Authorization: `Bearer ${o.token}` } } },
  }, null, 2);

  switch (tool) {
    case "claude-desktop":
      return { id: tool, kind: "mcp", label: "Claude Desktop",
        file: { name: "claude_desktop_config.json", content: mcpJson("mcpServers") },
        note: "Merge into your claude_desktop_config.json, then restart Claude Desktop. Your expert appears as a tool." };
    case "cursor":
      return { id: tool, kind: "mcp", label: "Cursor",
        file: { name: ".cursor/mcp.json", content: mcpJson("mcpServers") },
        note: "Save as .cursor/mcp.json in your project (or add via Settings → MCP)." };
    case "windsurf":
      return { id: tool, kind: "mcp", label: "Windsurf",
        file: { name: "mcp_config.json", content: mcpJson("mcpServers") },
        note: "Add to Windsurf's MCP config, then reload." };
    case "continue":
      return { id: tool, kind: "mcp", label: "Continue (VS Code / JetBrains)",
        file: { name: "config.json", content: mcpJson("mcpServers") },
        note: "Add to your Continue config under mcpServers." };

    case "open-webui":
      return { id: tool, kind: "openai", label: "Open WebUI / Ollama front-end",
        fields: [
          { label: "API Base URL", value: base },
          { label: "API Key", value: o.token, secret: true },
          { label: "Model", value: model },
        ],
        note: "Add WizAgents as an OpenAI-compatible connection. Your expert appears next to your local Ollama models — but runs on WizAgents, so the expert's knowledge is never downloaded to your machine." };

    case "langchain":
      return { id: tool, kind: "openai", label: "LangChain / LlamaIndex",
        snippet: { lang: "python", code:
`from langchain_openai import ChatOpenAI

expert = ChatOpenAI(
    base_url="${base}",
    api_key="${o.token}",     # your WizAgents subscription token
    model="${model}",
)

print(expert.invoke("How should I approach this?").content)` },
        note: "Any OpenAI-compatible client works — LangChain, LlamaIndex, Vercel AI SDK, and friends." };

    case "openai-sdk":
      return { id: tool, kind: "openai", label: "OpenAI SDK",
        snippet: { lang: "python", code:
`from openai import OpenAI

client = OpenAI(base_url="${base}", api_key="${o.token}")

r = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "How should I approach this?"}],
)
print(r.choices[0].message.content)` },
        note: "Drop-in: only base_url, api_key and model change." };

    case "hermes":
      return { id: tool, kind: "openai", label: "Hermes / open-source agent frameworks",
        fields: [
          { label: "OpenAI-compatible base URL", value: base },
          { label: "API key", value: o.token, secret: true },
          { label: "Model", value: model },
        ],
        note: "Register the expert as a model or as a tool your agent can call. It runs server-side, so your local stack never holds the expert's corpus." };

    case "openclaw":
      return { id: tool, kind: "mcp", label: "OpenClaw",
        file: { name: "mcp.json", content: mcpJson("mcpServers") },
        fields: [
          { label: "OpenAI-compatible base URL", value: base },
          { label: "API key", value: o.token, secret: true },
        ],
        note: "Connect over MCP, or as an OpenAI-compatible model — whichever your setup prefers." };

    case "curl":
    default:
      return { id: "curl", kind: "openai", label: "Any tool (raw HTTP)",
        snippet: { lang: "bash", code:
`curl ${base}/chat/completions \\
  -H "Authorization: Bearer ${o.token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role":"user","content":"How should I approach this?"}]
  }'` },
        note: "If it speaks the OpenAI API, it can speak to your expert." };
  }
}

export const ALL_TOOLS: Tool[] = [
  "claude-desktop", "cursor", "open-webui", "langchain", "openai-sdk", "hermes", "openclaw", "windsurf", "continue", "curl",
];
