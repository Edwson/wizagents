import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, pick } from "@/lib/locale";
import NewPostClient, { type MyAgent } from "./NewPostClient";
import { IconArrowLeft } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New post",
  robots: { index: false, follow: false }, // a composer is not a page a search engine needs
};

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const [user, locale, sp] = await Promise.all([getCurrentUser(), getLocale(), searchParams]);
  if (!user) redirect("/login?next=/community/new");
  const P = (en: string, ja: string, zh: string) => pick(locale, en, ja, zh);

  // Only a creator (or admin) may publish an article or a case study — the API enforces
  // this too. Read the Agents straight from the db: /api/agents has no "mine" filter.
  const isCreator = user.role === "creator" || user.role === "admin";
  const myAgents: MyAgent[] = isCreator
    ? (
        await db.agent.findMany({
          where: { creatorId: user.id, status: "published" },
          select: { slug: true, name: true },
          orderBy: { createdAt: "desc" },
        })
      ).map((a) => ({ slug: a.slug, name: a.name }))
    : [];

  return (
    <div className="animate-fadein">
      <Link href="/community" className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-text">
        <IconArrowLeft size={14} stroke={1.8} />
        {P("Community", "コミュニティ", "社群")}
      </Link>

      <h1 className="mb-1 font-display text-[26px] font-bold tracking-tight">
        {P("New post", "新規投稿", "新增貼文")}
      </h1>
      <p className="mb-6 text-[13px] text-muted">
        {P(
          "Everything you write here is public and carries your name. That is the point.",
          "ここに書いたものはすべて公開され、あなたの名前が残ります。それがこの場の意味です。",
          "你在這裡寫的每個字都是公開的，並且署上你的名字。這正是重點所在。",
        )}
      </p>

      <NewPostClient
        isCreator={isCreator}
        myAgents={myAgents}
        initialKind={sp?.kind || "question"}
        defaultLang={locale}
      />
    </div>
  );
}
