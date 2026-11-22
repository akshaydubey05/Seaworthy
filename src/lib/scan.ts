import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { CHECKS } from "./checks";
import { site } from "./site";

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

const MAX_RESPONSE_BYTES = 300_000;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 12_000;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export class ScanInputError extends Error {}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(raw: string): boolean {
  const ip = raw.toLowerCase().split("%")[0];
  if (ip === "::" || ip === "::1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(ip)) return true;
  if (ip.startsWith("ff")) return true;
  if (ip.startsWith("2001:db8")) return true;
  const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

function normalizeUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new ScanInputError("A URL is required.");
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ScanInputError("That does not look like a valid URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ScanInputError("Only http and https URLs are supported.");
  }
  if (url.username || url.password) {
    throw new ScanInputError("URLs with embedded credentials are not supported.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new ScanInputError("Only ports 80 and 443 are supported.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new ScanInputError("Local and private network URLs are not allowed.");
  }

  if (isIP(host) && isPrivateIp(host)) {
    throw new ScanInputError("Local and private network URLs are not allowed.");
  }

  return url;
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new ScanInputError("Local and private network URLs are not allowed.");
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new ScanInputError("That hostname could not be resolved.");
  }

  if (!addresses.length) throw new ScanInputError("That hostname could not be resolved.");
  for (const address of addresses) {
    if (isPrivateIp(address.address)) {
      throw new ScanInputError("That hostname resolves to a private or reserved address.");
    }
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (total >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  out += decoder.decode();
  return out.slice(0, maxBytes);
}

async function fetchWithGuards(startUrl: URL): Promise<{
  finalUrl: URL;
  headers: Headers | null;
  html: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let current = startUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicHost(current);

      const response = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "user-agent": `SeaworthyFastScan/0.1 (+${site.url})`,
          accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { finalUrl: current, headers: response.headers, html: "" };
        }
        if (hop === MAX_REDIRECTS) throw new ScanInputError("Too many redirects.");
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new ScanInputError("The target returned an invalid redirect.");
        }
        if (!["http:", "https:"].includes(next.protocol)) {
          throw new ScanInputError("The target redirected to an unsupported protocol.");
        }
        if (!ALLOWED_PORTS.has(next.port)) {
          throw new ScanInputError("The target redirected to an unsupported port.");
        }
        current = next;
        continue;
      }

      const html = await readCapped(response, MAX_RESPONSE_BYTES);
      return { finalUrl: current, headers: response.headers, html };
    }

    throw new ScanInputError("Too many redirects.");
  } finally {
    clearTimeout(timer);
  }
}

function scoreFromFindings(findings: Finding[]): number {
  const weights: Record<ScanSeverity, number> = { critical: 24, high: 14, medium: 7, low: 3 };
  const penalty = findings
    .filter((finding) => finding.verdict !== "rejected")
    .reduce((sum, finding) => sum + weights[finding.severity], 0);
  return Math.max(8, Math.min(100, 100 - penalty));
}

export async function runFastScan(input: string): Promise<ScanResult> {
  const started = Date.now();
  const url = normalizeUrl(input);

  let html = "";
  let headers: Headers | null = null;
  let fetchError = "";

  try {
    const result = await fetchWithGuards(url);
    headers = result.headers;
    html = result.html;
  } catch (error) {
    if (error instanceof ScanInputError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      fetchError = "The target took too long to respond.";
    } else {
      fetchError = error instanceof Error ? error.message : "Unable to fetch target";
    }
  }

  const ctx = { url, html, lower: html.toLowerCase(), headers, fetchError };
  const findings: Finding[] = [];
  const checks: CheckRun[] = [];

  for (const check of CHECKS) {
    try {
      const result = check.run(ctx);
      if (result) {
        findings.push(result);
        checks.push({
          id: check.id,
          name: check.name,
          category: check.category,
          status: result.verdict === "needs_validation" ? "needs_validation" : "fail",
          severity: check.severity,
        });
      } else {
        checks.push({
          id: check.id,
          name: check.name,
          category: check.category,
          status: "pass",
          severity: check.severity,
        });
      }
    } catch {
      checks.push({
        id: check.id,
        name: check.name,
        category: check.category,
        status: "error",
        severity: check.severity,
      });
    }
  }

  const dedup = Array.from(new Map(findings.map((finding) => [finding.id, finding])).values());
  const score = scoreFromFindings(dedup);
  const checksRun = checks.filter((check) => check.status !== "error").length;
  const coverage = Math.round((checksRun / CHECKS_TOTAL) * 100);
  const confirmed = dedup.filter((finding) => finding.verdict === "confirmed").length;
  const needsValidation = dedup.filter((finding) => finding.verdict === "needs_validation").length;
  const critical = dedup.filter((finding) => finding.severity === "critical" && finding.verdict === "confirmed").length;
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
