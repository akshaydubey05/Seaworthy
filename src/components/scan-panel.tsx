"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import type { FindingType, ScanResult, ScanSeverity } from "@/lib/scan";

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

type Filter = "all" | FindingType;

export function ScanPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setElapsed(0);
    setLoading(true);
    setResult(null);
    setFilter("all");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode: "fast" }),
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

  async function copyReceipt() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.receiptId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const sortedFindings = result
    ? [...result.findings].sort((a, b) => (typeRank[a.type || "signal"] ?? 1) - (typeRank[b.type || "signal"] ?? 1))
    : [];
  const visibleFindings = filter === "all" ? sortedFindings : sortedFindings.filter((finding) => finding.type === filter);
  const filters: Array<{ key: Filter; label: string; count: number }> = result
    ? [
        { key: "all", label: "All", count: sortedFindings.length },
        { key: "exposure", label: "Exposure", count: result.counts.exposures ?? 0 },
        { key: "signal", label: "Signals", count: result.counts.signals ?? result.counts.needs_validation ?? 0 },
        { key: "hardening", label: "Hardening", count: result.counts.hardening ?? 0 },
      ]
    : [];

  return (
    <div className="card p-5 sm:p-6 lg:p-7" id="scan">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Fast scan</p>
          <h2 className="text-[1.7rem] font-medium leading-[1.1] tracking-[-0.035em] sm:text-[2rem]">
            Check an app before launch
          </h2>
        </div>
        <span className="pill hidden sm:inline-flex"><span className="dot" />34 checks</span>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="scan-url">App URL</label>
        <input id="scan-url" className="input" placeholder="yourapp.com" value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="url" />
        <button className="btn btn-primary sm:min-w-[160px]" type="submit" disabled={loading}>
          {loading ? <><Loader2 size={16} className="animate-spin" /> Scanning</> : <>Run fast scan <ArrowRight size={16} className="btn-icon" /></>}
        </button>
      </form>

      <p className="mt-3 text-[13px] leading-6 text-[var(--muted)]">
        Public URLs only. 34 deterministic checks for exposed secrets, headers, and obvious launch risks. Best-effort automated review, not a penetration test.
      </p>

      {loading && (
        <div className="mt-4">
          <div className="scan-progress" role="progressbar" aria-label="Scan in progress" />
          <p className="mt-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.04em] text-[var(--muted)]" aria-live="polite">
            <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
            Scanning public surface · {elapsed}s
          </p>
        </div>
      )}

      {error && <div className="mt-4 rounded-xl border border-[rgba(255,150,150,0.22)] bg-[rgba(255,150,150,0.08)] px-4 py-3 text-sm text-[#ffb1b1]">{error}</div>}

      {result ? (
        <div key={result.receiptId} className="result-enter mt-6 grid gap-5 border-t border-[var(--line)] pt-6">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="score" style={{ ["--value" as string]: result.score }}><span>{result.score}</span></div>
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="kbd">Exposure score</span>
                <button type="button" onClick={copyReceipt} className="kbd copy-chip" aria-label={copied ? "Receipt ID copied" : "Copy receipt ID"}>
                  {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> {result.receiptId}</>}
                </button>
                <span className="kbd">{result.coverage}% coverage</span>
                <span className="kbd">{result.checksRun}/{result.checksTotal} checks</span>
                <span className="kbd">{Math.max(1, Math.round(result.durationMs / 1000))}s</span>
                {typeof result.hardeningScore === "number" && <span className="kbd">Hardening {result.hardeningScore}/100</span>}
              </div>
              <p className="text-[15px] leading-7 text-[color:var(--text)]/88">{result.summary}</p>
              <p className="mt-1 break-all text-[13px] text-[var(--muted)]">{result.url}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/report/${result.receiptId}`} className="btn btn-ghost !min-h-9 !px-3 !text-xs"><ExternalLink size={14} /> View report</a>
                <a href={`/api/report/${result.receiptId}/pdf`} className="btn btn-ghost !min-h-9 !px-3 !text-xs"><Download size={14} /> PDF</a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              ["Exposures", result.counts.exposures ?? 0, "text-[#ff9696]"],
              ["Signals", result.counts.signals ?? 0, "text-[var(--warn)]"],
              ["Hardening", result.counts.hardening ?? 0, "text-[var(--accent)]"],
            ] as const).map(([label, value, tone], index) => (
              <div key={label} className="card-soft stagger-item p-3 text-center" style={{ ["--i" as string]: index + 1 }}>
                <div className={`text-xl font-medium tracking-[-0.03em] ${tone}`}>{value}</div>
                <div className="mt-1 text-[11px] text-[var(--muted)]">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter findings">
                {filters.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="filter-tab"
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label}
                    <span className="filter-count">{item.count}</span>
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {result.mode === "deep" ? "Deep scan" : "Fast scan"}
              </span>
            </div>

            {visibleFindings.length ? visibleFindings.map((f, index) => (
              <article key={f.id} className="card-soft stagger-item p-4 sm:p-5" style={{ ["--i" as string]: Math.min(index, 8) }}>
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <span className={sevClass[f.severity]}>{f.severity}</span>
                  <span className={typeClass[f.type || "signal"]}>{typeLabel[f.type || "signal"]}</span>
                  <span className="kbd">{verdictLabel[f.verdict] || f.verdict}</span>
                  <span className="font-mono text-[11px] text-[var(--muted)]">{f.id}</span>
                </div>
                <h3 className="mb-2 text-[15px] font-medium leading-6">{f.title}</h3>
                <p className="text-[13px] leading-6 text-[var(--muted)]"><span className="text-[color:var(--text)]/72">Evidence:</span> {f.evidence}</p>
                <p className="mt-1 text-[13px] leading-6 text-[var(--muted)]"><span className="text-[color:var(--text)]/72">Fix:</span> {f.fix}</p>
              </article>
            )) : (
              <div className="card-soft p-4 text-[14px] leading-6 text-[var(--muted)]">
                {sortedFindings.length === 0
                  ? "No exposure signals or hardening gaps were observed on this public page. This is not a guarantee that the app is secure."
                  : `No ${filter === "signal" ? "signals needing validation" : filter} findings on this scan.`}
              </div>
            )}
          </div>

          <details className="card-soft">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]">View all {result.checks.length} checks</summary>
            <div className="grid gap-1.5 px-4 pb-4">
              {result.checks.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border-t border-[var(--line)] py-1.5 text-[12px]">
                  <span className="text-[var(--muted)]"><span className="mr-2 font-mono text-[11px]">{c.id}</span>{c.name}</span>
                  <span className={c.status === "pass" ? "text-[var(--accent)]" : c.status === "needs_validation" ? "text-[var(--warn)]" : c.status === "fail" ? "text-[#ff9696]" : "text-[var(--muted)]"}>{c.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 border-t border-[var(--line)] pt-6 sm:grid-cols-3">
          {[["Secrets", "API keys, tokens, and exposed build artifacts."], ["Access", "Auth, Supabase, and Stripe risk signals."], ["Headers", "Browser and transport hardening basics."]].map(([t, d], index) => (
            <div key={t} className="card-soft stagger-item px-4 py-4" style={{ ["--i" as string]: index + 1 }}><div className="mb-1 text-sm font-medium">{t}</div><div className="text-[13px] leading-5 text-[var(--muted)]">{d}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}
