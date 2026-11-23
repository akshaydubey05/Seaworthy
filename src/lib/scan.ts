import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { CHECKS, buildManualChecks, type CheckContext } from "./checks";
import { site } from "./site";

export type ScanSeverity = "critical" | "high" | "medium" | "low";
export type Verdict = "confirmed" | "needs_validation" | "rejected";
/**
 * exposure: something that looks like a real leak or exploitable misconfiguration.
 * signal:   a pattern worth validating, but not proof of a problem.
 * hardening: a best-practice gap (headers, hygiene) with little direct exploitability.
 */
export type FindingType = "exposure" | "signal" | "hardening";

export type Finding = {
  id: string;
  title: string;
  severity: ScanSeverity;
  verdict: Verdict;
  type: FindingType;
  evidence: string;
  fix: string;
};

export type CheckRun = {
  id: string;
  name: string;
  category: string;
  status: "pass" | "fail" | "needs_validation" | "skipped" | "error";
  severity: ScanSeverity;
  type: FindingType;
};

export type ManualCheck = {
  id: string;
  title: string;
  why: string;
};

export type ScanContextInfo = {
  finalUrl: string;
  status: number;
  contentType: string;
  bodyScanned: boolean;
  truncated: boolean;
  hasForms: boolean;
  hasPasswordForm: boolean;
  hasPaymentScript: boolean;
  sensitive: boolean;
};

export type ScanResult = {
  url: string;
  finalUrl: string;
  score: number;
  hardeningScore: number;
  coverage: number;
  checksRun: number;
  checksTotal: number;
  durationMs: number;
  findings: Finding[];
  manualChecks: ManualCheck[];
  notes: string[];
  context: ScanContextInfo;
  summary: string;
  receiptId: string;
  checks: CheckRun[];
  counts: {
    confirmed: number;
    needs_validation: number;
    rejected: number;
    exposures: number;
    signals: number;
    hardening: number;
  };
};

export const CHECKS_TOTAL = CHECKS.length;

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

async function readCapped(response: Response, maxBytes: number): Promise<{ html: string; truncated: boolean }> {
  if (!response.body) return { html: "", truncated: false };
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
  return { html: out.slice(0, maxBytes), truncated: total >= maxBytes };
}

async function fetchWithGuards(startUrl: URL): Promise<{
  finalUrl: URL;
  headers: Headers | null;
  html: string;
  status: number;
  contentType: string;
  truncated: boolean;
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
          "accept-language": "en",
        },
        cache: "no-store",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          const body = await readCapped(response, MAX_RESPONSE_BYTES);
          return {
            finalUrl: current,
            headers: response.headers,
            html: body.html,
            status: response.status,
            contentType: response.headers.get("content-type") || "",
            truncated: body.truncated,
          };
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

      const body = await readCapped(response, MAX_RESPONSE_BYTES);
      return {
        finalUrl: current,
        headers: response.headers,
        html: body.html,
        status: response.status,
        contentType: response.headers.get("content-type") || "",
        truncated: body.truncated,
      };
    }

    throw new ScanInputError("Too many redirects.");
  } finally {
    clearTimeout(timer);
  }
}

const EXPOSURE_WEIGHTS: Record<ScanSeverity, number> = { critical: 32, high: 20, medium: 10, low: 4 };
const SIGNAL_WEIGHTS: Record<ScanSeverity, number> = { critical: 10, high: 7, medium: 4, low: 2 };
const HARDENING_WEIGHTS: Record<ScanSeverity, number> = { critical: 3, high: 2, medium: 1, low: 0.5 };
const HARDENING_SCORE_WEIGHTS: Record<ScanSeverity, number> = { critical: 25, high: 15, medium: 8, low: 3 };
const HARDENING_CAP = 6;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreFindings(findings: Finding[]) {
  let exposure = 0;
  let signal = 0;
  let hardening = 0;
  let hardeningForScore = 0;

  for (const finding of findings) {
    if (finding.verdict === "rejected") continue;
    if (finding.type === "exposure") exposure += EXPOSURE_WEIGHTS[finding.severity];
    else if (finding.type === "signal") signal += SIGNAL_WEIGHTS[finding.severity];
    else {
      hardening += HARDENING_WEIGHTS[finding.severity];
      hardeningForScore += HARDENING_SCORE_WEIGHTS[finding.severity];
    }
  }

  return {
    score: clamp(Math.round(100 - exposure - signal - Math.min(hardening, HARDENING_CAP)), 5, 100),
    hardeningScore: clamp(Math.round(100 - hardeningForScore), 0, 100),
  };
}

function buildSummary(findings: Finding[], context: ScanContextInfo) {
  const exposures = findings.filter((f) => f.type === "exposure" && f.verdict !== "rejected").length;
  const signals = findings.filter((f) => f.type === "signal" && f.verdict !== "rejected").length;
  const hardening = findings.filter((f) => f.type === "hardening" && f.verdict !== "rejected").length;
  const critical = findings.filter((f) => f.severity === "critical" && f.verdict !== "rejected").length;

  if (!context.bodyScanned) {
    return `Only response headers were evaluated (status ${context.status}, content-type ${context.contentType || "unknown"}). Content checks were skipped.`;
  }

  if (findings.length === 0) {
    return "No exposure signals or hardening gaps were observed on this public page. This is not a guarantee that the app is secure.";
  }

  const parts: string[] = [];
  if (exposures) parts.push(`${exposures} exposure signal${exposures === 1 ? "" : "s"}`);
  if (signals) parts.push(`${signals} item${signals === 1 ? "" : "s"} needing validation`);
  if (hardening) parts.push(`${hardening} hardening suggestion${hardening === 1 ? "" : "s"}`);

  const lead = `Found ${parts.join(", ")}.`;
  if (exposures) {
    return `${lead}${critical ? ` ${critical} critical.` : ""} Review the evidence before launch; exposures are the highest priority.`;
  }
  return `${lead} No exposure signals were observed. Hardening gaps are best-practice notes, not proof of exploitability.`;
}

