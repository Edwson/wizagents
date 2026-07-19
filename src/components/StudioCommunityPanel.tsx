"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  IconMessageCircleQuestion, IconRobot, IconPencil, IconLoader2, IconArrowRight,
  IconEye, IconCircleCheck, IconFileText, IconBook2,
} from "@tabler/icons-react";

export type CommunityStats = {
  published: number;
  drafts: number;
  views: number;
  acceptedAnswers: number;
};
export type PanelAgent = { slug: string; name: string; guides: number };

type Question = {
  slug: string; title: string; excerpt: string; replyCount: number; answered: boolean;
  createdAt: string; author: { name: string };
};

/**
 * The creator's door into the community.
 *
 * Three things, all of them useful on their own: what you have already published,
 * the Agents that still have no guide, and the questions nobody has answered.
 * No streaks, no points, no reminder to post today.
 */
export default function StudioCommunityPanel({ stats, agents }: { stats: CommunityStats; agents: PanelAgent[] }) {
  const { t } = useI18n();
  const [questions, setQuestions] = useState<Question[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/forum/post?kind=question&sort=new")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const rows: Question[] = Array.isArray(d?.posts) ? d.posts : [];
        setQuestions(rows.filter((q) => q.replyCount === 0 && !q.answered).slice(0, 5));
      })
      .catch(() => { if (alive) setQuestions([]); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <div className="font-display text-[16px] font-bold tracking-tight">{t("Community", "コミュニティ", "社群")}</div>
          <p className="mt-1 text-[12.5px] leading-6 text-muted">
            {t(
              "The square is where people meet your thinking before they meet your price. Nothing here is a task — it is what is open to you right now.",
              "広場は、人々があなたの価格より先にあなたの思考に出会う場所です。ここにあるのはタスクではなく、いま開かれている選択肢です。",
              "廣場是人們在看到你的價格之前先遇見你思考的地方。這裡沒有任何任務——只是此刻對你敞開的選項。",
            )}
          </p>
        </div>
        <Link href="/community" className="shrink-0 rounded-xl border border-border bg-panel2 px-3.5 py-2 text-[12.5px] text-muted transition-colors hover:text-text">
          {t("Open the community", "コミュニティを開く", "開啟社群")} →
        </Link>
      </div>

      {/* At a glance — plain counts, nothing weighted */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell icon={<IconFileText size={13} stroke={1.7} />} v={stats.published.toLocaleString()} l={t("Published", "公開中", "已發布")} />
        <Cell icon={<IconPencil size={13} stroke={1.7} />} v={stats.drafts.toLocaleString()} l={t("Drafts", "下書き", "草稿")} />
        <Cell icon={<IconEye size={13} stroke={1.7} />} v={stats.views.toLocaleString()} l={t("Views", "閲覧数", "瀏覽數")} />
        <Cell icon={<IconCircleCheck size={13} stroke={1.7} />} v={stats.acceptedAnswers.toLocaleString()} l={t("Accepted answers", "採用された回答", "被採納的解答")} />
      </div>
      <div className="mt-2">
        <Link href="/studio/blog" className="inline-flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-text">
          {t("Manage everything you have written", "書いたものをすべて管理", "管理你寫過的所有內容")} <IconArrowRight size={12} stroke={1.7} />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Guides */}
        <div className="rounded-xl border border-border bg-panel2 p-4">
          <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint">
            <IconBook2 size={13} stroke={1.7} /> {t("Write a guide for one of your Agents", "エージェントの使い方ガイドを書く", "為你的 Agent 寫一份指南")}
          </div>
          <p className="mb-3 text-[11.5px] leading-5 text-faint">
            {t(
              "A guide teaches buyers to get more out of that Agent — the cheapest way to reduce refunds and to get found.",
              "ガイドは、そのエージェントをうまく使う方法を購入者に教えます。返金を減らし、見つけてもらうための最も安上がりな手段です。",
              "指南教買家如何把那個 Agent 用得更好——這是減少退款、也讓人找到你最省成本的方式。",
            )}
          </p>
          {agents.length === 0 ? (
            <p className="rounded-lg border border-border bg-panel px-3 py-2.5 text-[11.5px] leading-5 text-faint">
              {t(
                "You have no published Agents yet. A guide has to be about one of them.",
                "公開中のエージェントがまだありません。ガイドはそのいずれかについて書くものです。",
                "你還沒有已發布的 Agent。指南必須是關於其中之一。",
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {agents.map((a) => (
                <div key={a.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-panel px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate text-[12.5px] text-text">
                      <IconRobot size={13} stroke={1.7} className="shrink-0 text-muted" /> {a.name}
                    </div>
                    <div className="text-[10.5px] text-faint">
                      {a.guides === 0
                        ? t("No guide yet", "ガイドなし", "尚無指南")
                        : t(`${a.guides} guide${a.guides === 1 ? "" : "s"}`, `ガイド ${a.guides} 件`, `${a.guides} 份指南`)}
                    </div>
                  </div>
                  <Link
                    href={`/studio/blog/new?kind=guide&agent=${encodeURIComponent(a.slug)}`}
                    className="shrink-0 rounded-lg border border-border bg-panel2 px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:text-text"
                  >
                    {t("Write a guide", "ガイドを書く", "撰寫指南")} →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unanswered questions */}
        <div className="rounded-xl border border-border bg-panel2 p-4">
          <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint">
            <IconMessageCircleQuestion size={13} stroke={1.7} /> {t("Questions nobody has answered yet", "まだ誰も答えていない質問", "還沒有人回答的問題")}
          </div>
          <p className="mb-3 text-[11.5px] leading-5 text-faint">
            {t(
              "Answering in public is how an expert becomes visible before anyone pays them.",
              "公開の場で答えることが、報酬を受け取る前に専門家が知られる道です。",
              "公開回答，是專家在有人付錢之前變得可見的方式。",
            )}
          </p>

          {questions === null ? (
            <div className="flex items-center gap-2 px-1 py-4 text-[11.5px] text-faint">
              <IconLoader2 size={13} className="animate-spin" /> {t("Loading", "読み込み中", "載入中")}
            </div>
          ) : questions.length === 0 ? (
            <p className="rounded-lg border border-border bg-panel px-3 py-2.5 text-[11.5px] leading-5 text-faint">
              {t(
                "Nothing is going unanswered right now.",
                "いま未回答の質問はありません。",
                "目前沒有未被回答的問題。",
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {questions.map((q) => (
                <Link
                  key={q.slug}
                  href={`/community/${q.slug}`}
                  className="block rounded-lg border border-border bg-panel px-3 py-2 transition-colors hover:border-borderlight"
                >
                  <div className="truncate text-[12.5px] text-text">{q.title}</div>
                  {q.excerpt && <div className="mt-0.5 line-clamp-1 text-[11px] text-faint">{q.excerpt}</div>}
                  <div className="mt-1 text-[10.5px] text-faint">
                    {t("Asked by", "質問者", "提問者")} {q.author?.name || t("someone", "誰か", "某人")} · {t("Answer", "回答する", "回答")} →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Cell({ icon, v, l }: { icon: React.ReactNode; v: string; l: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel2 p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-faint">{icon} {l}</div>
      <div className="mt-1 font-display text-xl font-bold text-text">{v}</div>
    </div>
  );
}
