import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Seaworthy",
  description: "How Seaworthy handles scan and waitlist data.",
};

export default function PrivacyPage() {
  return (
    <main className="container py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="btn btn-ghost !min-h-10 !px-3 !text-[13px] mb-8">← Back to Seaworthy</Link>
        <p className="eyebrow mb-4">Legal</p>
        <h1 className="h2 mb-6 text-[clamp(2rem,5vw,3.5rem)]">Privacy Policy</h1>
        <div className="card p-6 sm:p-8 space-y-5 text-[15px] leading-7 text-[var(--muted)]">
          <p className="text-[var(--text)]/88">
            This is a plain-language draft for the V1 launch. Replace with reviewed legal text before broad public/commercial use.
          </p>
          <section>
            <h2 className="text-[var(--text)] font-medium mb-2">What we collect</h2>
            <p>When you run a fast scan, we collect the submitted URL, scan results, evidence metadata, and technical logs needed to operate the service. If you join the waitlist, we collect your email address and the source of signup.</p>
          </section>
          <section>
            <h2 className="text-[var(--text)] font-medium mb-2">How we use data</h2>
            <p>We use data to provide scan reports, improve detection quality, prevent abuse, and contact waitlist subscribers about Seaworthy launches or updates they requested. We do not sell personal information.</p>
          </section>
          <section>
            <h2 className="text-[var(--text)] font-medium mb-2">Scan safety</h2>
            <p>Fast scans are intended for public URLs you own or have permission to test. Do not submit private systems or sensitive data. Scan output may include evidence snippets from public responses; handle reports as sensitive security information.</p>
          </section>
          <section>
            <h2 className="text-[var(--text)] font-medium mb-2">Retention &amp; contact</h2>
            <p>V1 may store scan/waitlist data in local or production storage depending on deployment configuration. Before production launch, define retention periods, deletion requests, and a contact email for privacy requests.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
