"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("seaworthy_client_error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="container flex min-h-[70vh] items-center py-16">
      <div className="card mx-auto w-full max-w-xl p-8 sm:p-10">
        <p className="eyebrow mb-4">Something went wrong</p>
        <h1 className="h2 mb-4 text-[clamp(1.8rem,4vw,2.6rem)]">This page hit an error.</h1>
        <p className="mb-7 text-[15px] leading-7 text-[var(--muted)]">
          The failure has been logged. Retry the action, or go back and run the scan again. If it keeps happening,
          email us with the reference below.
        </p>
        {error.digest && (
          <p className="mb-6 font-mono text-xs text-[var(--muted)]">Reference: {error.digest}</p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="btn btn-primary">
            <RotateCcw size={16} /> Try again
          </button>
          <Link href="/" className="btn btn-ghost">Back to Seaworthy</Link>
        </div>
      </div>
    </main>
  );
}
