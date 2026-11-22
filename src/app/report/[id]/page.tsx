import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, LockKeyhole } from "lucide-react";
import { SeaworthyMark } from "@/components/brand";
import { getScan } from "@/lib/store";

async function ReportBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return notFound();

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
          <p className="mt-2 break-all text-[var(--muted)]">{scan.url}</p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Score", `${scan.score}/100`], ["Coverage", `${scan.coverage}%`], ["Checks", `${scan.checksRun}/${scan.checksTotal}`], ["Confirmed", String(scan.counts?.confirmed ?? 0)]].map(([l, v]) => (
          <div key={l} className="card p-5"><div className="mb-2 text-xs text-[var(--muted)]">{l}</div><div className="text-2xl font-medium tracking-[-0.03em]">{v}</div></div>
        ))}
      </div>

      <div className="card mb-6 p-6 sm:p-7">
        <h2 className="mb-2 text-lg font-medium">Summary</h2>
        <p className="leading-7 text-[var(--muted)]">{scan.summary}</p>
        <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-[var(--muted)]"><LockKeyhole size={14} className="mt-0.5 shrink-0" /><span>Best-effort automated review. Not a penetration test or certification. Findings should be validated before production decisions.</span></p>
      </div>

      <div className="grid gap-3">
        {scan.findings.map((f) => (
          <article key={f.id} className="card p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={`sev sev-${f.severity}`}>{f.severity}</span>
              <span className="kbd">{f.verdict}</span>
              <span className="kbd">{f.id}</span>
            </div>
            <h3 className="mb-2 font-medium">{f.title}</h3>
            <p className="text-sm leading-6 text-[var(--muted)]"><span className="text-[var(--text)]/70">Evidence:</span> {f.evidence}</p>
            <p className="text-sm leading-6 text-[var(--muted)]"><span className="text-[var(--text)]/70">Fix:</span> {f.fix}</p>
          </article>
        ))}
      </div>

      <footer className="mt-12 border-t border-[rgba(236,241,236,0.08)] pt-8 text-xs text-[var(--muted)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[var(--text)]"><span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--accent)] text-[#141814]"><SeaworthyMark className="h-3.5 w-3.5" /></span><span className="font-medium">Seaworthy</span></div>
          <div className="flex gap-4"><Link href="/terms" className="hover:text-[var(--text)]">Terms</Link><Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link></div>
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