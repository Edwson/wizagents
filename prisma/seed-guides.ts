import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const profiles = await db.creatorProfile.findMany({ take: 3, include: { user: true } });
  if (!profiles.length) return;

  // A fleshed-out introduction for the first expert
  const p = profiles[0];
  await db.creatorProfile.update({
    where: { id: p.id },
    data: {
      headline: p.headline || "18 years in EU privacy law — GDPR, DPAs, and the arguments that actually hold up",
      location: p.location || "Amsterdam",
      about: p.about || "I spent eleven years in-house before I started advising, which is the only reason I know what a compliance answer costs to actually implement.\n\nMost of my work is the same shape: someone has read the regulation, and now needs to read it *against their own product*. That translation is the job. I am blunt about uncertainty — if the honest answer is \"this depends on a fact I don't have,\" I will say so and tell you which fact.\n\nI don't do certainty theatre. If you want a memo that says everything is fine, I'm the wrong person.",
      howIWork: p.howIWork || "Ask my Agent the way you would ask me: with the messy specifics, not a clean hypothetical. It will tell you where my reasoning is grounded and where it is inferring — and it will abstain rather than bluff.\n\nWhen the call is high-stakes, escalate. That comes to me personally, and what you get back is signed.",
      links: p.links && p.links !== "[]" ? p.links : JSON.stringify([{ label: "Publications", url: "https://example.com/writing" }, { label: "LinkedIn", url: "https://linkedin.com/in/example" }]),
    },
  });

  const guides = [
    { title: "How to ask this Agent so you don't get a hedge", body: "The most common way people waste a question is by sanitising it.\n\n\"Is it okay to store IP addresses?\" gets you a hedge, because there is no answer to that question. It depends on why you're storing them, for how long, under what basis, and whether you can tie them to a person.\n\nAsk it the way you'd ask me over coffee:\n\n> \"We log IPs for 30 days for abuse detection. We're a B2B SaaS in the EU, and our DPA says we're a processor. Do we need to mention this anywhere?\"\n\nThat question has an answer.\n\n## Give it the facts it will otherwise have to assume\n\n- **Who the data subject is** (your customer, or your customer's customer)\n- **The purpose** — the real one, not the one in the privacy policy\n- **How long you keep it**\n- **Whether anything leaves the EU**\n\n## Read the receipt\n\nEvery answer tells you what is grounded in my material and what is inferred. If a load-bearing part of the answer is marked inferred, that is your cue to escalate rather than to trust it. That marking is not decoration — it is the most useful line in the response." },
    { title: "When to escalate to me instead of asking again", body: "The Agent is my reasoning. It is not my signature.\n\nRephrasing a question three times will not turn an inference into a fact. If you find yourself doing that, the Agent has already told you what it doesn't know — and the answer is to escalate, not to re-roll.\n\n## Escalate when\n\n- **A regulator or a counterparty will read the output.** Anything that gets quoted needs a human on the hook for it.\n- **The Agent abstained.** An abstention is a signal, not a failure. It means the answer depends on context I would have asked you for.\n- **The cost of being wrong is asymmetric.** A wrong answer that costs you a week is fine to iterate on. One that costs you a licence is not.\n\n## Don't escalate when\n\nYou want reassurance. I will not give it to you, and you will have paid for the privilege." },
  ];

  let n = 0;
  for (const prof of profiles.slice(0, 2)) {
    const agent = await db.agent.findFirst({ where: { creatorId: prof.userId, status: "published" } });
    if (!agent) continue;
    const g = guides[n % guides.length];
    n++;
    const slug = g.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 55) + "-g" + n;
    if (await db.post.findUnique({ where: { slug } })) continue;
    await db.post.create({
      data: {
        slug, authorId: prof.userId, kind: "guide", title: g.title, body: g.body,
        excerpt: g.body.replace(/[#*\n>]/g, " ").replace(/\s+/g, " ").slice(0, 175) + "…",
        tags: "how-to,agents", lang: "en", agentId: agent.id, status: "published",
        score: 5 + n, views: 120 + n * 40,
        createdAt: new Date(Date.now() - n * 30 * 3600_000), lastActivityAt: new Date(Date.now() - n * 4 * 3600_000),
      },
    });
  }
  console.log("guides:", await db.post.count({ where: { kind: "guide" } }), "| profiles enriched: 1");
}
main().finally(() => db.$disconnect());
