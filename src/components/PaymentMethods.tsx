"use client";
import { useEffect, useState } from "react";
import { IconCreditCard, IconTrash, IconPlus, IconCircleCheck, IconShieldLock } from "@tabler/icons-react";
import { useToast } from "./Toast";
import { useI18n } from "@/lib/i18n";
import { Btn } from "@/components/ui";

export type Card = { id: string; brand: string; last4: string; expMonth: number; expYear: number; holderName: string; isDefault: boolean };
const BRAND: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover", jcb: "JCB", card: "Card" };

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = async () => { const r = await fetch("/api/payment-methods"); const d = await r.json(); setCards(d.methods || []); setLoaded(true); };
  useEffect(() => { reload(); }, []);
  return { cards, loaded, reload };
}

export function AddCardForm({ onAdded, compact }: { onAdded?: (c: Card) => void; compact?: boolean }) {
  const { toast } = useToast(); const { t } = useI18n();
  const [number, setNumber] = useState(""); const [exp, setExp] = useState(""); const [cvc, setCvc] = useState(""); const [holder, setHolder] = useState("");
  const [busy, setBusy] = useState(false);
  const fmtNum = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const fmtExp = (v: string) => { const n = v.replace(/\D/g, "").slice(0, 4); return n.length >= 3 ? `${n.slice(0, 2)}/${n.slice(2)}` : n; };
  async function add() {
    setBusy(true);
    const r = await fetch("/api/payment-methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, exp, holderName: holder }) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) return toast(d.error || "Error", "error");
    setNumber(""); setExp(""); setCvc(""); setHolder("");
    toast(t("Card saved", "カードを保存", "已儲存卡片"), "success");
    onAdded?.(d.method);
  }
  const inp = "w-full rounded-lg hairline bg-panel/40 px-3 py-2 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-purple";
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div><div className="mb-1 text-[11px] text-faint">{t("Card number", "カード番号", "卡號")}</div>
        <input value={number} onChange={(e) => setNumber(fmtNum(e.target.value))} inputMode="numeric" placeholder="4242 4242 4242 4242" className={inp} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><div className="mb-1 text-[11px] text-faint">{t("Expiry", "有効期限", "到期")}</div>
          <input value={exp} onChange={(e) => setExp(fmtExp(e.target.value))} placeholder="MM/YY" className={inp} /></div>
        <div><div className="mb-1 text-[11px] text-faint">{t("CVC", "CVC", "安全碼")}</div>
          <input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" className={inp} /></div>
      </div>
      <div><div className="mb-1 text-[11px] text-faint">{t("Cardholder name", "カード名義", "持卡人姓名")}</div>
        <input value={holder} onChange={(e) => setHolder(e.target.value)} className={inp} /></div>
      <Btn onClick={add} disabled={busy} variant="primary" className="w-full disabled:opacity-50">{busy ? t("Saving…", "保存中…", "儲存中…") : t("Save card", "カードを保存", "儲存卡片")}</Btn>
      <div className="text-center text-[10.5px] text-faint">{t("We store only your card's brand and last 4 digits — never the full number or CVC.", "カードのブランドと下4桁のみ保存 — 完全な番号やCVCは保存しません。", "我們只儲存卡片品牌與末 4 碼——永不儲存完整卡號或安全碼。")}</div>
    </div>
  );
}

export default function PaymentMethods() {
  const { toast } = useToast(); const { t } = useI18n();
  const { cards, reload } = useCards();
  const [adding, setAdding] = useState(false);
  async function setDefault(id: string) { await fetch("/api/payment-methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "default", id }) }); reload(); }
  async function remove(id: string) { await fetch("/api/payment-methods", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); toast(t("Card removed", "カードを削除", "已移除卡片"), "success"); reload(); }
  return (
    <div className="glass-card p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><IconCreditCard size={18} className="text-purple" stroke={1.7} /><div className="font-display text-[14px] font-bold">{t("Payment methods", "支払い方法", "付款方式")}</div></div>
        <Btn onClick={() => setAdding((v) => !v)} variant="outline" size="sm"><IconPlus size={13} stroke={1.8} />{t("Add card", "カード追加", "新增卡片")}</Btn>
      </div>
      <div className="space-y-2">
        {cards.length === 0 && !adding && <div className="rounded-lg border border-dashed border-border py-6 text-center text-[12px] text-muted">{t("No saved cards yet.", "保存されたカードはありません。", "尚無已儲存的卡片。")}</div>}
        {cards.map((c) => (
          <div key={c.id} className="group relative flex items-center justify-between overflow-hidden rounded-xl border-grad glass-card px-4 py-3">
            <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-purple/5 blur-2xl" aria-hidden />
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-11 place-items-center rounded-md bg-panel3 text-muted"><IconCreditCard size={18} stroke={1.7} /></span>
              <div>
                <div className="font-display text-[13.5px] font-bold tracking-wide">{BRAND[c.brand] || "Card"} <span className="font-mono text-muted">•••• {c.last4}</span> {c.isDefault && <span className="ml-1 rounded-full border border-green/40 px-1.5 py-0.5 text-[9.5px] text-green">{t("Default", "デフォルト", "預設")}</span>}</div>
                <div className="font-mono text-[10.5px] text-faint">{c.holderName} · {String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}</div>
              </div>
            </div>
            <div className="relative flex items-center gap-2">
              {!c.isDefault && <button onClick={() => setDefault(c.id)} className="text-[11px] text-purple hover:text-violet">{t("Set default", "デフォルトに", "設為預設")}</button>}
              <button onClick={() => remove(c.id)} className="text-muted transition-colors hover:text-rust"><IconTrash size={15} stroke={1.7} /></button>
            </div>
          </div>
        ))}
      </div>
      {adding && <div className="mt-4 border-t border-border pt-4"><AddCardForm onAdded={() => { setAdding(false); reload(); }} /></div>}
      <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[10.5px] leading-5 text-faint">
        <IconShieldLock size={13} stroke={1.8} className="mt-0.5 shrink-0 text-violet" />
        <span>{t("Saved cards store only the brand and last 4 digits — never the full number. Payments of $100 or more require verification.", "保存されるのはブランドと下4桁のみ — 完全な番号は保存しません。100ドル以上の支払いには本人確認が必要です。", "已儲存的卡片只保留品牌與末 4 碼——永不儲存完整卡號。滿 $100 的付款需經驗證。")}</span>
      </div>
    </div>
  );
}
