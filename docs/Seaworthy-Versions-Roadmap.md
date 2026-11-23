# Seaworthy — Version Roadmap

> **Product**: Seaworthy — pre-launch security and continuous assurance for AI-built apps.  
> **Principle**: Evidence over theater. Best-effort automated review unless explicitly contracted otherwise. Never claim penetration test/certification/SOC compliance unless true.  
> **Status date**: 2026-11-23

## Version map

| Version | Name | Goal | Status |
|---|---|---|---|
| **V1** | Fast Scan Foundation | Public, deterministic pre-launch scan with credible evidence/report | **In progress / shipping now** |
| **V1.1** | Launch Hardening | Production-ready release, QA, deploy, persistence, legal/ops basics | Next |
| **V2.0** | Productize & Persist | Accounts, DB, scan history, entitlements, observability | Planned |
| **V2.1** | Paid Full Report | $19 one-time report, billing, share/PDF/diff, fix workflows | Planned |
| **V2.2** | Deep Audit Engine | Sandboxed agentic/authenticated/repo/runtime audits | Planned |
| **V2.3** | Monitor | Continuous assurance, alerts, verify-fix, trust freshness | Planned |
| **V2.4** | Team & Agency | Multi-project/team workflows, agency packaging | Planned |
| **V3.0** | Expert Review Network | Vetted human AppSec review, scoped engagements, partner ops | Planned |
| **V3.1** | Trust Platform | Public trust pages, badges, procurement-ready evidence packs | Planned |
| **V4.0** | Enterprise / Platform | SSO, API, CI/CD gates, policy, advanced compliance mappings | Future |

---

## V1 — Fast Scan Foundation (current)

**Objective**: Ship a credible, premium, fast pre-launch security check for AI-built apps.

### Included
- **Landing experience**: premium liquid-glass UI, responsive layout, accessible motion/reduced-motion fallbacks, clear CTA.
- **Fast Scan**: public URL only, ~60s target, deterministic checks, no fake delay.
- **30 high-impact checks**: exposed secrets/tokens, source maps/debug artifacts, security headers, browser protections, risky public config signals, Supabase/Firebase/Stripe/auth exposure signals, basic transport/deployment/public-fetch issues.
- **Evidence model**: score 0-100, coverage %, verdicts (`confirmed`, `needs_validation`, `rejected` where applicable), check ledger, audit receipt.
- **Report**: shareable report page `/report/[id]`, PDF export `/api/report/[id]/pdf`.
- **Waitlist**: in-app capture for Full Report and Monitor.
- **APIs**: `POST /api/scan`, `POST /api/waitlist`, `GET /api/report/[id]`, `GET /api/report/[id]/pdf`.
- **Safety/legal posture**: SSRF private-host blocking; best-effort automated review; not a penetration test/certification; Cloudflare `security-audit-skill` MIT attribution/no endorsement.

### V1 release gate
- [x] Core scan/report/waitlist flows implemented
- [x] Lint and production build pass
- [x] Premium UI/accessibility baseline
- [x] README/attribution/legal copy baseline
- [x] Final browser QA: 390/768/1024/1440, keyboard/focus, scan flow, report/PDF flow (`docs/QA-V1.md`)
- [x] Credibility pass: exposures vs signals vs hardening, false-positive controls, `npm run qa:credibility`
- [ ] Deploy to production domain with env/monitoring (needs Vercel/registrar credentials)
- [x] Replace `.data` local store with production DB adapter + migration (live DB verification pending `DATABASE_URL`)
- [x] Legal pages, support/contact, and responsible disclosure (attorney review pending)

### Explicitly not in V1
- No auth/accounts, billing, scan history, or team features.
- No authenticated/repo/runtime/internal scanning.
- No continuous monitoring, alerts, or scheduled scans.
- No agentic code execution on main servers.
- No pentest/certification/SOC/compliance claims.

---

## V1.1 — Launch Hardening

**Objective**: Make V1 safe and reliable for real users.

- **Deploy**: Vercel/production hosting, custom domain, HTTPS, env vars, error monitoring (Sentry), uptime checks.
- **Persistence**: Postgres (Neon/Supabase) for scans/waitlist; migrations; retention policy; backup.
- **Abuse protection**: rate limiting, CAPTCHA or soft challenge if abused, request size/time limits, scan quotas.
- **Security hardening**: stricter SSRF/DNS rebinding defenses, secret redaction in logs, audit logging, secure headers/CSP.
- **QA**: browser matrix, accessibility audit, performance pass, Lighthouse/real-user smoke tests.
- **Legal/ops**: Terms, Privacy, contact, responsible disclosure note, data handling policy.
- **Analytics**: privacy-conscious funnel events (scan started/completed, report viewed, waitlist, CTA clicks).

**Exit criteria**: Public users can run scans reliably; data persists; abuse/rate limits exist; legal/support basics are live.

---

## V2.0 — Productize & Persist

**Objective**: Turn scans into a product with identity and history.

- **Accounts**: magic link/OAuth, profile, email verification.
- **Scan history**: owned scans, report links, receipts, re-scan from history.
- **Data model**: users, workspaces, projects/domains, scans, findings, evidence artifacts, waitlist, events.
- **Entitlements**: free/paid capability flags; feature gating.
- **Observability**: structured logs, job tracing, scan failure taxonomy, admin dashboard.
- **API foundation**: internal API conventions, idempotency, audit trail.

