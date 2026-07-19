"use client";
import { IconShieldCheck, IconScale, IconGavel } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "./ui";

/**
 * Tiered accountability explainer (Product Master §4.2).
 * Informational · Reviewed · Engaged — a compact, professional 3-tier ladder that
 * makes clear who is responsible at each level and when it applies. Trilingual, token-only.
 */
export default function AccountabilityTiers({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();

  const tiers = [
    {
      key: "informational",
      icon: <IconShieldCheck size={17} stroke={1.7} className="text-cyan" />,
      tone: "cyan" as const,
      name: t("Informational", "情報提供", "資訊層"),
      badge: t("Default", "既定", "預設"),
      desc: t(
        "Method and perspective from the expert's avatar — not licensed advice. You remain responsible for how you act on it.",
        "専門家アバターによる手法と視点 — 有資格者の助言ではありません。その活用の責任はあなたにあります。",
        "來自專家化身的方法與觀點——非受牌照約束的建議。如何採用由你自行負責。"
      ),
      when: t("Applies to every everyday answer.", "日常的な回答すべてに適用。", "適用於每一個日常回答。"),
    },
    {
      key: "reviewed",
      icon: <IconScale size={17} stroke={1.7} className="text-purple" />,
      tone: "purple" as const,
      name: t("Reviewed", "レビュー済み", "覆核層"),
      badge: t("Signed answer", "署名付き回答", "具名回覆"),
      desc: t(
        "A named expert reviews and signs a specific answer, putting their reputation behind that response.",
        "指名された専門家が特定の回答をレビューし署名 — その回答に自らの信用を賭けます。",
        "由具名專家覆核並簽署特定回答，以其聲譽為該回覆背書。"
      ),
      when: t("Applies when you escalate for a signed second opinion.", "署名付きセカンドオピニオンにエスカレーションしたとき。", "當你升級以取得具名第二意見時適用。"),
    },
    {
      key: "engaged",
      icon: <IconGavel size={17} stroke={1.7} className="text-amber" />,
      tone: "amber" as const,
      name: t("Engaged", "受任", "受任層"),
      badge: t("Real engagement", "実務受任", "正式委任"),
      desc: t(
        "A real professional engagement under the expert's own licence, brokered and delivered off-platform.",
        "専門家自身の資格に基づく実際の職業的受任 — プラットフォーム外で仲介・提供されます。",
        "在專家本人牌照下的正式專業委任，於平台外促成並交付。"
      ),
      when: t("Applies when you retain the expert directly.", "専門家を直接受任するとき。", "當你直接委任該專家時適用。"),
    },
  ];

  return (
    <div>
      <div className="mb-1 font-display text-[15px] font-bold text-text">
        {t("Tiered accountability", "階層別の責任", "分層問責")}
      </div>
      <p className="mb-4 text-[12px] leading-6 text-muted">
        {t(
          "Regulated expertise operates in tiers. Each step raises who stands behind the answer — and who is responsible.",
          "規制のある専門知識は階層で運用されます。各段階で回答の裏付け役 — そして責任の所在 — が上がります。",
          "受監管的專業以分層運作。每上一層，為回答背書與負責的人就更進一步。"
        )}
      </p>
      <div className={`grid gap-3 ${compact ? "sm:grid-cols-3" : "md:grid-cols-3"}`}>
        {tiers.map((tier) => (
          <div key={tier.key} className="glass-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {tier.icon}
                <span className="font-display text-[13.5px] font-bold text-text">{tier.name}</span>
              </div>
              <Badge tone={tier.tone}>{tier.badge}</Badge>
            </div>
            <p className="mt-2.5 text-[12px] leading-6 text-muted">{tier.desc}</p>
            <div className="mt-3 border-t border-border/60 pt-2 text-[11px] leading-5 text-faint">{tier.when}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
