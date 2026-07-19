import Link from "next/link";
import { getLocale, pick } from "@/lib/locale";
export default async function NotFound() {
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-[13px] text-rust">$ 404 · endpoint not found</div>
      <div className="mt-4 text-[28px] font-extrabold">{P("This page doesn't exist","このページは存在しません","這個頁面不存在")}</div>
      <p className="mt-2 text-[13px] text-muted">{P("The agent or page you're looking for may have been removed or the URL is wrong.","お探しのAgentまたはページは削除されたか、URLが間違っている可能性があります。","你要找的 Agent 或頁面可能已下架或網址有誤。")}</p>
      <div className="mt-6 flex gap-3">
        <Link href="/market" className="rounded-lg bg-purple px-4 py-2 text-[13px] font-bold text-white">{P("Back to Marketplace","マーケットに戻る","回市集")}</Link>
        <Link href="/" className="rounded-lg border border-border px-4 py-2 text-[13px] text-muted hover:text-text">{P("Back to Home","ホームに戻る","回首頁")}</Link>
      </div>
    </div>
  );
}
