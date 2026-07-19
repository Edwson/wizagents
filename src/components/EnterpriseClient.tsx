"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  IconLock, IconPlus, IconReceipt, IconAlertTriangle, IconInfoCircle, IconKey, IconShieldCheck,
  IconUsers, IconCopy, IconDownload, IconCheck, IconX, IconTrash, IconMail, IconClock,
  IconLayoutDashboard, IconFileText, IconLink, IconChevronDown, IconBan,
} from "@tabler/icons-react";
import { timeAgo } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Progress, Reveal } from "@/components/ui";
import OnboardingChecklist from "./OnboardingChecklist";
import { useToast } from "./Toast";

/* ---------------- types (mirror what enterprise/page.tsx sends) ---------------- */
export type Seat = {
  id: string; memberEmail: string; memberName: string; role: string; status: string;
  dailyLimit: number; linked: boolean; invitedAt: string; acceptedAt: string | null;
};
export type Audit = { actorEmail: string; agentName: string; action: string; query: string; createdAt: string };
export type BL = { id: string; agentName: string; reason: string };
export type AL = { id: string; agentName: string };
export type Req = {
  id: string; requesterEmail: string; agentName: string; reason: string;
  status: string; note: string; createdAt: string;
};
export type OrgAgent = { id: string; slug: string; name: string; price: number };
export type SeatKey = { id: string; label: string; revoked: boolean; createdAt: string; lastUsedAt: string | null; preview: string };

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const inp = "rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow";
const btnPrimary = "btn-glow inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-purple px-4 py-2 text-[12.5px] font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60";
const btnGhost = "inline-flex items-center gap-1.5 rounded-lg border border-glassborder/20 bg-panel/40 px-2.5 py-1 text-[11px] text-muted backdrop-blur-sm transition hover:border-violet/40 hover:text-text";
const btnDanger = "inline-flex items-center gap-1.5 rounded-lg border border-rust/50 px-2.5 py-1 text-[11px] text-rust transition hover:bg-rust/10";

function Stat({ v, l }: { v: React.ReactNode; l: string }) {
  return <div className="glass-card px-4 py-3"><div className="font-display text-[20px] font-extrabold text-grad">{v}</div><div className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-faint">{l}</div></div>;
}

export default function EnterpriseClient({
  orgName, isAdmin, isOwner, mySeat,
  seats, audit, blacklist, allowlist, policy, requests, orgAgents, teamSubs,
  seatCount, activeSeatCount, orgSpend, subsCost, budget, seatPrice,
}: {
  orgName: string;
  isAdmin: boolean;
  isOwner: boolean;
  mySeat: Seat | null;
  seats: Seat[];
  audit: Audit[];
  blacklist: BL[];
  allowlist: AL[];
  policy: string;
  requests: Req[];
  orgAgents: OrgAgent[];
  teamSubs: number;
  seatCount: number; activeSeatCount: number; orgSpend: number; subsCost: number; budget: number; seatPrice: number;
}) {
  const { toast } = useToast();
  const { t } = useI18n();

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t("Copied to clipboard", "クリップボードにコピーしました", "已複製到剪貼簿"), "success");
    } catch {
      toast(t("Could not copy — select the text and copy it manually.", "コピーできませんでした。テキストを選択して手動でコピーしてください。", "無法複製 — 請選取文字後手動複製。"), "error");
    }
  }, [toast, t]);

  if (!isAdmin) {
    return <MemberView orgName={orgName} mySeat={mySeat} orgAgents={orgAgents} requests={requests} copy={copy} />;
  }

  return <AdminView
    orgName={orgName} isOwner={isOwner} seats={seats} audit={audit} blacklist={blacklist}
    allowlist={allowlist} policy={policy} requests={requests} orgAgents={orgAgents} teamSubs={teamSubs}
    seatCount={seatCount} activeSeatCount={activeSeatCount} orgSpend={orgSpend} subsCost={subsCost}
    budget={budget} seatPrice={seatPrice} copy={copy}
  />;
}

/* =========================================================================
   ADMIN
   ========================================================================= */
