import Link from "next/link";
import { ArrowRight, BadgeCheck, FileCheck2, LockKeyhole, Radar as RadarIcon, ShieldCheck } from "lucide-react";
import { AmbientFx } from "@/components/ambient-fx";
import { SeaworthyMark } from "@/components/brand";
import { Radar } from "@/components/radar";
import { RevealInit } from "@/components/reveal";
import { ScanPanel } from "@/components/scan-panel";
import { SiteHeader } from "@/components/site-header";
import { WaitlistForm } from "@/components/waitlist-form";

const stats = [
  { value: "60s", label: "Fast public scan", detail: "A quick pass for obvious launch blockers." },
  { value: "34", label: "High-impact checks", detail: "Focused on the mistakes AI-built apps ship most." },
  { value: "0-100", label: "Exposure score", detail: "Weighted toward confirmed exposures. Hardening gaps count little." },
];

const steps = [
  {
    icon: RadarIcon,
    title: "Scan the live app",
    body: "Paste a URL. Seaworthy runs fast, public checks for exposed secrets, risky configs, and missing protections.",
  },
  {
    icon: FileCheck2,
    title: "Read the evidence",
    body: "Each finding includes severity, verdict, evidence, and a plain-English fix. Unclear items are marked needs validation.",
  },
  {
    icon: ShieldCheck,
    title: "Fix before launch",
    body: "Patch the issue, re-scan, and move to a deeper audit when you need authenticated or infrastructure coverage.",
  },
];

const checks = [
  "Exposed Stripe, Supabase, or AI API keys",
  "Source maps and debug artifacts in production",
  "Missing security headers and browser protections",
  "Supabase and RLS risk signals",
  "Stripe webhook and auth configuration signals",
  "Public fetch failures and deployment exposure signals",
];

