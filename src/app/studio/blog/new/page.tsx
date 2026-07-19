import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BODY_MAX, TITLE_MAX, TAGS_MAX, POST_KINDS } from "@/lib/forum";
import NewArticleClient from "./NewArticleClient";

export const dynamic = "force-dynamic";

/**
 * Write or edit a post. Editing is entered through ?edit=<slug> — the post must be
 * yours, which the API enforces again on every write.
 *
 * An Agent page links here with ?kind=guide&agent=<slug> so an expert can go straight
 * from "this Agent" to "here is how to get more out of it". Both hints are validated:
 * an unknown kind falls back to `article`, and an Agent slug that is not the creator's
 * own published Agent is simply dropped.
 */
export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; kind?: string; agent?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "creator" && user.role !== "admin") redirect("/studio");

  const { edit, kind, agent } = await searchParams;

  // Only the creator's own published Agents can be pointed at. There is no "my agents"
  // API — this is a direct read, and the API re-checks ownership when the post is saved.
  const myAgents = await db.agent.findMany({
    where: { creatorId: user.id, status: "published" },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  let post = null;
  if (edit) {
    const p = await db.post.findUnique({
      where: { slug: edit },
      include: { agent: { select: { slug: true, name: true } } },
    });
    if (!p || p.status === "removed") redirect("/studio/blog");
    if (p.authorId !== user.id && user.role !== "admin") redirect("/studio/blog");
    post = {
      slug: p.slug,
      title: p.title,
      kind: p.kind,
      body: p.body,
      tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
      coverMediaId: p.coverMediaId,
      status: p.status,
      agentSlug: p.agent?.slug || null,
      agentName: p.agent?.name || null,
    };
  }

  // Preselection only applies to a new post — an existing post's kind and Agent are fixed.
  const kinds: readonly string[] = POST_KINDS;
  const initialKind = !edit && kind && kinds.includes(kind) ? kind : undefined;
  const initialAgent = !edit && agent && myAgents.some((a) => a.slug === agent) ? agent : undefined;

  return (
    <NewArticleClient
      post={post}
      agents={myAgents}
      limits={{ body: BODY_MAX, title: TITLE_MAX, tags: TAGS_MAX }}
      initialKind={initialKind}
      initialAgentSlug={initialAgent}
    />
  );
}