function AdminView({
  orgName, isOwner, seats, audit, blacklist, allowlist, policy, requests, orgAgents, teamSubs,
  seatCount, activeSeatCount, orgSpend, subsCost, budget, seatPrice, copy,
}: {
  orgName: string; isOwner: boolean; seats: Seat[]; audit: Audit[]; blacklist: BL[]; allowlist: AL[];
  policy: string; requests: Req[]; orgAgents: OrgAgent[]; teamSubs: number;
  seatCount: number; activeSeatCount: number; orgSpend: number; subsCost: number; budget: number; seatPrice: number;
  copy: (s: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState("overview");

  /* budget */
  const [budgetInput, setBudgetInput] = useState(budget ? String(budget) : "");
  const [savingBudget, setSavingBudget] = useState(false);

  /* invite */
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  const [inviteErr, setInviteErr] = useState("");

  /* keys */
  const [openSeat, setOpenSeat] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<string, SeatKey[]>>({});
  const [keyLabel, setKeyLabel] = useState("");
  const [freshKey, setFreshKey] = useState<{ seatId: string; token: string } | null>(null);

  /* governance */
  const [alSlug, setAlSlug] = useState("");
  const [blSlug, setBlSlug] = useState("");
  const [blReason, setBlReason] = useState("");

  /* requests */
  const [reqErr, setReqErr] = useState("");
  const [busyReq, setBusyReq] = useState("");

  const seatCost = activeSeatCount * seatPrice;
  const annual = orgSpend * 12;
  const pct = budget > 0 ? (orgSpend / budget) * 100 : 0;
  const overBudget = budget > 0 && orgSpend > budget;
  const nearBudget = budget > 0 && !overBudget && pct >= 80;
  const barTone = overBudget ? "rgb(var(--rust))" : nearBudget ? "rgb(var(--amber))" : "rgb(var(--green))";
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  async function saveBudget() {
    setSavingBudget(true);
    const cap = Math.max(0, Math.floor(Number(budgetInput) || 0));
    const r = await fetch("/api/enterprise/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ budget: cap }) });
    setSavingBudget(false);
    if (r.ok) { toast(cap ? t("Budget cap saved", "予算上限を保存しました", "已儲存預算上限") : t("Budget cap removed", "予算上限を解除しました", "已解除預算上限"), "success"); router.refresh(); }
    else toast(t("Could not save budget", "予算を保存できませんでした", "無法儲存預算"), "error");
  }

  async function invite() {
    if (!email.trim()) return;
    setInviting(true); setInviteErr(""); setInviteLink(null);
    const r = await fetch("/api/enterprise/seat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), name, role: inviteRole }),
    });
    const j = await r.json().catch(() => ({}));
    setInviting(false);
    if (!r.ok) { setInviteErr(j.error || t("Could not send that invitation.", "招待を送信できませんでした。", "無法送出邀請。")); return; }
    setInviteLink({ email: email.trim(), link: j.inviteLink, emailSent: !!j.emailSent });
    setEmail(""); setName(""); setInviteRole("member");
    toast(t("Invitation created", "招待を作成しました", "已建立邀請"), "success");
    router.refresh();
  }

  async function seatAction(id: string, action: string, extra: Record<string, unknown> = {}) {
    const r = await fetch(`/api/enterprise/seat/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || t("That change was rejected.", "その変更は拒否されました。", "該變更遭拒。"), "error"); return; }
    router.refresh();
  }

  async function removeSeat(s: Seat) {
    const ok = window.confirm(t(
      `Remove ${s.memberEmail}? This deletes their seat and revokes every API key it issued — anything they built on those keys stops working immediately. Their past activity stays in the audit log.`,
      `${s.memberEmail} を削除しますか？席を削除し、その席が発行した全APIキーを失効させます。キーを使った連携は直ちに停止します。過去の操作は監査ログに残ります。`,
      `要移除 ${s.memberEmail} 嗎？這會刪除其席位並撤銷該席位發出的所有 API 金鑰 — 依賴這些金鑰的整合會立即停止運作。其過往活動仍保留在審計日誌中。`,
    ));
    if (ok) seatAction(s.id, "remove");
  }

  async function loadKeys(seatId: string) {
    const r = await fetch(`/api/enterprise/seat/${seatId}/token`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setKeys((k) => ({ ...k, [seatId]: j.tokens || [] }));
    else toast(j.error || t("Could not load keys.", "キーを読み込めませんでした。", "無法載入金鑰。"), "error");
  }

  function toggleSeatKeys(seatId: string) {
    if (openSeat === seatId) { setOpenSeat(null); return; }
    setOpenSeat(seatId); setFreshKey(null); setKeyLabel("");
    if (!keys[seatId]) loadKeys(seatId);
  }

  async function issueKey(seatId: string) {
    const r = await fetch(`/api/enterprise/seat/${seatId}/token`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: keyLabel }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || t("Could not issue a key.", "キーを発行できませんでした。", "無法發行金鑰。"), "error"); return; }
    setFreshKey({ seatId, token: j.token }); setKeyLabel("");
    loadKeys(seatId);
  }

  async function revokeKey(seatId: string, tokenId: string) {
    await fetch(`/api/enterprise/seat/${seatId}/token`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId }),
    });
    toast(t("Key revoked", "キーを失効しました", "已撤銷金鑰"), "success");
    loadKeys(seatId);
  }

  async function setPolicy(p: string) {
    const r = await fetch("/api/enterprise/policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy: p }) });
    if (r.ok) { toast(t("Policy updated", "ポリシーを更新しました", "已更新政策"), "success"); router.refresh(); }
    else toast(t("Could not update the policy.", "ポリシーを更新できませんでした。", "無法更新政策。"), "error");
  }
  async function addAllow() {
    if (!alSlug.trim()) return;
    const r = await fetch("/api/enterprise/policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addSlug: alSlug.trim() }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setAlSlug(""); toast(t("Added to the allowlist", "許可リストに追加しました", "已加入允許清單"), "success"); router.refresh(); }
    else toast(j.error || t("Agent slug not found", "そのAgent slugが見つかりません", "找不到該 Agent slug"), "error");
  }
  async function rmAllow(id: string) {
    await fetch("/api/enterprise/policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeId: id }) });
    router.refresh();
  }
  async function addBl() {
    if (!blSlug.trim()) return;
    const r = await fetch("/api/enterprise/blacklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: blSlug.trim(), reason: blReason }) });
    if (r.ok) { setBlSlug(""); setBlReason(""); toast(t("Blocked", "ブロックしました", "已封鎖"), "success"); router.refresh(); }
    else toast(t("Agent slug not found", "そのAgent slugが見つかりません", "找不到該 Agent slug"), "error");
  }
  async function rmBl(id: string) {
    await fetch("/api/enterprise/blacklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeId: id }) });
    router.refresh();
  }

  async function decide(id: string, action: "approve" | "deny") {
    setBusyReq(id); setReqErr("");
    const r = await fetch("/api/enterprise/request", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const j = await r.json().catch(() => ({}));
    setBusyReq("");
    if (!r.ok) {
      // The budget cap is enforced at the moment money would be committed — show exactly what came back.
      setReqErr(j.error || t("That decision could not be applied.", "その判断を適用できませんでした。", "無法套用該決定。"));
      toast(j.error || t("Rejected", "拒否されました", "遭拒"), "error");
      return;
    }
    toast(action === "approve"
      ? t("Approved — the organization is now subscribed.", "承認しました — 組織がサブスクリプションを開始しました。", "已核准 — 組織已完成訂閱。")
      : t("Denied", "却下しました", "已拒絕"), "success");
    router.refresh();
  }

  const lineItems: { label: string; qty: string; unit: string; amount: number }[] = [
    { label: t("Active team seats", "有効なチーム席", "有效團隊席位"), qty: String(activeSeatCount), unit: money(seatPrice), amount: seatCost },
    { label: t("Agent subscriptions", "Agentサブスクリプション", "Agent 訂閱"), qty: String(teamSubs), unit: t("metered", "従量", "計量"), amount: subsCost },
  ];

  const TABS: [string, string, string, string, React.ReactNode][] = [
    ["overview", "Overview", "概要", "總覽", <IconLayoutDashboard key="i" size={13} stroke={1.8} />],
    ["seats", "Seats", "席の管理", "席位管理", <IconUsers key="i" size={13} stroke={1.8} />],
    ["keys", "Keys", "APIキー", "API 金鑰", <IconKey key="i" size={13} stroke={1.8} />],
    ["governance", "Governance", "ガバナンス", "治理", <IconShieldCheck key="i" size={13} stroke={1.8} />],
    ["requests", "Requests", "申請", "申請", <IconMail key="i" size={13} stroke={1.8} />],
    ["audit", "Audit & Export", "監査とエクスポート", "審計與匯出", <IconFileText key="i" size={13} stroke={1.8} />],
  ];

  return (
    <div className="animate-fadein">
      <h1 className="font-display text-[28px] font-extrabold tracking-tight"><span className="text-grad">{t("Enterprise Console", "エンタープライズコンソール", "企業控制台")}</span></h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">
        {orgName} · {t("Seats, per-person API keys, governance, access requests, and a full audit log.", "席、個人別APIキー、ガバナンス、アクセス申請、完全な監査ログ。", "席位、個人 API 金鑰、治理、存取申請與完整審計日誌。")}
      </p>

      <div className="mb-6">
        <OnboardingChecklist
          role="enterprise"
          steps={[
            {
              done: seats.length > 0,
              label: ["Invite your first seat", "最初の席を招待", "邀請第一個席位"],
              desc: ["Send an invite. They must accept before anything is charged.", "招待を送ります。相手が承諾するまで課金は発生しません。", "送出邀請。對方接受前不會產生任何費用。"],
              cta: ["Invite", "招待", "邀請"],
              onClick: () => setTab("seats"),
            },
            {
              done: budget > 0,
              label: ["Set a monthly budget cap", "月間予算上限を設定", "設定每月預算上限"],
              desc: ["The cap is enforced: new seats and approvals are blocked above it.", "上限は実際に適用され、超過する新規席や承認はブロックされます。", "上限會實際生效：超出上限的新席位與核准會被封鎖。"],
              cta: ["Set cap", "上限設定", "設定上限"],
              onClick: () => setTab("overview"),
            },
            {
              done: policy === "allowlist" || blacklist.length > 0,
              label: ["Choose a governance policy", "ガバナンスポリシーを選択", "選擇治理政策"],
              desc: ["Open, or an allowlist of Agents your seats may use.", "オープン、または席が使える Agent の許可リスト。", "開放，或指定席位可使用的 Agent 允許清單。"],
              cta: ["Configure", "設定", "設定"],
              onClick: () => setTab("governance"),
            },
            {
              done: audit.length > 0,
              label: ["Review the audit log", "監査ログを確認", "查看審計日誌"],
              desc: ["Every seat's Agent usage is recorded here and exportable as CSV.", "各席の Agent 利用はここに記録され、CSV で書き出せます。", "每個席位的 Agent 使用都記錄於此，可匯出為 CSV。"],
              cta: ["View log", "ログを見る", "查看日誌"],
              onClick: () => setTab("audit"),
            },
          ]}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat v={money(orgSpend)} l={t("Monthly Spend", "月間支出", "每月支出")} />
        <Stat v={`${activeSeatCount}/${seatCount}`} l={t("Active Seats", "有効な席", "有效席位")} />
        <Stat v={teamSubs} l={t("Org Agents", "組織のAgent", "組織 Agent")} />
        <Stat v={pending.length} l={t("Pending Requests", "保留中の申請", "待處理申請")} />
        <Stat v={audit.length} l={t("Audit Events", "監査イベント", "審計事件")} />
        <Stat v={policy === "allowlist" ? t("Allowlist", "許可リスト", "允許清單") : t("Open", "オープン", "開放")} l={t("Policy", "ポリシー", "政策")} />
      </div>

      {(overBudget || nearBudget) && (
        <div className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-[12px] ${overBudget ? "border-rust/40 bg-rust/10 text-rust" : "border-amber/40 bg-amber/10 text-amber"}`}>
          <IconAlertTriangle size={15} stroke={1.8} className="mt-px shrink-0" />
          <div>
            <div className="font-display font-bold">
              {overBudget
                ? t("You are over your monthly budget cap.", "月間予算上限を超えています。", "已超出每月預算上限。")
                : t("You are close to your monthly budget cap.", "月間予算上限に近づいています。", "接近每月預算上限。")}
            </div>
            <div className="mt-0.5 opacity-90">
              {money(orgSpend)} {t("of", "／", "／")} {money(budget)} ({Math.round(pct)}%) — {t(
                "new seat invitations and Agent approvals that would exceed the cap are rejected until you raise it or cut spend.",
                "上限を超える新規席の招待や Agent の承認は、上限を上げるか支出を減らすまで拒否されます。",
                "在您調高上限或減少支出前，會超出上限的新席位邀請與 Agent 核准都會被拒絕。",
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-glassborder/20 bg-panel2/40 p-1 backdrop-blur-sm">
        {TABS.map(([k, en, ja, zh, icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${tab === k ? "bg-purple text-white" : "text-muted hover:text-text"}`}>
            {icon}{t(en, ja, zh)}
            {k === "requests" && pending.length > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-bold ${tab === k ? "bg-white/20" : "bg-amber/20 text-amber"}`}>{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- OVERVIEW ---------------- */}
      {tab === "overview" && (
        <Reveal className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="glass-card border-grad p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-faint"><IconReceipt size={14} stroke={1.8} />{t("Monthly cost summary", "月間コストサマリー", "每月成本摘要")}</div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="font-display text-[38px] font-extrabold leading-none text-grad">{money(orgSpend)}</div>
                  <div className="mt-1 text-[11.5px] text-muted">{t("total monthly spend", "月間合計支出", "每月總支出")}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-[18px] font-bold">{money(annual)}</div>
                  <div className="text-[11px] text-faint">{t("projected annual", "年間見込み", "年度預估")}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-glassborder/20 bg-panel2/40 px-3 py-2.5">
                  <div className="text-[11px] text-faint">{t("Seats", "席", "席位")} · {activeSeatCount} × {money(seatPrice)}</div>
                  <div className="mt-0.5 font-display text-[16px] font-bold">{money(seatCost)}</div>
                </div>
                <div className="rounded-xl border border-glassborder/20 bg-panel2/40 px-3 py-2.5">
                  <div className="text-[11px] text-faint">{t("Agent subscriptions", "Agentサブスク", "Agent 訂閱")}</div>
                  <div className="mt-0.5 font-display text-[16px] font-bold">{money(subsCost)}</div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-faint">{t("Monthly budget cap", "月間予算上限", "每月預算上限")}</div>
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">$</span>
                  <input value={budgetInput} onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder={t("0 = no cap", "0 = 上限なし", "0 = 無上限")} className={inp + " w-full pl-6"} />
                </div>
                <button onClick={saveBudget} disabled={savingBudget} className={btnPrimary}>{savingBudget ? t("Saving…", "保存中…", "儲存中…") : t("Save", "保存", "儲存")}</button>
              </div>
              <div className="mt-4">
                {budget > 0 ? (
                  <>
                    <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                      <span className={overBudget ? "text-rust" : nearBudget ? "text-amber" : "text-muted"}>{money(orgSpend)} {t("of", "／", "／")} {money(budget)} {t("monthly cap", "月間上限", "每月上限")}</span>
                      <span className={`font-display font-bold ${overBudget ? "text-rust" : nearBudget ? "text-amber" : "text-green"}`}>{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} tone={barTone} />
                    <div className="mt-2 text-[11px] text-faint">
                      {t("A seat costs", "1席あたり", "每個席位")} {money(seatPrice)}{t("/mo. Agent subscriptions are charged at their listed price.", "／月。Agent サブスクは表示価格で課金されます。", "／月。Agent 訂閱按其標示價格計費。")}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-[12px] text-faint"><IconInfoCircle size={13} stroke={1.8} />{t("No cap set — spend is unlimited and nothing will be blocked.", "上限未設定 — 支出は無制限で、何もブロックされません。", "未設上限 — 支出無限制，不會封鎖任何動作。")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card !p-0 overflow-hidden">
            <div className="grid grid-cols-[2fr_0.7fr_0.9fr_0.9fr] gap-2 border-b border-glassborder/15 bg-panel2/40 px-4 py-2.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">
              <span>{t("Line item", "項目", "項目")}</span><span className="text-right">{t("Qty", "数量", "數量")}</span><span className="text-right">{t("Unit", "単価", "單價")}</span><span className="text-right">{t("Amount", "金額", "金額")}</span>
            </div>
            {lineItems.map((li, i) => (
              <div key={i} className="grid grid-cols-[2fr_0.7fr_0.9fr_0.9fr] gap-2 border-b border-glassborder/10 px-4 py-3 text-[12.5px]">
                <span>{li.label}</span>
                <span className="text-right text-muted">{li.qty}</span>
                <span className="text-right text-muted">{li.unit}</span>
                <span className="text-right font-display font-bold">{money(li.amount)}</span>
              </div>
            ))}
            <div className="grid grid-cols-[2fr_0.7fr_0.9fr_0.9fr] gap-2 border-t border-glassborder/20 bg-panel2/30 px-4 py-3 text-[12.5px]">
              <span className="font-display font-bold uppercase tracking-[0.06em] text-faint">{t("Total / mo", "月間合計", "每月合計")}</span>
              <span /><span />
              <span className="text-right font-display text-[15px] font-extrabold text-grad">{money(orgSpend)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-1 text-[10.5px] text-faint"><IconInfoCircle size={12} stroke={1.7} />{t("Figures are illustrative until billed · seat price fixed at $49/mo · taxes not included", "金額は請求確定まで参考値です · 席単価は月額$49固定 · 税別", "金額於實際出帳前僅供參考 · 席位單價固定為每月 $49 · 未含稅")}</div>
        </Reveal>
      )}

      {/* ---------------- SEATS ---------------- */}
      {tab === "seats" && (
        <Reveal className="space-y-4">
          <div className="glass-card p-4">
            <div className="flex flex-wrap gap-2">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("Member email", "メンバーのメール", "成員 email")} className={inp + " flex-1"} />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Name / Department (optional)", "氏名 / 部署（任意）", "姓名 / 部門（選填）")} className={inp + " flex-1"} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={inp}>
                <option value="member">{t("Member", "メンバー", "成員")}</option>
                <option value="admin">{t("Admin", "管理者", "管理員")}</option>
              </select>
              <button onClick={invite} disabled={inviting} className={btnPrimary}><IconPlus size={14} stroke={1.7} />{inviting ? t("Inviting…", "招待中…", "邀請中…") : t("Invite", "招待", "邀請")}</button>
            </div>
            <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-faint">
              <IconInfoCircle size={12} stroke={1.7} className="mt-0.5 shrink-0" />
              <span>{t(
                "The person must accept the invitation — nobody is added silently. A seat is billed at $49/mo only once it is active. Tell them plainly: once they accept, their use of the organization's Agents appears in this organization's audit log.",
                "相手が招待を承諾する必要があります。無断で追加されることはありません。席が有効になって初めて月額$49が課金されます。承諾後は、その人の組織 Agent の利用がこの組織の監査ログに記録されることを必ず伝えてください。",
                "對方必須接受邀請 — 沒有人會被靜默加入。席位僅在啟用後才以每月 $49 計費。請明確告知：一旦接受，他們使用組織 Agent 的紀錄會出現在本組織的審計日誌中。",
              )}</span>
            </div>
            {inviteErr && (
              <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-rust/40 bg-rust/10 px-3 py-2 text-[11.5px] text-rust">
                <IconAlertTriangle size={13} stroke={1.8} className="mt-px shrink-0" />{inviteErr}
              </div>
            )}
            {inviteLink && (
              <div className="mt-3 rounded-xl border border-violet/40 bg-panel2/50 px-3 py-3">
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-violet"><IconLink size={13} stroke={1.8} />{t("Invitation link for", "招待リンク：", "邀請連結：")} {inviteLink.email}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-glassborder/20 bg-panel/60 px-2.5 py-1.5 text-[11px] text-text">{inviteLink.link}</code>
                  <button onClick={() => copy(inviteLink.link)} className={btnGhost}><IconCopy size={12} stroke={1.7} />{t("Copy", "コピー", "複製")}</button>
                </div>
                <div className="mt-2 text-[11px] text-faint">
                  {inviteLink.emailSent
                    ? t("We also emailed this link to them. Send it yourself if it doesn't arrive.", "このリンクはメールでも送信しました。届かない場合はご自身で共有してください。", "我們也已將此連結寄給對方。若未收到，請自行轉發。")
                    : t("Email delivery is not configured on this deployment, so we did not send anything. Share this link with them yourself.", "この環境ではメール送信が未設定のため送信していません。このリンクをご自身で共有してください。", "此部署未設定郵件寄送，因此我們沒有發信。請自行將此連結分享給對方。")}
                </div>
              </div>
            )}
          </div>

          <div className="glass-card !p-0 divide-y divide-glassborder/15 overflow-hidden">
            {seats.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[13px] font-bold">{s.memberName || s.memberEmail}</span>
                    {s.role === "admin" && <span className="rounded-full border border-purple/40 px-1.5 py-px text-[10px] text-purple">{t("Admin", "管理者", "管理員")}</span>}
                  </div>
                  <div className="text-[11px] text-faint">{s.memberEmail}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <SeatStatus status={s.status} />

                  {/* per-seat daily limit */}
                  <label className="flex items-center gap-1 text-[11px] text-faint">
                    {t("Daily limit", "1日の上限", "每日上限")}
                    <input
                      type="number" min={0} defaultValue={s.dailyLimit || 0}
                      onBlur={(e) => {
                        const n = Math.max(0, Number(e.target.value) || 0);
                        if (n !== (s.dailyLimit || 0)) seatAction(s.id, "limit", { dailyLimit: n });
                      }}
                      className={inp + " w-[74px] !px-2 !py-1 text-[11px]"}
                      title={t("0 = platform default", "0 = プラットフォーム既定値", "0 = 平台預設值")}
                    />
                  </label>

                  {isOwner && (
                    <select
                      value={s.role}
                      onChange={(e) => seatAction(s.id, "role", { role: e.target.value })}
                      className={inp + " !px-2 !py-1 text-[11px]"}
                    >
                      <option value="member">{t("Member", "メンバー", "成員")}</option>
                      <option value="admin">{t("Admin", "管理者", "管理員")}</option>
                    </select>
                  )}

                  {s.status !== "invited" && (
                    <button onClick={() => seatAction(s.id, s.status === "suspended" ? "activate" : "suspend")} className={btnGhost}>
                      {s.status === "suspended" ? t("Activate", "有効化", "啟用") : t("Suspend", "停止", "停用")}
                    </button>
                  )}
                  {s.status === "invited" && (
                    <span className="text-[10.5px] text-faint">{t("Waiting for them to accept", "承諾待ち", "等待對方接受")}</span>
                  )}
                  <button onClick={() => removeSeat(s)} className={btnDanger}><IconTrash size={12} stroke={1.7} />{t("Remove", "削除", "移除")}</button>
                </div>
              </div>
            ))}
            {seats.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-faint">{t("No seats yet — invite someone above.", "席がまだありません — 上から招待してください。", "尚無席位 — 請於上方邀請成員。")}</div>}
          </div>
          <div className="flex items-start gap-1.5 px-1 text-[10.5px] text-faint">
            <IconInfoCircle size={12} stroke={1.7} className="mt-px shrink-0" />
            {t(
              "Suspending a seat revokes its API keys immediately. Removing a seat deletes it and revokes its keys — the person's past activity stays in the audit log. A daily limit of 0 means the platform default applies.",
              "席を停止すると、その APIキーは直ちに失効します。削除すると席とキーは消えますが、過去の操作は監査ログに残ります。1日の上限が0の場合はプラットフォーム既定値が適用されます。",
              "停用席位會立即撤銷其 API 金鑰。移除席位會刪除席位並撤銷金鑰 — 該人的過往活動仍留在審計日誌中。每日上限為 0 表示套用平台預設值。",
            )}
          </div>
        </Reveal>
      )}

      {/* ---------------- KEYS ---------------- */}
      {tab === "keys" && (
        <Reveal className="space-y-4">
          <div className="glass-card p-4 text-[12px] text-muted">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-faint"><IconKey size={13} stroke={1.8} />{t("Per-seat API keys", "席ごとのAPIキー", "各席位 API 金鑰")}</div>
            <p className="mt-2">{t(
              "Each key belongs to one seat. Calls made with it are attributed to that person in the audit log, and you can revoke one person's key without rotating anyone else's. A key only works while the seat is active and the Agent is permitted by your policy.",
              "各キーは1つの席に属します。そのキーによる呼び出しは監査ログでその人に紐づき、他の人のキーを回さずに1人分だけ失効できます。キーは席が有効で、Agent がポリシー上許可されている間のみ機能します。",
              "每把金鑰只屬於一個席位。使用該金鑰的呼叫會在審計日誌中歸屬到該人，您也可以只撤銷某一人的金鑰而不影響他人。金鑰僅在席位有效且該 Agent 符合政策時可用。",
            )}</p>
          </div>

          <div className="glass-card !p-0 divide-y divide-glassborder/15 overflow-hidden">
            {seats.map((s) => (
              <div key={s.id}>
                <button onClick={() => toggleSeatKeys(s.id)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-panel2/30">
                  <div>
                    <div className="font-display text-[13px] font-bold">{s.memberName || s.memberEmail}</div>
                    <div className="text-[11px] text-faint">{s.memberEmail}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeatStatus status={s.status} />
                    <IconChevronDown size={14} stroke={1.8} className={`text-faint transition ${openSeat === s.id ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {openSeat === s.id && (
                  <div className="border-t border-glassborder/10 bg-panel2/20 px-4 py-3">
                    {s.status !== "active" ? (
                      <div className="flex items-center gap-1.5 text-[11.5px] text-amber">
                        <IconAlertTriangle size={13} stroke={1.8} />
                        {t("Keys can only be issued for an active seat.", "キーは有効な席にのみ発行できます。", "只有有效席位才能發行金鑰。")}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder={t("Key label (e.g. laptop, CI)", "キーのラベル（例：ノートPC、CI）", "金鑰標籤（例：筆電、CI）")} className={inp + " flex-1"} />
                        <button onClick={() => issueKey(s.id)} className={btnPrimary}><IconPlus size={13} stroke={1.7} />{t("Issue key", "キーを発行", "發行金鑰")}</button>
                      </div>
                    )}

                    {freshKey?.seatId === s.id && (
                      <div className="mt-3 rounded-xl border border-amber/50 bg-amber/10 px-3 py-3">
                        <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-amber">
                          <IconAlertTriangle size={13} stroke={1.8} />
                          {t("Copy it now — we will not show it again.", "今すぐコピーしてください — 二度と表示されません。", "請立即複製 — 我們不會再次顯示。")}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-glassborder/20 bg-panel/60 px-2.5 py-1.5 text-[11px]">{freshKey.token}</code>
                          <button onClick={() => copy(freshKey.token)} className={btnGhost}><IconCopy size={12} stroke={1.7} />{t("Copy", "コピー", "複製")}</button>
                          <button onClick={() => setFreshKey(null)} className={btnGhost}><IconX size={12} stroke={1.7} />{t("Done", "完了", "完成")}</button>
                        </div>
                        <div className="mt-2 text-[11px] text-amber/80">
                          {t("We store only a hashless record of it — if it is lost, revoke it and issue a new one.", "こちらには再表示できる形で保存していません。紛失した場合は失効させて再発行してください。", "我們不會保留可再次顯示的副本 — 若遺失，請撤銷並重新發行。")}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 space-y-1.5">
                      {(keys[s.id] || []).map((k) => (
                        <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-glassborder/15 bg-panel/30 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <code className="text-[11px] text-muted">{k.preview}</code>
                            {k.label && <span className="text-[11px] text-faint">· {k.label}</span>}
                            {k.revoked && <span className="rounded-full border border-rust/40 px-1.5 py-px text-[10px] text-rust">{t("Revoked", "失効済み", "已撤銷")}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] text-faint">
                            <span>{k.lastUsedAt ? t("last used", "最終利用", "最後使用") + " " + timeAgo(k.lastUsedAt, locale) : t("never used", "未使用", "尚未使用")}</span>
                            {!k.revoked && <button onClick={() => revokeKey(s.id, k.id)} className={btnDanger}>{t("Revoke", "失効", "撤銷")}</button>}
                          </div>
                        </div>
                      ))}
                      {keys[s.id] && keys[s.id].length === 0 && (
                        <div className="py-2 text-[11.5px] text-faint">{t("No keys issued for this seat yet.", "この席にはまだキーが発行されていません。", "此席位尚未發行任何金鑰。")}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {seats.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-faint">{t("Invite a seat before issuing keys.", "キーを発行する前に席を招待してください。", "請先邀請席位再發行金鑰。")}</div>}
          </div>
        </Reveal>
      )}

      {/* ---------------- GOVERNANCE ---------------- */}
      {tab === "governance" && (
        <Reveal className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-faint"><IconShieldCheck size={14} stroke={1.8} />{t("Agent policy", "Agentポリシー", "Agent 政策")}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([
                ["open", t("Open", "オープン", "開放"), t("Seats may use any Agent the organization subscribes to, except blocked ones.", "席は、ブロック済みを除き、組織がサブスクする任意の Agent を使えます。", "除封鎖者外，席位可使用組織訂閱的任何 Agent。")],
                ["allowlist", t("Allowlist", "許可リスト", "允許清單"), t("Seats may ONLY use Agents on the allowlist below. Everything else is refused.", "席は下の許可リストにある Agent のみ使えます。それ以外は拒否されます。", "席位僅能使用下方允許清單中的 Agent，其餘一律拒絕。")],
              ] as [string, string, string][]).map(([k, label, desc]) => (
                <button key={k} onClick={() => setPolicy(k)} className={`rounded-xl border p-3.5 text-left transition ${policy === k ? "border-violet bg-panel2/60 shadow-glow" : "border-glassborder/20 bg-panel2/30 hover:border-violet/40"}`}>
                  <div className="flex items-center gap-1.5 font-display text-[13px] font-bold">
                    {policy === k && <IconCheck size={13} stroke={2.2} className="text-violet" />}{label}
                  </div>
                  <div className="mt-1 text-[11.5px] text-muted">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {policy === "allowlist" && (
            <div className="glass-card p-4">
              <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-faint">{t("Allowed Agents", "許可された Agent", "允許的 Agent")}</div>
              <div className="flex flex-wrap gap-2">
                <input value={alSlug} onChange={(e) => setAlSlug(e.target.value)} placeholder={t("Agent slug (e.g. kyc-aml)", "Agent slug（例：kyc-aml）", "Agent slug（例：kyc-aml）")} className={inp + " flex-1"} />
                <button onClick={addAllow} className={btnPrimary}><IconPlus size={13} stroke={1.7} />{t("Allow", "許可", "允許")}</button>
              </div>
              <div className="mt-3 divide-y divide-glassborder/15">
                {allowlist.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2.5">
                    <div className="font-display text-[13px] font-bold">{a.agentName}</div>
                    <button onClick={() => rmAllow(a.id)} className={btnGhost}>{t("Remove", "削除", "移除")}</button>
                  </div>
                ))}
                {allowlist.length === 0 && (
                  <div className="py-3 text-[11.5px] text-amber">
                    {t(
                      "The allowlist is empty, so your seats currently cannot use any Agent. Add one, or switch back to Open.",
                      "許可リストが空のため、現在どの席も Agent を使えません。追加するか、オープンに戻してください。",
                      "允許清單為空，因此目前所有席位都無法使用任何 Agent。請新增項目，或切換回「開放」。",
                    )}
                  </div>
                )}
              </div>
              <div className="mt-2 text-[10.5px] text-faint">
                {t("Approving an access request automatically adds that Agent here.", "アクセス申請を承認すると、その Agent は自動的にここへ追加されます。", "核准存取申請時，該 Agent 會自動加入此清單。")}
              </div>
            </div>
          )}

          <div className="glass-card p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-faint"><IconBan size={13} stroke={1.8} />{t("Blocked Agents", "ブロック済み Agent", "封鎖的 Agent")}</div>
            <div className="flex flex-wrap gap-2">
              <input value={blSlug} onChange={(e) => setBlSlug(e.target.value)} placeholder={t("Agent slug (e.g. kyc-aml)", "Agent slug（例：kyc-aml）", "Agent slug（例：kyc-aml）")} className={inp + " flex-1"} />
              <input value={blReason} onChange={(e) => setBlReason(e.target.value)} placeholder={t("Block reason", "ブロック理由", "封鎖原因")} className={inp + " flex-1"} />
              <button onClick={addBl} className="rounded-xl border border-rust/50 px-4 py-2 text-[12.5px] text-rust transition hover:bg-rust/10">{t("Block", "ブロック", "封鎖")}</button>
            </div>
            <div className="mt-3 divide-y divide-glassborder/15">
              {blacklist.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-display text-[13px] font-bold">{b.agentName}</div>
                    <div className="text-[11px] text-faint">{b.reason || t("No reason recorded", "理由の記録なし", "未記錄原因")}</div>
                  </div>
                  <button onClick={() => rmBl(b.id)} className={btnGhost}>{t("Unblock", "解除", "解除")}</button>
                </div>
              ))}
              {blacklist.length === 0 && <div className="py-3 text-[11.5px] text-faint">{t("Nothing is blocked.", "ブロックされているものはありません。", "目前沒有封鎖任何項目。")}</div>}
            </div>
            <div className="mt-2 text-[10.5px] text-faint">
              {t("A block always wins, even in Open policy and even if the Agent is on the allowlist.", "ブロックは常に優先されます。オープンポリシーでも、許可リストにあっても同様です。", "封鎖一律優先，即使在「開放」政策下或該 Agent 在允許清單中也一樣。")}
            </div>
          </div>
        </Reveal>
      )}

      {/* ---------------- REQUESTS ---------------- */}
      {tab === "requests" && (
        <Reveal className="space-y-4">
          {reqErr && (
            <div className="flex items-start gap-1.5 rounded-xl border border-rust/40 bg-rust/10 px-3 py-2.5 text-[12px] text-rust">
              <IconAlertTriangle size={13} stroke={1.8} className="mt-px shrink-0" />{reqErr}
            </div>
          )}
          <div className="glass-card !p-0 divide-y divide-glassborder/15 overflow-hidden">
            <div className="bg-panel2/40 px-4 py-2.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">{t("Pending approval", "承認待ち", "待核准")}</div>
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-[200px] flex-1">
                  <div className="font-display text-[13px] font-bold">{r.agentName}</div>
                  <div className="text-[11px] text-faint">{r.requesterEmail} · {timeAgo(r.createdAt, locale)}</div>
                  {r.reason && <div className="mt-1 text-[11.5px] text-muted">“{r.reason}”</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => decide(r.id, "approve")} disabled={busyReq === r.id} className={btnPrimary}><IconCheck size={13} stroke={2} />{t("Approve", "承認", "核准")}</button>
                  <button onClick={() => decide(r.id, "deny")} disabled={busyReq === r.id} className={btnDanger}><IconX size={12} stroke={1.8} />{t("Deny", "却下", "拒絕")}</button>
                </div>
              </div>
            ))}
            {pending.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-faint">{t("Nothing waiting on you.", "対応待ちはありません。", "沒有待您處理的項目。")}</div>}
          </div>

          <div className="flex items-start gap-1.5 px-1 text-[10.5px] text-faint">
            <IconInfoCircle size={12} stroke={1.7} className="mt-px shrink-0" />
            {t(
              "Approving actually subscribes the organization to that Agent and charges its monthly price — and it is checked against your budget cap, so an approval that would break the cap is refused with an explanation.",
              "承認すると、実際に組織がその Agent をサブスクし、月額が課金されます。予算上限もチェックされ、上限を超える承認は理由付きで拒否されます。",
              "核准會實際讓組織訂閱該 Agent 並按月計費，且會檢查預算上限 — 會超出上限的核准將被拒絕並附上說明。",
            )}
          </div>

          {decided.length > 0 && (
            <div className="glass-card !p-0 divide-y divide-glassborder/15 overflow-hidden">
              <div className="bg-panel2/40 px-4 py-2.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">{t("Decided", "対応済み", "已決定")}</div>
              {decided.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[11.5px]">
                  <span className="font-display font-bold">{r.agentName}</span>
                  <span className="text-faint">{r.requesterEmail}</span>
                  <span className={r.status === "approved" ? "text-green" : "text-rust"}>
                    {r.status === "approved" ? t("Approved", "承認済み", "已核准") : t("Denied", "却下", "已拒絕")}
                  </span>
                  <span className="text-faint">{timeAgo(r.createdAt, locale)}</span>
                </div>
              ))}
            </div>
          )}
        </Reveal>
      )}

      {/* ---------------- AUDIT & EXPORT ---------------- */}
      {tab === "audit" && (
        <Reveal className="space-y-4">
          <div className="glass-card p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-faint"><IconDownload size={13} stroke={1.8} />{t("Export as CSV", "CSVでエクスポート", "匯出為 CSV")}</div>
            <div className="flex flex-wrap gap-2">
              {([
                ["audit", t("Audit log", "監査ログ", "審計日誌")],
                ["spend", t("Spend breakdown", "支出の内訳", "支出明細")],
                ["seats", t("Seat roster", "席の一覧", "席位名冊")],
              ] as [string, string][]).map(([kind, label]) => (
                <a key={kind} href={`/api/enterprise/export?kind=${kind}`} className={btnGhost + " !px-3 !py-1.5 !text-[12px]"} download>
                  <IconDownload size={13} stroke={1.7} />{label}
                </a>
              ))}
            </div>
            <div className="mt-2 text-[10.5px] text-faint">
              {t("Your records are yours — take them with you whenever you like.", "記録はあなたのものです。いつでも持ち出せます。", "紀錄屬於您 — 隨時都可以帶走。")}
            </div>
          </div>

          <div className="glass-card !p-0 overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1.4fr_0.8fr_1fr] gap-2 border-b border-glassborder/15 bg-panel2/40 px-4 py-2.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">
              <span>{t("Member", "メンバー", "成員")}</span><span>Agent</span><span>{t("Action", "操作", "動作")}</span><span>{t("Time", "時刻", "時間")}</span>
            </div>
            {audit.map((a, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_1.4fr_0.8fr_1fr] gap-2 border-b border-glassborder/10 px-4 py-2.5 text-[11.5px] last:border-0">
                <span className="truncate text-muted">{a.actorEmail}</span>
                <span className="truncate">{a.agentName}</span>
                <span className="text-violet">{a.action}{a.query && <span className="text-faint"> · {a.query}</span>}</span>
                <span className="text-faint">{timeAgo(a.createdAt, locale)}</span>
              </div>
            ))}
            {audit.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-faint">{t("No audit events yet.", "監査イベントはまだありません。", "尚無審計事件。")}</div>}
            <div className="flex items-center gap-1.5 border-t border-glassborder/10 px-4 py-2.5 text-[10.5px] text-faint">
              <IconLock size={12} stroke={1.7} />
              {t("Every call a seat makes with an org key is recorded here, attributed to the person who made it.", "席が組織キーで行った各呼び出しは、実行者に紐づけてここに記録されます。", "席位使用組織金鑰的每次呼叫都會記錄於此，並歸屬到實際操作者。")}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}

/* =========================================================================
   MEMBER (non-admin seat holder)
   ========================================================================= */
function MemberView({
  orgName, mySeat, orgAgents, requests, copy,
}: {
  orgName: string; mySeat: Seat | null; orgAgents: OrgAgent[]; requests: Req[];
  copy: (s: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [keys, setKeys] = useState<SeatKey[] | null>(null);
  const [keyLabel, setKeyLabel] = useState("");
  const [freshKey, setFreshKey] = useState("");
  const [slug, setSlug] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const active = mySeat?.status === "active";

  async function loadKeys() {
    if (!mySeat) return;
    const r = await fetch(`/api/enterprise/seat/${mySeat.id}/token`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setKeys(j.tokens || []);
  }
  async function issueKey() {
    if (!mySeat) return;
    const r = await fetch(`/api/enterprise/seat/${mySeat.id}/token`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: keyLabel }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || t("Could not issue a key.", "キーを発行できませんでした。", "無法發行金鑰。"), "error"); return; }
    setFreshKey(j.token); setKeyLabel(""); loadKeys();
  }
  async function revokeKey(tokenId: string) {
    if (!mySeat) return;
    await fetch(`/api/enterprise/seat/${mySeat.id}/token`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId }),
    });
    toast(t("Key revoked", "キーを失効しました", "已撤銷金鑰"), "success");
    loadKeys();
  }
  async function requestAccess() {
    if (!slug.trim()) return;
    setSending(true); setErr("");
    const r = await fetch("/api/enterprise/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slug.trim(), reason }),
    });
    const j = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) { setErr(j.error || t("Could not send that request.", "申請を送信できませんでした。", "無法送出申請。")); return; }
    setSlug(""); setReason("");
    toast(j.already
      ? t("You already have a pending request for that Agent.", "その Agent への申請はすでに保留中です。", "您對該 Agent 已有待處理的申請。")
      : t("Request sent to your organization's admins.", "組織の管理者に申請を送信しました。", "已將申請送給組織管理員。"), "success");
    router.refresh();
  }

  if (!mySeat) {
    return (
      <div className="animate-fadein">
        <h1 className="font-display text-[28px] font-extrabold tracking-tight"><span className="text-grad">{t("Organization", "組織", "組織")}</span></h1>
        <div className="glass-card mt-6 p-6 text-[13px] text-muted">
          <div className="flex items-center gap-1.5 font-display font-bold text-text"><IconInfoCircle size={15} stroke={1.8} />{t("You don't hold a seat in any organization.", "どの組織の席も保有していません。", "您目前不隸屬於任何組織席位。")}</div>
          <p className="mt-2">{t(
            "If your company uses WizAgents, ask an admin to invite you. You will get a link and you have to accept it — nobody can add you without your say-so.",
            "会社が WizAgents を利用している場合は、管理者に招待を依頼してください。リンクが届き、あなたが承諾する必要があります。無断で追加されることはありません。",
            "若貴公司使用 WizAgents，請請管理員邀請您。您會收到連結並需自行接受 — 沒有人能在未經您同意下加入您。",
          )}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadein">
      <h1 className="font-display text-[28px] font-extrabold tracking-tight"><span className="text-grad">{t("My Organization Seat", "自分の組織席", "我的組織席位")}</span></h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">
        {orgName} · {t("Your seat, your API key, and what you can request.", "あなたの席、APIキー、申請できること。", "您的席位、API 金鑰，以及可提出的申請。")}
      </p>

      {/* seat status */}
      <div className="glass-card mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-faint">{t("Seat status", "席のステータス", "席位狀態")}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <SeatStatus status={mySeat.status} />
              <span className="text-[12.5px] text-muted">{mySeat.memberEmail}</span>
              {mySeat.role === "admin" && <span className="rounded-full border border-purple/40 px-1.5 py-px text-[10px] text-purple">{t("Admin", "管理者", "管理員")}</span>}
            </div>
          </div>
          <div className="text-right text-[11px] text-faint">
            <div>{t("Daily limit", "1日の上限", "每日上限")}: {mySeat.dailyLimit ? mySeat.dailyLimit : t("platform default", "プラットフォーム既定値", "平台預設值")}</div>
            {mySeat.acceptedAt && <div>{t("Joined", "参加", "加入")} {timeAgo(mySeat.acceptedAt, locale)}</div>}
          </div>
        </div>
        <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-glassborder/20 bg-panel2/40 px-3 py-2.5 text-[11.5px] text-muted">
          <IconLock size={13} stroke={1.8} className="mt-px shrink-0 text-faint" />
          <span>{t(
            "Because you hold a seat here, your use of this organization's Agents is recorded in their audit log — who ran what, and when. Your personal subscriptions are not part of that log.",
            "ここで席を保有しているため、この組織の Agent の利用は組織の監査ログに記録されます（誰が何をいつ実行したか）。個人のサブスクリプションはこのログには含まれません。",
            "由於您持有此處的席位，您使用本組織 Agent 的紀錄會出現在他們的審計日誌中（誰、做了什麼、何時）。您的個人訂閱不在此日誌內。",
          )}</span>
        </div>
        {mySeat.status === "suspended" && (
          <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-rust">
            <IconAlertTriangle size={13} stroke={1.8} />
            {t("Your seat is suspended, so its API keys are revoked and org Agents are unavailable to you. Contact an admin.", "席が停止中のため、APIキーは失効し、組織の Agent は利用できません。管理者にご連絡ください。", "您的席位已停用，API 金鑰已被撤銷，且無法使用組織 Agent。請聯絡管理員。")}
          </div>
        )}
      </div>

      {/* my keys */}
      <div className="glass-card mb-4 p-5">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-faint"><IconKey size={13} stroke={1.8} />{t("My API key", "自分のAPIキー", "我的 API 金鑰")}</div>
        <p className="mt-2 text-[11.5px] text-muted">{t(
          "This key is yours alone. Calls made with it are attributed to you in the organization's audit log, and an admin can revoke it without affecting anyone else.",
          "このキーはあなた専用です。キーによる呼び出しは組織の監査ログであなたに紐づき、管理者は他の人に影響を与えずに失効できます。",
          "此金鑰僅屬於您。使用它的呼叫會在組織審計日誌中歸屬於您，管理員可撤銷它而不影響其他人。",
        )}</p>

        {!active ? (
          <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-amber"><IconAlertTriangle size={13} stroke={1.8} />{t("Your seat must be active to hold a key.", "キーを保有するには席が有効である必要があります。", "席位必須為有效狀態才能持有金鑰。")}</div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder={t("Key label (e.g. laptop, CI)", "キーのラベル（例：ノートPC、CI）", "金鑰標籤（例：筆電、CI）")} className={inp + " flex-1"} />
              <button onClick={issueKey} className={btnPrimary}><IconPlus size={13} stroke={1.7} />{t("Issue key", "キーを発行", "發行金鑰")}</button>
              {keys === null && <button onClick={loadKeys} className={btnGhost}>{t("Show my keys", "自分のキーを表示", "顯示我的金鑰")}</button>}
            </div>

            {freshKey && (
              <div className="mt-3 rounded-xl border border-amber/50 bg-amber/10 px-3 py-3">
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-amber">
                  <IconAlertTriangle size={13} stroke={1.8} />{t("Copy it now — we will not show it again.", "今すぐコピーしてください — 二度と表示されません。", "請立即複製 — 我們不會再次顯示。")}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-glassborder/20 bg-panel/60 px-2.5 py-1.5 text-[11px]">{freshKey}</code>
                  <button onClick={() => copy(freshKey)} className={btnGhost}><IconCopy size={12} stroke={1.7} />{t("Copy", "コピー", "複製")}</button>
                  <button onClick={() => setFreshKey("")} className={btnGhost}><IconX size={12} stroke={1.7} />{t("Done", "完了", "完成")}</button>
                </div>
              </div>
            )}

            {keys && keys.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {keys.map((k) => (
                  <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-glassborder/15 bg-panel/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] text-muted">{k.preview}</code>
                      {k.label && <span className="text-[11px] text-faint">· {k.label}</span>}
                      {k.revoked && <span className="rounded-full border border-rust/40 px-1.5 py-px text-[10px] text-rust">{t("Revoked", "失効済み", "已撤銷")}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[10.5px] text-faint">
                      <span>{k.lastUsedAt ? t("last used", "最終利用", "最後使用") + " " + timeAgo(k.lastUsedAt, locale) : t("never used", "未使用", "尚未使用")}</span>
                      {!k.revoked && <button onClick={() => revokeKey(k.id)} className={btnDanger}>{t("Revoke", "失効", "撤銷")}</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {keys && keys.length === 0 && <div className="mt-3 text-[11.5px] text-faint">{t("You have no keys yet.", "キーはまだありません。", "您尚未擁有任何金鑰。")}</div>}
          </>
        )}
      </div>

      {/* agents I can use */}
      <div className="glass-card mb-4 !p-0 overflow-hidden">
        <div className="border-b border-glassborder/15 bg-panel2/40 px-4 py-2.5 text-[10.5px] uppercase tracking-[0.06em] text-faint">
          {t("Agents you can use with this seat", "この席で使える Agent", "此席位可使用的 Agent")}
        </div>
        {orgAgents.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-b border-glassborder/10 px-4 py-2.5 text-[12px] last:border-0">
            <div>
              <div className="font-display font-bold">{a.name}</div>
              <div className="text-[11px] text-faint">{a.slug}</div>
            </div>
            <span className="text-[11px] text-faint">{money(a.price)}{t("/mo, paid by the org", "／月・組織が支払い", "／月，由組織支付")}</span>
          </div>
        ))}
        {orgAgents.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-faint">
            {t("Your organization has not made any Agent available to you yet. Request one below.", "組織はまだ Agent を利用可能にしていません。下から申請してください。", "貴組織尚未開放任何 Agent 給您。請於下方提出申請。")}
          </div>
        )}
      </div>

      {/* request access */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-faint"><IconMail size={13} stroke={1.8} />{t("Request access to an Agent", "Agent へのアクセスを申請", "申請使用某個 Agent")}</div>
        <p className="mt-2 text-[11.5px] text-muted">{t(
          "An admin has to approve it, because approving means the organization subscribes and pays for it. Say why you need it — that reason is what they will see.",
          "承認は管理者が行います。承認すると組織がサブスクし費用を負担するためです。必要な理由を書いてください。管理者はその理由を見て判断します。",
          "需由管理員核准，因為核准代表組織會訂閱並付費。請說明您需要的原因 — 管理員會看到這段理由。",
        )}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t("Agent slug (e.g. kyc-aml)", "Agent slug（例：kyc-aml）", "Agent slug（例：kyc-aml）")} className={inp + " flex-1"} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Why you need it", "必要な理由", "需要的原因")} className={inp + " flex-[2]"} />
          <button onClick={requestAccess} disabled={sending || !active} className={btnPrimary}>{sending ? t("Sending…", "送信中…", "送出中…") : t("Request", "申請", "申請")}</button>
        </div>
        {!active && <div className="mt-2 text-[11px] text-amber">{t("Only an active seat can request access.", "有効な席のみ申請できます。", "只有有效席位可以提出申請。")}</div>}
        {err && <div className="mt-2 flex items-start gap-1.5 text-[11.5px] text-rust"><IconAlertTriangle size={13} stroke={1.8} className="mt-px shrink-0" />{err}</div>}

        {requests.length > 0 && (
          <div className="mt-4 divide-y divide-glassborder/15 border-t border-glassborder/15">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11.5px]">
                <span className="font-display font-bold">{r.agentName}</span>
                <span className="flex items-center gap-1.5">
                  {r.status === "pending" && <span className="flex items-center gap-1 text-amber"><IconClock size={12} stroke={1.8} />{t("Waiting on an admin", "管理者の承認待ち", "等待管理員處理")}</span>}
                  {r.status === "approved" && <span className="flex items-center gap-1 text-green"><IconCheck size={12} stroke={2} />{t("Approved", "承認済み", "已核准")}</span>}
                  {r.status === "denied" && <span className="flex items-center gap-1 text-rust"><IconX size={12} stroke={1.8} />{t("Denied", "却下", "已拒絕")}{r.note ? ` · ${r.note}` : ""}</span>}
                </span>
                <span className="text-faint">{timeAgo(r.createdAt, locale)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
function SeatStatus({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, [string, string]> = {
    active: ["text-green border-green/40", t("Active", "有効", "使用中")],
    suspended: ["text-rust border-rust/40", t("Suspended", "停止中", "已停用")],
    invited: ["text-amber border-amber/40", t("Invited", "招待済み", "已邀請")],
    declined: ["text-faint border-glassborder/30", t("Declined", "辞退", "已婉拒")],
  };
  const [cls, label] = map[status] || ["text-faint border-glassborder/30", status];
  return <span className={`inline-flex items-center rounded-full border bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none backdrop-blur-sm ${cls}`}>{label}</span>;
}
