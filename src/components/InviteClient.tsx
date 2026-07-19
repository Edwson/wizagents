"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { IconBuilding, IconEye, IconCheck, IconX } from "@tabler/icons-react";

export default function InviteClient({ token, orgName, email, role, dailyLimit }: {
  token: string; orgName: string; email: string; role: string; dailyLimit: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "accept" | "decline">("");
  const [err, setErr] = useState("");

  async function act(action: "accept" | "decline") {
    setBusy(action); setErr("");
    const r = await fetch("/api/enterprise/invite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setErr(d.error || t("Something went wrong.", "エラーが発生しました。", "發生錯誤。")); return; }
    router.push(action === "accept" ? "/enterprise" : "/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <div className="glass rounded-2xl p-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
            <IconBuilding size={20} stroke={1.6} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{orgName}</h1>
            <p className="text-xs text-muted">{t("invited you to a seat", "シートに招待しました", "邀請你加入席位")}</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed">
          {t(
            `Accepting gives ${email} access to the Agents this organization subscribes to — you don't pay for them yourself.`,
            `承諾すると、${email} はこの組織が契約している Agent を利用できます。費用はあなたの負担ではありません。`,
            `接受後，${email} 就能使用這個組織已訂閱的 Agent，費用不由你支付。`,
          )}
        </p>

        {/* The honest part. An org seat is not free of consequences, and we say so before you click. */}
        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex gap-2.5">
            <IconEye size={16} stroke={1.6} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="text-xs leading-relaxed text-muted">
              <p className="font-medium text-fg">{t("What the organization will see", "組織に見えるもの", "組織會看到什麼")}</p>
              <p className="mt-1">
                {t(
                  "Once you accept, your use of this organization's Agents — which Agent, when, and the question you asked — is written to its audit log. Your personal subscriptions, your own conversations, and everything else in your account stay private and are never shown to them.",
                  "承諾後、この組織の Agent の利用状況（どの Agent を、いつ、どんな質問をしたか）が監査ログに記録されます。個人で契約している Agent や自分自身の会話など、アカウント内のその他の情報は共有されません。",
                  "接受之後，你使用「這個組織的 Agent」的紀錄（哪個 Agent、什麼時候、你問了什麼）會寫入組織的稽核日誌。你個人訂閱的 Agent、你自己的對話，以及帳號裡的其他一切，都不會被他們看到。",
                )}
              </p>
              <p className="mt-2">
                {t("You can decline, and you can leave later.", "辞退することも、後で退出することもできます。", "你可以婉拒，也可以之後隨時退出。")}
              </p>
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 text-xs">
          <div><dt className="text-muted">{t("Email", "メール", "信箱")}</dt><dd className="mt-0.5 truncate font-medium">{email}</dd></div>
          <div><dt className="text-muted">{t("Role", "役割", "角色")}</dt><dd className="mt-0.5 font-medium">{role === "admin" ? t("Admin", "管理者", "管理員") : t("Member", "メンバー", "成員")}</dd></div>
          <div><dt className="text-muted">{t("Daily limit", "1日の上限", "每日上限")}</dt><dd className="mt-0.5 font-medium">{dailyLimit > 0 ? dailyLimit : t("Standard", "標準", "標準")}</dd></div>
        </dl>

        {err && <p className="mt-4 rounded-lg border border-rust/30 bg-rust/5 px-3 py-2 text-xs text-rust">{err}</p>}

        <div className="mt-6 flex gap-3">
          <button onClick={() => act("accept")} disabled={!!busy} className="btn-primary flex-1 justify-center disabled:opacity-50">
            <IconCheck size={16} stroke={1.8} />
            {busy === "accept" ? t("Joining…", "参加中…", "加入中…") : t("Accept and join", "承諾して参加", "接受並加入")}
          </button>
          <button onClick={() => act("decline")} disabled={!!busy} className="btn-ghost justify-center disabled:opacity-50">
            <IconX size={16} stroke={1.8} />
            {t("Decline", "辞退", "婉拒")}
          </button>
        </div>
      </div>
    </main>
  );
}
