"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Composer from "@/components/Composer";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import {
  IconArrowLeft, IconPhoto, IconX, IconLoader2, IconDeviceFloppy, IconAlertTriangle,
  IconRosetteDiscountCheck, IconId, IconLink, IconPlus, IconMapPin, IconLock, IconUser,
} from "@tabler/icons-react";

/** Mirrors the server: LIMITS in /api/creator/profile. Kept in sync by hand — the server wins. */
const LIMITS = { displayName: 60, headline: 90, bio: 200, about: 6000, howIWork: 1500, location: 60, verticalLabel: 40, linkLabel: 40, linkUrl: 300 };
const MAX_LINKS = 6;

type LinkRow = { label: string; url: string };
type Profile = {
  displayName: string; bio: string; headline: string; about: string; howIWork: string;
  location: string; verticalLabel: string; coverMediaId: string | null; avatarMediaId: string | null;
  links: LinkRow[]; verified: boolean; identityVerified: boolean; verificationStatus: string;
};

/** The same rule the server applies, so the form can be honest before it asks. */
function linkError(url: string): "empty" | "scheme" | "long" | null {
  const v = url.trim();
  if (!v) return "empty";
  if (!/^https?:\/\//i.test(v)) return "scheme";
  if (v.length >= LIMITS.linkUrl) return "long";
  return null;
}

export default function ProfileClient({ userId, profile }: { userId: string; profile: Profile }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [headline, setHeadline] = useState(profile.headline);
  const [bio, setBio] = useState(profile.bio);
  const [about, setAbout] = useState(profile.about);
  const [howIWork, setHowIWork] = useState(profile.howIWork);
  const [location, setLocation] = useState(profile.location);
  const [verticalLabel, setVerticalLabel] = useState(profile.verticalLabel);
  const [links, setLinks] = useState<LinkRow[]>(profile.links.slice(0, MAX_LINKS));
  const [cover, setCover] = useState<string | null>(profile.coverMediaId);
  const [avatar, setAvatar] = useState<string | null>(profile.avatarMediaId);

  const [uploading, setUploading] = useState<"" | "cover" | "avatar">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [refusal, setRefusal] = useState("");

  const coverRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const linkErrors = useMemo(() => links.map((l) => linkError(l.url)), [links]);
  const badLinks = linkErrors.some((e) => e !== null);
  const tooLong =
    displayName.trim().length < 2 ||
    headline.length > LIMITS.headline || bio.length > LIMITS.bio || about.length > LIMITS.about ||
    howIWork.length > LIMITS.howIWork || location.length > LIMITS.location || verticalLabel.length > LIMITS.verticalLabel;

  async function upload(file: File, which: "cover" | "avatar") {
    setErr(""); setUploading(which);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("alt", which === "cover" ? displayName : `${displayName} portrait`);
    const r = await fetch("/api/media", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setUploading("");
    if (!r.ok) { setErr(d.error || t("Upload failed.", "アップロードに失敗しました。", "上傳失敗。")); return; }
    if (which === "cover") setCover(d.id); else setAvatar(d.id);
  }

  async function save() {
    setErr(""); setRefusal("");
    if (displayName.trim().length < 2) {
      setErr(t("Your name needs at least 2 characters.", "名前は2文字以上必要です。", "名稱至少需要 2 個字元。"));
      return;
    }
    if (badLinks) {
      setErr(t("Fix the links below first.", "先に下のリンクを修正してください。", "請先修正下方的連結。"));
      return;
    }
    setSaving(true);
    const r = await fetch("/api/creator/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim(), headline, bio, about, howIWork, location, verticalLabel,
        links: links.filter((l) => linkError(l.url) === null).map((l) => ({ label: l.label.slice(0, LIMITS.linkLabel), url: l.url.trim() })),
        coverMediaId: cover, avatarMediaId: avatar,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.status === 422) {
      // The extraction guard refused. Show exactly what it said — no paraphrase.
      setRefusal(String(d.error || ""));
      return;
    }
    if (!r.ok) {
      setErr(d.error || t("Could not save.", "保存できませんでした。", "無法儲存。"));
      return;
    }
    toast(t("Saved. This is what buyers see.", "保存しました。これが購入者に見える内容です。", "已儲存。這就是買家會看到的內容。"), "success");
    router.refresh();
  }

  return (
    <div className="animate-fadein">
      <Link href="/studio" className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-text">
        <IconArrowLeft size={14} stroke={1.7} /> {t("Studio", "スタジオ", "工作室")}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-[28px] font-extrabold tracking-tight">
            <span className="text-grad">{t("Your introduction", "あなたの紹介", "你的自我介紹")}</span>
          </h1>
          <p className="mt-1 text-[12.5px] leading-6 text-muted">
            {t(
              "This is how buyers meet you. They are not buying a prompt — they are deciding whether to trust your judgement, and this page is most of what they have to go on. Write it in your own words. Plain is better than impressive.",
              "ここが購入者との出会いの場です。彼らが買うのはプロンプトではなく、あなたの判断を信頼するかどうかを決めています。このページがその判断材料のほとんどです。自分の言葉で、飾らずに書いてください。",
              "這是買家認識你的地方。他們買的不是一段提示詞，而是在決定要不要信任你的判斷，而這一頁就是他們幾乎唯一的依據。用你自己的話寫，樸實勝過華麗。",
            )}
          </p>
        </div>
        <a href={`/creator/${userId}`} className="shrink-0 rounded-xl border border-border bg-panel2 px-3.5 py-2 text-[12.5px] text-muted transition-colors hover:text-text">
          {t("View public page", "公開ページを見る", "查看公開頁面")} →
        </a>
      </div>

      {refusal && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-rust/40 bg-rust/5 p-4">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-rust" stroke={1.7} />
          <div>
            <div className="text-[12px] font-semibold text-rust">{t("Not saved", "保存されていません", "尚未儲存")}</div>
            <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-6 text-text">{refusal}</p>
          </div>
        </div>
      )}
      {err && (
        <div className="mt-5 rounded-xl border border-rust/40 bg-rust/5 px-4 py-3 text-[12.5px] text-rust">{err}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ------------------------------- Editor ------------------------------- */}
        <div className="space-y-5">
          {/* Images */}
          <Card
            title={t("Cover and portrait", "カバーと顔写真", "封面與照片")}
            note={t(
              "A real photograph beats a coloured square. People are deciding whether to trust a person.",
              "色付きの四角より本物の写真です。人は「人」を信頼するかどうかを判断しています。",
              "真實照片勝過一個色塊。人們是在判斷要不要信任一個人。",
            )}
          >
            <div className="relative overflow-hidden rounded-xl border border-border bg-panel2">
              <div className="relative h-32 w-full sm:h-40">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${cover}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11.5px] text-faint">
                    {t("No cover image", "カバー画像なし", "尚未設定封面")}
                  </div>
                )}
                <div className="absolute right-2 top-2 flex gap-1.5">
                  <button type="button" onClick={() => coverRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel/90 px-2.5 py-1 text-[11.5px] text-muted backdrop-blur-sm transition-colors hover:text-text">
                    {uploading === "cover" ? <IconLoader2 size={13} className="animate-spin" /> : <IconPhoto size={13} stroke={1.7} />}
                    {cover ? t("Replace", "差し替え", "更換") : t("Upload cover", "カバーを追加", "上傳封面")}
                  </button>
                  {cover && (
                    <button type="button" onClick={() => setCover(null)} aria-label={t("Remove cover", "カバーを削除", "移除封面")}
                      className="rounded-lg border border-border bg-panel/90 p-1.5 text-muted backdrop-blur-sm transition-colors hover:text-rust">
                      <IconX size={13} stroke={1.7} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-panel2">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${avatar}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-faint"><IconUser size={22} stroke={1.5} /></div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => avatarRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-[11.5px] text-muted transition-colors hover:text-text">
                  {uploading === "avatar" ? <IconLoader2 size={13} className="animate-spin" /> : <IconPhoto size={13} stroke={1.7} />}
                  {avatar ? t("Replace portrait", "顔写真を差し替え", "更換照片") : t("Upload portrait", "顔写真を追加", "上傳照片")}
                </button>
                {avatar && (
                  <button type="button" onClick={() => setAvatar(null)}
                    className="rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-[11.5px] text-muted transition-colors hover:text-rust">
                    {t("Remove", "削除", "移除")}
                  </button>
                )}
              </div>
            </div>

            <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "cover"); e.target.value = ""; }} />
            <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "avatar"); e.target.value = ""; }} />
          </Card>

          {/* Identity */}
          <Card title={t("Who you are", "あなたは誰か", "你是誰")}>
            <Field label={t("Name", "名前", "名稱")} value={displayName} max={LIMITS.displayName} onChange={setDisplayName}
              placeholder={t("The name buyers will see", "購入者に表示される名前", "買家會看到的名稱")} />

            <Field
              label={t("Headline", "ヘッドライン", "一句標題")}
              value={headline} max={LIMITS.headline} onChange={setHeadline}
              placeholder={t("20 years in EU privacy law", "EUプライバシー法務20年", "20 年歐盟隱私法經驗")}
              help={t(
                "The hook. One line of fact, not a slogan — what you have actually done, for how long.",
                "フックです。スローガンではなく事実を1行で——何を、どれだけの期間やってきたか。",
                "這是鉤子。一行事實，不是口號——你實際做過什麼、做了多久。",
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Field", "分野", "領域")} value={verticalLabel} max={LIMITS.verticalLabel} onChange={setVerticalLabel}
                placeholder={t("Privacy & data protection", "プライバシー・データ保護", "隱私與資料保護")} />
              <Field label={t("Location", "所在地", "所在地")} value={location} max={LIMITS.location} onChange={setLocation}
                placeholder={t("Berlin, Germany", "ドイツ・ベルリン", "德國柏林")} icon={<IconMapPin size={13} stroke={1.7} />} />
            </div>

            <Field
              label={t("Short bio", "短い自己紹介", "簡短介紹")}
              value={bio} max={LIMITS.bio} onChange={setBio} rows={3}
              placeholder={t("Two sentences that appear on cards and search results.", "カードや検索結果に表示される2文。", "會出現在卡片與搜尋結果的兩句話。")}
              help={t(
                "This is what shows on your cards across the site. Keep it factual — it is often the only thing read.",
                "サイト全体のカードに表示される文章です。事実に徹してください——これしか読まれないことも多いです。",
                "這會顯示在全站的卡片上。請保持事實——很多時候人們只會看這一段。",
              )}
            />
          </Card>

          {/* About */}
          <Card
            title={t("About you", "あなたについて", "關於你")}
            note={t(
              "Long-form. Markdown and images are allowed. Where you trained, what you argue with the consensus about, the work you are known for.",
              "長文で。Markdownと画像が使えます。どこで学び、通説のどこに異を唱え、何で知られているか。",
              "長篇。可用 Markdown 與圖片。你在哪裡受訓、你在哪些地方不同意主流、你因什麼而為人所知。",
            )}
          >
            <Composer
              value={about}
              onChange={setAbout}
              max={LIMITS.about}
              minRows={10}
              placeholder={t(
                "I spent twelve years advising banks on cross-border transfers. I think most DPIA templates are theatre, and I will tell you why...",
                "12年間、銀行の越境データ移転を助言してきました。多くのDPIAテンプレートは形式主義だと考えています。その理由は……",
                "我花了十二年為銀行提供跨境傳輸的建議。我認為多數 DPIA 範本只是做做樣子，理由如下……",
              )}
              hint={t(
                "Write for one person who is deciding whether you are worth their money.",
                "あなたにお金を払う価値があるか判断している一人の人に向けて書いてください。",
                "把它寫給一個正在決定你是否值得付錢的人。",
              )}
            />
          </Card>

          {/* How I work */}
          <Card
            title={t("How I work", "私の進め方", "我怎麼工作")}
            note={t(
              "What a buyer actually gets: how you answer, what you refuse, how fast, and where your Agent stops and you start.",
              "購入者が実際に得るもの：どう答えるか、何を断るか、どのくらいの速さか、エージェントが止まりあなたが引き継ぐ境界はどこか。",
              "買家實際會得到什麼：你怎麼回答、你拒絕什麼、多快回覆，以及 Agent 停在哪裡、由你接手。",
            )}
          >
            <Field label="" value={howIWork} max={LIMITS.howIWork} onChange={setHowIWork} rows={7}
              placeholder={t(
                "My Agent answers with my actual positions, including the unpopular ones. It will refuse to guess about anything jurisdiction-specific it has not been given. Escalate and I answer personally, usually within two working days.",
                "私のエージェントは、不人気な見解も含め、私の実際の立場で答えます。与えられていない管轄固有の事項について推測は拒否します。エスカレーションすれば通常2営業日以内に私が直接回答します。",
                "我的 Agent 會以我真實的立場回答，包括不受歡迎的那些。對於未提供的特定司法管轄問題，它會拒絕臆測。升級後由我親自回覆，通常在兩個工作天內。",
              )}
            />
          </Card>

          {/* Links */}
          <Card
            title={t("Links", "リンク", "連結")}
            note={t(
              `Up to ${MAX_LINKS}. Only http:// or https:// addresses — a profile is not a redirect service.`,
              `最大${MAX_LINKS}件。http:// または https:// のみ——プロフィールはリダイレクトサービスではありません。`,
              `最多 ${MAX_LINKS} 個。僅接受 http:// 或 https:// ——個人檔案不是轉址服務。`,
            )}
          >
            <div className="space-y-2">
              {links.map((l, i) => {
                const e = linkErrors[i];
                return (
                  <div key={i}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={l.label}
                        maxLength={LIMITS.linkLabel}
                        onChange={(ev) => setLinks(links.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))}
                        placeholder={t("Label", "ラベル", "標籤")}
                        className="w-32 rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-faint focus:border-borderlight"
                      />
                      <input
                        value={l.url}
                        onChange={(ev) => setLinks(links.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))}
                        placeholder="https://"
                        className={`min-w-0 flex-1 rounded-lg border bg-panel2 px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-faint ${e ? "border-rust/50" : "border-border focus:border-borderlight"}`}
                      />
                      <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))}
                        aria-label={t("Remove link", "リンクを削除", "移除連結")}
                        className="rounded-lg border border-border bg-panel2 p-1.5 text-muted transition-colors hover:text-rust">
                        <IconX size={13} stroke={1.7} />
                      </button>
                    </div>
                    {e && (
                      <p className="mt-1 text-[11px] text-rust">
                        {e === "empty"
                          ? t("Enter an address or remove the row.", "アドレスを入力するか、行を削除してください。", "請輸入網址，或移除這一列。")
                          : e === "scheme"
                            ? t("Must start with http:// or https:// — this is exactly what the server checks, so it would be dropped silently otherwise.", "http:// または https:// で始まる必要があります。サーバーも同じ検証を行い、そうでなければ黙って破棄されます。", "必須以 http:// 或 https:// 開頭——伺服器也是這樣檢查的，否則會被靜默丟棄。")
                            : t("That address is too long.", "アドレスが長すぎます。", "這個網址太長了。")}
                      </p>
                    )}
                  </div>
                );
              })}
              {links.length < MAX_LINKS && (
                <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:text-text">
                  <IconPlus size={13} stroke={1.7} /> {t("Add link", "リンクを追加", "新增連結")}
                </button>
              )}
            </div>
          </Card>

          {/* Verification — read-only, by design */}
          <div className="rounded-xl border border-border bg-panel2 p-5">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint">
              <IconLock size={13} stroke={1.7} /> {t("Verification", "認証", "驗證")}
            </div>
            <div className="flex flex-wrap gap-2">
              <ReadOnlyPill on={profile.verified} icon={<IconRosetteDiscountCheck size={13} stroke={1.7} />}
                label={t("Verified expert", "認証済みエキスパート", "已驗證專家")} />
              <ReadOnlyPill on={profile.identityVerified} icon={<IconId size={13} stroke={1.7} />}
                label={t("Identity verified", "本人確認済み", "身分已驗證")} />
            </div>
            <p className="mt-3 text-[11.5px] leading-5 text-faint">
              {t(
                "These are granted by review, never self-asserted — you cannot edit them here, and the form does not send them.",
                "これらは審査によって付与されるもので、自己申告はできません。ここでは編集できず、フォームからも送信されません。",
                "這些標記由審核授予，不能自我宣稱——你無法在這裡編輯，表單也不會送出它們。",
              )}{" "}
              <Link href="/studio/verification" className="text-muted underline decoration-border underline-offset-2 transition-colors hover:text-text">
                {t("Apply or check status", "申請・状況確認", "申請或查看狀態")}
              </Link>
            </p>
          </div>

          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel/90 px-4 py-3 backdrop-blur-md">
            <span className="text-[11.5px] text-faint">
              {t("Nothing is published until you save.", "保存するまで何も公開されません。", "在你儲存之前不會有任何變更。")}
            </span>
            <button type="button" onClick={save} disabled={saving || tooLong || badLinks || !!uploading}
              className="btn-glow inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-purple px-4 py-2 text-[13px] font-bold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} stroke={1.7} />}
              {t("Save introduction", "紹介を保存", "儲存介紹")}
            </button>
          </div>
        </div>

        {/* ---------------------------- Live preview ---------------------------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint">
            <span className="inline-block h-px w-6 bg-border" />
            {t("Roughly what buyers see", "購入者に見える見た目（おおよそ）", "買家大致會看到的樣子")}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-panel">
            <div className="relative h-28 w-full bg-panel3">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${cover}`} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-panel2 to-panel3" />
              )}
            </div>

            <div className="px-5 pb-5">
              <div className="-mt-8 mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-panel bg-panel2">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${avatar}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-faint"><IconUser size={22} stroke={1.5} /></div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[18px] font-bold tracking-tight text-text">
                  {displayName.trim() || t("Your name", "あなたの名前", "你的名稱")}
                </span>
                {profile.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple/40 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-purple">
                    <IconRosetteDiscountCheck size={12} stroke={1.8} /> {t("Verified expert", "認証済み", "已驗證專家")}
                  </span>
                )}
                {profile.identityVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none text-muted">
                    <IconId size={12} stroke={1.8} /> {t("Identity verified", "本人確認済み", "身分已驗證")}
                  </span>
                )}
              </div>

              <p className="mt-1.5 text-[13px] leading-6 text-text">
                {headline.trim() || (
                  <span className="text-faint">
                    {t("Your headline appears here — one line of fact.", "ここにヘッドラインが表示されます——事実を1行で。", "你的標題會顯示在這裡——一行事實。")}
                  </span>
                )}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                {verticalLabel.trim() && (
                  <span className="rounded-full border border-border/70 bg-panel2 px-2 py-0.5 text-[10.5px] leading-none">{verticalLabel.trim()}</span>
                )}
                {location.trim() && (
                  <span className="inline-flex items-center gap-1"><IconMapPin size={12} stroke={1.7} /> {location.trim()}</span>
                )}
              </div>

              {bio.trim() && <p className="mt-3 text-[12.5px] leading-6 text-muted">{bio.trim()}</p>}

              {links.filter((l) => linkError(l.url) === null).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {links.filter((l) => linkError(l.url) === null).map((l, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel2 px-2 py-1 text-[11.5px] text-muted">
                      <IconLink size={12} stroke={1.7} />
                      {l.label.trim() || l.url.replace(/^https?:\/\//i, "").split("/")[0]}
                    </span>
                  ))}
                </div>
              )}

              {howIWork.trim() && (
                <div className="mt-4 rounded-lg border border-border bg-panel2 p-3">
                  <div className="text-[10.5px] uppercase tracking-[0.14em] text-faint">{t("How I work", "私の進め方", "我怎麼工作")}</div>
                  <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-[12px] leading-5 text-muted">{howIWork.trim()}</p>
                </div>
              )}
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-faint">
            {t(
              "An approximation of the storefront header, not a pixel-exact copy. Your long-form About and your Agents appear below it on the real page.",
              "実際のヘッダーの近似であり、ピクセル単位で同じではありません。実際のページでは、この下に長文の「あなたについて」とエージェントが並びます。",
              "這是店面標頭的近似，不是像素級的複製。在實際頁面上，長篇「關於你」與你的 Agent 會顯示在下方。",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- bits ---------------------------------- */

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="font-display text-[14px] font-bold tracking-tight text-text">{title}</div>
      {note && <p className="mt-1 text-[11.5px] leading-5 text-faint">{note}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, max, placeholder, help, rows, icon,
}: {
  label: string; value: string; onChange: (v: string) => void; max: number;
  placeholder?: string; help?: string; rows?: number; icon?: React.ReactNode;
}) {
  const over = value.length > max;
  const near = !over && value.length > max * 0.85;
  return (
    <div>
      {(label || max) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted">{icon}{label}</label>
          <span className={`text-[10.5px] ${over ? "text-rust" : near ? "text-amber" : "text-faint"}`}>{value.length} / {max}</span>
        </div>
      )}
      {rows ? (
        <textarea
          value={value} rows={rows} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full resize-y rounded-lg border bg-panel2 px-3 py-2 text-[13px] leading-6 outline-none placeholder:text-faint ${over ? "border-rust/50" : "border-border focus:border-borderlight"}`}
        />
      ) : (
        <input
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full rounded-lg border bg-panel2 px-3 py-2 text-[13px] outline-none placeholder:text-faint ${over ? "border-rust/50" : "border-border focus:border-borderlight"}`}
        />
      )}
      {help && <p className="mt-1.5 text-[11px] leading-5 text-faint">{help}</p>}
    </div>
  );
}

function ReadOnlyPill({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-none ${on ? "border-purple/40 bg-panel/40 text-purple" : "border-border/70 bg-panel/40 text-faint line-through decoration-border"}`}>
      {icon} {label}
    </span>
  );
}
