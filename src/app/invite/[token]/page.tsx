import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, pick } from "@/lib/locale";
import Link from "next/link";
import InviteClient from "@/components/InviteClient";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();

  const seat = await db.enterpriseSeat.findUnique({
    where: { inviteToken: token },
    include: { orgOwner: { select: { name: true, orgName: true, email: true } } },
  });

  const shell = (title: string, body: React.ReactNode) => (
    <main className="mx-auto max-w-lg px-6 py-24">
      <div className="glass rounded-2xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-4 text-sm text-muted leading-relaxed">{body}</div>
      </div>
    </main>
  );

  if (!seat || seat.status === "declined") {
    return shell(
      pick(locale, "Invitation not found", "招待が見つかりません", "找不到這個邀請"),
      <p>{pick(locale,
        "This invitation link is invalid, was already used, or was withdrawn. Ask your organization admin to send a new one.",
        "この招待リンクは無効か、すでに使用されたか、取り消されています。組織の管理者に再送を依頼してください。",
        "這個邀請連結無效、已被使用，或已被撤回。請向貴組織的管理員索取新的邀請。")}</p>,
    );
  }

  if (seat.status === "active") {
    return shell(
      pick(locale, "You're already in", "すでに参加済みです", "你已經加入了"),
      <p>
        {pick(locale, "This seat is already active. ", "この席はすでに有効です。", "這個席位已經啟用。")}
        <Link href="/enterprise" className="underline">{pick(locale, "Go to your organization", "組織ページへ", "前往組織頁面")}</Link>
      </p>,
    );
  }

  const orgName = seat.orgOwner.orgName || seat.orgOwner.name;

  if (!user) {
    return shell(
      pick(locale, "Sign in to respond", "サインインして応答", "請先登入再回覆"),
      <>
        <p>{pick(locale,
          `${orgName} invited ${seat.memberEmail} to a WizAgents seat. Sign in with that email address to accept or decline.`,
          `${orgName} が ${seat.memberEmail} を WizAgents のシートに招待しました。承諾または辞退するには、そのメールアドレスでサインインしてください。`,
          `${orgName} 邀請 ${seat.memberEmail} 加入 WizAgents 席位。請用該信箱登入以接受或婉拒。`)}</p>
        <Link href={`/login?next=/invite/${token}`} className="btn-primary mt-6 inline-flex">
          {pick(locale, "Sign in", "サインイン", "登入")}
        </Link>
      </>,
    );
  }

  // Only the invited person may act on the invite. No silent joins, no wrong-account accepts.
  if (user.email.toLowerCase() !== seat.memberEmail.toLowerCase()) {
    return shell(
      pick(locale, "This invitation isn't for this account", "この招待はこのアカウント宛てではありません", "這個邀請不是給這個帳號的"),
      <p>{pick(locale,
        `The invitation was sent to ${seat.memberEmail}, but you are signed in as ${user.email}. Sign in with the invited address to respond.`,
        `招待は ${seat.memberEmail} 宛てですが、現在 ${user.email} でサインインしています。招待されたアドレスでサインインしてください。`,
        `這個邀請寄給 ${seat.memberEmail}，但你目前以 ${user.email} 登入。請改用被邀請的信箱登入。`)}</p>,
    );
  }

  return (
    <InviteClient
      token={token}
      orgName={orgName}
      email={seat.memberEmail}
      role={seat.role}
      dailyLimit={seat.dailyLimit}
    />
  );
}
