import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const outPath = path.resolve("docs/Seaworthy-Plan-v1.pdf");
const datedPath = path.resolve("docs/Seaworthy-Plan-v1.1.pdf");
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const doc = new PDFDocument({ margin: 54, size: "A4", info: { Title: "Seaworthy Plan v1.1", Author: "Seaworthy" } });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

const COLORS = { ink: "#151917", muted: "#4f5952", accent: "#4f7254", line: "#d8ddd8", soft: "#f3f6f3" };
const W = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;

function hr() { doc.moveDown(0.4); doc.strokeColor(COLORS.line).lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke(); doc.moveDown(0.6); }
function title(t) { doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(22).text(t, { width: W() }); }
function subtitle(t) { doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10.5).text(t, { width: W(), lineGap: 2 }); }
function h1(t) { doc.moveDown(0.6); doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(13).text(t.toUpperCase(), { width: W(), characterSpacing: 0.5 }); doc.moveDown(0.25); }
function h2(t) { doc.moveDown(0.25); doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10.8).text(t, { width: W() }); doc.moveDown(0.1); }
function p(t) { doc.fillColor(COLORS.ink).font("Helvetica").fontSize(9.8).text(t, { width: W(), lineGap: 2.2 }); }
function muted(t) { doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9.2).text(t, { width: W(), lineGap: 2 }); }
function bullets(items) {
  for (const item of items) {
    const x = doc.x;
    doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9.8).text("•", x, doc.y, { continued: false });
    doc.fillColor(COLORS.ink).font("Helvetica").fontSize(9.6).text(item, x + 12, doc.y - 11.7, { width: W() - 12, lineGap: 2.2 });
    doc.moveDown(0.12);
  }
}
function checkBullets(items) {
  for (const item of items) {
    const x = doc.x;
    doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9.5).text("[x]", x, doc.y);
    doc.fillColor(COLORS.ink).font("Helvetica").fontSize(9.6).text(item, x + 24, doc.y - 11.4, { width: W() - 24, lineGap: 2.2 });
    doc.moveDown(0.12);
  }
}
function ensureSpace(h = 80) { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); }

title("Seaworthy — Product Plan v1.1");
subtitle("Pre-launch security for AI-built apps. Updated after V1 foundation completion.");
subtitle(`Updated: ${new Date().toISOString().slice(0,10)}  •  Status: V1 foundation complete, V2 planning`);
hr();

h1("Executive Summary");
p("Seaworthy is a launch-readiness and continuous security product for AI-built apps. It gives founders evidence-backed findings, plain-English fixes, a 0-100 Seaworthy score, coverage %, and verified report states (confirmed / needs_validation / rejected). V1 delivers a credible fast scan and shareable report; V2 moves into authenticated/deep audits, monitoring, accounts, and commercial workflows.");

h1("V1 Completion Status");
p("V1 foundation is implemented locally in A:\\Projects\\Seaworthy. Core product and UI flows are in place; final pre-release QA and publish steps remain.");
doc.moveDown(0.2);
checkBullets([
  "Product plan and scope defined (docs/Seaworthy-Plan-v1.pdf baseline, this v1.1 update).",
  "Next.js 16 / React 19 / TypeScript / Tailwind 4 scaffold and project structure.",
  "Premium liquid-glass landing UI with responsive layout, reveal motion, hover states, and reduced-motion/transparency fallbacks.",
  "Fast Scan UI with URL input, loading/error states, score/coverage/receipt, findings, and full check ledger.",
  "Deterministic scan engine: 30 high-impact checks, URL normalization, SSRF private-host blocking, scoring, coverage, verdict counts, audit receipt.",
  "APIs: POST /api/scan, POST /api/waitlist, GET /api/report/[id], GET /api/report/[id]/pdf.",
  "Shareable report page /report/[id] and PDF export.",
  "Local .data persistence for scans and waitlist (gitignored; DB needed for production).",
  "README and Cloudflare security-audit-skill MIT attribution/no-endorsement notice.",
  "Lint and production build passing."
]);
h2("Remaining before V1 release");
bullets([
  "Final browser QA across 390/768/1024/1440, keyboard/focus, and real scan flow smoke tests.",
  "Copy/legal polish pass: terms/privacy/waitlist messaging, explicit best-effort/not-a-pentest language everywhere public.",
  "Decide on motion dependency cleanup (motion package currently installed but not required by final lightweight reveal).",
  "Git commit, push to origin, and deployment setup (env, domain, analytics/error monitoring).",
  "Replace local .data storage with production persistence before public multi-user use."
]);

ensureSpace(140);
h1("Product Principles");
bullets([
  "Credibility over theater: evidence-backed findings, no fake delay, no pentest/certification claims.",
  "Fast value first: 60s public scan for obvious launch blockers; deeper coverage clearly labeled.",
  "Clear uncertainty: confirmed / needs_validation / rejected states and coverage ledger.",
  "Premium, calm, high-trust UX: professional visual system, accessible motion, readable evidence.",
  "Security by design: SSRF guards, deterministic public checks, sandboxed deep audits before untrusted code execution."
]);

