"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { CATEGORY_LABELS } from "@/lib/categories";
import { useI18n } from "@/lib/i18n";
import { AGENT_TYPES, typeLabel, typeGlyph, typeTagline } from "@/lib/agent-types";
import AssetUploader from "@/components/AssetUploader";

type KV = { version: string; note: string; docCount: number };
export default function EditAgent({ agent, versions }: {
  agent: {
    slug: string; name: string; category: string; description: string; price: number; features: string[]; inPass: boolean; status: string;
    escalationPrice: number; signaturePrice: number; trialLimit: number; subscribers: number; renewal: number; rating: number; agentType: string;
    /** Presentation fields. Optional: when the page doesn't supply them we never send them back, so nothing is overwritten. */
    pitch?: string; useCases?: string[]; notFor?: string; sampleQuestions?: string[]; tags?: string[];
  };
  versions: KV[];
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [f, setF] = useState<any>({
    ...agent,
    pitch: agent.pitch ?? "",
    useCases: agent.useCases?.length ? agent.useCases : ["", "", ""],
    notFor: agent.notFor ?? "",
    sampleQuestions: agent.sampleQuestions?.length ? agent.sampleQuestions : ["", "", ""],
    tags: (agent.tags ?? []).join(", "),
  });
  // Only send the presentation fields when the server actually handed them to us, or the
  // expert edited them here. Otherwise an untouched save would blank out a stored pitch.
  const presentationSupplied = agent.pitch !== undefined;
  const [presentationTouched, setPresentationTouched] = useState(false);
  const [note, setNote] = useState("");
  const [kdoc, setKdoc] = useState(20);
  const [msg, setMsg] = useState("");
  const [vers, setVers] = useState(versions);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const setP = (k: string, v: any) => { setPresentationTouched(true); set(k, v); };

  async function save() {
    setMsg("");
    const body: any = { ...f, features: f.features.filter((x: string) => x.trim()) };
    if (presentationSupplied || presentationTouched) {
      body.pitch = f.pitch;
      body.notFor = f.notFor;
      body.useCases = f.useCases.filter((x: string) => x.trim());
      body.sampleQuestions = f.sampleQuestions.filter((x: string) => x.trim());
      body.tags = f.tags; // comma-separated; the API normalises + dedupes
    } else {
      delete body.pitch; delete body.notFor; delete body.useCases; delete body.sampleQuestions; delete body.tags;
    }
    const res = await fetch(`/api/creator/agent/${agent.slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setMsg(res.ok ? t("Saved ✓", "保存しました ✓", "已儲存 ✓") : t("Save failed", "保存に失敗しました", "儲存失敗")); router.refresh();
  }
  async function toggleStatus() {
    const next = f.status === "published" ? "suspended" : "published";
    await fetch(`/api/creator/agent/${agent.slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    set("status", next); router.refresh();
  }
  async function pushKnowledge() {
    const res = await fetch(`/api/creator/agent/${agent.slug}/knowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, docCount: kdoc }) });
    const d = await res.json();
    if (d.ok) { setVers([{ version: d.version, note: note || t("Knowledge base update", "ナレッジベース更新", "推送知識庫更新"), docCount: kdoc }, ...vers]); setNote(""); setMsg(t(`Pushed ${d.version} · all subscribers updated instantly`, `${d.version} をプッシュ · 全購読者に即時反映`, `已推送 ${d.version} · 所有訂閱者即時生效`)); }
  }

  return (
    <div className="animate-fadein">
      <Link href="/studio" className="text-[12px] text-muted transition hover:text-text">← {t("Back to Studio", "スタジオに戻る", "回工作室")}</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight"><span className="text-grad">{f.name}</span></h1>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">{f.subscribers} {t("subscribers", "登録", "訂閱")} · {f.renewal}% {t("renewal", "更新", "續訂")} · ★{f.rating.toFixed(1)}</span>
          <button onClick={toggleStatus} className={`rounded-xl border px-3 py-1.5 text-[11.5px] transition ${f.status === "published" ? "border-rust/50 text-rust hover:bg-rust/10" : "border-green/50 text-green hover:bg-green/10"}`}>{f.status === "published" ? t("Unpublish", "公開停止", "暫停發布") : t("Republish", "再公開", "重新發布")}</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card p-5">
          <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Basic Settings", "基本設定", "基本設定")}</div>
          <div className="space-y-3">
            <F label={t("Name", "名前", "名稱")}><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} /></F>
            <F label={t("Category", "カテゴリ", "分類")}><select value={f.category} onChange={(e) => set("category", e.target.value)} className={inp}>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
            <F label={t("Avatar type", "アバターのタイプ", "分身類型")}>
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
            <F label={t("Description", "説明", "說明")}><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} className={inp} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label={t("Monthly Price", "月額", "月費")}><input type="number" value={f.price} onChange={(e) => set("price", e.target.value)} className={inp} /></F>
              <F label={t("Trial uses", "トライアル回数", "試用次數")}><input type="number" value={f.trialLimit} onChange={(e) => set("trialLimit", e.target.value)} className={inp} /></F>
              <F label={t("Human Escalation Fee", "有人エスカレーション料金", "真人升級費")}><input type="number" value={f.escalationPrice} onChange={(e) => set("escalationPrice", e.target.value)} className={inp} /></F>
              <F label={t("Signature Fee", "署名料金", "簽核費")}><input type="number" value={f.signaturePrice} onChange={(e) => set("signaturePrice", e.target.value)} className={inp} /></F>
            </div>
            <F label={t("Core Capabilities", "コア機能", "核心能力")}>
              {f.features.map((ft: string, i: number) => <input key={i} value={ft} onChange={(e) => { const a = [...f.features]; a[i] = e.target.value; set("features", a); }} className={inp + " mb-2"} />)}
              <button onClick={() => set("features", [...f.features, ""])} className="inline-flex items-center gap-1 text-[11px] text-violet transition hover:brightness-125"><IconPlus size={12} stroke={1.7} /> {t("Add", "追加", "新增")}</button>
            </F>

            <div className="space-y-3 rounded-xl border border-glassborder/20 bg-panel2/30 p-4">
              <div>
                <div className="font-display text-[13px] font-bold text-text">{t("How you present this Agent", "この Agent の見せ方", "你如何呈現這個 Agent")}</div>
                <div className="mt-1 text-[11.5px] leading-6 text-muted">{t("Shown on the Agent's public page. Plain words beat marketing.", "Agent の公開ページに表示されます。宣伝文句より率直な言葉を。", "會顯示在 Agent 的公開頁面。白話勝過行銷語言。")}</div>
              </div>

              <F label={t("Your pitch — why this Agent exists, and who you are", "あなたのピッチ — この Agent が存在する理由と、あなたが何者か", "你的自述 — 這個 Agent 為何存在，以及你是誰")}>
                <textarea value={f.pitch} onChange={(e) => setP("pitch", e.target.value.slice(0, 1200))} rows={4} className={inp} />
                <div className="mt-1 text-right text-[10.5px] text-faint">{(f.pitch || "").length}/1200</div>
              </F>

              <F label={t("What this Agent is best for", "この Agent が最も得意なこと", "這個 Agent 最適合什麼")}>
                {f.useCases.map((u: string, i: number) => (
                  <input key={i} value={u} onChange={(e) => { const a = [...f.useCases]; a[i] = e.target.value; setP("useCases", a); }} placeholder={`${t("Use case", "ユースケース", "使用情境")} ${i + 1}`} className={inp + " mb-2"} />
                ))}
                {f.useCases.length < 8 && <button onClick={() => setP("useCases", [...f.useCases, ""])} className="inline-flex items-center gap-1 text-[11px] text-violet transition hover:brightness-125"><IconPlus size={12} stroke={1.7} /> {t("Add", "追加", "新增")}</button>}
              </F>

              <F label={t("What this Agent is NOT for — being honest here builds trust", "この Agent が対象としないこと — 正直に書くことが信頼になります", "這個 Agent 不適合什麼 — 誠實說明能建立信任")}>
                <textarea value={f.notFor} onChange={(e) => setP("notFor", e.target.value.slice(0, 600))} rows={2} className={inp} />
                <div className="mt-1 text-right text-[10.5px] text-faint">{(f.notFor || "").length}/600</div>
              </F>

              <F label={t("Starter questions (clickable chips in the trial chat)", "最初の質問（試用チャットのクリック可能なチップ）", "起手問題（試用對話中的可點擊選項）")}>
                {f.sampleQuestions.map((q: string, i: number) => (
                  <input key={i} value={q} onChange={(e) => { const a = [...f.sampleQuestions]; a[i] = e.target.value; setP("sampleQuestions", a); }} placeholder={`${t("Question", "質問", "問題")} ${i + 1}`} className={inp + " mb-2"} />
                ))}
                {f.sampleQuestions.length < 6 && <button onClick={() => setP("sampleQuestions", [...f.sampleQuestions, ""])} className="inline-flex items-center gap-1 text-[11px] text-violet transition hover:brightness-125"><IconPlus size={12} stroke={1.7} /> {t("Add", "追加", "新增")}</button>}
              </F>

              <F label={t("Topic tags (comma-separated, up to 8)", "トピックタグ（カンマ区切り、最大 8 個）", "主題標籤（以逗號分隔，最多 8 個）")}>
                <input value={f.tags} onChange={(e) => setP("tags", e.target.value)} placeholder="kyc, aml, cross-border" className={inp} />
                <TagChips value={f.tags} />
              </F>
            </div>

            <label className="flex items-center gap-2 text-[12px] text-muted"><input type="checkbox" checked={f.inPass} onChange={(e) => set("inPass", e.target.checked)} /> {t("Include in Pass", "パスに追加", "加入通行證")}</label>
            <div className="flex items-center gap-3">
              <button onClick={save} className="btn-glow rounded-xl border border-transparent px-4 py-2 text-[12.5px] font-semibold text-white shadow-glow transition hover:brightness-110 bg-purple">{t("Save Changes", "変更を保存", "儲存變更")}</button>
              {msg && <span className="text-[12px] text-green">{msg}</span>}
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 text-[11px] tracking-[0.12em] text-rust">// {t("Knowledge Update Pipeline", "ナレッジ更新パイプライン", "知識庫更新管線")}</div>
          <div className="rounded-xl border border-glassborder/20 bg-panel2/40 p-3 backdrop-blur-sm">
            <F label={t("Update note", "更新メモ", "更新說明")}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. Added this week's MiCA regulation amendments", "例：今週の MiCA 規制改正を追加", "例：新增本週 MiCA 法規修訂")} className={inp} /></F>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" value={kdoc} onChange={(e) => setKdoc(Number(e.target.value))} className={inp + " w-24"} />
              <span className="text-[11px] text-faint">{t("new knowledge chunks", "新規知識ブロック", "新增知識區塊")}</span>
              <button onClick={pushKnowledge} className="btn-glow ml-auto rounded-xl border border-transparent px-3 py-1.5 text-[12px] font-bold text-white shadow-glow transition hover:brightness-110 bg-purple">{t("Push Update", "更新をプッシュ", "推送更新")}</button>
            </div>
          </div>
          <div className="mt-4"><AssetUploader slug={agent.slug} /></div>
          <div className="mt-4 text-[11px] text-faint">{t("Version history (tamper-proof · audit-grade traceability)", "バージョン履歴（改竄不可・監査グレードの追跡性）", "版本歷史（不可竄改 · 稽核級溯源）")}</div>
          <div className="mt-2 space-y-2">
            {vers.map((v, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-glassborder/20 bg-panel2/40 px-3 py-2 text-[11.5px] backdrop-blur-sm">
                <span className="text-muted">{v.note}</span><span className="text-faint">{v.version} · {v.docCount} {t("files", "件", "檔")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
const inp = "w-full rounded-xl border border-glassborder/20 bg-panel2/50 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition focus:border-violet focus:shadow-glow";
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div><div className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-faint">{label}</div>{children}</div>; }
/** Live preview of the comma-separated tag input. */
function TagChips({ value }: { value: string }) {
  const tags = Array.from(new Set((value || "").split(",").map((x) => x.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))).slice(0, 8);
  if (!tags.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tg) => <span key={tg} className="rounded-full border border-border bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-muted">#{tg}</span>)}
    </div>
  );
}
