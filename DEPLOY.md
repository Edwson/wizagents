# Deploying WizAgents

WizAgents ships as a self-contained Docker image (Next.js standalone) with Postgres.
It runs anywhere Docker runs — a VPS, a cloud VM, or your laptop.

## Quick start (Docker Compose)

```bash
cp .env.docker.example .env
# edit .env: set a strong POSTGRES_PASSWORD and AUTH_SECRET
#   AUTH_SECRET can be generated with:  openssl rand -base64 48
docker compose up -d --build
```

Then open http://localhost:3000. On first boot the app waits for Postgres,
applies the schema, and seeds demo data automatically (only if the DB is empty).

Demo accounts (password `demo1234`): `buyer@` / `creator@` / `enterprise@` / `admin@wiz-agents.com`.

## Required environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (compose sets this for you) |
| `AUTH_SECRET` | yes (prod) | Long random string; the app refuses to start in production without it |
| `WEBAUTHN_RP_ID` | for passkeys | Your domain, e.g. `wiz-agents.com` (use `localhost` for local) |
| `WEBAUTHN_ORIGIN` | for passkeys | Full origin, e.g. `https://wiz-agents.com` |
| `LLM_API_KEY` | optional | Any OpenAI-compatible key for live chat; blank uses the built-in offline expert engine |

## Production behind a domain (TLS)

Passkeys/biometric and secure cookies require HTTPS in production. Put a reverse
proxy (Caddy, nginx, or your cloud LB) in front of the app on :3000 and terminate
TLS there, then set `WEBAUTHN_ORIGIN=https://your-domain` and `WEBAUTHN_RP_ID=your-domain`.

Example Caddyfile:

```
wiz-agents.com {
    reverse_proxy localhost:3000
}
```

## Health check

`GET /api/health` returns `200 {ok:true}` when the app and DB are healthy, `503` otherwise.
The container's Docker HEALTHCHECK uses this endpoint.

## Data & migrations

The entrypoint runs `prisma db push` (schema sync) on boot. For controlled
migrations, generate them with `prisma migrate dev` in development and switch the
entrypoint to `prisma migrate deploy`. The Postgres volume `wizagents_db` persists data.

## Notes

- The image targets Postgres (the Dockerfile swaps the Prisma provider at build).
  Local development still uses SQLite via `npm run setup && npm run dev`.
- Rate limiting is in-memory (per instance). For multi-instance deployments, back
  it with Redis (see `src/lib/security.ts`).
- Payouts record a ledger; wire a real Stripe Connect / PayPal Payouts transfer for
  live settlement (the `Payout` model is structured for it).
