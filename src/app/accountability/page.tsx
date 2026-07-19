import AccountabilityTiers from "@/components/AccountabilityTiers";
import { getLocale, pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function AccountabilityPage() {
  const locale = await getLocale();
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);
  return (
    <div className="animate-fadein">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-glassborder/40 bg-panel/40 px-3 py-1.5 text-[11px] text-muted backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
        <span>{P("Trust & accountability", "信頼と責任", "信任與問責")}</span>
      </div>
      <h1 className="font-display text-[28px] font-extrabold tracking-tight text-text">
        {P("How our experts stand behind their answers", "専門家はどのように回答を裏付けるか", "我們的專家如何為回答負責")}
      </h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
        {P(
          "Every answer on WizAgents carries a clear level of accountability. Understand what you are getting — method, a signed review, or a real professional engagement — before you rely on it.",
          "WizAgents のすべての回答には明確な責任レベルがあります。手法、署名付きレビュー、あるいは実際の職業的受任 — 何を得ているのかを理解してから頼ってください。",
          "WizAgents 上的每個回答都帶有明確的問責層級。在依賴之前，先了解你得到的是什麼——方法、具名覆核，還是正式的專業委任。"
        )}
      </p>
      <div className="mt-8">
        <AccountabilityTiers />
      </div>
    </div>
  );
}
