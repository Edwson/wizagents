"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import OAuthButtons from "@/components/OAuthButtons";
import { Btn } from "@/components/ui";

const DEMOS = [
  { label: ["Buyer", "バイヤー", "買家"], email: "buyer@wiz-agents.com", tone: "#5eb0ff" },
  { label: ["Creator", "クリエイター", "創作者"], email: "creator@wiz-agents.com", tone: "#e5a94e" },
  { label: ["Enterprise", "エンタープライズ", "企業"], email: "enterprise@wiz-agents.com", tone: "#4ade80" },
  { label: ["Admin", "管理者", "管理員"], email: "admin@wiz-agents.com", tone: "#f0663f" },
];
function dest(role: string) { return role === "admin" ? "/admin" : role === "creator" ? "/studio" : role === "enterprise" ? "/enterprise" : "/market"; }

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  const [role, setRole] = useState("buyer");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [err, setErr] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [twoFA, setTwoFA] = useState(false);
  const [code, setCode] = useState("");
  const [verifyLink, setVerifyLink] = useState("");

  async function submit(e?: React.FormEvent) {
    e?.preventDefault(); setErr(""); setIssues([]); setLoading(true);
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login" ? { email: form.email, password: form.password } : { ...form, role };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json(); setLoading(false);
    if (!res.ok) { if (data.issues) setIssues(data.issues); return setErr(data.error || t("Something went wrong", "エラーが発生しました", "發生錯誤")); }
    if (data.twoFactorRequired) { setTwoFA(true); return; }
    if (data.verifyPath) setVerifyLink(data.verifyPath);
    router.push(dest(data.role)); router.refresh();
  }
  async function verify2FA() {
    setErr(""); setLoading(true);
    const res = await fetch("/api/auth/2fa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: code }) });
    const data = await res.json(); setLoading(false);
    if (!res.ok) return setErr(data.error);
    router.push(dest(data.role)); router.refresh();
  }
  async function demoLogin(email: string) {
    setErr(""); setLoading(true);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "demo1234" }) });
    const data = await res.json(); setLoading(false);
    if (!res.ok) return setErr(data.error);
    if (data.twoFactorRequired) { setTwoFA(true); return; }
    router.push(dest(data.role)); router.refresh();
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-md flex-col justify-center py-12">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-violet to-cyan shadow-glow" />
        <span className="font-display text-lg text-text"><span className="font-medium">Wiz</span><span className="font-extrabold">Agents</span><span className="text-faint">.mcp</span></span>
      </Link>
      <div className="glass-card border-grad relative overflow-hidden p-7">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-violet/20 blur-3xl" aria-hidden />
        {twoFA ? (
          <div className="relative space-y-4">
            <h1 className="font-display text-[19px] font-extrabold tracking-tight"><span className="text-grad">{t("Two-factor authentication", "二段階認証", "兩步驟驗證")}</span></h1>
            <p className="text-[12px] text-muted">{t("Enter the 6-digit code from your authenticator app, or a backup code.", "認証アプリの6桁コード、またはバックアップコードを入力。", "輸入驗證器 App 的 6 位數代碼，或備用碼。")}</p>
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verify2FA()} placeholder="123456"
              className="w-full rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-2.5 text-center font-display text-[20px] tracking-[0.35em] outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow" />
            {err && <div className="rounded-lg border border-rust/40 bg-rust/10 px-3 py-2 text-[12px] text-rust">{err}</div>}
            <Btn type="button" onClick={verify2FA} disabled={loading} className="w-full">{loading ? t("Verifying…", "確認中…", "驗證中…") : t("Verify", "確認", "驗證")}</Btn>
            <button onClick={() => { setTwoFA(false); setCode(""); setErr(""); }} className="w-full text-[12px] text-muted transition hover:text-text">{t("Back", "戻る", "返回")}</button>
          </div>
        ) : (
        <div className="relative">
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-faint">{mode === "login" ? t("Welcome back", "おかえりなさい", "歡迎回來") : t("Get started", "はじめる", "開始使用")}</div>
        <h1 className="mb-5 font-display text-[26px] font-extrabold leading-tight tracking-tight">
          <span className="text-grad">{mode === "login" ? t("Sign in to WizAgents", "WizAgents にログイン", "登入 WizAgents") : t("Create your account", "アカウントを作成", "建立你的帳號")}</span>
        </h1>
        <div className="mb-5 flex gap-1 rounded-xl border border-glassborder/20 bg-panel2/40 p-1 backdrop-blur-sm">
          {["login", "register"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); setIssues([]); }} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${mode === m ? "text-white bg-purple" : "text-muted hover:text-text"}`}>
              {m === "login" ? t("Sign in", "ログイン", "登入") : t("Sign up", "登録", "註冊")}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (<>
            <Field label={t("Name / Team", "名前 / チーム", "姓名 / 團隊名稱")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{t("I am a", "私は", "我是")}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[["buyer", t("Buyer", "バイヤー", "買家")], ["creator", t("Creator", "クリエイター", "創作者")], ["enterprise", t("Enterprise", "企業", "企業")]].map(([r, l]) => (
                  <button type="button" key={r} onClick={() => setRole(r)} className={`rounded-lg border py-2 text-[12px] transition-all ${role === r ? "border-violet/60 text-grad shadow-glow" : "border-glassborder/20 bg-panel2/40 text-muted hover:border-borderlight"}`}>{l}</button>
                ))}
              </div>
            </div>
          </>)}
          <Field label={t("Email", "メール", "Email")} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label={t("Password", "パスワード", "密碼")} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          {mode === "login" && (
            <div className="-mt-1 text-right">
              <Link href="/forgot" className="text-[11.5px] text-muted transition hover:text-text">{t("Forgot password?", "パスワードをお忘れですか？", "忘記密碼？")}</Link>
            </div>
          )}
          {issues.length > 0 && (
            <ul className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[11.5px] text-amber">
              {issues.map((i, k) => <li key={k}>· {i}</li>)}
            </ul>
          )}
          {err && <div className="rounded-lg border border-rust/40 bg-rust/10 px-3 py-2 text-[12px] text-rust">{err}</div>}
          <Btn type="submit" disabled={loading} className="w-full">
            {loading ? t("Processing…", "処理中…", "處理中…") : mode === "login" ? t("Sign in", "ログイン", "登入") : t("Create account", "アカウント作成", "建立帳號")}
          </Btn>
        </form>
        {verifyLink && (
          <div className="mt-3 rounded-lg border border-purple/40 bg-purple/10 px-3 py-2 text-[11.5px] text-purple">
            {t("Dev: verify your email", "開発: メール認証", "開發：驗證信箱")} → <Link href={verifyLink} className="underline">{t("open link", "リンクを開く", "開啟連結")}</Link>
          </div>
        )}
        <OAuthButtons />
        <div className="my-5 flex items-center gap-3 text-[11px] text-faint">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-glassborder/30" /> {t("or try a demo account", "またはデモアカウントで", "或用示範帳號快速體驗")} <div className="h-px flex-1 bg-gradient-to-l from-transparent to-glassborder/30" />
        </div>
        <div className="space-y-2">
          {DEMOS.map((d) => (
            <button key={d.email} onClick={() => demoLogin(d.email)} disabled={loading} className="flex w-full items-center justify-between rounded-xl border border-glassborder/20 bg-panel2/40 px-4 py-2.5 text-[12.5px] backdrop-blur-sm transition-all hover:border-violet/40 hover:shadow-glow disabled:opacity-50">
              <span className="flex items-center gap-2 font-medium"><span className="h-2 w-2 rounded-full" style={{ background: d.tone, boxShadow: `0 0 8px ${d.tone}` }} />{t(d.label[0], d.label[1], d.label[2])}</span>
              <span className="font-mono text-[11px] text-faint">{d.email}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 text-center font-mono text-[11px] text-faint">{t("Demo password", "デモパスワード", "所有示範帳號密碼")}: demo1234</div>
        </div>
        )}
      </div>
    </div>
  );
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (<div><div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{label}</div>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required className="w-full rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-2.5 text-[13px] text-text outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow" /></div>);
}
export default function LoginPage() { return <Suspense><LoginInner /></Suspense>; }
