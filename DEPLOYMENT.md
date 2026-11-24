# Deploying Seaworthy (V1)

This is the production checklist for V1. It assumes Vercel + a hosted Postgres (Neon or Supabase) + optional Upstash Redis.

## 1. Database

1. Create a Postgres database (Neon free tier is enough for V1).
2. Copy the **pooled** connection string. It should include `?sslmode=require`.
3. Apply the schema:

```bash
DATABASE_URL="postgresql://...?sslmode=require" npm run db:migrate
```

Schema lives in `db/schema.sql`. It creates `scans` and `waitlist`.

## 2. Distributed rate limiting (recommended)

1. Create an Upstash Redis database (free tier).
2. Copy the REST URL and token into the Vercel env vars below.

Without Upstash, rate limits are per-instance in memory, which is weak on serverless.

## 3. Vercel project

1. Import `https://github.com/akshaydubey05/Seaworthy`.
2. Framework preset: Next.js. Build command: `npm run build`.
3. Add environment variables:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | `https://your-domain.com` (no trailing slash) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | yes | support/contact inbox |
| `NEXT_PUBLIC_SECURITY_EMAIL` | yes | vulnerability reports inbox |
| `NEXT_PUBLIC_COMPANY_NAME` | recommended | legal entity or product name |
| `NEXT_PUBLIC_JURISDICTION` | recommended | governing-law jurisdiction |
| `DATABASE_URL` | yes for production | pooled Postgres URL with `sslmode=require` |
| `DATABASE_POOL_MAX` | optional | defaults to `5` |
| `UPSTASH_REDIS_REST_URL` | recommended | distributed rate limits |
| `UPSTASH_REDIS_REST_TOKEN` | recommended | distributed rate limits |
| `ERROR_WEBHOOK_URL` | optional | Slack/Discord/generic JSON error alerts |
| `SCANNER_URL` | recommended | Go scanner base URL, e.g. `https://scanner.your-domain.com` |
| `SCANNER_TOKEN` | recommended | shared secret; must match the scanner's `SCANNER_TOKEN` |

4. Deploy.

## 4. Domain

1. Add the custom domain in Vercel.
2. Set `NEXT_PUBLIC_APP_URL` to the final `https://` URL and redeploy.
3. HSTS is sent by the app; confirm the site is HTTPS-only.

## 5. Post-deploy verification

- [ ] `GET /api/health` returns `200` with `storage.mode = "postgres"`.
- [ ] `GET /.well-known/security.txt` returns the contact and policy URLs.
- [ ] Run a fast scan against a safe public URL (e.g. `https://example.com`).
- [ ] Open the report page and download the PDF.
- [ ] Submit the waitlist form and confirm the row in `waitlist`.
- [ ] Confirm `x-content-type-options`, `content-security-policy`, and `strict-transport-security` response headers.
- [ ] Trigger a deliberate 400/500 and confirm it appears in logs/webhook.
- [ ] Send 7 scans quickly and confirm `429` with `Retry-After`.
- [ ] Check Lighthouse/accessibility on `/`, `/terms`, `/privacy`, `/security`.

## 6. Monitoring

- Vercel logs capture structured JSON events (`scan_completed`, `scan_rate_limited`, `error_captured`, …).
- `ERROR_WEBHOOK_URL` receives server errors captured by `instrumentation.ts` and API routes.
- `/api/health` is safe for uptime monitors (no secrets, no-store).
- For richer tracing later, add Sentry/OpenTelemetry in `src/instrumentation.ts`.

## 7. Persistence note

The local `.data/` store remains as a development fallback only. In production, set `DATABASE_URL`; otherwise scans are not durable on serverless. The app logs `file_storage_in_use` if it detects production without a database.

## 8. Go scanner service (recommended)

Vercel cannot host the Go binary, so the scanner runs on a container host.

1. Pick a host: Fly.io, Render, Railway, or Google Cloud Run.
2. Deploy `services/scanner` using its Dockerfile. Full steps and a Fly example
   are in `services/scanner/README.md`.
3. Generate a token: `openssl rand -hex 32` (or any long random string).
4. Set `SCANNER_TOKEN` on the scanner host and the same value in Vercel.
5. Set `SCANNER_URL` in Vercel to the scanner's public URL (no trailing slash).
6. Redeploy the web app and confirm logs show `scan_remote_ok` when scanning.

Safety properties:

- If the scanner is down or returns a malformed payload, the app logs
  `scan_remote_fallback` and uses the built-in TypeScript engine. Users still get
  a report.
- If the target itself is invalid (private IP, bad URL), the scanner returns 400
  and the app does not retry locally.
- The scanner is stateless: no database, no disk, no access to user data. Keep it
  private if your host supports private networking.

Verification checklist:

- [ ] `GET <SCANNER_URL>/health` returns `{"ok":true,...}`.
- [ ] `POST <SCANNER_URL>/v1/scan` without a token returns `401`.
- [ ] A scan through the website logs `scan_remote_ok` and shows `checksTotal` of 34 (fast) or 42 (deep).
- [ ] Stop the scanner and re-run a scan: the site still returns a report (fallback).
- [ ] Start the scanner again: scans go back to the Go service.
