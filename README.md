# WizAgents

**Subscribe to an expert, not a prompt.** A marketplace where verified human experts publish protected avatar Agents that buyers subscribe to over MCP — with an anti-distillation shield, provenance receipts, KYC-verified experts, enterprise seats & governance, and a community forum.

🔗 https://wiz-agents.com · 🛡️ Proprietary — All rights reserved · 🔒 Private repository

Built with **Next.js 15 (App Router), React 19, TypeScript, Prisma, and Tailwind.** Self-hostable via Docker.

---

## WizAgents — an expert-agent subscription marketplace (a runnable full-stack product)

Subscribe to an expert, not a prompt. A paid expert-agent subscription platform built on the open MCP protocol.

This is a genuinely runnable full-stack Next.js application: a real database, authentication, subscriptions, payments (test flow), streaming agent conversations, one authorized MCP endpoint per Agent, the Expert Loop (human escalation / named sign-off / version provenance), and complete buyer / creator / enterprise interfaces.

## Quick start

```bash
git clone https://github.com/Edwson/wizagents.git
cd wizagents
npm install     # install dependencies
npm run setup   # generate the Prisma client, create the SQLite database, seed the demo Agents
npm run dev     # start the dev server → http://localhost:3000
```

Open http://localhost:3000 and sign in with any of the demo accounts below (all passwords are `demo1234`):

| Role | Email | What you get |
|---|---|---|
| Buyer | buyer@wiz-agents.com | Marketplace, subscriptions, conversations, human escalation |
| Creator | creator@wiz-agents.com | Studio, publishing, revenue, the Expert Loop inbox |
| Enterprise | enterprise@wiz-agents.com | Seats, audit log, blacklist |
| Admin | admin@wiz-agents.com | Platform console (KPIs, moderation, rules engine) |

The login page also has one-click demo-account buttons. Press ⌘K / Ctrl+K on any page for quick search.

## Tech stack

- **Next.js 15** (App Router, React 19, TypeScript)
- **Prisma + SQLite** (runs with zero configuration; swap to Postgres for production)
- **JWT cookie authentication** (jose + bcryptjs, multi-role)
- **Tailwind CSS** (dark terminal-style design system)
- **Built-in expert conversation engine**: with no LLM key configured, a deterministic expert engine answers (fully usable offline); set a key and it switches to a real LLM. Replies stream token by token over SSE.

## The three surfaces

**Buyer** — marketplace (search / sort / categories with counts / pass / recommended-for-you), Agent detail pages, a free trial sandbox (streaming conversation), Stripe-style checkout, and a subscriptions dashboard (MCP endpoint + token, renewal management, human-escalation history, billing).

**Creator** — studio dashboard (subscriptions / MRR / renewal rate / revenue), a four-step no-code publishing wizard, Agent editing, knowledge-base version pushes (audit-grade provenance), identity verification, the Expert Loop escalation inbox (reply / sign-off), and a public storefront at `/creator/[id]`.

**Enterprise** — team seat management, a full audit log, a compliance blacklist, and an organisation-wide subscription overview.

**Expert Loop** — human escalation (an SLA queue), named sign-off (the responsibility transfer), and knowledge-version provenance.

## Every Agent = an authorized MCP endpoint

After subscribing you receive an endpoint and a token. Call it with standard MCP JSON-RPC:

```bash
# fetch the public manifest (no token required)
curl http://localhost:3000/api/mcp/kyc-aml

# call the Agent (requires a valid subscription token)
curl -X POST http://localhost:3000/api/mcp/kyc-aml \
  -H "Authorization: Bearer <your-subscription-token>" \
  -H "Content-Type: application/json" \
  -d '{"id":1,"method":"tools/call","params":{"name":"ask_expert","arguments":{"question":"How do KYC requirements differ across jurisdictions?"}}}'
```

Calling `tools/call` without a token returns **401** — this is the execution-layer moat behind "the prompt never leaves the server." For production, map `mcp.wiz-agents.com/a/{slug}` to this route.

## Connecting a real LLM (optional)

Edit `.env` (copy from `.env.example`):