h1("V1 Scope (Current)");
h2("Included");
bullets([
  "Free Fast Scan: public URL, 30 deterministic checks, score 0-100, coverage %, verdict counts, receipt, shareable report, PDF export.",
  "Checks focus: exposed secrets/tokens, source maps/debug artifacts, security headers, browser protections, risky public config signals, Supabase/Stripe/auth exposure signals, basic deployment/public fetch issues.",
  "Waitlist capture for Full Report and Monitor.",
  "Marketing/positioning: AI-built app pre-launch security, evidence not noise."
]);
h2("Explicitly excluded / not claimed");
bullets([
  "No penetration test, certification, SOC compliance, WAF, or incident response.",
  "No authenticated/internal scanning, repo scanning, or runtime agent execution on main servers.",
  "No accounts/billing/monitoring automation in V1 foundation."
]);

ensureSpace(120);
h1("Version Roadmap (V1 to V4)");
p("Detailed roadmap is maintained in docs/Seaworthy-Versions-Roadmap.md. Summary below covers all planned versions.");
h2("V1 — Fast Scan Foundation (now)");
bullets(["Public deterministic fast scan, 30 checks, score/coverage/verdicts, report/PDF/waitlist, premium UI, legal/attribution baseline."]);
h2("V1.1 — Launch Hardening");
bullets(["Deploy, DB persistence, rate limiting/abuse protection, monitoring, QA matrix, final Terms/Privacy/support."]);
h2("V2.0 — Productize & Persist");
bullets(["Accounts/auth, scan history, workspaces/projects, entitlements, observability, admin basics."]);
h2("V2.1 — Paid Full Report");
bullets(["$19 one-time report, Stripe billing, full evidence/fix prompts, share/PDF, scan diffs."]);
h2("V2.2 — Deep Audit Engine");
bullets(["Sandboxed 20-45m agentic audits, authenticated/repo/dependency/cloud checks, Cloudflare skill taxonomy with attribution/no endorsement, human validation."]);
h2("V2.3 — Monitor");
bullets(["$29/mo scheduled scans, deploy hooks, verify-fix, alerts, trend/freshness/trust signals."]);
h2("V2.4 — Team & Agency");
bullets(["Team roles, multi-project dashboard, client reports, $149/mo agency packaging."]);
h2("V3.0 — Expert Review Network");
bullets(["$199-$299 scoped human AppSec reviews via vetted partners; NDA/SOW; no pentest claim unless contracted."]);
h2("V3.1 — Trust Platform");
bullets(["Public/private trust pages, badges/widgets, evidence packs, procurement support."]);
h2("V4.0 — Enterprise / Platform");
bullets(["SSO/SCIM, API/CLI/CI gates, policy engine, advanced integrations, compliance evidence mapping (no auto-certification)."]);

h1("Architecture Direction");
bullets([
  "Frontend: keep Next.js App Router; extract design system/components, add report/dashboard routes, preserve premium accessible UX.",
  "API: move long scans to queued jobs/workers; keep fast scan synchronous where safe with strict timeouts and rate limits.",
  "Data: Postgres for users/scans/findings/receipts/waitlist/billing events; object storage for PDFs/artifacts; immutable audit receipts.",
  "Security: SSRF protections, secret redaction, audit logs, sandbox isolation for deep audits, least-privilege credentials, secure webhook handling.",
  "Extensibility: check registry with IDs, categories, evidence schema, verdict rules, and engine capability flags."
]);

h1("Pricing / Packaging (Planned)");
bullets([
  "Free: Fast Scan, score/coverage/top findings, no login.",
  "$19 one-time: Full Report, evidence, fix prompts, shareable report, PDF export.",
  "$29/mo: Monitor, scheduled scans, alerts, verify fix, trust freshness.",
  "$49-$99: Deep Audit (scope-dependent).",
  "$149/mo: Agency.",
  "$199-$299: Expert Review later (partner-delivered, scoped)."
]);

h1("Risks & Controls");
bullets([
  "False confidence: label coverage/limitations prominently; never overclaim.",
  "False positives/noise: evidence-first, confidence/verdict model, rejection pipeline.",
  "Abuse/SSRF: strict URL validation, DNS/IP checks, private range blocking, rate limiting.",
  "Untrusted code execution: mandatory OS-enforced sandbox for deep audits; no execution on core app servers.",
  "Legal/compliance: clear ToS/privacy, best-effort disclaimer, no pentest/certification wording unless true."
]);

h1("Immediate Next Actions");
bullets([
  "Run final V1 QA and fix any responsive/accessibility/scan-flow issues.",
  "Commit V1 foundation and push to GitHub after user confirmation.",
  "Create V2 technical spec: DB schema, auth/billing, job queue, sandbox architecture, and check registry format.",
  "Instrument analytics and deploy a staging environment for real-user scan tests."
]);

doc.moveDown(0.8);
hr();
muted("Attribution: Security audit concepts informed in part by Cloudflare's MIT-licensed security-audit-skill (github.com/cloudflare/security-audit-skill). Cloudflare does not endorse Seaworthy. Seaworthy reports are best-effort automated reviews and are not penetration tests or certifications.");

doc.end();
await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); });
fs.copyFileSync(outPath, datedPath);
console.log(outPath);
console.log(datedPath);