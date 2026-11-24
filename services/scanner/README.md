# Seaworthy scanner (Go)

Standalone scan service. The Next.js app owns the UI, accounts, billing, reports,
and PDFs; this service owns scanning.

Why it exists:

- Go is a better fit for concurrent fetches, TLS, DNS, and security tooling.
- The scanner can be scaled, deployed, and restarted without touching the website.
- The app keeps a TypeScript copy of the rules as an offline fallback, so a
  scanner outage degrades to "slower/less complete scan", never a broken site.

## API

```http
GET  /health                 -> { ok, service, version }        (public)
POST /v1/scan                -> ScanResult JSON                 (token required)
```

Request:

```json
{ "url": "https://example.com", "mode": "fast" }
```

`mode` is `fast` or `deep`. Anything else is treated as `fast`.

Auth: send `x-scanner-token: <SCANNER_TOKEN>` or `Authorization: Bearer <token>`.
The comparison is constant-time. There is no public access.

Responses:

| Status | Meaning |
|---|---|
| 200 | scan completed |
| 400 | invalid target (private IP, bad URL, bad JSON) — do not retry |
| 401 | missing/wrong token |
| 413 | request body over 4 KB |
| 429 | concurrency limit reached — retry shortly |
| 500 | internal error |
| 504 | scan timed out |

The JSON contract is defined in `internal/model/model.go` and validated again in
`src/lib/scanner-client.ts`, so a schema drift cannot produce a half-rendered report.

## Configuration

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SCANNER_TOKEN` | yes | — | long random string; same value in the web app |
| `PORT` | no | `8080` | listen port |
| `SCANNER_MAX_CONCURRENT` | no | `8` | simultaneous scans; extra requests get 429 |
| `SCANNER_ALLOW_PRIVATE` | test only | `false` | permits localhost/private targets |
| `SCANNER_ALLOW_ANY_PORT` | test only | `false` | permits non-80/443 ports |

Never enable the two `ALLOW_*` flags in production. They exist so tests can scan
an `httptest` server.

## Run locally

```bash
cd services/scanner
SCANNER_TOKEN=local-test-token go run ./cmd/scanner
```

Then point the web app at it (`.env.local`):

```bash
SCANNER_URL=http://localhost:8080
SCANNER_TOKEN=local-test-token
```

The app prefers the Go service when both variables are set and falls back to its
built-in TypeScript engine otherwise. Logs show `scan_remote_ok` or
`scan_remote_fallback` with a reason.

## Test

```bash
go vet ./...
go test ./...
go test -race ./...
```

Coverage includes:

- SSRF/URL hardening (`internal/netguard`): private ranges, IPv4/IPv6, local
  names, credentialed URLs, redirect hops, DNS failures.
- Rule behaviour and scoring parity (`internal/checks`).
- End-to-end scan against `httptest` servers (`internal/scan`): secret in a JS
  bundle, CSP quality, mixed content, SRI, deep checks, 5xx handling, check counts.
- HTTP contract (`internal/httpapi`): auth, bad input, 413, capacity 429, method
  restrictions, `no-store`.

`tests/scanner-contract.test.ts` in the web app fails if the Go rule IDs drift
from the TypeScript fallback, so the advertised "34 checks" cannot silently
diverge.

## Docker

```bash
docker build -t seaworthy-scanner .
docker run --rm -p 8080:8080 -e SCANNER_TOKEN=change-me seaworthy-scanner
```

The image is distroless and runs as a non-root user. It is stateless; there is no
database or disk access. All persistence stays in the web app.

## Deploy

Any container host works. Fly.io example:

```bash
cd services/scanner
fly launch --no-deploy --name seaworthy-scanner
fly secrets set SCANNER_TOKEN="$(openssl rand -hex 32)"
fly deploy
fly scale count 2          # two machines, one per region if desired
```

Then in Vercel set:

```bash
SCANNER_URL=https://seaworthy-scanner.fly.dev
SCANNER_TOKEN=<the same secret>
```

Render/Railway/Cloud Run are equivalent: build the Dockerfile, set
`SCANNER_TOKEN`, expose `PORT`.

Keep the service private if your host supports it (Fly private networking, Cloud
Run IAM, or an allowlist for the Vercel egress ranges). The token is the minimum
bar, not the only one.

## Security model

- Only `http`/`https`, ports 80/443, no embedded credentials.
- Every hostname is resolved and every A/AAAA record is checked against private,
  loopback, link-local, CGNAT, documentation, and multicast ranges.
- Redirects are followed manually (max 5) and each hop is re-validated.
- Same-origin script bundles are capped (2 × 150 KB fast, 8 × 300 KB deep) and
  fetched with their own timeout.
- Response bodies are capped at 300 KB.
- Findings never include full secret values; evidence redacts them.
- The scanner does not exploit anything, log in, or crawl private routes.
  It reports what a well-informed anonymous visitor can observe.