**Exit criteria**: Signed-in users can manage scans/reports; data model supports paid features.

---

## V2.1 — Paid Full Report

**Objective**: Monetize the core value.

- **Pricing**: $19 one-time Full Report (as planned).
- **Billing**: Stripe checkout, receipts, entitlement checks, refund-safe messaging.
- **Full Report**: complete findings/evidence, fix prompts, shareable report, PDF export, ownership controls.
- **Diffs**: compare scans — new/fixed/reopened/regressed findings.
- **Fix workflow**: copyable fix prompts, checklist, “mark as fixed / verify later” UX (verification still best-effort).

**Exit criteria**: Users can pay, receive full report, and track remediation across rescans.

---

## V2.2 — Deep Audit Engine

**Objective**: Provide deeper coverage without compromising safety.

- **Deep Audit**: 20-45 min, queued/async, explicit scope and consent.
- **Sandboxed execution**: OS-enforced sandbox for any untrusted target code; never on main app servers.
- **Coverage expansion**: authenticated checks, repo/config scanning, dependency/CVE signals, cloud posture checks, runtime observations where safe.
- **Cloudflare skill integration**: adapt schema/validators/attack-class taxonomy from Cloudflare MIT `security-audit-skill` with attribution/no endorsement; V2+ only for sandboxed/controlled execution.
- **Check registry**: IDs, categories, severity, verdict rules, evidence schema, engine capability flags, coverage ledger.
- **Human-in-loop review**: validation workflow for ambiguous findings; clear labeling.

**Exit criteria**: Deep audits run safely in sandbox; findings are evidence-backed and clearly scoped.

---

## V2.3 — Monitor

**Objective**: Continuous assurance after launch.

- **Pricing**: $29/mo Monitor (as planned).
- **Cadence**: daily light, weekly full, monthly deep option, deploy-hook triggered scans.
- **Change detection**: new/reopened/fixed/regressed findings; score/coverage trend.
- **Alerts**: email first; Slack/webhooks later; severity thresholds and noise controls.
- **Trust freshness**: last-scanned timestamp, evidence snapshots, trust page/badge (careful wording).
- **Verify fix**: targeted re-check for specific findings.

**Exit criteria**: Users get useful change alerts with low noise and clear evidence.

---

## V2.4 — Team & Agency

**Objective**: Support teams shipping multiple AI-built apps.

- **Workspaces/teams**: roles, invites, project ownership, audit trail.
- **Agency plan**: $149/mo target; multi-project dashboard, client-ready reports, branding controls.
- **Client workflows**: share links, report permissions, export packs, comment/status fields.
- **Governance**: scan policies, required checks, approval gates.

**Exit criteria**: Agencies can manage multiple client apps and reports from one workspace.

---

## V3.0 — Expert Review Network

**Objective**: Add high-trust human review without false claims.

- **Pricing**: $199-$299 expert review (later), scoped.
- **Partner model**: vetted AppSec partners, NDA/SOW, defined SLAs, secure artifact handling.
- **Compensation**: $75-$150 partner payout target (model to validate).
- **Scope**: manual validation, threat-model review, business-logic/authz review, prioritized remediation guidance.
- **Claims discipline**: no “pentest” label unless a real pentest is contracted with appropriate scope/methodology.

**Exit criteria**: Human reviews are high quality, safely scoped, and operationally repeatable.

---

## V3.1 — Trust Platform

**Objective**: Make Seaworthy evidence useful for customers/investors/procurement.

- **Trust page**: public/private trust page with last scan date, coverage, score trend, selected evidence.
- **Badges/widgets**: embeddable “Last scanned”/status widgets with non-certification wording.
- **Evidence packs**: downloadable audit receipt, report PDF, change log, policy attestations as applicable.
- **Procurement support**: security questionnaire assist, evidence mapping, scoped exports.

**Exit criteria**: Seaworthy reports help close trust gaps in sales/procurement without overclaiming.

---

## V4.0 — Enterprise / Platform

**Objective**: Fit into mature engineering and security programs.

- **SSO/SCIM**: SAML/OIDC, directory provisioning.
- **API/CI**: scan API, CLI, GitHub/GitLab CI gates, PR/deploy checks.
- **Policy engine**: org policies, severity thresholds, block/warn rules, exceptions/waivers.
- **Advanced coverage**: cloud/infrastructure integrations, secrets manager checks, SBOM/dependency policy, runtime signals.
- **Compliance mapping**: evidence mapping to frameworks where appropriate; never automatic certification.

**Exit criteria**: Enterprise teams can integrate Seaworthy into SDLC with governance and auditability.

---

## Cross-cutting principles (all versions)

- **Evidence first**: every finding should have why/evidence/fix/confidence/verdict.
- **Honest scope**: clearly state what was checked, not checked, and what needs validation.
- **Safe execution**: untrusted code only in OS-enforced sandbox; strict SSRF/network controls.
- **Privacy & security**: least data retention, secret redaction, encrypted storage, audit logs.
- **Accessible premium UX**: fast, clear, keyboard/focusable, reduced-motion/transparency support.
- **No false claims**: no pentest/certification/SOC/compliance guarantees unless formally true.

## Immediate next build order

1. **Ship V1**: QA, deploy, DB persistence, legal/ops, monitoring.
2. **Start V2.0**: schema + auth + scan history.
3. **Then V2.1**: Stripe + Full Report.
4. **Then V2.2/V2.3**: sandboxed deep audit and monitor, based on user demand and safety readiness.
