"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Composer from "@/components/Composer";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import {
  IconPhoto, IconX, IconLoader2, IconArrowLeft, IconAlertTriangle, IconDeviceFloppy, IconWorld, IconBook,
} from "@tabler/icons-react";

const KINDS: [string, string, string, string][] = [
  ["article", "Article", "記事", "文章"],
  ["guide", "Guide", "使い方ガイド", "使用指南"],
  ["case", "Case study", "ケーススタディ", "案例"],
  ["discussion", "Discussion", "ディスカッション", "討論"],
  ["question", "Question", "質問", "提問"],
];
const KIND_HELP: Record<string, [string, string, string]> = {
  article: ["A piece you wrote to be read on its own — an argument, an explanation, a method.", "単独で読まれることを想定した文章。主張・解説・手法など。", "可以獨立閱讀的文章——論點、解說或方法。"],
  guide: ["Teach buyers how to get more out of one of your Agents. It has to name the Agent it teaches.", "あなたのエージェントをもっと活かすための使い方を読者に教えます。対象のエージェントを必ず指定します。", "教買家如何更好地使用你的某個 Agent。必須指定它所教的 Agent。"],
  case: ["A real situation, what you did, and what happened. Names removed as needed.", "実際の状況、行ったこと、結果。必要に応じて固有名は伏せます。", "真實情境、你做了什麼、結果如何。必要時隱去名稱。"],
  discussion: ["Something you want other people to argue with you about.", "他の人と議論したいこと。", "你想讓其他人與你討論的事。"],
  question: ["Something you genuinely do not know, asked in public.", "本当に分からないことを公の場で尋ねます。", "你真的不知道的事，公開提問。"],
};

type Post = {
  slug: string; title: string; kind: string; body: string; tags: string[];
  coverMediaId: string | null; status: string; agentSlug: string | null; agentName: string | null;
};