```env
LLM_API_KEY=sk-...                      # any OpenAI-compatible endpoint
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Leave it empty and the built-in expert engine is used (every feature still works).

## Common commands

```bash
npm run dev     # development mode
npm run build   # production build
npm run start   # production server
npm run setup   # regenerate the client + create the DB + seed
npm run seed    # re-run the seed data only
```

## Next steps for production

- **Database**: change the `provider` in `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL` at a cloud Postgres.
- **Payments**: `/api/subscribe` and checkout are currently a test flow — wire up real Stripe (subscriptions + webhooks).
- **Security**: rotate `AUTH_SECRET`; keep Next.js on the latest patched release (`npm i next@latest`).
- **Deployment**: one-click deploy on Vercel; map the MCP endpoint domain to `/api/mcp/[slug]`.

## v1.1 (experience polish)

- **Streaming conversations**: Agent replies stream token by token — conversations feel immediate.
- **⌘K command palette**: quick-search Agents or jump to any page, from anywhere.
- **Creator public storefronts** at `/creator/[id]`: an expert's Agents, verification, and renewal rate on one page.
- **Global toast notifications**: instant feedback for subscriptions, reviews, seats, blacklist actions and more.
- **Mobile navigation**: hamburger menu — comfortable on phones.
- Loading skeletons and a 404 page; "recommended for you" and category counts in the marketplace.

## v1.2 (meaningful features + logical consistency)

- **Cross-role notifications**: a subscription notifies the creator; an escalation reply notifies the buyer; a knowledge push notifies every subscriber; a review notifies the creator. The nav bell shows the unread count.
- **Account settings** at `/settings`: edit your name, one-click "become a creator", verification status.
- **Creator revenue breakdown** at `/studio/revenue`: per-Agent split, take-rate breakdown, monthly revenue trend, Expert Loop premium income.
- **Role-aware navigation**: the Enterprise tab is visible to enterprise accounts only.
- **Consistency fixes**: escalation replies / sign-offs restricted to that Agent's expert; reviews restricted to subscribers with duplicate protection and live rating recalculation; cancelling a subscription decrements the count correctly.

## v1.3 (platformisation: Admin · rules · usage · MCP)

- **Admin console** at `/admin` (admin-only): platform KPI overview (GMV / revenue / subscriptions / usage), Agent listing moderation, user role management, creator verification review, a transaction ledger, platform settings editing, and one-click recomputation of derived data.
- **Platform rules engine**: take rate, pass pricing, default trial count, daily usage caps, and the Expert Loop cut — all adjustable live by an admin and driving platform-wide logic (revenue splits, pricing, rate limits).
- **Usage metering & rate limiting**: every conversation / MCP call is metered; exceeding the daily cap returns 429. Buyers, creators and admins can all see usage.
- **MCP hardening**: `resources/list` added (knowledge-base version provenance), usage metering, a fuller manifest; a public `/mcp` onboarding page with config generators for Claude Desktop / Cursor / cURL.
- New admin demo account: `admin@wiz-agents.com` (password `demo1234`).

## v1.4 (parallel development: content expansion + discovery / analytics / favourites)

- **Agents expanded to 180** across 30 vertical categories (adding data science, tax, security, DevOps, study-abroad, careers, materials, space and more).
- **Advanced search** at `/search`: keywords + multi-select categories (with counts) + price range + minimum renewal rate + pass filter + multi-dimensional sorting.
- **Agent comparison** at `/compare`: 2–3 Agents side by side (price / renewal / rating / capabilities / fees), best value highlighted per row.
- **Favourites / wishlist** at `/favorites`: one-click ♥ on any Agent detail page, managed in one place.
- **Creator deep analytics** at `/studio/analytics`: 14-day usage, subscription growth curve, per-Agent performance breakdown.
- All of the above reachable from the marketplace header and the ⌘K palette.
- This release was built as one lead plus three parallel sub-agents, then integrated.

## v1.5 (internationalization + Tabler icons)

- **Trilingual UI**: English (default), 日本語, 中文 — switch from the globe menu in the top nav; the choice is saved to a cookie and applied server-side with no flash.
- **i18n architecture**: `src/lib/i18n.tsx` (client `useI18n().t(en, ja, zh)`) + `src/lib/locale.ts` (server `getLocale()` / `pick()`). English is the default fallback.
- **Tabler icons** (`/icons-react`) replace all emoji across the product for a consistent, professional icon set.

## Project structure

```text
app/
├── prisma/
│   ├── schema.prisma   # 15 data models
│   ├── seed.ts         # demo Agents + creators + per-role data
│   └── data/           # seed-source JSON
├── src/
│   ├── app/            # pages & API routes (App Router)
│   │   ├── market/ agent/ creator/ dashboard/ studio/ enterprise/ login/
│   │   └── api/        # auth, chat(+stream), subscribe, escalation, mcp, creator, enterprise, agents…
│   ├── components/     # UI components (market cards, streaming chat, command palette, toasts, dashboards…)
│   └── lib/            # db, auth, session, agent-engine, categories…
└── .env
```
