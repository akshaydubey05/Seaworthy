import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container flex min-h-[70vh] items-center py-16">
      <div className="card mx-auto w-full max-w-xl p-8 sm:p-10">
        <p className="eyebrow mb-4">404</p>
        <h1 className="h2 mb-4 text-[clamp(1.8rem,4vw,2.6rem)]">That page is not here.</h1>
        <p className="mb-7 text-[15px] leading-7 text-[var(--muted)]">
          The report may have expired, or the link is incorrect. Run a fresh scan to create a new receipt.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/#scan" className="btn btn-primary">Run fast scan</Link>
          <Link href="/" className="btn btn-ghost">Back to Seaworthy</Link>
        </div>
      </div>
    </main>
  );
}
