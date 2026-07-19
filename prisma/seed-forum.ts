import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function slugify(t: string, n: number) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 55) + "-" + n;
}

async function main() {
  const creators = await db.user.findMany({ where: { role: "creator" }, take: 6, include: { creatorProfile: true } });
  const buyer = await db.user.findFirst({ where: { email: "buyer@wiz-agents.com" } });
  if (!creators.length || !buyer) { console.log("no creators/buyer; skip"); return; }
  const agents = await db.agent.findMany({ where: { status: "published" }, take: 30 });
  const agentOf = (cid: string) => agents.find((a) => a.creatorId === cid) || null;

  const seedPosts = [
    { kind: "article", ci: 0, title: "The three GDPR questions every SaaS founder gets wrong", tags: "gdpr,compliance,saas",
      body: "Most founders I speak to have read the regulation. Very few have read it *against their own product*.\n\nHere are the three places I see the same mistake, over and over.\n\n## 1. \"We're a processor, so it's not our problem\"\n\nYou are a processor for your customer's data. You are almost always a **controller** for your own: your marketing list, your support tickets, your product analytics. Two hats, two sets of obligations, and the second one is the one that gets audited first because it is the one your DPA never mentions.\n\n## 2. Legitimate interest as a catch-all\n\nLegitimate interest is a real basis. It is also a *balancing test you have to actually write down*. If you cannot produce the LIA on request, you do not have legitimate interest — you have a hope.\n\n## 3. Treating the DPA as the finish line\n\nSigning a DPA is the beginning of an obligation, not the discharge of one. Sub-processor notification, transfer mechanism, deletion on termination: all of it is now something you have promised to *do*.\n\nNone of this is legal advice, and your situation will have facts I cannot see from here." },
    { kind: "question", ci: -1, title: "Do I need a DPO if we're a 12-person startup processing health data?", tags: "gdpr,dpo,healthtech",
      body: "We're a small team building a scheduling tool for physiotherapy clinics. We store appointment data, and some clinics put clinical notes in the free-text field even though we tell them not to.\n\nOur lawyer says \"probably not required\" but won't put it in writing. What's the actual test here, and does the free-text problem change the answer?" },
    { kind: "discussion", ci: 1, title: "Where does an AI avatar of an expert stop being useful?", tags: "ai,ethics,advice",
      body: "I've been running an avatar of my own practice for a few months now. Something I did not expect: the questions it *refuses* are the most valuable signal I get.\n\nEvery abstention is a place where my own reasoning depends on context the model does not have. That's a map of where my judgement is actually irreducible.\n\nCurious whether other experts here see the same thing, or whether I'm reading too much into it." },
    { kind: "case", ci: 2, title: "Case: a HIPAA breach notification that didn't need to happen", tags: "hipaa,breach,incident",
      body: "A clinic client emailed 300 patient names to the wrong distribution list. Their instinct was to notify immediately and loudly.\n\nWe walked the four-factor risk assessment instead.\n\n- **Nature and extent of the PHI**: names and appointment times. No diagnoses, no identifiers beyond the name.\n- **Who received it**: an internal list. Every recipient was a workforce member already permitted to see scheduling data.\n- **Whether it was actually acquired or viewed**: mail logs showed 4 opens, all internal.\n- **Mitigation**: recalled within 18 minutes, attestations collected.\n\nLow probability of compromise, documented, no notification. The documentation is the deliverable — not the conclusion.\n\nThis is the shape of the reasoning. What it means for *your* incident depends on facts I would need to ask you about." },
    { kind: "question", ci: -1, title: "How do you price a first consulting engagement without anchoring too low?", tags: "pricing,consulting,freelance",
      body: "First real client, and I have no idea what to charge. Everything I read says \"charge for value\" which is not a number.\n\nWhat did you actually do for your first one, and what would you do differently?" },
  ];

  let n = 0;
  for (const p of seedPosts) {
    n++;
    const author = p.ci >= 0 ? creators[p.ci % creators.length] : buyer;
    const agent = p.ci >= 0 ? agentOf(author.id) : null;
    const slug = slugify(p.title, n);
    const existing = await db.post.findUnique({ where: { slug } });
    if (existing) continue;
    const post = await db.post.create({
      data: {
        slug, authorId: author.id, kind: p.kind, title: p.title, body: p.body,
        excerpt: p.body.replace(/[#*\n]/g, " ").replace(/\s+/g, " ").slice(0, 175) + "…",
        tags: p.tags, lang: "en", agentId: agent?.id || null,
        status: "published", score: 3 + ((n * 7) % 11), views: 40 + ((n * 53) % 400),
        createdAt: new Date(Date.now() - n * 36 * 3600_000),
        lastActivityAt: new Date(Date.now() - n * 5 * 3600_000),
      },
    });

    // an expert answers the two questions
    if (p.kind === "question") {
      const expert = creators[n % creators.length];
      const ea = agentOf(expert.id);
      const bodies: Record<string, string> = {
        "Do I need a DPO if we're a 12-person startup processing health data?":
          "Headcount is not the test — Article 37 is. Three triggers: public authority, large-scale *regular and systematic monitoring*, or large-scale processing of special-category data. Health data is special category, so your whole question collapses into what \"large scale\" means for you.\n\nThe free-text field is the part I'd worry about. If clinicians are pasting clinical notes into it, then your \"scheduling tool\" is processing health data whether your terms say so or not — and \"we told them not to\" is not a control, it's a wish. A control is a field that rejects it, a scan that flags it, or a contract that makes them the controller of what they put there.\n\nGet that written down before you decide on the DPO, because it changes the input to the decision.",
        "How do you price a first consulting engagement without anchoring too low?":
          "Two things helped me more than any pricing framework.\n\nFirst: quote a **scope**, not an hour. \"Two weeks, this deliverable, this decision you'll be able to make at the end.\" An hourly rate invites a negotiation about your worth; a scope invites one about the outcome.\n\nSecond: whatever number makes you slightly uncomfortable to say out loud — say that one. The discomfort is not a signal that it's too high. It's a signal that you've never said it before.\n\nWhat I'd do differently: I gave away the diagnosis for free and charged for the fix. The diagnosis was the valuable half.",
      };
      const body = bodies[p.title];
      if (body) {
        const r = await db.reply.create({
          data: { postId: post.id, authorId: expert.id, body, score: 6 + (n % 5), agentId: ea?.id || null,
            createdAt: new Date(Date.now() - n * 20 * 3600_000) },
        });
        await db.reply.update({ where: { id: r.id }, data: { accepted: true } });
        await db.post.update({ where: { id: post.id }, data: { replyCount: 1, acceptedReplyId: r.id, answeredById: expert.id } });
      }
    } else {
      const commenter = creators[(n + 2) % creators.length];
      await db.reply.create({
        data: { postId: post.id, authorId: commenter.id, score: 2 + (n % 4),
          body: "This matches what I see. The part people underrate is that writing the reasoning down is what makes it reviewable later — by a regulator, or by you in six months when you've forgotten why you decided it.",
          createdAt: new Date(Date.now() - n * 8 * 3600_000) },
      });
      await db.post.update({ where: { id: post.id }, data: { replyCount: 1 } });
    }
  }
  const total = await db.post.count();
  console.log("community posts:", total, "replies:", await db.reply.count());
}
main().finally(() => db.$disconnect());
