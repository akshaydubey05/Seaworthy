import { CHECKS } from "./checks";

export type ScanSeverity = "critical" | "high" | "medium" | "low";
export type Verdict = "confirmed" | "needs_validation" | "rejected";

export type Finding = {
  id: string;
  title: string;
  severity: ScanSeverity;
  verdict: Verdict;
  evidence: string;
  fix: string;
};

export type CheckRun = {
  id: string;
  name: string;
  category: string;
  status: "pass" | "fail" | "needs_validation" | "error";
  severity: ScanSeverity;
};

export type ScanResult = {
  url: string;
  score: number;
  coverage: number;
  checksRun: number;
  checksTotal: number;
  durationMs: number;
  findings: Finding[];
  summary: string;
  receiptId: string;
  checks: CheckRun[];
  counts: { confirmed: number; needs_validation: number; rejected: number };
};

export const CHECKS_TOTAL = 30;

function normalizeUrl(input: string): URL {
  const raw = input.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withScheme);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https URLs are supported.");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || /^169\.254\./.test(host) || host.endsWith(".internal")
  ) {
    throw new Error("Local and private network URLs are not allowed.");
  }
  return url;
}

function scoreFromFindings(findings: Finding[]): number {
  const weights: Record<ScanSeverity, number> = { critical: 24, high: 14, medium: 7, low: 3 };
  const penalty = findings.filter(f => f.verdict !== "rejected").reduce((sum, f) => sum + weights[f.severity], 0);
  return Math.max(8, Math.min(100, 100 - penalty));
}

export async function runFastScan(input: string): Promise<ScanResult> {
  const started = Date.now();
  const url = normalizeUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  let html = "";
  let headers: Headers | null = null;
  let fetchError = "";
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "SeaworthyFastScan/0.1 (+https://seaworthy.dev)" },
      cache: "no-store",
    });
    headers = res.headers;
    html = (await res.text()).slice(0, 300_000);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Unable to fetch target";
  } finally {
    clearTimeout(timeout);
  }

  const ctx = { url, html, lower: html.toLowerCase(), headers, fetchError };
  const findings: Finding[] = [];
  const checks: CheckRun[] = [];

  for (const check of CHECKS) {
    try {
      const result = check.run(ctx);
      if (result) {
        findings.push(result);
        checks.push({ id: check.id, name: check.name, category: check.category, status: result.verdict === "needs_validation" ? "needs_validation" : "fail", severity: check.severity });
      } else {
        checks.push({ id: check.id, name: check.name, category: check.category, status: "pass", severity: check.severity });
      }
    } catch {
      checks.push({ id: check.id, name: check.name, category: check.category, status: "error", severity: check.severity });
    }
  }

  const dedup = Array.from(new Map(findings.map((f) => [f.id, f])).values());
  const score = scoreFromFindings(dedup);
  const checksRun = checks.filter(c => c.status !== "error").length;
  const coverage = Math.round((checksRun / CHECKS_TOTAL) * 100);
  const confirmed = dedup.filter(f => f.verdict === "confirmed").length;
  const needsValidation = dedup.filter(f => f.verdict === "needs_validation").length;
  const critical = dedup.filter(f => f.severity === "critical" && f.verdict === "confirmed").length;
  const summary = dedup.length
    ? `Found ${dedup.length} issue${dedup.length === 1 ? "" : "s"}${critical ? `, including ${critical} confirmed critical` : ""}. ${needsValidation ? `${needsValidation} need validation.` : "Review evidence before launch."}`
    : "No high-signal public issues detected in this fast scan. A deep audit is still required before launch.";

  return {
    url: url.toString(),
    score,
    coverage,
    checksRun,
    checksTotal: CHECKS_TOTAL,
    durationMs: Date.now() - started,
    findings: dedup,
    summary,
    receiptId: `SW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    checks,
    counts: { confirmed, needs_validation: needsValidation, rejected: 0 },
  };
}