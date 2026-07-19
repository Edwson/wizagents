"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { POST_KINDS, TITLE_MAX, BODY_MAX, TAGS_MAX, kindLabel } from "@/lib/forum";
import Composer from "@/components/Composer";
import { Btn } from "@/components/ui";
import { IconAlertTriangle, IconLoader2, IconLock, IconInfoCircle } from "@tabler/icons-react";

export type MyAgent = { slug: string; name: string };

const HINTS: Record<string, [string, string, string]> = {
  question: [
    "Ask what you actually want to know. The more specific the situation, the better the answer.",
    "本当に知りたいことを書いてください。状況が具体的なほど、良い回答が返ってきます。",
    "問出你真正想知道的事。情境越具體，回答就越有用。",
  ],
  discussion: [
    "Open something worth arguing about. Say where you stand.",
    "議論する価値のあることを提起してください。あなたの立場も書きましょう。",
    "提出值得討論的事，並說明你的立場。",
  ],
  article: [
    "Long-form is welcome here. Teach the thing you know that others do not.",
    "長文も歓迎です。あなたにしか書けないことを教えてください。",
    "歡迎長篇。把只有你知道的事教給別人。",
  ],
  case: [
    "A real case, with the numbers and the decision. That is what proves judgement.",
    "数字と判断まで含めた実例を。それが判断力の証明になります。",
    "一個真實案例，連同數字與最終決策。這才是判斷力的證明。",
  ],
};

