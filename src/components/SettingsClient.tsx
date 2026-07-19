"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconCheck } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import TwoFactorSetup from "./TwoFactorSetup";
import PasskeyManager from "./PasskeyManager";
import PaymentMethods from "./PaymentMethods";
import ProfileSettings from "./ProfileSettings";
import AccountSecurity from "./AccountSecurity";
import DataOwnership from "./DataOwnership";

export default function SettingsClient({ name, email, role, verified , twoFactorEnabled = false, emailVerified = false }: { name: string; email: string; role: string; verified: boolean ; twoFactorEnabled?: boolean; emailVerified?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function becomeCreator() {
    setBusy(true);
    const r = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "become-creator" }) });
    setBusy(false);
    if (r.ok) { toast(t("You're now a creator!","クリエイターになりました！","你已成為創作者！"), "success"); router.push("/studio"); router.refresh(); }
  }

  return (
    <div className="mx-auto max-w-lg animate-fadein">
      <h1 className="font-display text-[24px] font-extrabold tracking-tight"><span className="text-grad">{t("Account Settings","アカウント設定","帳號設定")}</span></h1>
      <p className="mt-1 text-[12px] text-muted">{t("Manage your profile and role.","プロフィールと役割を管理します。","管理你的個人資料與角色。")}</p>

      {/* Profile comes first: it is the part of the account that other people actually see. */}
      <div className="mt-6"><ProfileSettings role={role} /></div>

      {role === "buyer" ? (
        <div className="mt-8 glass-card border border-amber/30 bg-amber/5 p-6">
          <div className="font-display text-[14px] font-bold text-amber">{t("Become a Creator","クリエイターになる","成為創作者")}</div>
          <p className="mt-1 text-[12px] leading-6 text-muted">{t("Package your expertise into a 24/7 expert agent—publish once and earn recurring subscription revenue (78% split).","あなたの専門知識を24/7の専門Agentに。一度出品すれば継続的にサブスク収益を得られます（分配78%）。","把你的專業封裝成 24/7 的專家 Agent，一次上架、持續收訂閱費（分潤 78%）。")}</p>
          <button onClick={becomeCreator} disabled={busy} className="btn-glow mt-3 rounded-xl border border-transparent px-4 py-2 text-[12.5px] font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50 bg-purple">{t("Upgrade to Creator","クリエイターに昇格","升級為創作者")} →</button>
        </div>
      ) : role === "creator" ? (
        <div className="mt-8 glass-card p-6">
          <div className="flex items-center justify-between">
            <div><div className="font-display text-[13px] font-bold">{t("Creator Verification","クリエイター認証","創作者認證")}</div><div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted">{verified ? <><IconCheck size={13} stroke={2} />{t("Identity verified","本人確認済み","已通過實名認證")}</> : t("Not verified — verification builds buyer trust","未認証 — 認証は購入者の信頼を高めます","尚未認證 — 認證可提升買家信任")}</div></div>
            <Link href="/studio/verification" className="rounded-xl border border-glassborder/20 bg-panel/40 px-3 py-1.5 text-[12px] text-muted backdrop-blur-sm transition hover:border-violet/40 hover:text-text">{verified ? t("View","表示","查看") : t("Get Verified","認証へ進む","前往認證")}</Link>
          </div>
        </div>
      ) : null}

      <div className="mt-4"><TwoFactorSetup enabled={twoFactorEnabled} /></div>
      <div className="mt-4"><PasskeyManager /></div>
      <div className="mt-4"><PaymentMethods /></div>
      <div className="mt-8"><AccountSecurity /></div>
      <div className="mt-8"><DataOwnership /></div>
    </div>
  );
}
