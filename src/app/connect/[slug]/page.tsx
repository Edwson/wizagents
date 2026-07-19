import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import ConnectPanel from "@/components/ConnectPanel";
import { getLocale, pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect your AI tool",
  robots: { index: false, follow: false },
};

export default async function ConnectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const agent = await db.agent.findUnique({ where: { slug }, select: { name: true, creatorName: true } });
  if (!agent) notFound();

  return (
    <div className="animate-fadein">
      <div className="mb-1 flex items-center gap-2 text-[12px] text-muted">
        <Link href="/dashboard" className="transition-colors hover:text-purple">{P("My subscriptions", "マイ購読", "我的訂閱")}</Link>
        <span className="text-faint">/</span>
        <span>{P("Connect", "接続", "接入")}</span>
      </div>

      <h1 className="mt-3 font-display text-[30px] font-extrabold tracking-tight">
        {P("Connect ", "", "把 ")}
        <span className="text-grad">{agent.name}</span>
        {P(" to your tools", " をあなたのツールに接続", " 接進你的工具")}
      </h1>
      <p className="mb-8 mt-2 max-w-2xl text-[13.5px] leading-7 text-muted">
        {P(
          `Two universal doors: MCP for Claude Desktop, Cursor, Windsurf, Continue and OpenClaw — and an OpenAI-compatible endpoint for Open WebUI, LangChain, agent frameworks, the OpenAI SDKs, or plain curl. Pick your tool, take the config, done. ${agent.creatorName}'s Agent keeps running on WizAgents the whole time.`,
          `入口は 2 つ。Claude Desktop・Cursor・Windsurf・Continue・OpenClaw 向けの MCP と、Open WebUI・LangChain・エージェントフレームワーク・OpenAI SDK・curl 向けの OpenAI 互換エンドポイントです。ツールを選び、設定を受け取るだけ。その間も ${agent.creatorName} の Agent は WizAgents 上で動き続けます。`,
          `兩道通用大門：給 Claude Desktop、Cursor、Windsurf、Continue、OpenClaw 的 MCP，以及給 Open WebUI、LangChain、代理框架、OpenAI SDK 或純 curl 的 OpenAI 相容端點。選工具、拿設定，完成。全程 ${agent.creatorName} 的 Agent 都在 WizAgents 上執行。`
        )}
      </p>

      <ConnectPanel slug={slug} />
    </div>
  );
}
