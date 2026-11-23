# Changelog

All notable changes to Seaworthy are documented here.

The format is based on Keep a Changelog, and versions follow SemVer tags (`vMAJOR.MINOR.PATCH`).

## [Unreleased]

### Added
- V2.0 planning: accounts, DB-backed history, entitlements/billing, dashboard (provider choice pending).

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
