# Seaworthy V1 — QA record

**Date:** 2026-11-23
**Build:** Next.js 16.4.6, production build (`npm run build`)
**Method:** headless Chromium (CDP) driven by `scripts/qa-smoke.mjs` against a local dev server, plus the in-app browser for visual review.

## Automated smoke (`npm run qa` → `node scripts/qa-smoke.mjs`)

Result: **QA PASS**

| Area | Check | Result |
|---|---|---|
| Responsive | No horizontal overflow at 390 / 768 / 1024 / 1440 | pass |
| Responsive | Scan submit button rendered at every width | pass |
| Keyboard | First tab stops show a visible focus ring; skip link is first | pass |
| Scan | `https://example.com` → receipt link rendered | pass |
| Report | `GET /api/report/:id` returns 200 + JSON | pass |
| Report | `/report/:id` renders receipt, score, coverage, findings | pass |
| PDF | `GET /api/report/:id/pdf` returns 200, `application/pdf`, valid `%PDF-` header | pass |
| Waitlist | Valid email saves and shows the success state | pass |
| Abuse | 8 rapid waitlist posts return `429` with `Retry-After` | pass |
| Console | No uncaught errors or `console.error` during the run | pass |

Screenshots are written to `qa/` (gitignored): `home-390.png`, `home-768.png`, `home-1024.png`, `home-1440.png`, `report-1440.png`.

## Headers verified locally

- `Content-Security-Policy` (with `frame-ancestors 'none'`, `object-src 'none'`)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/mic/geolocation/payment disabled)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Powered-By` absent

## Also verified

- `GET /api/health` returns 200 with `storage.mode` (`file` locally, `postgres` when `DATABASE_URL` is set).
- `GET /robots.txt` and `GET /sitemap.xml` render and use `NEXT_PUBLIC_APP_URL`.
- Reduced-motion and transparency fallbacks are defined in `globals.css` (`prefers-reduced-motion`, `prefers-reduced-transparency`).
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.

## Not covered here (requires credentials / external accounts)

- Real production deploy, custom domain, and TLS.
- Postgres migration against a live database (`npm run db:migrate` needs `DATABASE_URL`).
- Upstash distributed rate-limit path (in-memory limiter is what CI exercises).
- Error webhook delivery (`ERROR_WEBHOOK_URL`).
- Attorney review of Terms/Privacy.
