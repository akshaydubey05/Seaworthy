import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — Seaworthy",
  description: "Terms for using Seaworthy scans and reports.",
};

export default function TermsPage() {
  return (
    <main className="container py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="btn btn-ghost !min-h-10 !px-3 !text-[13px] mb-8">← Back to Seaworthy</Link>
        <p className="eyebrow mb-4">Legal</p>
        <h1 className="h2 mb-6 text-[clamp(2rem,5vw,3.5rem)]">Terms of Use</h1>
        <div className="card p-6 sm:p-8 space-y-5 text-[15px] leading-7 text-[var(--muted)]">
          <p className="text-[var(--text)]/88">
            This is a plain-language draft for the V1 launch. Replace with reviewed legal text before broad public/commercial use.
          </p>
          <section>
            <h2 className="text-[var(--text)] font-medium mb-2">Best-effort automated review</h2>
            <p>Seaworthy provides best-effort automated security checks for public URLs. Reports are informational and may contain false positives, false negatives, or incomplete coverage. Seaworthy is <strong className="text-[var(--text)]/85">not</strong> a penetration test, certification, compliance audit, or guarantee that an application is secure.</p>
          </section>
          <section>
            <h2 className="text-[var(--text)] font-medium mb-2">Authorized use only</h2>
            <p>You may only scan applications and URLs you own or have explicit permission to test. You are responsible for ensuring your use complies with applicable laws, contracts, and third-party terms.</p>
          </section>
          <section>
            <h2 className="text-[var(--text)] font-medium mb-2">No warranty</h2>
            <p>The service is provided “as is” without warranties of any kind. You are responsible for validating findings, applying fixes, and performing appropriate security reviews before launch or handling sensitive data.</p>
          </section>
          <section>
            <h2 className="text-[var(--text)] font-medium mb-2">Changes</h2>
            <p>Features, checks, pricing, and these terms may change as Seaworthy evolves. Before paid/public launch, publish final terms, privacy policy, and support contact details.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
