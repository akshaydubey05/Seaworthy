# Seaworthy scan methodology (V1)

Seaworthy runs **best-effort, deterministic checks against one public response**. It is not a penetration test, a certification, or a guarantee. This page explains what the output means so the score stays honest.

## What a scan does

1. Normalizes the URL and rejects private/internal targets (SSRF/DNS guard, ports 80/443 only).
2. Fetches the page over HTTPS with redirects re-validated on every hop (max 5).
3. Caps the response at 300 KB and reads headers plus HTML.
4. Runs 30 deterministic checks. No code from the target is executed.
5. Stores the receipt and renders the report/PDF.

## Three finding types

| Type | Meaning | Counts toward exposure score? |
|---|---|---|
| **Exposure** | A credential, leak, or misconfiguration that looks exploitable now (e.g. `sk_live_` key, private key, permissive CORS, weak session cookie). | Yes, heavily |
| **Signal** | A pattern worth validating, but not proof of a problem (e.g. Supabase usage, source maps, redirect parameters). | Yes, lightly |
| **Hardening** | A best-practice gap such as a missing header. Useful, but not evidence of a vulnerability. | Barely (capped at 6 points total) |

The report shows an **Exposure score** (risk) and a separate **Hardening score** (header/best-practice posture).

## Why big sites still show notes

A scan sees **one public response**. Large sites:

- terminate at edge networks that add headers per route, region, or user agent;
- ship CSP in **report-only** mode first (Google does this on the homepage);
- put `Referrer-Policy` in a `<meta>` tag instead of a header;
- render footers and legal links client-side, or past the 300 KB cutoff.

So a header can be absent on the homepage while the application is well protected. Seaworthy therefore labels header gaps **hardening**, rates them **low**, and caps their effect on the exposure score. A 100 exposure score means "no exposure signals observed on this page", not "secure".

## False-positive controls

- CSP: accepts enforcing header, report-only header, and `<meta http-equiv>`; report-only is a low hardening note, not a "missing CSP" vulnerability.
- Referrer-Policy: accepts the header or `<meta name="referrer">`.
- Frame protection: accepts `X-Frame-Options` or an enforcing `frame-ancestors`; report-only is flagged as report-only.
- Mixed content: only matches resource-loading attributes (`src`, `poster`, `action`, `<link href>`), so `itemtype="http://schema.org/..."` is ignored.
- Secret keys: high-confidence prefixes only (`sk_live_`, `sk-proj-`, `sk-ant-`, `AIzaSy…`, private-key blocks). Generic `sk-…` strings are no longer treated as keys.
- Stripe: a marketing mention of "Stripe" is not a finding. Webhook verification is a **manual check**, only shown when `js.stripe.com` is actually loaded.
- Session cookies: only session-like cookie names are checked for `HttpOnly`/`Secure`; analytics cookies are ignored.
- Privacy/terms: skipped when the HTML was truncated, because the footer may be past the cutoff.
- Non-HTML or error responses: body checks are marked **skipped**, not passed or failed; only headers are evaluated.

## Scoring

```
exposure score  = 100 − exposure penalties − signal penalties − min(hardening penalties, 6)
hardening score = 100 − hardening penalties
```

Weights (exposure / signal / hardening):

| Severity | Exposure | Signal | Hardening |
|---|---|---|---|
| critical | 32 | 10 | 3 |
| high | 20 | 7 | 2 |
| medium | 10 | 4 | 1 |
| low | 4 | 2 | 0.5 |

The exposure score is clamped to 5–100. A page with only header gaps stays in the high 90s; a leaked live key drops it sharply.

## Manual checks

Some things cannot be verified from outside. When the page suggests them, the report lists them under **Verify manually** instead of pretending they are findings:

- Supabase RLS on every table
- Firebase security rules
- Stripe webhook signature verification
- Login rate limiting and session lifetime
- CSRF protection on forms
- Upload validation
- Admin/debug route authorization
- Open-redirect handling

## Limitations

- One public page, one user agent, one point in time.
- No authenticated routes, APIs, mobile apps, or runtime behavior.
- No exploit attempts and no payload injection.
- HTML is capped at 300 KB; late-page signals can be missed.
- CDNs may serve different headers to different clients.
- Client-rendered content (SPAs) may not appear in the fetched HTML.

These limits are repeated in the report under **Scan limitations**, and the result should be treated as a triage aid, not a verdict.
