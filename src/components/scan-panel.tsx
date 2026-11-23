"use client";

import { useState } from "react";
import { ArrowRight, Download, ExternalLink, Loader2 } from "lucide-react";
import type { ScanResult, ScanSeverity } from "@/lib/scan";

const sevClass: Record<ScanSeverity, string> = {
  critical: "sev sev-critical",
  high: "sev sev-high",
  medium: "sev sev-medium",
  low: "sev sev-low",
};

const typeClass: Record<string, string> = {
  exposure: "tag tag-exposure",
  signal: "tag tag-signal",
  hardening: "tag tag-hardening",
};

const typeLabel: Record<string, string> = {
  exposure: "Exposure",
  signal: "Needs validation",
  hardening: "Hardening",
};

const verdictLabel: Record<string, string> = {
  confirmed: "observed",
  needs_validation: "needs validation",
  rejected: "rejected",
};

const typeRank: Record<string, number> = { exposure: 0, signal: 1, hardening: 2 };

export function ScanPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as ScanResult | { error?: string };
      if (!res.ok) throw new Error(("error" in data && data.error) || "Scan failed.");
      setResult(data as ScanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5 sm:p-6 lg:p-7" id="scan">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Fast scan</p>
          <h2 className="text-[1.7rem] font-medium leading-[1.1] tracking-[-0.035em] sm:text-[2rem]">
            Check an app before launch
          </h2>
        </div>
        <span className="pill hidden sm:inline-flex"><span className="dot" />30 checks</span>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="scan-url">App URL</label>
        <input id="scan-url" className="input" placeholder="yourapp.com" value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="url" />
        <button className="btn btn-primary sm:min-w-[160px]" type="submit" disabled={loading}>
          {loading ? <><Loader2 size={16} className="animate-spin" /> Scanning</> : <>Run fast scan <ArrowRight size={16} className="btn-icon" /></>}
        </button>
      </form>

      <p className="mt-3 text-[13px] leading-6 text-[var(--muted)]">
        Public URLs only. 30 deterministic checks for exposed secrets, headers, and obvious launch risks. Best-effort automated review, not a penetration test.
      </p>

      {error && <div className="mt-4 rounded-xl border border-[rgba(255,150,150,0.22)] bg-[rgba(255,150,150,0.08)] px-4 py-3 text-sm text-[#ffb1b1]">{error}</div>}

      {result ? (
        <div className="mt-6 pt-6 border-t border-[var(--line)] grid gap-5">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="score" style={{ ["--value" as string]: result.score }}><span>{result.score}</span></div>
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="kbd">Exposure score</span>
                <span className="kbd">{result.receiptId}</span>
                <span className="kbd">{result.coverage}% coverage</span>
                <span className="kbd">{result.checksRun}/{result.checksTotal} checks</span>
                <span className="kbd">{Math.max(1, Math.round(result.durationMs / 1000))}s</span>
                {typeof result.hardeningScore === "number" && <span className="kbd">Hardening {result.hardeningScore}/100</span>}
              </div>
              <p className="text-[15px] leading-7 text-[color:var(--text)]/88">{result.summary}</p>
              <p className="mt-1 text-[13px] text-[var(--muted)] break-all">{result.url}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/report/${result.receiptId}`} className="btn btn-ghost !min-h-9 !px-3 !text-xs"><ExternalLink size={14} /> View report</a>
                <a href={`/api/report/${result.receiptId}/pdf`} className="btn btn-ghost !min-h-9 !px-3 !text-xs"><Download size={14} /> PDF</a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[["Exposures", result.counts.exposures ?? 0, "text-[#ff9696]"], ["Needs validation", result.counts.needs_validation, "text-[var(--warn)]"], ["Hardening", result.counts.hardening ?? 0, "text-[var(--accent)]"]].map(([l,v,c]) => (
              <div key={String(l)} className="card-soft p-3 text-center">
                <div className={`text-xl font-medium tracking-[-0.03em] ${c}`}>{v}</div>
                <div className="text-[11px] text-[var(--muted)] mt-1">{l}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3">
            {result.findings.length ? [...result.findings].sort((a, b) => (typeRank[a.type || "signal"] ?? 1) - (typeRank[b.type || "signal"] ?? 1)).map((f) => (
              <article key={f.id} className="card-soft p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <span className={sevClass[f.severity]}>{f.severity}</span>
                  <span className={typeClass[f.type || "signal"]}>{typeLabel[f.type || "signal"]}</span>
                  <span className="kbd">{verdictLabel[f.verdict] || f.verdict}</span>
                  <span className="text-[11px] font-mono text-[var(--muted)]">{f.id}</span>
                </div>
                <h3 className="text-[15px] font-medium leading-6 mb-2">{f.title}</h3>
                <p className="text-[13px] leading-6 text-[var(--muted)]"><span className="text-[color:var(--text)]/72">Evidence:</span> {f.evidence}</p>
                <p className="mt-1 text-[13px] leading-6 text-[var(--muted)]"><span className="text-[color:var(--text)]/72">Fix:</span> {f.fix}</p>
              </article>
            )) : (
              <div className="card-soft p-4 text-[14px] leading-6 text-[var(--muted)]">No exposure signals or hardening gaps were observed on this public page. This is not a guarantee that the app is secure.</div>
            )}
          </div>

          <details className="card-soft">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]">View all {result.checks.length} checks</summary>
            <div className="px-4 pb-4 grid gap-1.5">
              {result.checks.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 text-[12px] py-1.5 border-t border-[var(--line)]">
                  <span className="text-[var(--muted)]"><span className="font-mono text-[11px] mr-2">{c.id}</span>{c.name}</span>
                  <span className={c.status === "pass" ? "text-[var(--accent)]" : c.status === "needs_validation" ? "text-[var(--warn)]" : c.status === "fail" ? "text-[#ff9696]" : "text-[var(--muted)]"}>{c.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-6 pt-6 border-t border-[var(--line)] grid sm:grid-cols-3 gap-3">
          {[["Secrets", "API keys, tokens, and exposed build artifacts."], ["Access", "Auth, Supabase, and Stripe risk signals."], ["Headers", "Browser and transport hardening basics."]].map(([t, d]) => (
            <div key={t} className="card-soft px-4 py-4"><div className="text-sm font-medium mb-1">{t}</div><div className="text-[13px] leading-5 text-[var(--muted)]">{d}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}