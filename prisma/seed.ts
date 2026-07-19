import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const dbUrl =
  process.env.DATABASE_URL && !/^file:\.\//.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL
    : "file:" + path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
const db = new PrismaClient({ datasources: { db: { url: dbUrl } } });

type RawAgent = {
  id: string;
  name: string;
  creator: string;
  category: string;
  price: number;
  renewal: number;
  subscribers: number;
  desc: string;
  features?: string[];
  owner?: string;
  lang?: string;
};

function tok(prefix = "sk_live_") {
  const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 40; i++) s += c[Math.floor(Math.random() * c.length)];
  return prefix + s;
}
const pick = <T>(a: T[], i: number) => a[i % a.length];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function asciiSlug(id: string, cat: string, idx: number): string {
  const clean = (id || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return clean.length >= 3 ? clean : `${cat}-${idx}`;
}


const AVATAR_COLORS = ["#8b6dff", "#e5a94e", "#4ade80", "#f0663f", "#5eb0ff", "#e06fd8", "#3ec6c6"];

function systemPromptFor(a: RawAgent): string {
  return [
    `你是「${a.name}」，一個由 ${a.creator} 持續維護、託管於 WizAgents 的專家 Agent。`,
    `你的專業領域是「${a.desc}」。`,
    a.features && a.features.length ? `核心能力：${a.features.join("、")}。` : "",
    `回答時務必：以繁體中文、結構化、引用最新知識庫版本，並在高風險判斷上主動提示可升級真人專家。`,
    `此 System Prompt 僅存於伺服器端，永不下發給買家。`,
  ]
    .filter(Boolean)
    .join("\n");
}

const REVIEW_POOL = [
  { r: 5, c: "法規一變隔天就更新，比我們內部團隊還快。" },
  { r: 5, c: "把原本要外包的工作壓縮成一個下午，續訂無懸念。" },
  { r: 4, c: "日常問題答得很穩，複雜個案我會用真人升級兜底。" },
  { r: 5, c: "簽核功能對我們的稽核流程幫助很大，可直接放進審查文件。" },
  { r: 4, c: "回覆結構清楚，偶爾需要追問細節，但整體超值。" },
  { r: 5, c: "24/7 隨時可問，等於多請了一位資深顧問。" },
  { r: 4, c: "知識庫版本溯源讓主管很買單，採購阻力小很多。" },
  { r: 5, c: "試用沙盒讓我下單前就確認品質，體驗很好。" },
];

const REVIEW_NAMES = ["合規主管 · Lin", "產品經理 · Wu", "風控 · Chang", "法遵 · Ho", "營運長 · Tsai", "工程主管 · Yeh", "財務 · Kuo", "創辦人 · Shen"];

async function main() {
  console.log("Clearing…");
  // order matters for FKs
  await db.favorite.deleteMany();
  await db.usageEvent.deleteMany();
  await db.auditLog.deleteMany();
  await db.blacklist.deleteMany();
  await db.enterpriseSeat.deleteMany();
  await db.transaction.deleteMany();
  await db.review.deleteMany();
  await db.message.deleteMany();
  await db.escalation.deleteMany();
  await db.conversation.deleteMany();
  await db.subscription.deleteMany();
  await db.pass.deleteMany();
  await db.metricPoint.deleteMany();
  await db.knowledgeVersion.deleteMany();
  await db.agent.deleteMany();
  await db.creatorProfile.deleteMany();
  await db.user.deleteMany();

  const zhRaw: RawAgent[] = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "agents.json"), "utf-8")).map((a: RawAgent) => ({ ...a, lang: a.lang || "zh" }));
  const enRaw: RawAgent[] = fs.existsSync(path.join(__dirname, "data", "agents_en.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "data", "agents_en.json"), "utf-8")) : [];
  const jaRaw: RawAgent[] = fs.existsSync(path.join(__dirname, "data", "agents_ja.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "data", "agents_ja.json"), "utf-8")) : [];
  const raw: RawAgent[] = [...enRaw, ...jaRaw, ...zhRaw];
  const catLabels: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "catlabels.json"), "utf-8")
  );

  const pw = await bcrypt.hash("demo1234", 10);

  // --- Demo accounts ---
  const buyer = await db.user.create({
    data: { email: "buyer@wiz-agents.com", passwordHash: pw, name: "Demo 買家", role: "buyer", avatarColor: "#5eb0ff" },
  });
  const enterprise = await db.user.create({
    data: { email: "enterprise@wiz-agents.com", passwordHash: pw, name: "Meridian 銀行 · 採購", role: "enterprise", orgName: "Meridian Bank", avatarColor: "#e5a94e" },
  });
  const admin = await db.user.create({
    data: { email: "admin@wiz-agents.com", passwordHash: pw, name: "平台管理員", role: "admin", avatarColor: "#f0663f" },
  });
  await db.platformConfig.upsert({ where: { id: "singleton" }, update: { takeRatePct: 15, passPrice: 129, defaultTrial: 3, dailyRateLimit: 200, escalationFeePct: 15 }, create: { id: "singleton" } });

  // The demo creator = 陳律師事務所 (owns the "you" agents)
  const demoCreatorName = "陳律師事務所";

  // --- Build creator users from unique creator names ---
  const creatorNames = Array.from(new Set(raw.map((a) => a.creator)));
  const creatorByName: Record<string, string> = {};
  let ci = 0;
  for (const cname of creatorNames) {
    const isDemo = cname === demoCreatorName;
    const email = isDemo ? "creator@wiz-agents.com" : `creator+${ci}@wiz-agents.com`;
    const cats = raw.filter((a) => a.creator === cname).map((a) => a.category);
    const primaryCat = cats[0] || "compliance";
    const u = await db.user.create({
      data: {
        email,
        passwordHash: pw,
        name: cname,
        role: "creator",
        avatarColor: pick(AVATAR_COLORS, ci),
        creatorProfile: {
          create: {
            displayName: cname,
            bio: `${catLabels[primaryCat] || primaryCat}領域專家，於 WizAgents 提供持續維護的專家 Agent 訂閱。`,
            verticalLabel: catLabels[primaryCat] || primaryCat,
            verified: true,
            verificationStatus: "approved",
            licenseInfo: isDemo ? "執業律師執照已驗證 · 多轄區金融合規背景" : "專業背景已審核",
            payoutShare: 85,
          },
        },
      },
    });
    creatorByName[cname] = u.id;
    ci++;
  }

  console.log(`Creators: ${creatorNames.length}`);

  // --- Agents ---
  const months = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
  const trendingIds = new Set(raw.slice().sort((a, b) => b.subscribers - a.subscribers).slice(0, 8).map((a) => a.id));
  const createdAgents: { id: string; price: number; creatorId: string; name: string; slug: string }[] = [];

  let idx = 0;
  for (const a of raw) {
    const creatorId = creatorByName[a.creator];
    const feats = a.features && a.features.length ? a.features : ["領域知識持續更新", "結構化專業回覆", "可升級真人專家"];
    const rating = Math.min(5, Math.max(3.8, 3.6 + a.renewal / 100)).toFixed(1);
    const inPass = a.price <= 55 && idx % 5 !== 0; // most affordable agents in Pass
    const replacesRate = rand(120, 480);
    const savesHrs = rand(6, 30);
    const ag = await db.agent.create({
      data: {
        slug: asciiSlug(a.id, a.category, idx),
        lang: a.lang || "en",
        name: a.name,
        creatorId,
        creatorName: a.creator,
        category: a.category,
        price: a.price,
        renewal: a.renewal,
        subscribers: a.subscribers,
        rating: parseFloat(rating),
        tagline: a.desc.split("，")[0].slice(0, 28),
        description: a.desc,
        features: JSON.stringify(feats),
        systemPrompt: systemPromptFor(a),
        knowledgeSummary: `${catLabels[a.category] || a.category}知識庫 · 每週更新 · 版本溯源`,
        updatedLabel: pick(["本週更新", "3 天前更新", "昨日更新", "本月已更新 4 次"], idx),
        status: "published",
        trending: trendingIds.has(a.id),
        inPass,
        trialLimit: 3,
        escalationPrice: rand(150, 500),
        signaturePrice: rand(60, 160),
        replacesRate,
        replacesRole: catLabels[a.category] || "專業顧問",
        savesHrs,
        regulated: ["legal","finance","compliance","transaction","healthcare","insurance","realestate"].includes(a.category),
        agentType: (["mentor","assistant","conversation","discussion"] as const)[idx % 4],
        tags: JSON.stringify([a.category, ...(feats.slice(0, 2).map((x: string) => String(x).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24)))].filter(Boolean)),
        pitch: `I built this Agent so you can reach my judgment on ${catLabels[a.category] || a.category} without booking a call. It answers from my own maintained knowledge base — and when a question deserves a human, it says so.`,
        sampleQuestions: JSON.stringify(feats.slice(0, 3).map((x: string) => `How should I approach ${x}?`)),
        notFor: "One-off factual lookups a general model already handles well, and anything requiring a formal licensed opinion without a human sign-off.",
        // Illustrative fidelity: only agents from a verified expert show a measured-style score (seed-stage placeholder).
        fidelityScore: 0, // never claimed — only a real harness run sets this
      },
    });
    createdAgents.push({ id: ag.id, price: a.price, creatorId, name: a.name, slug: ag.slug });

    // knowledge versions
    for (let v = 0; v < 3; v++) {
      await db.knowledgeVersion.create({
        data: {
          agentId: ag.id,
          version: `v${3 - v}.${rand(0, 9)}`,
          note: pick(["新增最新法規修訂", "補充實務案例與判例", "更新市場數據與基準", "修正邊界情況處理", "新增揭露條款檢查"], v + idx),
          docCount: rand(40, 320),
        },
      });
    }
    // reviews
    const nrev = rand(2, 4);
    for (let r = 0; r < nrev; r++) {
      const rv = pick(REVIEW_POOL, r + idx);
      await db.review.create({
        data: { agentId: ag.id, userId: buyer.id, authorName: pick(REVIEW_NAMES, r + idx), rating: rv.r, comment: rv.c },
      });
    }
    // metrics trend
    let base = Math.max(20, a.subscribers - rand(40, 120));
    for (const m of months) {
      base = Math.min(a.subscribers, base + rand(5, 40));
      await db.metricPoint.create({
        data: { agentId: ag.id, month: m, subscribers: base, revenue: base * a.price, renewal: Math.max(55, a.renewal - rand(0, 8)) },
      });
    }
    idx++;
  }
  console.log(`Agents: ${createdAgents.length}`);

  // --- Buyer subscriptions (subscribe to a few) ---
  const subAgents = createdAgents.filter((_, i) => [0, 3, 7, 12].includes(i));
  for (const sa of subAgents) {
    await db.subscription.create({
      data: { userId: buyer.id, agentId: sa.id, status: "active", price: sa.price, mcpToken: tok() },
    });
    await db.transaction.create({
      data: { userId: buyer.id, type: "subscription", amount: sa.price, agentId: sa.id, note: `訂閱 ${sa.name}` },
    });
  }
  // buyer pass
  await db.pass.create({ data: { userId: buyer.id, active: true, monthlyPrice: 129 } });

  // --- A sample conversation with escalation for the demo buyer ---
  const firstAgent = createdAgents[0];
  const convo = await db.conversation.create({
    data: {
      userId: buyer.id,
      agentId: firstAgent.id,
      isTrial: false,
      messages: {
        create: [
          { role: "user", content: "我們要在三個轄區同時上線一項金融商品，KYC 流程可以共用嗎？" },
          { role: "assistant", content: "針對你的問題，我從法規遵循的角度分析如下：\n\n1. **適用轄區識別** — 三個轄區的 KYC 門檻與強化盡職調查（EDD）觸發條件不同，不建議直接共用同一套流程。\n2. **差異比對** — 我已比對三地最新規範，其中一地要求受益所有權穿透至 25% 以下。\n\n此為參考意見。若要用於正式申報，建議一鍵升級由專家實名簽核。" },
        ],
      },
    },
  });
  await db.escalation.create({
    data: {
      conversationId: convo.id,
      agentId: firstAgent.id,
      userId: buyer.id,
      expertUserId: firstAgent.creatorId,
      status: "answered",
      tier: "standard",
      price: 220,
      question: "三轄區共用 KYC 流程是否可行，能否出具可放入申報文件的簽核？",
      answer: "經本人核對三地最新規範，不建議完全共用；可共用身分驗證基礎層，但 EDD 與受益所有權穿透須依各轄區分別處理。詳附版本溯源。",
      signed: true,
      answeredAt: new Date(),
    },
  });
  await db.transaction.create({
    data: { userId: buyer.id, type: "escalation", amount: 220, agentId: firstAgent.id, note: "真人升級 · 已簽核" },
  });

  // --- Enterprise: seats, audit log, blacklist ---
  const seatEmails = [
    ["alex@meridian.bank", "Alex Chen · 合規"],
    ["dana@meridian.bank", "Dana Wu · 風控"],
    ["sam@meridian.bank", "Sam Ho · 法遵"],
    ["kai@meridian.bank", "Kai Lin · 產品"],
  ];
  for (const [em, nm] of seatEmails) {
    await db.enterpriseSeat.create({ data: { orgOwnerId: enterprise.id, memberEmail: em, memberName: nm, status: "active" } });
  }
  const auditActions = [
    { a: "查詢", ag: createdAgents[0] },
    { a: "查詢", ag: createdAgents[3] },
    { a: "真人升級", ag: createdAgents[0] },
    { a: "簽核申請", ag: createdAgents[7] },
    { a: "查詢", ag: createdAgents[12] },
  ];
  for (let i = 0; i < auditActions.length; i++) {
    const x = auditActions[i];
    await db.auditLog.create({
      data: {
        orgOwnerId: enterprise.id,
        actorEmail: seatEmails[i % seatEmails.length][0],
        agentId: x.ag.id,
        agentName: x.ag.name,
        action: x.a,
        query: pick(["跨轄區 KYC 差異", "廣告文案合規檢查", "衍生品條款解讀", "風險揭露審查"], i),
      },
    });
  }
  await db.blacklist.create({
    data: { orgOwnerId: enterprise.id, agentId: createdAgents[20]?.id || createdAgents[0].id, agentName: createdAgents[20]?.name || "", reason: "Did not pass internal security review — suspended for org use." },
  });
  await db.user.update({ where: { id: enterprise.id }, data: { orgBudgetMonthly: 2000 } });
  // enterprise subscribes to a couple for the team
  for (const sa of [createdAgents[0], createdAgents[3]]) {
    await db.subscription.create({
      data: { userId: enterprise.id, agentId: sa.id, status: "active", price: sa.price, mcpToken: tok() },
    });
  }

  // --- Held-out fidelity samples for the demo expert (real input for the harness) ---
  // The samples must be written in the AGENT'S language — the harness scores the avatar
  // against the expert's own words, so a language mismatch would (correctly) score ~0.
  {
    const demoId = creatorByName[demoCreatorName];
    const demoAgentsForFidelity = createdAgents.filter((a) => a.creatorId === demoId).slice(0, 2);
    const ZH = [
      { q: "客戶要把個資傳到美國的供應商，你會怎麼處理？",
        a: "我會先看傳輸機制，而不是先看供應商。第一步確認合法性基礎，接著決定傳輸工具：先看適足性認定，沒有的話就用標準契約條款並做傳輸影響評估。評估一定要寫下來，因為主管機關來問的就是這份文件。補充措施——加密、假名化、稽核權——要針對當事人的實際風險來決定，不能套模板。如果供應商做不到這些保護，答案就是不行，而且我會早點講清楚，不會用文件去粉飾。" },
      { q: "KYC 盡職調查要做到什麼程度才算足夠？",
        a: "足夠的標準是：一年後另一個稱職的人能重建你的判斷過程。我要看到風險評分的理由、資金來源與財富來源的區分、實質受益人穿透到自然人、以及對高風險因子的具體處置。文件長度不是重點，可追溯的推理才是。一份結論說「無風險」的盡職調查，通常代表根本沒做。" },
      { q: "業務要求在審查完成前先讓客戶上線，你怎麼辦？",
        a: "我會把「真正的阻斷點」和「只是還沒做完」分開。如果缺的是合法性基礎或未緩解的高風險，那就不能上線，我會直接說。如果只是文件落後，我會讓他們在書面條件與明確期限下先上線，而且我會盯到底。我不會拿真實風險去換時程，但也不會用文書作業綁架一個上線。" },
      { q: "遇到疑似可疑交易，你的判斷順序是什麼？",
        a: "先看行為是否偏離該客戶既有的正常模式，而不是先看金額大小。接著檢查是否有結構化拆單、與業務性質不符的資金流、或高風險轄區的中介。我會保留原始佐證並寫下判斷理由，因為申報與不申報都要能被檢視。若合理懷疑成立就依法申報，不通知客戶；有疑慮但不成立，也要留下這次判斷的紀錄。" },
    ];
    const EN = [
      { q: "A client wants to transfer personal data to a US vendor. How do you approach it?",
        a: "I start from the transfer mechanism, not the vendor. Establish the lawful basis, then the transfer tool: adequacy first, otherwise standard contractual clauses with a transfer impact assessment. I document the assessment because that is what a regulator asks for. Supplementary measures — encryption, pseudonymisation, audit rights — are decided against the actual risk to the data subject, not as boilerplate. If the vendor cannot support the safeguards, the answer is no, and I say so early rather than papering over it." },
      { q: "How much documentation is enough for a due diligence file?",
        a: "Enough that a competent stranger could reconstruct your reasoning a year later. I want the risk rating justified, source of funds separated from source of wealth, beneficial ownership traced to a natural person, and each high-risk factor explicitly dispositioned. Length is not the measure; traceable reasoning is. A file that concludes there is no risk is usually a file that has not been done." },
      { q: "The business wants to onboard before review is finished. What do you do?",
        a: "I separate what is genuinely blocking from what is merely unfinished. If the blocking issue is a lawful-basis gap or an unmitigated high risk, onboarding is not available and I will say that plainly. If it is documentation lag, I let them proceed under a dated written condition with a deadline I enforce. I never trade a real risk for a schedule, but I do not hold a launch hostage to paperwork either." },
      { q: "How do you triage a suspicious transaction?",
        a: "I look first at whether the behaviour departs from that customer's established pattern, not at the size of the amount. Then I check for structuring, flows inconsistent with the stated business, and intermediaries in high-risk jurisdictions. I preserve the underlying evidence and write down the reasoning, because both reporting and not reporting must survive review. If reasonable suspicion is met I report and do not tip off the customer; if it is not met, I still record how I reached that conclusion." },
    ];
    for (const ag of demoAgentsForFidelity) {
      const row = raw.find((r) => r.name === ag.name);
      const qs = (row?.lang || "en") === "zh" ? ZH : EN;
      for (const x of qs) {
        await db.fidelitySample.create({ data: { agentId: ag.id, question: x.q, expertAnswer: x.a } });
      }
    }
  }

  // --- Creator earnings ledger for demo creator (coherent demo tenant) ---
  const demoCreatorId = creatorByName[demoCreatorName];
  const demoAgents = createdAgents.filter((a) => a.creatorId === demoCreatorId);
  let grossLifetime = 0;
  for (const a of demoAgents) {
    // record real subscription revenue transactions so the earnings engine has a source of truth
    const n = Math.max(4, Math.min(24, Math.round(a.price > 0 ? 18 : 6)));
    for (let i = 0; i < n; i++) {
      await db.transaction.create({ data: { userId: demoCreatorId, type: "subscription", amount: a.price, agentId: a.id, note: `Subscription revenue · ${a.name}`, status: "succeeded" } });
      grossLifetime += a.price;
    }
  }
  const lifetimeShare = Math.round(grossLifetime * 0.85);
  const priorWithdrawn = Math.round(lifetimeShare * 0.35);
  await db.creatorProfile.updateMany({ where: { userId: demoCreatorId }, data: {
    totalEarnings: lifetimeShare,
    withdrawnTotal: priorWithdrawn,
    pendingPayout: 0,
    payoutMethod: "paypal",
    payoutDetailMasked: "c•••@wiz-agents.com",
    payoutVerified: true,
  } });
  // a completed payout in history
  await db.payout.create({ data: {
    creatorId: demoCreatorId, amount: priorWithdrawn, feePct: 0, feeAmount: 0, netAmount: priorWithdrawn,
    method: "paypal", destinationMasked: "c•••@wiz-agents.com", status: "paid",
    note: "Monthly withdrawal", processedAt: new Date(Date.now() - 6 * 86400000),
  } });
  await db.transaction.create({ data: { userId: demoCreatorId, type: "payout", amount: -priorWithdrawn, note: "Withdrawal to paypal c•••@wiz-agents.com", status: "succeeded" } });

  // --- sample notifications ---
  await db.notification.createMany({ data: [
    { userId: buyer.id, type: "escalation_answered", title: `你的升級已回覆：${firstAgent.name}`, body: "專家已實名簽核，可放入稽核文件。", href: "/dashboard" },
    { userId: buyer.id, type: "knowledge_update", title: `${createdAgents[3].name} 知識庫已更新`, body: "本週新增最新法規修訂，你的 Agent 即時生效。", href: `/agent/${createdAgents[3].slug}` },
    { userId: buyer.id, type: "welcome", title: "歡迎使用 WizAgents", body: "訂閱一位專家，而不是買一段提示詞。", href: "/market" },
  ] });
  await db.notification.createMany({ data: [
    { userId: demoCreatorId, type: "subscription", title: `新訂閱者：${demoAgents[0]?.name ?? "你的 Agent"}`, body: "有新買家訂閱了你的 Agent，月費 $49。", href: "/studio" },
    { userId: demoCreatorId, type: "review", title: "新評價：5 星", body: "訂閱者給了你的 Agent 5 星好評。", href: "/studio" },
  ] });

  console.log("Seed complete ✔");
  console.log("Accounts (password: demo1234):");
  console.log("  買家:   buyer@wiz-agents.com");
  console.log("  創作者: creator@wiz-agents.com");
  console.log("  企業:   enterprise@wiz-agents.com");
  console.log("  管理員: admin@wiz-agents.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