export default function NewPostClient({
  isCreator, myAgents, initialKind, defaultLang,
}: {
  isCreator: boolean;
  myAgents: MyAgent[];
  initialKind: string;
  defaultLang: "en" | "ja" | "zh";
}) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const allowed = (k: string) => isCreator || (k !== "article" && k !== "case");
  const [kind, setKind] = useState<string>(
    POST_KINDS.includes(initialKind as never) && initialKind !== "guide" && allowed(initialKind) ? initialKind : "question",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [agentSlug, setAgentSlug] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "published">("");
  const [err, setErr] = useState("");
  const [refusal, setRefusal] = useState("");

  const tagList = tags.split(",").map((x) => x.trim()).filter(Boolean);
  const tagsOver = tagList.length > TAGS_MAX;
  const titleOver = title.length > TITLE_MAX;
  const bodyOver = body.length > BODY_MAX;
  const valid = title.trim().length >= 6 && body.trim().length >= 20 && !titleOver && !bodyOver && !tagsOver;

  async function submit(status: "draft" | "published") {
    if (!valid || busy) return;
    setBusy(status); setErr(""); setRefusal("");
    const r = await fetch("/api/forum/post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind, title, body, tags, status, lang: defaultLang,
        ...(agentSlug ? { agentSlug } : {}),
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      // The extraction refusal explains itself. Show it exactly as the server wrote it.
      if (d.code === "extraction") setRefusal(String(d.error || ""));
      else setErr(String(d.error || t("Could not save that.", "保存できませんでした。", "無法儲存。")));
      return;
    }
    router.push(`/community/${d.slug}`);
    router.refresh();
  }

  const hint = HINTS[kind] || HINTS.discussion;

  return (
    <div className="max-w-3xl space-y-5">
      {/* kind */}
      <div>
        <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-faint">
          {t("What is this?", "種類", "類型")}
        </label>
        <div className="flex flex-wrap gap-2">
          {POST_KINDS.filter((k) => k !== "guide").map((k) => {
            const ok = allowed(k);
            return (
              <button
                key={k}
                type="button"
                disabled={!ok}
                onClick={() => ok && setKind(k)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] transition-all duration-300 ${
                  kind === k
                    ? "border-transparent bg-purple text-white"
                    : ok
                      ? "border-glassborder/20 bg-panel/40 text-muted backdrop-blur-sm hover:border-purple/40 hover:text-text"
                      : "cursor-not-allowed border-border/50 bg-panel/20 text-faint"
                }`}
              >
                {!ok && <IconLock size={12} stroke={1.8} />}
                {kindLabel(k, locale)}
              </button>
            );
          })}
        </div>
        {!isCreator && (
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-faint">
            <IconInfoCircle size={13} stroke={1.8} className="mt-0.5 shrink-0" />
            {t(
              "Articles and case studies are published by creators — the people who put their name and their credentials behind them. Ask a question or open a discussion instead.",
              "記事とケーススタディはクリエイター（実名と資格を背負う人）が公開します。質問かディスカッションとして投稿してください。",
              "文章與案例由創作者發表 — 他們以真名與專業資格背書。你可以改為提問或發起討論。",
            )}
          </p>
        )}
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{t(hint[0], hint[1], hint[2])}</p>
        {isCreator && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-faint">
            <IconInfoCircle size={13} stroke={1.8} className="mt-0.5 shrink-0" />
            {t("Writing a how-to for one of your Agents? Publish it as a guide from ", "自分の Agent の使い方を書くなら、", "想寫某個 Agent 的使用教學？請從 ")}
            <a href="/studio/blog/new?kind=guide" className="text-purple underline">{t("your studio", "スタジオ", "你的工作室")}</a>
            {t(" so it links to the Agent.", " からガイドとして公開してください。", " 發表為指南，才能連結到該 Agent。")}
          </p>
        )}
      </div>

      {/* title */}
      <div>
        <label className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-faint">
          <span>{t("Title", "タイトル", "標題")}</span>
          <span className={titleOver ? "text-rust" : ""}>{title.length} / {TITLE_MAX}</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            kind === "question"
              ? t("The question, in one line", "質問を一行で", "用一句話寫出你的問題")
              : t("Give it a title", "タイトルを付けてください", "為它取個標題")
          }
          className={`w-full rounded-xl border bg-panel px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-purple/50 ${
            titleOver ? "border-rust" : "border-border"
          }`}
        />
      </div>

      {/* body */}
      <div>
        <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-faint">
          {t("Body", "本文", "內文")}
        </label>
        <Composer
          value={body}
          onChange={(v) => { setBody(v); if (refusal) setRefusal(""); }}
          max={BODY_MAX}
          minRows={12}
          placeholder={t(
            "Markdown. Paste or upload images. Write it the way you would explain it to someone you respect.",
            "Markdownで書けます。画像も貼り付け・アップロード可能です。尊敬する相手に説明するつもりで書いてください。",
            "支援 Markdown，可貼上或上傳圖片。用你向敬重的人說明事情的方式來寫。",
          )}
          hint={t(
            "Markdown is rendered through a strict sanitizer — no raw HTML, no remote images.",
            "Markdownは厳格なサニタイザで処理されます（生のHTMLや外部画像は不可）。",
            "Markdown 會經過嚴格的淨化處理 — 不接受原始 HTML 或外部圖片。",
          )}
        />
      </div>

      {/* tags */}
      <div>
        <label className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-faint">
          <span>{t("Tags", "タグ", "標籤")}</span>
          <span className={tagsOver ? "text-rust" : ""}>{tagList.length} / {TAGS_MAX}</span>
        </label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t("comma separated — e.g. series-a, pricing, japan", "カンマ区切り — 例: series-a, pricing, japan", "以逗號分隔 — 例如 series-a, pricing, japan")}
          className={`w-full rounded-xl border bg-panel px-3.5 py-2.5 text-[13.5px] outline-none transition-colors placeholder:text-faint focus:border-purple/50 ${
            tagsOver ? "border-rust" : "border-border"
          }`}
        />
        {tagsOver && (
          <p className="mt-1.5 text-[11.5px] text-rust">
            {t(`Up to ${TAGS_MAX} tags.`, `タグは${TAGS_MAX}個までです。`, `最多 ${TAGS_MAX} 個標籤。`)}
          </p>
        )}
      </div>

      {/* link an Agent — creators only, and only their own published Agents */}
      {isCreator && myAgents.length > 0 && (
        <div>
          <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-faint">
            {t("Link one of your Agents", "自分のAgentをリンクする", "連結你的一個 Agent")}
            <span className="ml-1.5 normal-case tracking-normal text-faint">{t("(optional)", "（任意）", "（選填）")}</span>
          </label>
          <select
            value={agentSlug}
            onChange={(e) => setAgentSlug(e.target.value)}
            className="w-full rounded-xl border border-border bg-panel px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-purple/50"
          >
            <option value="">{t("None", "なし", "不連結")}</option>
            {myAgents.map((a) => (
              <option key={a.slug} value={a.slug}>{a.name}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
            {t(
              "Shown quietly beside the post: the reader can go where the full reasoning lives. You can only link an Agent you own and have published.",
              "投稿の横に控えめに表示されます。読者は完全な推論がある場所へ移動できます。リンクできるのは自分が公開したAgentのみです。",
              "會安靜地顯示在貼文旁邊：讀者可以前往完整推理所在之處。你只能連結自己已發布的 Agent。",
            )}
          </p>
        </div>
      )}

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

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
        <Btn onClick={() => submit("draft")} variant="outline" size="md" disabled={!valid || !!busy}>
          {busy === "draft" && <IconLoader2 size={14} className="animate-spin" />}
          {t("Save as draft", "下書き保存", "儲存草稿")}
        </Btn>
        <Btn onClick={() => submit("published")} variant="primary" size="md" disabled={!valid || !!busy}>
          {busy === "published" && <IconLoader2 size={14} className="animate-spin" />}
          {t("Publish", "公開する", "發布")}
        </Btn>
      </div>
    </div>
  );
}
