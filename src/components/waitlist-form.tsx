"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website, source: "website-waitlist" }),
      });
      if (!res.ok) throw new Error();
      setStatus("ok");
      setEmail("");
      setWebsite("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div
        className="rounded-xl border border-[rgba(149,176,149,0.25)] bg-[rgba(149,176,149,0.08)] px-4 py-3 text-sm text-[var(--accent)]"
        role="status"
      >
        You’re on the list. We’ll email you when Full Report and Monitor launch.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3 sm:flex-row">
      <label htmlFor="waitlist-email" className="sr-only">Email address</label>
      <input
        id="waitlist-email"
        type="email"
        required
        placeholder="you@company.com"
        className="input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        maxLength={254}
      />

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="waitlist-website">Website</label>
        <input
          id="waitlist-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-primary sm:shrink-0" disabled={status === "loading"}>
        {status === "loading" ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Saving
          </>
        ) : (
          "Join waitlist"
        )}
      </button>
      {status === "error" && (
        <p className="text-xs text-[#ff9696] sm:self-center" role="status">
          Could not save email. Try again.
        </p>
      )}
    </form>
  );
}