export default function Home() {
  return (
    <div className="relative overflow-x-clip">
      <RevealInit />
      <AmbientFx />
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow drift top-[-220px] left-[52%] h-[560px] w-[560px] bg-[rgba(149,176,149,0.14)]" aria-hidden="true" />
      <div className="bg-glow drift top-[680px] left-[-140px] h-[380px] w-[380px] bg-[rgba(149,176,149,0.07)]" style={{ ["--drift-delay" as string]: "-9s" }} aria-hidden="true" />
      <div className="bg-glow drift top-[1600px] right-[-120px] h-[340px] w-[340px] bg-[rgba(255,255,255,0.04)]" style={{ ["--drift-delay" as string]: "-16s" }} aria-hidden="true" />

      <SiteHeader />

      <main id="top" className="relative z-10">
        <section className="pb-16 pt-14 sm:pb-22 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="container grid items-start gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-6" data-reveal>
              <div className="pill mb-7">
                <span className="dot" />
                Pre-launch security for AI-built apps
              </div>
              <h1 className="display max-w-[11.5ch] text-[clamp(2.9rem,8vw,5.8rem)]">
                Ship fast.
                <span className="block text-[var(--accent)]">Don&apos;t sink.</span>
              </h1>
              <p className="body-lg mt-7 max-w-[38rem]">
                Seaworthy scans AI-built apps for exposed secrets, unsafe data rules, missing protections, and other launch risks. Get evidence, plain-English fixes, and a report before customers find the problem first.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#scan" className="btn btn-primary">
                  Run fast scan <ArrowRight size={16} className="btn-icon" />
                </a>
                <a href="#report" className="btn btn-ghost">See sample report</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-[13px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-2"><BadgeCheck size={14} className="text-[var(--accent)]" /> No login for fast scan</span>
                <span className="inline-flex items-center gap-2"><BadgeCheck size={14} className="text-[var(--accent)]" /> Evidence, not noise</span>
                <span className="inline-flex items-center gap-2"><BadgeCheck size={14} className="text-[var(--accent)]" /> Built for vibe-coded apps</span>
              </div>
            </div>

            <div className="lg:col-span-6" data-reveal style={{ ["--reveal-delay" as string]: "120ms" }}>
              <div className="relative">
                <div className="pointer-events-none absolute -right-16 -top-20 hidden lg:block" aria-hidden="true">
                  <Radar />
                </div>
                <div className="absolute -inset-8 -z-10 rounded-[36px] bg-[radial-gradient(closest-side,rgba(149,176,149,0.18),transparent)] blur-2xl" aria-hidden="true" />
                <div className="hero-sheen" aria-hidden="true" />
                <ScanPanel />
              </div>
            </div>
          </div>
        </section>

        <section className="section-border border-b border-[rgba(236,241,236,0.08)] py-10 sm:py-12">
          <div className="container grid gap-8 sm:grid-cols-3 sm:gap-6" data-reveal>
            {stats.map((s) => (
              <div key={s.label}>
                <div className="mb-2 font-mono text-xs tracking-[0.06em] text-[var(--muted)]">{s.value}</div>
                <div className="text-[1.05rem] font-medium tracking-[-0.01em]">{s.label}</div>
                <p className="mt-1 max-w-[30ch] text-sm leading-6 text-[var(--muted)]">{s.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="section">
          <div className="container">
            <div className="mb-12 max-w-[44rem]" data-reveal>
              <p className="eyebrow mb-4">How it works</p>
              <h2 className="h2 text-[clamp(2rem,4.8vw,3.6rem)]">A security check founders can actually use.</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <article key={step.title} className="card interactive-card p-6 sm:p-7" data-spotlight data-reveal style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}>
                  <div className="mb-6 grid h-11 w-11 place-items-center rounded-xl border border-[rgba(236,241,236,0.12)] bg-white/[0.04] text-[var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <step.icon size={19} />
                  </div>
                  <div className="mb-2 font-mono text-xs text-[var(--muted)]">0{i + 1}</div>
                  <h3 className="mb-3 text-[1.45rem] font-medium leading-[1.15] tracking-[-0.02em]">{step.title}</h3>
                  <p className="text-[15px] leading-7 text-[var(--muted)]">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="checks" className="section section-border">
          <div className="container grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5" data-reveal>
              <p className="eyebrow mb-4">Fast scan checks</p>
              <h2 className="h2 mb-5 text-[clamp(2rem,4.5vw,3.25rem)]">The launch risks that cost real money.</h2>
              <p className="max-w-[34rem] text-[15px] leading-7 text-[var(--muted)]">
                The fast scan focuses on high-signal issues common in AI-built apps. It catches obvious public exposure first, then tells you what needs deeper validation before launch.
              </p>
            </div>
            <div className="lg:col-span-7" data-reveal style={{ ["--reveal-delay" as string]: "80ms" }}>
              <div className="card overflow-hidden">
                <ul className="grid sm:grid-cols-2">
                  {checks.map((item, i) => (
                    <li key={item} className={`flex gap-3 p-5 text-[14px] leading-6 text-[color:var(--text)]/88 ${i < checks.length - 1 ? "border-b border-[rgba(236,241,236,0.08)]" : ""} ${i % 2 === 0 ? "sm:border-r sm:border-[rgba(236,241,236,0.08)]" : ""} ${i >= checks.length - 2 ? "sm:border-b-0" : ""}`}>
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgba(149,176,149,0.14)] text-[var(--accent)]">
                        <BadgeCheck size={13} />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="report" className="section section-border bg-black/[0.08]">
          <div className="container grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5" data-reveal>
              <p className="eyebrow mb-4">Verified report</p>
              <h2 className="h2 mb-5 text-[clamp(2rem,4.5vw,3.25rem)]">Proof, not a pile of warnings.</h2>
              <p className="mb-7 max-w-[34rem] text-[15px] leading-7 text-[var(--muted)]">
                Seaworthy separates confirmed exposures from signals that need validation and from low-priority hardening notes. You can see what was checked, what evidence was found, and what still requires deeper access.
              </p>
              <div className="space-y-4">
                {[
                  ["Exposure", "A credential, leak, or misconfiguration that looks exploitable now.", "text-[var(--accent)]"],
                  ["Needs validation", "A pattern worth checking with auth, repo, or runtime access.", "text-[var(--warn)]"],
                  ["Hardening", "Best-practice gaps like missing headers. Useful, not proof of a vulnerability.", "text-[var(--muted)]"],
                ].map(([label, desc, tone]) => (
                  <div key={label} className="border-t border-[rgba(236,241,236,0.1)] pt-4">
                    <div className={`font-mono text-xs tracking-[0.03em] ${tone}`}>{label}</div>
                    <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7" data-reveal style={{ ["--reveal-delay" as string]: "100ms" }}>
              <div className="card p-6 sm:p-8" data-spotlight>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="eyebrow mb-2">Audit receipt</div>
                    <div className="text-[1.7rem] font-medium tracking-[-0.03em]">SW-1042</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">app.example.com · 34 checks planned</div>
                  </div>
                  <span className="pill"><span className="dot" />Coverage 87%</span>
                </div>
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  {[["3", "Exposures"], ["2", "Needs validation"], ["4", "Hardening"]].map(([n, l]) => (
                    <div key={l} className="card-soft p-4">
                      <div className="text-[2rem] font-medium leading-none tracking-[-0.04em]">{n}</div>
                      <div className="mt-2 text-xs text-[var(--muted)]">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-[rgba(255,150,150,0.18)] bg-[rgba(255,150,150,0.065)] p-5 backdrop-blur-sm">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="sev sev-critical">Critical</span>
                    <span className="tag tag-exposure">Exposure</span>
                    <span className="kbd">observed</span>
                    <span className="font-mono text-[11px] text-[var(--muted)]">SW-001</span>
                  </div>
                  <div className="text-[15px] font-medium">Supabase service role key exposed in client bundle</div>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
                    <span className="text-[color:var(--text)]/72">Evidence:</span> Matched a service role credential pattern in publicly fetched JavaScript.
                    <br />
                    <span className="text-[color:var(--text)]/72">Fix:</span> Rotate the key, move it server-side, and audit git history for exposure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="honesty" className="section section-border">
          <div className="container grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5" data-reveal>
              <p className="eyebrow mb-4">Honest by design</p>
              <h2 className="h2 text-[clamp(2rem,4.5vw,3.25rem)]">Why big sites still get notes.</h2>
            </div>
            <div className="space-y-4 text-[15px] leading-7 text-[var(--muted)] lg:col-span-7" data-reveal style={{ ["--reveal-delay" as string]: "80ms" }}>
              <p>
                A scan sees one public response. Large sites terminate at edge networks, enforce policy per route, and often roll out CSP in report-only mode first. That is why a header can be absent on the homepage while the application itself is well protected.
              </p>
              <p>
                So Seaworthy labels header gaps as <strong className="text-[var(--text)]">hardening</strong>, not vulnerabilities, and weights them lightly. Exposure findings — leaked keys, unsafe data access, weak session cookies — are what move the score.
              </p>
              <p>
                If a result surprises you, read the evidence and the scan limitations. A clean score is not a guarantee, and a hardening note is not an incident.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="section section-border">
          <div className="container">
            <div className="mb-12 max-w-[44rem]" data-reveal>
              <p className="eyebrow mb-4">Pricing</p>
              <h2 className="h2 text-[clamp(2rem,4.8vw,3.6rem)]">Start free. Pay when you need proof.</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  name: "Fast Scan",
                  price: "$0",
                  desc: "For a quick pre-launch check.",
                  items: ["Public URL scan", "34 checks + JS bundle scan", "Exposure + hardening scores", "Shareable report + PDF", "No login required"],
                  cta: "Run fast scan",
                  href: "#scan",
                  primary: false,
                },
                {
                  name: "Deep Scan",
                  price: "$29",
                  desc: "For founders about to charge money.",
                  items: ["Everything in Fast Scan", "8 JS bundles + deeper secret patterns", "TLS expiry, SPF/DMARC, security.txt", "CORS/cross-origin/CSP quality checks", "Priority fix guidance (V2)"],
                  cta: "Join waitlist",
                  href: "#waitlist",
                  primary: true,
                },
                {
                  name: "Monitor",
                  price: "$49/mo",
                  desc: "For apps that keep changing.",
                  items: ["Scheduled deep rescans", "New and reopened alerts", "Fix verification", "History & diff (V2)"],
                  cta: "Join waitlist",
                  href: "#waitlist",
                  primary: false,
                },
              ].map((plan, i) => (
                <article key={plan.name} data-spotlight data-reveal style={{ ["--reveal-delay" as string]: `${i * 90}ms` }} className={`card interactive-card p-6 sm:p-7 ${plan.primary ? "border-[rgba(149,176,149,0.34)] bg-[linear-gradient(180deg,rgba(149,176,149,0.13),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(149,176,149,0.08),0_24px_80px_rgba(0,0,0,0.28)]" : ""}`}>
                  {plan.primary && <div className="mb-4 inline-flex rounded-full border border-[rgba(149,176,149,0.25)] bg-[rgba(149,176,149,0.1)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--accent-strong)]">Most useful</div>}
                  <div className="mb-2 text-sm text-[var(--muted)]">{plan.name}</div>
                  <div className="mb-3 text-[2.6rem] font-medium leading-none tracking-[-0.04em]">{plan.price}</div>
                  <p className="mb-6 text-sm leading-6 text-[var(--muted)]">{plan.desc}</p>
                  <ul className="mb-7 space-y-3">
                    {plan.items.map((item) => (
                      <li key={item} className="flex gap-2.5 text-sm leading-6 text-[color:var(--text)]/86">
                        <BadgeCheck size={15} className="mt-1 shrink-0 text-[var(--accent)]" /> {item}
                      </li>
                    ))}
                  </ul>
                  <a href={plan.href} className={`btn w-full ${plan.primary ? "btn-primary" : "btn-ghost"}`}>{plan.cta}</a>
                </article>
              ))}
            </div>
            <p className="mt-6 max-w-[44rem] text-xs leading-6 text-[var(--muted)]">
              Deep Scan and Monitor are planned paid tiers. Fast Scan is free today, including report and PDF. Deep Scan
              will be worth paying for only when it includes authenticated/runtime checks you cannot get from a public page;
              until then it is gated and not sold as a guarantee.
            </p>
          </div>
        </section>

        <section id="waitlist" className="section section-border">
          <div className="container grid gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="card p-8 sm:p-10 lg:col-span-7" data-spotlight data-reveal>
              <p className="eyebrow mb-4">Waitlist</p>
              <h2 className="h2 mb-5 text-[clamp(2rem,4.4vw,3.2rem)]">Get the full report and monitor when they launch.</h2>
              <p className="mb-7 max-w-[36rem] text-[15px] leading-7 text-[var(--muted)]">
                Paid full reports and monitoring are in progress. Join the list and we’ll use it to prioritize what ships next.
              </p>
              <WaitlistForm />
              <p className="mt-3 text-xs text-[var(--muted)]">No spam. We’ll only email when Full Report or Monitor is ready.</p>
            </div>
            <div className="card flex flex-col justify-between gap-8 p-8 sm:p-10 lg:col-span-5" data-reveal style={{ ["--reveal-delay" as string]: "100ms" }}>
              <div>
                <p className="eyebrow mb-4">Before you charge money</p>
                <h2 className="h2 text-[clamp(2rem,4.4vw,3rem)]">Find the launch blockers before your users do.</h2>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">Run a fast public scan now, then move to a deeper report when you need proof for launch, customers, or investors.</p>
              </div>
              <a href="#scan" className="btn btn-primary w-full sm:w-fit">
                Run fast scan <ArrowRight size={16} className="btn-icon" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="section-border py-10">
        <div className="container flex flex-col gap-6 text-sm text-[var(--muted)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2.5 text-[var(--text)]">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[linear-gradient(180deg,#b7cab7,var(--accent))] text-[#141814]">
                <SeaworthyMark className="h-4 w-4" />
              </span>
              <span className="font-medium">Seaworthy</span>
            </div>
            <p className="max-w-[36rem] text-xs leading-6 text-[var(--muted)]">
              Built for AI-built apps. Security audit skill concepts adapted from Cloudflare&apos;s MIT-licensed
              {" "}<a className="underline decoration-[rgba(236,241,236,0.25)] underline-offset-2 hover:text-[var(--text)]" href="https://github.com/cloudflare/security-audit-skill" target="_blank" rel="noreferrer">security-audit-skill</a>
              {" "}with attribution. Cloudflare does not endorse Seaworthy.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
              <Link className="hover:text-[var(--text)] transition-colors" href="/security">Security</Link>
              <Link className="hover:text-[var(--text)] transition-colors" href="/terms">Terms</Link>
              <Link className="hover:text-[var(--text)] transition-colors" href="/privacy">Privacy</Link>
              <a className="hover:text-[var(--text)] transition-colors" href="https://github.com/akshaydubey05/Seaworthy" target="_blank" rel="noreferrer">GitHub</a>
            </div>
            <div className="flex max-w-[28rem] items-start gap-2 text-xs lg:text-right">
              <LockKeyhole size={14} className="mt-0.5 shrink-0" />
              <span>Best-effort automated review. Not a penetration test or certification.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}