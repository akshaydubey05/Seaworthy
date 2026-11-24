# Changelog

All notable changes to Seaworthy are documented here.

The format is based on Keep a Changelog, and versions follow SemVer tags (`vMAJOR.MINOR.PATCH`).

## [Unreleased]

### Added
- V2.0 planning: accounts, DB-backed history, entitlements/billing, dashboard (provider choice pending).

## [1.2.0] - 2026-11-24

### Added
- Standalone Go scan service in `services/scanner`: 34 fast checks, 8 deep checks, scoring, SSRF/DNS/redirect guards, token auth, concurrency limit, distroless Docker image.
- Contract client `src/lib/scanner-client.ts` with payload validation; malformed or unavailable scanner responses fall back to the TypeScript engine.
- New check SW-035: cross-origin script without Subresource Integrity (the advertised count of 34 is now accurate).
- Go test suite: URL/SSRF hardening, scoring, rule behaviour, end-to-end scans against `httptest`, HTTP contract/auth/limits.
- Rule-parity test that fails if Go and TypeScript check IDs or order drift.
- Separate `scanner` CI job: `gofmt`, `go vet`, `go test -race`, build.
- Docs: `services/scanner/README.md`, scanner sections in `README.md`, `DEPLOYMENT.md`, `docs/GETTING-STARTED.md`.

### Changed
- `runFastScan` / `runDeepScan` prefer the Go service when `SCANNER_URL` and `SCANNER_TOKEN` are set.
- Roadmap: V1/V1.1 marked shipped, V1.2 scanner service added, V2.0 marked next.

### Verified
- Live parity: Google (`98` exposure / `85` hardening) and Cloudflare (`99` / `94`) produced identical findings and scores through the Go service and the TypeScript fallback.
- Deep scan through the app: 42 checks, `scan_remote_ok` logged, no exposure findings on example.com.

## [1.1.0] - 2026-11-23

### Added
- Finding classification: `exposure`, `signal`, `hardening`; separate exposure and hardening scores.
- Free scan now scans up to 2 same-origin JS bundles for leaked credentials.
- New checks: SW-032 JS-bundle secrets, SW-033 CSP quality, SW-034 cloud token patterns.
- Deep scan mode (gated by `DEEP_SCAN_ENABLED` + `DEEP_SCAN_KEY`): source maps, TLS cert expiry, SPF/DMARC, security.txt, robots disclosure, COOP/CORP, CORS credentials, extra CSP directives.
- Vitest test suite and credibility regression script.
- CI runs lint, typecheck, tests, and build on every push/PR.
- Release workflow creates GitHub Releases on `v*` tags.
- Beginner docs: `docs/GETTING-STARTED.md`, `docs/LEGAL-CHECKLIST.md`, `docs/VERSIONING.md`.

### Fixed
- False positives on major sites: report-only/meta CSP, meta referrer, schema.org mixed content, Stripe marketing mentions, truncated footer privacy/terms.

## [1.0.0] - 2026-05-01

### Added
- Initial Fast Scan, report page, PDF export, waitlist, SSRF guards, rate limiting, security headers, Postgres adapter.