export default function NewArticleClient({
  post, agents, limits, initialKind, initialAgentSlug,
}: {
  post: Post | null;
  agents: { slug: string; name: string }[];
  limits: { body: number; title: number; tags: number };
  /** Preselected from the query string (e.g. an Agent page inviting a guide). */
  initialKind?: string;
  initialAgentSlug?: string;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const editing = !!post;

  const [title, setTitle] = useState(post?.title || "");
  const [kind, setKind] = useState(post?.kind || initialKind || "article");
  const [body, setBody] = useState(post?.body || "");
  const [tags, setTags] = useState<string[]>(post?.tags || []);
  const [tagDraft, setTagDraft] = useState("");
  const [cover, setCover] = useState<string | null>(post?.coverMediaId || null);
  const [agentSlug, setAgentSlug] = useState(post?.agentSlug || initialAgentSlug || "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [refusal, setRefusal] = useState("");
  const coverRef = useRef<HTMLInputElement>(null);

  const kindHelp = KIND_HELP[kind] || KIND_HELP.article;
  // A guide is "how to get more out of THIS Agent" — the server refuses one without an
  // Agent (code: guide_needs_agent) only when it is being published. A guide can be
  // drafted with no Agent chosen yet, so only the publish path is blocked here. This
  // holds on the edit screen too: PATCH accepts kind and agentSlug, so the same post can
  // become a guide (or stop being one) at any time, and the gate follows the current kind.
  const isGuide = kind === "guide";
  const guideNeedsAgent = isGuide && !agentSlug;
  const publishBlocked = guideNeedsAgent;

  // The post may already point at an Agent that is no longer in the selectable list (it was
  // unpublished since). Keep it in the options so editing an unrelated field does not quietly
  // drop the link, and so the select never shows a blank value.
  const agentOptions = editing && post?.agentSlug && !agents.some((a) => a.slug === post.agentSlug)
    ? [...agents, { slug: post.agentSlug, name: post.agentName || post.agentSlug }]
    : agents;

  function addTag(raw: string) {
    const v = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9぀-ヿ一-鿿-]/g, "");
    if (v.length < 2 || v.length > 24) return;
    if (tags.includes(v) || tags.length >= limits.tags) return;
    setTags([...tags, v]);
  }

  async function uploadCover(file: File) {
    setErr(""); setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("alt", title.slice(0, 80) || "cover");
    const r = await fetch("/api/media", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setUploading(false);
    if (!r.ok) { setErr(d.error || t("Upload failed.", "アップロードに失敗しました。", "上傳失敗。")); return; }
    setCover(d.id);
  }

  async function save(status: "draft" | "published") {
    setErr(""); setRefusal("");
    if (status === "published" && guideNeedsAgent) {
      setErr(t(
        "A guide has to be about one of your Agents — pick which one it teaches before publishing. You can save it as a draft in the meantime.",
        "使い方ガイドは、あなたのエージェントのいずれかについてのものです。公開する前に対象を選んでください。それまでは下書きとして保存できます。",
        "使用指南必須是關於你的某個 Agent——請在發布前選擇它所教的那一個。在那之前可以先儲存為草稿。",
      ));
      return;
    }
    if (title.trim().length < 6) { setErr(t("Give it a title of at least 6 characters.", "6文字以上のタイトルを入力してください。", "請輸入至少 6 個字的標題。")); return; }
    if (body.trim().length < 20) { setErr(t("Write at least a couple of sentences.", "少なくとも数文は書いてください。", "至少寫上幾句話。")); return; }
    if (body.length > limits.body) { setErr(t(`Posts are capped at ${limits.body} characters.`, `投稿は${limits.body}文字までです。`, `貼文上限為 ${limits.body} 字。`)); return; }

    setBusy(status);
    const payload: Record<string, unknown> = {
      title: title.trim(),
      body: body.trim(),
      tags: tags.join(","),
      coverMediaId: cover || "",
      status,
    };
    let res: Response;
    if (editing && post) {
      // PATCH accepts kind and agentSlug as well — an empty agentSlug unlinks the Agent.
      res = await fetch(`/api/forum/post/${post.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, kind, agentSlug: agentSlug || "" }),
      });
    } else {
      res = await fetch("/api/forum/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, kind, lang: locale, agentSlug: agentSlug || undefined }),
      });
    }
    const d = await res.json().catch(() => ({}));
    setBusy("");

    // The extraction guard speaks for itself — show exactly what it said.
    if (res.status === 422) { setRefusal(String(d.error || "")); return; }
    // The server has the last word on the guide/Agent rule (400 guide_needs_agent) and on
    // who may write which kind (403) — repeat it exactly rather than paraphrasing.
    if (res.status === 403 || (res.status === 400 && d.code === "guide_needs_agent")) {
      setErr(String(d.error || t("Could not save.", "保存できませんでした。", "無法儲存。")));
      return;
    }
    if (!res.ok) { setErr(d.error || t("Could not save.", "保存できませんでした。", "無法儲存。")); return; }

    toast(
      status === "published"
        ? t("Published. It is public now.", "公開しました。誰でも読めます。", "已發布，現在是公開的。")
        : t("Draft saved. Only you can see it.", "下書きを保存しました。あなただけが閲覧できます。", "草稿已儲存，只有你看得到。"),
      "success",
    );
    router.push("/studio/blog");
    router.refresh();
  }

  return (
    <div className="animate-fadein mx-auto max-w-3xl">
      <Link href="/studio/blog" className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-text">
        <IconArrowLeft size={13} stroke={1.7} /> {t("Back to your writing", "執筆一覧に戻る", "回到你的文章")}
      </Link>

      <h1 className="mt-3 font-display text-[26px] font-extrabold tracking-tight">
        <span className="text-grad">{editing ? t("Edit post", "記事を編集", "編輯貼文") : t("Write", "執筆", "撰寫")}</span>
      </h1>
      <p className="mt-1 text-[12.5px] leading-6 text-muted">
        {t(
          "This is public writing. It shows your judgement to people who have not paid you — and it can point at the Agent where the full reasoning lives.",
          "これは公開される文章です。まだお金を払っていない人にあなたの判断力を示し、完全な思考が置かれているエージェントへ導線を張ることができます。",
          "這是公開的文章。它向尚未付費的人展現你的判斷力，並可指向完整推理所在的 Agent。",
        )}
      </p>

      {refusal && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-rust/40 bg-rust/5 px-4 py-3 text-[12.5px] leading-6 text-rust">
          <IconAlertTriangle size={16} stroke={1.7} className="mt-0.5 shrink-0" />
          <span>{refusal}</span>
        </div>
      )}
      {err && (
        <div className="mt-5 rounded-xl border border-rust/40 bg-rust/5 px-4 py-3 text-[12.5px] text-rust">{err}</div>
      )}

      <div className="mt-6 space-y-6">
        {/* Title */}
        <Field label={t("Title", "タイトル", "標題")}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, limits.title))}
            placeholder={t("What is this about?", "何についてですか？", "這是關於什麼的？")}
            className="w-full rounded-xl border border-border bg-panel px-3 py-2.5 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-borderlight"
          />
          <div className="mt-1 text-right text-[11px] text-faint">{title.length} / {limits.title}</div>
        </Field>

        {/* Kind */}
        <Field label={t("Kind", "種類", "類型")} hint={t(kindHelp[0], kindHelp[1], kindHelp[2])}>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(([k, en, ja, zh]) => {
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${on ? "border-purple bg-purple text-white" : "border-border bg-panel text-muted hover:text-text"}`}
                >
                  {t(en, ja, zh)}
                </button>
              );
            })}
          </div>
          {editing && (
            <div className="mt-2 text-[11px] text-faint">
              {t(
                "You can change the kind of an existing post. A published post changes for its readers the moment you save.",
                "既存の投稿でも種類を変更できます。公開済みの場合、保存した瞬間から読者にも反映されます。",
                "已存在的貼文也可以更改類型。若已發布，儲存後讀者立即看到變更。",
              )}
            </div>
          )}
        </Field>

        {/* Cover */}
        <Field label={t("Cover image", "カバー画像", "封面圖片")} hint={t("Optional. PNG, JPEG, WebP or GIF, under 5 MB.", "任意。PNG / JPEG / WebP / GIF、5MB 未満。", "選填。PNG、JPEG、WebP 或 GIF，小於 5 MB。")}>
          {cover ? (
            <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${cover}`} alt="" className="max-h-52 w-full object-cover" />
              <button
                type="button"
                onClick={() => setCover(null)}
                className="absolute right-2 top-2 rounded-lg border border-border bg-panel/90 p-1.5 text-muted backdrop-blur-sm transition-colors hover:text-rust"
                aria-label={t("Remove cover", "カバーを削除", "移除封面")}
              >
                <IconX size={14} stroke={1.8} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-panel px-4 py-3 text-[12.5px] text-muted transition-colors hover:border-borderlight hover:text-text"
            >
              {uploading ? <IconLoader2 size={15} className="animate-spin" /> : <IconPhoto size={15} stroke={1.7} />}
              {uploading ? t("Uploading…", "アップロード中…", "上傳中…") : t("Upload a cover image", "カバー画像をアップロード", "上傳封面圖片")}
            </button>
          )}
          <input
            ref={coverRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }}
          />
        </Field>

        {/* Body */}
        <Field label={t("Body", "本文", "內文")}>
          <Composer
            value={body}
            onChange={setBody}
            max={limits.body}
            minRows={16}
            placeholder={t("Write it in markdown. Paste or upload images inline.", "マークダウンで書けます。画像は貼り付けまたはアップロードできます。", "以 Markdown 撰寫。可直接貼上或上傳圖片。")}
            hint={t(
              "Markdown only — no raw HTML, and images are served from this site. Write as much as it takes; nobody is counting words.",
              "マークダウンのみ。生の HTML は使えず、画像は本サイトから配信されます。必要なだけ書いてください。文字数は誰も数えていません。",
              "僅支援 Markdown——不接受原始 HTML，圖片由本站提供。需要多長就寫多長，沒有人在數字數。",
            )}
          />
        </Field>

        {/* Tags */}
        <Field label={t("Tags", "タグ", "標籤")} hint={t(`Up to ${limits.tags}. They are how people find this later.`, `最大${limits.tags}個。後から見つけてもらうための手がかりです。`, `最多 ${limits.tags} 個。這是別人日後找到它的方式。`)}>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-panel px-2.5 py-2">
            {tags.map((tg) => (
              <span key={tg} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-panel2 px-2 py-0.5 text-[11.5px] text-muted">
                {tg}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== tg))} className="text-faint hover:text-rust" aria-label={t("Remove tag", "タグを削除", "移除標籤")}>
                  <IconX size={11} stroke={2} />
                </button>
              </span>
            ))}
            {tags.length < limits.tags && (
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagDraft); setTagDraft(""); }
                  else if (e.key === "Backspace" && !tagDraft && tags.length) setTags(tags.slice(0, -1));
                }}
                onBlur={() => { addTag(tagDraft); setTagDraft(""); }}
                placeholder={t("Add a tag, press Enter", "タグを入力して Enter", "輸入標籤後按 Enter")}
                className="min-w-[160px] flex-1 bg-transparent px-1 py-0.5 text-[12.5px] outline-none placeholder:text-faint"
              />
            )}
          </div>
        </Field>

        {/* Agent link */}
        <Field
          label={
            isGuide
              ? t("Which Agent does this guide teach?", "このガイドはどのエージェントについてですか？", "這份指南在教哪一個 Agent？")
              : t("Point at one of your Agents", "あなたのエージェントへ紐づける", "指向你的一個 Agent")
          }
          hint={
            isGuide
              ? t(
                  "Required for a guide. A guide is about getting more out of one specific Agent — without it, it is just an article.",
                  "使い方ガイドには必須です。ガイドは特定のエージェントを使いこなすためのもので、指定がなければ単なる記事になります。",
                  "指南必填。指南是關於如何用好某一個 Agent；沒有它，就只是一篇文章。",
                )
              : t(
                  "Optional. The post shows your reasoning is real; the Agent is where the whole of it lives. Only your own published Agents can be linked.",
                  "任意。記事は思考が本物であることを示し、エージェントはその全体が置かれている場所です。公開済みの自分のエージェントのみ紐づけられます。",
                  "選填。貼文證明推理是真的；Agent 則是完整推理的所在。只能連結你自己已發布的 Agent。",
                )
          }
        >
          {agentOptions.length === 0 ? (
            <div className="rounded-xl border border-border bg-panel2 px-3 py-2.5 text-[12px] text-faint">
              {isGuide
                ? t(
                    "You have no published Agents yet, so there is nothing a guide could teach. Publish an Agent first, or write this as an article.",
                    "公開済みのエージェントがないため、ガイドの対象がありません。先にエージェントを公開するか、記事として書いてください。",
                    "你還沒有已發布的 Agent，指南沒有可教的對象。請先發布一個 Agent，或改以文章形式撰寫。",
                  )
                : t(
                    "You have no published Agents yet, so there is nothing to point at. The post still stands on its own.",
                    "公開済みのエージェントがないため、紐づけ先はありません。記事自体は単独で成立します。",
                    "你還沒有已發布的 Agent，因此沒有可指向的對象。貼文本身仍然成立。",
                  )}
            </div>
          ) : (
            <>
              <select
                value={agentSlug}
                onChange={(e) => setAgentSlug(e.target.value)}
                aria-invalid={guideNeedsAgent || undefined}
                className={`w-full rounded-xl border bg-panel px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-borderlight ${guideNeedsAgent ? "border-rust/60" : "border-border"}`}
              >
                <option value="">
                  {isGuide
                    ? t("Choose an Agent…", "エージェントを選択…", "選擇一個 Agent…")
                    : t("No Agent — just the post", "紐づけない（記事のみ）", "不連結——僅發布貼文")}
                </option>
                {agentOptions.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
              {guideNeedsAgent && (
                <div className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-5 text-rust">
                  <IconBook size={13} stroke={1.8} className="mt-0.5 shrink-0" />
                  <span>
                    {t(
                      "Pick the Agent this guide teaches before you publish it. You can save a draft now and choose the Agent later.",
                      "公開する前に、このガイドが対象とするエージェントを選んでください。今は下書きとして保存し、あとからエージェントを選ぶこともできます。",
                      "在發布之前，請選擇這份指南所教的 Agent。你可以先儲存草稿，稍後再選擇 Agent。",
                    )}
                  </span>
                </div>
              )}
            </>
          )}
        </Field>
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-2 border-t border-border bg-bg/80 py-4 backdrop-blur-sm">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => save("draft")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-[13px] text-muted transition-colors hover:bg-panel2 hover:text-text disabled:opacity-50"
        >
          {busy === "draft" ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} stroke={1.7} />}
          {t("Save draft", "下書きを保存", "儲存草稿")}
        </button>
        <button
          type="button"
          disabled={!!busy || publishBlocked}
          onClick={() => save("published")}
          className="btn-glow inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-purple px-4 py-2 text-[13px] font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {busy === "published" ? <IconLoader2 size={14} className="animate-spin" /> : <IconWorld size={14} stroke={1.7} />}
          {editing && post?.status === "published" ? t("Update", "更新する", "更新") : t("Publish", "公開する", "發布")}
        </button>
        <span className="ml-auto text-[11px] text-faint">
          {publishBlocked
            ? t("A guide needs an Agent before it can be published — you can still save a draft.", "使い方ガイドの公開には対象のエージェントが必要です。下書きの保存はできます。", "指南必須先選定 Agent 才能發布——但仍可先儲存草稿。")
            : t("A draft is visible to you alone.", "下書きはあなただけが閲覧できます。", "草稿只有你看得到。")}
        </span>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[12.5px] font-medium text-text">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-[11px] leading-5 text-faint">{hint}</div>}
    </div>
  );
}
