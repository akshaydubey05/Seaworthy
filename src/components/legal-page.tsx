import Link from "next/link";
import { site, mailto } from "@/lib/site";

export function LegalPage({
  eyebrow = "Legal",
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="container py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="btn btn-ghost !min-h-10 !px-3 !text-[13px] mb-8">← Back to Seaworthy</Link>
        <p className="eyebrow mb-4">{eyebrow}</p>
        <h1 className="h2 mb-4 text-[clamp(2rem,5vw,3.5rem)]">{title}</h1>
        <p className="mb-2 text-sm text-[var(--muted)]">Last updated: {site.legalUpdated}</p>
        {intro && <p className="mb-8 max-w-[42rem] text-[15px] leading-7 text-[var(--muted)]">{intro}</p>}
        <div className="card space-y-6 p-6 text-[15px] leading-7 text-[var(--muted)] sm:p-8">{children}</div>
        <p className="mt-6 text-xs leading-6 text-[var(--muted)]">
          Questions about this page? Email{" "}
          <a className="underline decoration-[rgba(236,241,236,0.25)] underline-offset-2 hover:text-[var(--text)]" href={mailto(site.contactEmail)}>
            {site.contactEmail}
          </a>
          .
        </p>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-medium text-[var(--text)]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
