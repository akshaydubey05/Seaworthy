# Seaworthy

Pre-launch security checks for AI-built apps.

Seaworthy runs fast, public, deterministic checks against a URL and returns evidence-backed findings, a 0-100 score, coverage, and a shareable report. It is designed for vibe-coded and AI-assisted apps that need a clear launch-readiness signal before charging money.

## V1 (current)

- **Fast Scan**: public URL scan with 34 deterministic checks, including same-origin JS bundle secret scanning
- **Evidence-backed findings**: severity, type (exposure / signal / hardening), evidence, and plain-English fix
- **Honest scoring**: a separate exposure score and hardening score; header gaps cannot dominate the risk score
- **Report**: shareable report page and PDF export
- **Waitlist**: in-app capture for Full Report and Monitor
- **Safety**: SSRF/DNS guard, port allowlist, redirect re-validation, response size cap, rate limits, body limits, honeypot
- **Production persistence**: Postgres when `DATABASE_URL` is set; local `.data/` fallback for development
- **Observability**: structured JSON logs, `instrumentation.ts` error capture, optional error webhook, `/api/health`
- **Legal/trust**: Terms, Privacy, Security/responsible disclosure, best-effort/not-a-pentest messaging, Cloudflare skill attribution

## Docs

- `docs/Seaworthy-Plan-v1.pdf` - current plan (canonical)
- `docs/Seaworthy-Plan-v1.1.pdf` - dated copy of current plan
- `docs/Seaworthy-Versions-Roadmap.md` - full V1→V4 roadmap
- `docs/METHODOLOGY.md` - what a finding means, scoring, and false-positive controls
- `docs/QA-V1.md` - QA record
- `SECURITY.md` - vulnerability reporting policy
- `DEPLOYMENT.md` - production deploy checklist

## Stack

- Next.js 16 (App Router, Cache Components)
- React 19
- TypeScript
- Tailwind CSS 4
- Zod
- PostgreSQL (`pg`)
- PDFKit
- Go 1.24 scan service (`services/scanner`)

The Go service is the preferred scan engine. The TypeScript engine stays in the
app as a fallback so a scanner outage does not take the site down.

## Local development

```bash
npm install
cp .env.example .env.local   # optional; fill in values as needed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To use the Go scanner locally:

```bash
cd services/scanner
SCANNER_TOKEN=local-test-token go run ./cmd/scanner
```

Then set `SCANNER_URL=http://localhost:8080` and the same `SCANNER_TOKEN` in
`.env.local`. Without those, the app uses its built-in TypeScript engine.

Without `DATABASE_URL`, scans and waitlist entries are stored in `.data/` (gitignored). This is a development convenience only.

## Environment

See `.env.example`. The important ones:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | canonical site URL used in metadata, user-agent, sitemap |
| `NEXT_PUBLIC_CONTACT_EMAIL` | support/legal contact |
| `NEXT_PUBLIC_SECURITY_EMAIL` | vulnerability reports |
| `DATABASE_URL` | Postgres connection string (include `sslmode=require`) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | distributed rate limiting |
| `ERROR_WEBHOOK_URL` | Slack/Discord/generic JSON error alerts |
| `SCANNER_URL` / `SCANNER_TOKEN` | use the Go scanner service when both are set |

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
npm run db:migrate
npm run qa
npm run qa:credibility
npm test
```

`npm run db:migrate` applies `db/schema.sql` to `DATABASE_URL`. `npm run qa:credibility` re-scans Google, Cloudflare, and example.com and fails if a hardened site is treated as vulnerable.

## Project structure

- `src/app/` - pages and API routes (`/`, `/report/[id]`, `/terms`, `/privacy`, `/security`, `/api/*`)
- `src/components/` - UI components
- `src/lib/checks.ts` - deterministic fast-scan checks
- `src/lib/deep-checks.ts` / `src/lib/deep.ts` - gated deep-scan checks (paid tier foundation)
- `src/lib/scan.ts` - scan orchestration, scoring, coverage, SSRF/DNS guard, JS bundle fetching (fallback engine)
- `src/lib/scanner-client.ts` - Go scanner client, payload validation, fallback policy
- `services/scanner/` - Go scan service (preferred engine, tests, Dockerfile)
- `src/lib/store.ts` - storage abstraction (Postgres or local file)
- `src/lib/db.ts` - Postgres queries and pool
- `src/lib/rate-limit.ts` - Upstash or in-memory rate limiting
- `src/lib/observability.ts` - structured logs and error capture
- `db/schema.sql` - production schema
- `scripts/` - plan generator and DB migration
- `docs/` - plan and version roadmap

## API

- `POST /api/scan` - run a scan (`{ "url": "https://example.com", "mode": "fast" }`; `deep` requires paid key gate)
- `POST /api/waitlist` - join the waitlist (`{ "email": "you@example.com" }`)
- `GET /api/report/[id]` - JSON report
- `GET /api/report/[id]/pdf` - PDF report
- `GET /api/health` - health/storage/config status

Internal scanner API (`services/scanner`): `GET /health`, `POST /v1/scan` (token required). See `services/scanner/README.md`.

## V1 release checklist

- [x] Fast scan, report, PDF, waitlist flows
- [x] Premium responsive UI, reduced-motion/transparency fallbacks
- [x] Terms/Privacy/Security pages and legal disclaimers
- [x] Cloudflare `security-audit-skill` MIT attribution/no endorsement
- [x] Postgres persistence with local dev fallback
- [x] Rate limiting, body limits, honeypot, SSRF/DNS guard
- [x] Structured logs, error capture hook, health endpoint, CI
- [x] Lint/build pass
- [x] Browser QA (390/768/1024/1440, keyboard/focus, scan → report → PDF, waitlist, 429s) — see `docs/QA-V1.md`
- [ ] Production deploy + domain/env/monitoring (needs Vercel/registrar credentials)
- [ ] Final legal review by counsel for Terms/Privacy (text is complete; not attorney-reviewed)

## Important notes

- Fast Scan is **best-effort automated review**. It is **not a penetration test, certification, or guarantee**.
- Findings are classified as **exposure**, **signal**, or **hardening**. Only exposures move the risk score meaningfully; header gaps are hardening notes, not vulnerabilities. See `docs/METHODOLOGY.md`.
- Public URLs only. Private/internal hosts, non-80/443 ports, and private DNS resolutions are blocked.
- Deep/authenticated/runtime audits require separate sandboxed execution and are not part of V1 fast scan.
- The scan fetches a target once per scan and does not execute target code.

## Attribution

Seaworthy's security-audit concepts are informed in part by Cloudflare's MIT-licensed [`security-audit-skill`](https://github.com/cloudflare/security-audit-skill).

Copyright (c) Cloudflare, Inc.  
Used with attribution. Cloudflare does not endorse Seaworthy. See the upstream repository for license terms.
