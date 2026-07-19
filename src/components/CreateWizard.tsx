"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconBulb } from "@tabler/icons-react";
import { CATEGORY_LABELS } from "@/lib/categories";
import { useI18n } from "@/lib/i18n";
import { AGENT_TYPES, typeLabel, typeGlyph, typeTagline } from "@/lib/agent-types";
import AssetUploader from "@/components/AssetUploader";

export default function CreateWizard() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const STEPS = [
    t("Persona & Workflow", "ペルソナとワークフロー", "人設與工作流"),
    t("Knowledge Base", "ナレッジベース", "知識庫"),
    t("Attach Tools", "ツール連携", "掛載工具"),
    t("Pricing & Publish", "価格設定と公開", "定價與發布"),
  ];
  const TOOLS = [
    t("Internal Compliance DB API", "社内コンプライアンスDB API", "內部合規資料庫 API"),
    t("Market Data Feed", "マーケットデータフィード", "市場數據 Feed"),
    t("Document Generation Service", "ドキュメント生成サービス", "文件產生服務"),
    t("Third-party KYC API", "サードパーティKYC API", "第三方 KYC API"),
    t("Vector Search (built-in)", "ベクトル検索（プラットフォーム内蔵）", "向量檢索 (平台內建)"),
    t("Email Notifications", "メール通知", "郵件通知"),
  ];
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState<any>({
    name: "", category: "compliance", agentType: "mentor", description: "", systemPrompt: "",
    features: ["", "", ""],
    pitch: "", useCases: ["", "", ""], notFor: "", sampleQuestions: ["", "", ""], tags: "",
    knowledge: "", docCount: 0, vectorized: false,
    tools: [] as string[],
    price: 49, trialLimit: 3, escalationPrice: 180, signaturePrice: 90,
    replacesRate: 150, replacesRole: "", savesHrs: 12, inPass: false, publish: true,
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  function vectorize() {
    const chunks = Math.max(1, Math.round(f.knowledge.length / 240) + (f.knowledge ? 8 : 0));
    set("docCount", chunks); set("vectorized", true);
  }

  async function submit() {
    setSaving(true); setErr("");
    const res = await fetch("/api/creator/agent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f,
        features: f.features.filter((x: string) => x.trim()),
        useCases: f.useCases.filter((x: string) => x.trim()),
        sampleQuestions: f.sampleQuestions.filter((x: string) => x.trim()),
        tags: f.tags, // comma-separated; the API normalises + dedupes
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(data.error || t("Creation failed", "作成に失敗しました", "建立失敗"));
    router.push(`/studio/agent/${data.slug}`);
    router.refresh();
  }

  const canNext = step === 0 ? f.name.trim() && f.description.trim() : true;

  return (
    <div className="mx-auto max-w-2xl animate-fadein">
      <h1 className="font-display text-[24px] font-extrabold tracking-tight"><span className="text-grad">{t("List a New Agent", "新しいエージェントを公開", "上架新 Agent")}</span></h1>
      <p className="mt-1 text-[12px] text-muted">{t("Four no-code steps to package your expertise into a managed Agent.", "ノーコード4ステップで、あなたの専門性をマネージドエージェントに。", "零代碼四步，把你的專業封裝成託管 Agent。")}</p>

      <div className="mt-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-[11px] font-bold transition-all ${i <= step ? "text-white bg-purple" : "border border-glassborder/20 bg-panel2/50 text-faint"}`}>{i + 1}</div>
            <div className={`text-[11px] font-medium ${i <= step ? "text-text" : "text-faint"}`}>{s}</div>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded-full transition-all ${i < step ? "bg-purple" : "bg-border/60"}`} />}
          </div>
        ))}
      </div>

      <div className="mt-6 glass-card p-6">
        {step === 0 && (
          <div className="space-y-4">
            <F label={t("Agent Name", "エージェント名", "Agent 名稱")}><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={t("e.g. Multi-jurisdiction KYC/AML compliance Agent", "例：多管轄区域 KYC/AML コンプライアンス照合エージェント", "例：多轄區 KYC/AML 合規比對 Agent")} className={inp} /></F>
            <F label={t("Category", "カテゴリ", "領域分類")}>
              <select value={f.category} onChange={(e) => set("category", e.target.value)} className={inp}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </F>
            <F label={t("Avatar type — how this expert shows up", "アバターのタイプ — 専門家の関わり方", "分身類型 — 這位專家如何出現")}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AGENT_TYPES.map((ty) => {
                  const on = f.agentType === ty;
                  return (
                    <button key={ty} type="button" onClick={() => set("agentType", ty)}
                      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${on ? "border-purple/60 bg-purple/[0.06] text-text" : "border-glassborder/20 bg-panel2/40 text-muted hover:border-borderlight"}`}>
                      <span className={`font-display text-[18px] font-bold leading-6 ${on ? "text-purple" : "text-faint"}`}>{typeGlyph(ty)}</span>
                      <span>
                        <span className="block font-display text-[12.5px] font-bold text-text">{typeLabel(ty, locale)}</span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-muted">{typeTagline(ty, locale)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </F>
            <F label={t("One-line description (shown in marketplace)", "一言説明（マーケットに表示）", "一句話說明（顯示在市集）")}><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder={t("Instantly compare KYC/AML rule differences across countries…", "各国のKYC/AML規制の違いを即時に照合…", "即時比對多國 KYC/AML 規範差異…")} className={inp} /></F>
            <F label={t("Persona / workflow instructions (server-side encrypted, never exposed)", "ペルソナ／ワークフロー指示（サーバー側で暗号化、非公開）", "人設 / 工作流指示（伺服器端加密，永不下發）")}><textarea value={f.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)} rows={3} placeholder={t("Describe this Agent's expert perspective, answer style, and workflow…", "このエージェントの専門的視点、回答スタイル、ワークフローを記述…", "描述這個 Agent 的專業視角、回答風格與工作流程…")} className={inp} /></F>
            <F label={t("Core Capabilities (shown as selling points)", "コア機能（セールスポイントとして表示）", "核心能力（顯示為賣點）")}>
              {f.features.map((ft: string, i: number) => (
                <input key={i} value={ft} onChange={(e) => { const a = [...f.features]; a[i] = e.target.value; set("features", a); }} placeholder={`${t("Capability", "機能", "能力")} ${i + 1}`} className={inp + " mb-2"} />
              ))}
              <button onClick={() => set("features", [...f.features, ""])} className="inline-flex items-center gap-1 text-[11px] text-violet transition hover:brightness-125"><IconPlus size={12} stroke={1.7} /> {t("Add capability", "機能を追加", "新增能力")}</button>
            </F>

            <div className="space-y-4 rounded-xl border border-glassborder/20 bg-panel2/30 p-4">
              <div>
                <div className="font-display text-[13px] font-bold text-text">{t("How you present this Agent", "この Agent の見せ方", "你如何呈現這個 Agent")}</div>
                <div className="mt-1 text-[11.5px] leading-6 text-muted">{t("Buyers meet the Agent before they meet you. Write it the way you would explain it to a colleague — plainly, and in your own words.", "購入者はあなたより先に Agent に出会います。同僚に説明するつもりで、率直に、あなた自身の言葉で書いてください。", "買家先遇到的是 Agent，不是你。用你跟同事解釋的方式寫——講白話，用你自己的話。")}</div>
              </div>

              <F label={t("Your pitch — why this Agent exists, and who you are", "あなたのピッチ — この Agent が存在する理由と、あなたが何者か", "你的自述 — 這個 Agent 為何存在，以及你是誰")}>
                <textarea value={f.pitch} onChange={(e) => set("pitch", e.target.value.slice(0, 1200))} rows={4}
                  placeholder={t("I've spent 12 years doing cross-border KYC reviews. I built this Agent because the same five questions come up in every audit…", "私は12年間、クロスボーダーの KYC レビューに携わってきました。どの監査でも同じ5つの質問が繰り返されるため、この Agent を作りました…", "我做了 12 年跨境 KYC 審查。每一次稽核都會遇到同樣的五個問題，所以我做了這個 Agent…")} className={inp} />
                <div className="mt-1 text-right text-[10.5px] text-faint">{f.pitch.length}/1200</div>
              </F>

              <F label={t("What this Agent is best for", "この Agent が最も得意なこと", "這個 Agent 最適合什麼")}>
                {f.useCases.map((u: string, i: number) => (
                  <input key={i} value={u} onChange={(e) => { const a = [...f.useCases]; a[i] = e.target.value; set("useCases", a); }} placeholder={`${t("Use case", "ユースケース", "使用情境")} ${i + 1}`} className={inp + " mb-2"} />
                ))}
                {f.useCases.length < 8 && <button onClick={() => set("useCases", [...f.useCases, ""])} className="inline-flex items-center gap-1 text-[11px] text-violet transition hover:brightness-125"><IconPlus size={12} stroke={1.7} /> {t("Add use case", "ユースケースを追加", "新增使用情境")}</button>}
              </F>

              <F label={t("What this Agent is NOT for — being honest here builds trust", "この Agent が対象としないこと — 正直に書くことが信頼になります", "這個 Agent 不適合什麼 — 誠實說明能建立信任")}>
                <textarea value={f.notFor} onChange={(e) => set("notFor", e.target.value.slice(0, 600))} rows={2}
                  placeholder={t("Not a substitute for licensed legal advice; not suitable for US state-level filings.", "有資格者による法的助言の代替にはなりません。米国の州レベルの申請には適しません。", "不能取代持照法律意見；不適用於美國州級申報。")} className={inp} />
                <div className="mt-1 text-right text-[10.5px] text-faint">{f.notFor.length}/600</div>
              </F>

              <F label={t("Starter questions (shown as clickable chips in the trial chat)", "最初の質問（試用チャットにクリック可能なチップとして表示）", "起手問題（在試用對話中顯示為可點擊的選項）")}>
                {f.sampleQuestions.map((q: string, i: number) => (
                  <input key={i} value={q} onChange={(e) => { const a = [...f.sampleQuestions]; a[i] = e.target.value; set("sampleQuestions", a); }} placeholder={`${t("Question", "質問", "問題")} ${i + 1}`} className={inp + " mb-2"} />
                ))}
                {f.sampleQuestions.length < 6 && <button onClick={() => set("sampleQuestions", [...f.sampleQuestions, ""])} className="inline-flex items-center gap-1 text-[11px] text-violet transition hover:brightness-125"><IconPlus size={12} stroke={1.7} /> {t("Add question", "質問を追加", "新增問題")}</button>}
              </F>

              <F label={t("Topic tags (comma-separated, up to 8)", "トピックタグ（カンマ区切り、最大 8 個）", "主題標籤（以逗號分隔，最多 8 個）")}>
                <input value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="kyc, aml, cross-border, mica" className={inp} />
                <TagChips value={f.tags} />
              </F>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-[12px] text-muted">{t("Paste or import your expert knowledge documents. The platform auto-chunks, vectorizes, and version-controls them — the material basis of \"subscribing to an expert.\"", "専門知識ドキュメントを貼り付けまたはインポート。プラットフォームが自動でチャンク分割・ベクトル化・バージョン管理します——「専門家を購読する」ための基盤です。", "貼上或匯入你的專業知識文件。平台自動切分、向量化並做版本管理——這是「訂閱一位專家」的物質基礎。")}</div>
            <textarea value={f.knowledge} onChange={(e) => { set("knowledge", e.target.value); set("vectorized", false); }} rows={8} placeholder={t("Paste regulations, cases, methodologies, internal knowledge…", "法令条文、事例、方法論、社内知識を貼り付け…", "貼上法規條文、案例、方法論、內部知識…")} className={inp} />
            <div className="flex items-center gap-3">
              <button onClick={vectorize} className="btn-glow rounded-xl border border-transparent px-4 py-2 text-[12.5px] font-semibold text-white shadow-glow transition hover:brightness-110 bg-purple">{t("Chunk & Vectorize", "チャンク分割してベクトル化", "切分並向量化")}</button>
              {f.vectorized && <span className="text-[12px] text-green">✓ {t("Vectorized", "ベクトル化済み", "已向量化")} · {f.docCount} {t("knowledge chunks", "個の知識ブロック", "個知識區塊")}</span>}
            </div>
            <AssetUploader />
            <div className="flex items-start gap-1.5 rounded-xl border border-glassborder/20 bg-panel2/40 p-3 text-[11px] text-faint backdrop-blur-sm"><IconBulb size={14} stroke={1.7} className="mt-0.5 shrink-0" /> {t("You can push updates anytime — all subscribers' Agents update instantly.", "いつでも更新をプッシュでき、全購読者のエージェントに即時反映されます。", "之後你可以隨時推送更新，所有訂閱者的 Agent 即時生效。")}</div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="text-[12px] text-muted">{t("Choose tools and data sources to attach (OAuth your own APIs, or use the platform tool library). Keys are managed by the platform and never exposed to buyers.", "連携するツールとデータソースを選択（自身のAPIをOAuth認可、またはプラットフォームのツールライブラリを利用）。キーはプラットフォームが管理し、購入者には公開されません。", "選擇要掛載的工具與資料源（OAuth 授權你自己的 API，或選用平台工具庫）。金鑰由平台代管，不暴露給買家。")}</div>
            {TOOLS.map((tool) => {
              const on = f.tools.includes(tool);
              return (
                <button key={tool} onClick={() => set("tools", on ? f.tools.filter((x: string) => x !== tool) : [...f.tools, tool])}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-[12.5px] backdrop-blur-sm transition-all ${on ? "border-violet/60 bg-violet/5 text-text shadow-glow" : "border-glassborder/20 bg-panel2/40 text-muted hover:border-borderlight"}`}>
                  {tool}<span className={`inline-flex items-center gap-1 ${on ? "text-violet" : "text-faint"}`}>{on ? <>{t("Attached", "連携済み", "已掛載")} ✓</> : <><IconPlus size={12} stroke={1.7} /> {t("Attach", "連携", "掛載")}</>}</span>
                </button>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <F label={t("Monthly Price (USD)", "月額（USD）", "月費 (USD)")}><input type="number" value={f.price} onChange={(e) => set("price", e.target.value)} className={inp} /></F>
              <F label={t("Free trial uses", "無料トライアル回数", "免費試用次數")}><input type="number" value={f.trialLimit} onChange={(e) => set("trialLimit", e.target.value)} className={inp} /></F>
              <F label={t("Human Escalation Fee (USD)", "有人エスカレーション料金（USD）", "真人升級費 (USD)")}><input type="number" value={f.escalationPrice} onChange={(e) => set("escalationPrice", e.target.value)} className={inp} /></F>
              <F label={t("Signed Verification Fee (USD)", "実名署名料金（USD）", "實名簽核費 (USD)")}><input type="number" value={f.signaturePrice} onChange={(e) => set("signaturePrice", e.target.value)} className={inp} /></F>
              <F label={t("Replaces hourly rate (USD/hr)", "代替する時給（USD/時）", "取代時薪 (USD/hr)")}><input type="number" value={f.replacesRate} onChange={(e) => set("replacesRate", e.target.value)} className={inp} /></F>
              <F label={t("Hours saved per month", "月あたり削減時間", "每月省下時數")}><input type="number" value={f.savesHrs} onChange={(e) => set("savesHrs", e.target.value)} className={inp} /></F>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" checked={f.inPass} onChange={(e) => set("inPass", e.target.checked)} /> {t("Include in the all-you-can-use Pass plan", "「パス」使い放題プランに追加", "加入「通行證」吃到飽方案")}</label>
            <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" checked={f.publish} onChange={(e) => set("publish", e.target.checked)} /> {t("Publish now (otherwise save as draft)", "今すぐ公開（それ以外は下書き保存）", "立即發布（否則存為草稿）")}</label>
            <div className="rounded-xl border border-glassborder/20 bg-panel2/40 p-3 text-[11.5px] text-muted backdrop-blur-sm">
              {t("Revenue share preview: you keep", "分配プレビュー：あなたの取り分は", "分潤預覽：你拿")} <span className="font-bold text-green">78%</span>{t(". With 200 subscribers → about", "。200人の購読者なら月間取り分は約", "。若 200 位訂閱者 → 月分潤約")} <span className="font-bold text-text">${Math.round(200 * f.price * 0.78).toLocaleString()}</span>{t("/mo.", "。", "。")}
            </div>
            {err && <div className="rounded-md border border-rust/40 bg-rust/10 px-3 py-2 text-[12px] text-rust">{err}</div>}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-xl border border-glassborder/20 bg-panel/40 px-4 py-2 text-[12.5px] text-muted backdrop-blur-sm transition hover:text-text disabled:opacity-30">{t("Back", "戻る", "上一步")}</button>
        {step < 3 ? (
          <button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext} className="btn-glow rounded-xl border border-transparent px-5 py-2 text-[12.5px] font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-40 bg-purple">{t("Next", "次へ", "下一步")}</button>
        ) : (
          <button onClick={submit} disabled={saving} className="btn-glow rounded-xl border border-transparent px-5 py-2 text-[12.5px] font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50 bg-purple">{saving ? t("Publishing…", "公開中…", "上架中…") : f.publish ? t("Publish Agent", "エージェントを公開", "發布 Agent") : t("Save as Draft", "下書き保存", "存為草稿")}</button>
        )}
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow";
/** Live preview of the comma-separated tag input. Mirrors the API's normalisation loosely. */
export function TagChips({ value }: { value: string }) {
  const tags = Array.from(new Set((value || "").split(",").map((x) => x.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))).slice(0, 8);
  if (!tags.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tg) => <span key={tg} className="rounded-full border border-border bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-muted">#{tg}</span>)}
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-faint">{label}</div>{children}</div>;
}
