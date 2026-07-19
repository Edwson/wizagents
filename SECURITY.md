# WizAgents — Security

## What is built and working locally

- **Password auth**: bcrypt hashing; generic error messages (no account enumeration).
- **Password strength policy**: min length, upper/lower/number, blocks common passwords (enforced on sign-up).
- **Rate limiting**: sliding-window limits per IP and per email on login/register; 429 with Retry-After.
- **Account lockout**: 5 failed logins → 15-minute lock.
- **Two-factor auth (TOTP)**: enroll in Account Settings (QR + secret for Google Authenticator / Authy / 1Password), one-time **backup codes**, and a login challenge step. Backup codes are single-use and hashed at rest.
- **Email verification**: a verification token is issued on sign-up (`/verify-email?token=…`). In dev the link is returned in the response; in production, email it (add SMTP).
- **Sessions**: httpOnly, SameSite=Lax, signed JWT (jose). A short-lived pre-auth cookie gates the 2FA step.
- **MCP token rotation**: each subscription's MCP token can be rotated (old token instantly revoked) from the dashboard.
- **Per-subscription rate limits** on chat/MCP calls (configurable in Admin).
- **Asset scanning**: every creator upload is scanned before it can be attached — size/type allowlist, magic-byte checks, executable detection (PE/ELF/Mach-O), EICAR test-signature detection, and script/shell-pattern heuristics. Infected/suspicious files are quarantined and never persisted.
- **Business-rule guards**: no self-dealing (subscribe/review/escalate own Agent), publish validation, safe-delete, pass-bundle lapse.

## What needs YOUR credentials to go live

Add these to `app/.env` (all optional; features stay dormant/mocked until set):

```
# OAuth — create an app with each provider and paste client id/secret
APP_ORIGIN=https://your-domain.com          # used for OAuth redirect URIs
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=                         # Apple uses a signed JWT client secret

# Payments — Stripe test or live keys + webhook signing secret
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Optional deeper malware scan
VIRUSTOTAL_API_KEY=

# LLM (optional; falls back to the built-in expert engine)
LLM_API_KEY=
```

- **Google/GitHub/Apple sign-in**: the buttons appear on the login page automatically once a provider's id+secret are set. Callback URL: `${APP_ORIGIN}/api/auth/oauth/<provider>/callback` (register this with the provider). Google & GitHub are wired end-to-end; Apple uses the same flow but its client secret must be a signed JWT (see Apple docs).
- **Stripe**: `/api/stripe/webhook` verifies the signature before acting. Wire your Checkout/PaymentIntent to replace the mock checkout. Never trust client-side amounts — always create the charge server-side.

## Production hardening checklist
- Move DB to Postgres; set a strong `AUTH_SECRET`.
- Serve over HTTPS; set `Secure` on cookies.
- Send verification/reset emails via SMTP or a provider.
- Run a real AV daemon (ClamAV) or VirusTotal for uploads; store assets in object storage with server-side scanning.
- Add CSRF protection on state-changing form posts if you add non-fetch forms.
