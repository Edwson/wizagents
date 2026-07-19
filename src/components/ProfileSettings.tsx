"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconUser, IconCamera, IconTrash, IconAlertTriangle, IconLoader2,
  IconMail, IconShieldLock, IconExternalLink, IconInfoCircle,
} from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "./Toast";
import { Btn, SectionLabel, Reveal } from "@/components/ui";
import Avatar from "./Avatar";

type Profile = {
  name: string;
  email: string;
  role: string;
  avatarColor: string | null;
  avatarMediaId: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  orgName: string | null;
  emailVerified: boolean;
};

const BIO_MAX = 200;
const MAX_BYTES = 5 * 1024 * 1024;

/** A small, deliberate palette. The picker below it can produce any hex the API accepts. */
const SWATCHES = ["#8b6dff", "#6d8bff", "#38bdf8", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#64748b"];

export default function ProfileSettings({ role }: { role: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [p, setP] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [orgName, setOrgName] = useState("");
  const [color, setColor] = useState("#8b6dff");
  const [mediaId, setMediaId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [refusal, setRefusal] = useState("");

  const isOrg = role === "enterprise" || role === "admin";
  const isCreator = role === "creator";

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/account/profile");
        const d = await r.json();
        if (d.ok && d.profile) {
          const q: Profile = d.profile;
          setP(q);
          setName(q.name || "");
          setBio(q.bio || "");
          setLocation(q.location || "");
          setWebsite(q.website || "");
          setOrgName(q.orgName || "");
          setColor(q.avatarColor || "#8b6dff");
          setMediaId(q.avatarMediaId || null);
        }
      } catch {
        /* the form simply stays in its loading state */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function pickPhoto(file: File) {
    setErr(""); setRefusal("");
    if (file.size > MAX_BYTES) {
      setErr(t("That image is over 5 MB. Pick a smaller one.", "画像が5MBを超えています。より小さいものを選んでください。", "圖片超過 5 MB，請選擇較小的檔案。"));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/media", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.id) {
        setErr(String(d.error || t("Could not upload that image.", "画像をアップロードできませんでした。", "無法上傳這張圖片。")));
        return;
      }
      setMediaId(String(d.id));
      toast(t("Photo uploaded — press Save to keep it.", "画像をアップロードしました。保存すると反映されます。", "圖片已上傳，按「儲存」後才會生效。"), "success");
    } catch {
      setErr(t("Network error. Try again.", "通信エラー。再試行してください。", "連線錯誤，請再試一次。"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setBusy(true); setErr(""); setRefusal("");
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        avatarColor: color,
        avatarMediaId: mediaId,
      };
      if (isOrg) body.orgName = orgName.trim();

      const r = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // The extraction refusal and the ownership refusal explain themselves. Show them
        // word for word — a boundary that gets paraphrased stops being believed.
        if (d.code === "extraction") setRefusal(String(d.error || ""));
        else setErr(String(d.error || t("Could not save your profile.", "プロフィールを保存できませんでした。", "無法儲存個人資料。")));
        return;
      }
      toast(t("Profile saved.", "プロフィールを保存しました。", "已儲存個人資料。"), "success");
      router.refresh();
    } catch {
      setErr(t("Network error. Try again.", "通信エラー。再試行してください。", "連線錯誤，請再試一次。"));
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = ({
    buyer: t("Buyer", "購入者", "買家"),
    creator: t("Creator", "クリエイター", "創作者"),
    enterprise: t("Enterprise", "エンタープライズ", "企業"),
    admin: t("Admin", "管理者", "管理員"),
  } as Record<string, string>)[p?.role || role] || (p?.role || role);

  return (
    <Reveal className="space-y-4">
      <SectionLabel>{t("Profile", "プロフィール", "個人資料")}</SectionLabel>

      <div className="glass-card p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconUser size={18} stroke={1.7} className="text-purple" />
          <div className="font-display text-[14px] font-bold">{t("Your profile", "あなたのプロフィール", "你的個人資料")}</div>
        </div>
        <p className="mb-5 text-[11.5px] leading-6 text-muted">
          {t(
            "This is what other people see next to your name in the community.",
            "コミュニティであなたの名前の横に表示される内容です。",
            "這是別人在社群中你的名字旁邊會看到的內容。",
          )}
        </p>

        {!loaded ? (
          <div className="rounded-lg border border-dashed border-border/60 py-8 text-center text-[11.5px] text-faint">
            {t("Loading…", "読み込み中…", "載入中…")}
          </div>
        ) : (
          <div className="space-y-5">
            {/* ---------- avatar ---------- */}
            <div className="flex flex-wrap items-start gap-5">
              <Avatar name={name || p?.name || "?"} color={color} mediaId={mediaId} size={72} />
              <div className="min-w-[220px] flex-1">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{t("Photo", "写真", "相片")}</div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }}
                  />
                  <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconCamera size={14} stroke={1.7} />}
                    {mediaId
                      ? t("Replace photo", "写真を差し替える", "更換相片")
                      : t("Upload a photo", "写真をアップロード", "上傳相片")}
                  </Btn>
                  {mediaId && (
                    <Btn variant="ghost" size="sm" onClick={() => setMediaId(null)} disabled={uploading}>
                      <IconTrash size={14} stroke={1.7} />
                      {t("Remove photo", "写真を削除", "移除相片")}
                    </Btn>
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-5 text-faint">
                  {t(
                    "PNG, JPEG, WebP or GIF, up to 5 MB.",
                    "PNG・JPEG・WebP・GIF、5MBまで。",
                    "PNG、JPEG、WebP 或 GIF，最大 5 MB。",
                  )}
                </p>
              </div>
            </div>

            {/* ---------- fallback colour ---------- */}
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">
                {t("Fallback colour", "フォールバックの色", "後備顏色")}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={c}
                    aria-pressed={color.toLowerCase() === c}
                    style={{ backgroundColor: c }}
                    className={`h-7 w-7 rounded-full border-2 transition ${color.toLowerCase() === c ? "border-text" : "border-transparent hover:border-border"}`}
                  />
                ))}
                <label className="ml-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel2/50 px-2.5 py-1.5 text-[11.5px] text-muted hover:border-borderlight">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#8b6dff"}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                  />
                  {t("Custom", "カスタム", "自訂")}
                </label>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-faint">
                {t(
                  "The colour is only what people see when you have no photo. If you upload one, the photo is shown instead.",
                  "この色は、写真がないときにだけ表示されます。写真をアップロードすると写真が優先されます。",
                  "只有在你沒有相片時，別人才會看到這個顏色；上傳相片後就會顯示相片。",
                )}
              </p>
            </div>

            {/* ---------- fields ---------- */}
            <Field label={t("Name", "名前", "名稱")} value={name} onChange={setName} placeholder={t("Your name", "あなたの名前", "你的名字")} />

            {isOrg && (
              <Field
                label={t("Organisation", "組織名", "組織名稱")}
                value={orgName}
                onChange={setOrgName}
                placeholder={t("The company you represent", "所属する会社", "你代表的公司")}
              />
            )}

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-[0.1em] text-faint">{t("Bio", "自己紹介", "簡介")}</span>
                <span className={`text-[10.5px] tabular-nums ${bio.length > BIO_MAX ? "text-rust" : "text-faint"}`}>{bio.length}/{BIO_MAX}</span>
              </div>
              <textarea
                value={bio}
                maxLength={BIO_MAX}
                rows={3}
                onChange={(e) => { setBio(e.target.value); if (refusal) setRefusal(""); }}
                className="w-full resize-y rounded-xl border border-border bg-panel2/50 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-purple"
              />
              <p className="mt-1.5 text-[11px] leading-5 text-faint">
                {t(
                  "Shown next to your posts in the community.",
                  "コミュニティであなたの投稿の横に表示されます。",
                  "會顯示在你於社群的貼文旁邊。",
                )}
              </p>
            </div>

            <Field
              label={t("Location", "所在地", "所在地")}
              value={location}
              onChange={setLocation}
              placeholder={t("Tokyo, Japan", "東京", "台北")}
            />
            <Field
              label={t("Website", "ウェブサイト", "網站")}
              value={website}
              onChange={setWebsite}
              placeholder="https://"
              hint={t(
                "Has to start with http:// or https://.",
                "http:// または https:// で始まる必要があります。",
                "必須以 http:// 或 https:// 開頭。",
              )}
            />

            {refusal && (
              <div className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/5 px-4 py-3 text-[12.5px] leading-relaxed text-amber">
                <IconAlertTriangle size={15} stroke={1.8} className="mt-0.5 shrink-0" />
                <span>{refusal}</span>
              </div>
            )}
            {err && (
              <div className="flex items-start gap-2 rounded-xl border border-rust/40 bg-rust/5 px-4 py-3 text-[12.5px] text-rust">
                <IconAlertTriangle size={15} stroke={1.8} className="mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <Btn onClick={save} disabled={busy || uploading || name.trim().length < 2}>
              {busy && <IconLoader2 size={14} className="animate-spin" />}
              {busy ? t("Saving…", "保存中…", "儲存中…") : t("Save profile", "プロフィールを保存", "儲存個人資料")}
            </Btn>
          </div>
        )}
      </div>

      {/* ---------- what this form does not change ---------- */}
      <div className="glass-card p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconShieldLock size={18} stroke={1.7} className="text-purple" />
          <div className="font-display text-[14px] font-bold">
            {t("What this form doesn't change", "このフォームでは変更できないもの", "這份表單不會變更的項目")}
          </div>
        </div>
        <p className="mb-4 text-[11.5px] leading-6 text-muted">
          {t(
            "Some things decide who you are, not how you look. They are not editable here.",
            "「見た目」ではなく「あなたが誰か」を決める項目は、ここでは編集できません。",
            "有些欄位決定的是「你是誰」，而不是「你看起來如何」，因此不能在這裡編輯。",
          )}
        </p>

        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-panel2/40 px-3.5 py-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">
              <IconMail size={13} stroke={1.7} />
              {t("Email", "メールアドレス", "電子郵件")}
            </div>
            <div className="text-[13px] text-text">{p?.email || "—"}</div>
            <p className="mt-1.5 text-[11px] leading-5 text-faint">
              {t(
                "Changing your email is a security-sensitive action and is handled separately — not from this form.",
                "メールアドレスの変更はセキュリティに関わる操作のため、このフォームではなく別途対応します。",
                "變更電子郵件屬於資安敏感操作，會另行處理，不在這份表單中進行。",
              )}
            </p>
            {loaded && p && !p.emailVerified && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-muted">
                <IconInfoCircle size={13} stroke={1.7} className="mt-0.5 shrink-0 text-faint" />
                {t("This address isn't verified yet.", "このアドレスはまだ確認されていません。", "這個地址尚未驗證。")}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-panel2/40 px-3.5 py-3">
            <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-faint">{t("Role", "ロール", "角色")}</div>
            <div className="text-[13px] text-text">{roleLabel}</div>
          </div>
        </div>
      </div>

      {isCreator && (
        <p className="flex flex-wrap items-center gap-1.5 px-1 text-[11.5px] leading-6 text-faint">
          {t(
            "Your public storefront introduction — cover, headline and About — is edited in the studio, and a photo you set there is shown instead of this one.",
            "公開ストアフロントの紹介（カバー・見出し・About）はスタジオで編集します。そこで設定した写真がこちらより優先して表示されます。",
            "你的公開店面介紹（封面、標題、關於）在工作室編輯；在那裡設定的相片會優先於這一張顯示。",
          )}
          <Link href="/studio/profile" className="inline-flex items-center gap-1 text-muted underline decoration-border underline-offset-2 hover:text-text">
            {t("Storefront profile", "ストアフロントのプロフィール", "店面個人資料")}
            <IconExternalLink size={12} stroke={1.7} />
          </Link>
        </p>
      )}
    </Reveal>
  );
}

function Field({
  label, value, onChange, placeholder, hint,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-panel2/50 px-3 py-2.5 text-[13px] text-text outline-none transition placeholder:text-faint focus:border-purple"
      />
      {hint && <p className="mt-1.5 text-[11px] leading-5 text-faint">{hint}</p>}
    </div>
  );
}