function buildNotes(url: URL, context: ScanContextInfo, findings: Finding[]): string[] {
  const notes: string[] = [];
  if (context.finalUrl && context.finalUrl !== url.toString()) {
    notes.push(`The target redirected to ${context.finalUrl}. Results describe the final response.`);
  }
  if (!context.bodyScanned) {
    notes.push(
      `The response was status ${context.status} with content-type ${context.contentType || "unknown"}. Body checks (secrets, links, mixed content) were skipped; only response headers were evaluated.`,
    );
  }
  if (context.truncated) {
    notes.push("The HTML response was truncated at 300 KB. Signals that appear later in the page may be missed.");
  }
  if (context.sensitive) {
    notes.push("This page appears to have an interactive or sensitive surface (login, payment, or forms). Validate auth and session handling manually.");
  }
  if (findings.length === 0) {
    notes.push("A clean result covers one public page only. Authenticated routes, APIs, and runtime behavior were not tested.");
  }
  return notes;
}

export async function runFastScan(input: string): Promise<ScanResult> {
  const started = Date.now();
  const url = normalizeUrl(input);

  let html = "";
  let headers: Headers | null = null;
  let finalUrl = url;
  let status = 0;
  let contentType = "";
  let truncated = false;
  let fetchError = "";

  try {
    const result = await fetchWithGuards(url);
    headers = result.headers;
    html = result.html;
    finalUrl = result.finalUrl;
    status = result.status;
    contentType = result.contentType;
    truncated = result.truncated;
  } catch (error) {
    if (error instanceof ScanInputError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      fetchError = "The target took too long to respond.";
    } else {
      fetchError = error instanceof Error ? error.message : "Unable to fetch target";
    }
  }

  const bodyScanned =
    !fetchError && status > 0 && status < 400 && /text\/html|application\/xhtml\+xml/i.test(contentType) && html.length > 0;
  const lower = html.toLowerCase();
  const hasForms = /<form\b/i.test(html);
  const hasPasswordForm = /type=["']?password/i.test(html);
  const hasPaymentScript = /js\.stripe\.com\/v3|checkout\.stripe\.com/i.test(html);
  const sensitive = hasPasswordForm || hasPaymentScript;

  const context: ScanContextInfo = {
    finalUrl: finalUrl.toString(),
    status,
    contentType,
    bodyScanned,
    truncated,
    hasForms,
    hasPasswordForm,
    hasPaymentScript,
    sensitive,
  };

  const ctx: CheckContext = {
    url,
    finalUrl,
    html,
    lower,
    headers,
    fetchError,
    bodyScanned,
    truncated,
    hasForms,
    hasPasswordForm,
    hasPaymentScript,
    sensitive,
  };

  const findings: Finding[] = [];
  const checks: CheckRun[] = [];

  for (const check of CHECKS) {
    const needsBody = check.source === "body" || check.source === "both";
    const needsHeaders = check.source === "headers" || check.source === "both";

    if ((needsBody && !bodyScanned) || (needsHeaders && !headers)) {
      checks.push({
        id: check.id,
        name: check.name,
        category: check.category,
        status: "skipped",
        severity: check.severity,
        type: check.type,
      });
      continue;
    }

    try {
      const result = check.run(ctx);
      if (result) {
        findings.push(result);
        checks.push({
          id: check.id,
          name: check.name,
          category: check.category,
          status: result.verdict === "needs_validation" ? "needs_validation" : "fail",
          severity: result.severity,
          type: result.type,
        });
      } else {
        checks.push({
          id: check.id,
          name: check.name,
          category: check.category,
          status: "pass",
          severity: check.severity,
          type: check.type,
        });
      }
    } catch {
      checks.push({
        id: check.id,
        name: check.name,
        category: check.category,
        status: "error",
        severity: check.severity,
        type: check.type,
      });
    }
  }

  const dedup = Array.from(new Map(findings.map((finding) => [finding.id, finding])).values());
  const { score, hardeningScore } = scoreFindings(dedup);
  const checksRun = checks.filter((check) => check.status !== "error" && check.status !== "skipped").length;
  const coverage = Math.round((checksRun / CHECKS_TOTAL) * 100);
  const confirmed = dedup.filter((finding) => finding.verdict === "confirmed").length;
  const needsValidation = dedup.filter((finding) => finding.verdict === "needs_validation").length;
  const exposures = dedup.filter((finding) => finding.type === "exposure").length;
  const signals = dedup.filter((finding) => finding.type === "signal").length;
  const hardening = dedup.filter((finding) => finding.type === "hardening").length;
  const manualChecks = buildManualChecks(ctx);

  return {
    url: url.toString(),
    finalUrl: finalUrl.toString(),
    score,
    hardeningScore,
    coverage,
    checksRun,
    checksTotal: CHECKS_TOTAL,
    durationMs: Date.now() - started,
    findings: dedup,
    manualChecks,
    notes: buildNotes(url, context, dedup),
    context,
    summary: buildSummary(dedup, context),
    receiptId: `SW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    checks,
    counts: { confirmed, needs_validation: needsValidation, rejected: 0, exposures, signals, hardening },
  };
}
