import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Info, LockKeyhole, Wrench } from "lucide-react";
import { SeaworthyMark } from "@/components/brand";
import { getScan } from "@/lib/store";
import type { Finding } from "@/lib/scan";

const TYPE_LABEL: Record<string, string> = {
  exposure: "Exposure",
  signal: "Needs validation",
  hardening: "Hardening",
};

const TYPE_CLASS: Record<string, string> = {
  exposure: "tag tag-exposure",
  signal: "tag tag-signal",
  hardening: "tag tag-hardening",
};

const VERDICT_LABEL: Record<string, string> = {
  confirmed: "observed",
  needs_validation: "needs validation",
  rejected: "rejected",
};

function typeOf(finding: Finding) {
  return finding.type || "signal";
}

function FindingCard({ finding }: { finding: Finding }) {
  const type = typeOf(finding);
  return (
    <article className="card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
        <span className={TYPE_CLASS[type]}>{TYPE_LABEL[type]}</span>
        <span className="kbd">{VERDICT_LABEL[finding.verdict] || finding.verdict}</span>
        <span className="kbd">{finding.id}</span>
      </div>
      <h3 className="mb-2 font-medium">{finding.title}</h3>
      <p className="text-sm leading-6 text-[var(--muted)]">
        <span className="text-[var(--text)]/70">Evidence:</span> {finding.evidence}
      </p>
      <p className="text-sm leading-6 text-[var(--muted)]">
        <span className="text-[var(--text)]/70">Fix:</span> {finding.fix}
      </p>
    </article>
  );
}

async function ReportBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return notFound();

  const findings = scan.findings || [];
  const manualChecks = scan.manualChecks || [];
  const notes = scan.notes || [];
  const hardeningScore = typeof scan.hardeningScore === "number" ? scan.hardeningScore : null;
  const exposures = findings.filter((f) => typeOf(f) === "exposure");
  const signals = findings.filter((f) => typeOf(f) === "signal");
  const hardening = findings.filter((f) => typeOf(f) === "hardening");

  return (
    <main className="container py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="btn btn-ghost !min-h-10 !px-3 !text-[13px]"><ArrowLeft size={15} /> Back to Seaworthy</Link>
        <a className="btn btn-primary !min-h-10 !px-4 !text-[13px]" href={`/api/report/${scan.receiptId}/pdf`}><Download size={15} /> Download PDF</a>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">Audit receipt</p>
          <h1 className="text-4xl font-medium tracking-[-0.04em] sm:text-5xl">{scan.receiptId}</h1>
          <p className="mt-2 break-all text-[var(--muted)]">{scan.finalUrl || scan.url}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Exposure score", `${scan.score}/100`],
          ["Hardening", hardeningScore === null ? "—" : `${hardeningScore}/100`],
          ["Coverage", `${scan.coverage}%`],
          ["Checks", `${scan.checksRun}/${scan.checksTotal}`],
        ].map(([label, value]) => (
          <div key={label} className="card p-5">
            <div className="mb-2 text-xs text-[var(--muted)]">{label}</div>
            <div className="text-2xl font-medium tracking-[-0.03em]">{value}</div>
          </div>
        ))}
      </div>

      <div className="card mb-6 p-6 sm:p-7">
        <h2 className="mb-2 text-lg font-medium">Summary</h2>
        <p className="leading-7 text-[var(--muted)]">{scan.summary}</p>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[rgba(236,241,236,0.08)] bg-[rgba(255,255,255,0.02)] p-3 text-xs leading-6 text-[var(--muted)]">
          <Info size={14} className="mt-1 shrink-0" />
          <span>
            A finding is a signal from one public page, not proof of exploitability. <strong className="text-[var(--text)]/85">Exposure</strong> findings
            are the priority. <strong className="text-[var(--text)]/85">Hardening</strong> items are best-practice gaps and count little toward the
            exposure score.
          </span>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-[var(--muted)]">
          <LockKeyhole size={14} className="mt-0.5 shrink-0" />
          <span>Best-effort automated review. Not a penetration test or certification. Findings should be validated before production decisions.</span>
        </p>
      </div>

      {notes.length > 0 && (
        <div className="card mb-6 p-6">
          <h2 className="mb-3 text-lg font-medium">Scan limitations</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--muted)]">
            {notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
      )}

      {exposures.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Exposures</h2>
          <div className="grid gap-3">{exposures.map((f) => <FindingCard key={f.id} finding={f} />)}</div>
        </section>
      )}

      {signals.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Signals to validate</h2>
          <div className="grid gap-3">{signals.map((f) => <FindingCard key={f.id} finding={f} />)}</div>
        </section>
      )}

      {hardening.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Hardening suggestions</h2>
          <div className="grid gap-3">{hardening.map((f) => <FindingCard key={f.id} finding={f} />)}</div>
        </section>
      )}

      {manualChecks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-medium"><Wrench size={17} /> Verify manually</h2>
          <div className="grid gap-3">
            {manualChecks.map((check) => (
              <div key={check.id} className="card p-5">
                <h3 className="mb-1.5 font-medium">{check.title}</h3>
                <p className="text-sm leading-6 text-[var(--muted)]">{check.why}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-12 border-t border-[rgba(236,241,236,0.08)] pt-8 text-xs text-[var(--muted)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[var(--text)]">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--accent)] text-[#141814]">
              <SeaworthyMark className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">Seaworthy</span>
          </div>
          <div className="flex gap-4">
            <Link href="/security" className="hover:text-[var(--text)]">Security</Link>
            <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="container py-16 text-[var(--muted)]">Loading report...</main>}>
      <ReportBody params={params} />
    </Suspense>
  );
}

export const metadata = {
  robots: { index: false, follow: false },
};
