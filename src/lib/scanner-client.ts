import { logEvent } from "./observability";
import type { ScanMode, ScanResult } from "./scan";

/**
 * Client for the standalone Go scanner service (services/scanner).
 *
 * The Next.js app keeps a complete local scan engine as a fallback. When
 * SCANNER_URL and SCANNER_TOKEN are configured we prefer the Go service, because
 * it is the source of truth for scan rules and can be scaled independently.
 *
 * Failure policy:
 * - invalid target (HTTP 400) -> RemoteInputError, never retried locally
 * - network error / 5xx / bad payload -> fall back to the local engine
 */

export class RemoteInputError extends Error {}

type RemoteOutcome =
  | { kind: "ok"; result: ScanResult }
  | { kind: "unavailable"; reason: string }
  | { kind: "input"; message: string };

const DEFAULT_TIMEOUT_MS = 130_000;
const MAX_PAYLOAD_BYTES = 2_000_000;

export function scannerConfigured(): boolean {
  return Boolean(process.env.SCANNER_URL && process.env.SCANNER_TOKEN);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const TYPES = new Set(["exposure", "signal", "hardening"]);
const VERDICTS = new Set(["confirmed", "needs_validation", "rejected"]);
const STATUSES = new Set(["pass", "fail", "needs_validation", "skipped", "error"]);

function isFinding(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.evidence === "string" &&
    typeof value.fix === "string" &&
    typeof value.severity === "string" &&
    SEVERITIES.has(value.severity) &&
    typeof value.type === "string" &&
    TYPES.has(value.type) &&
    typeof value.verdict === "string" &&
    VERDICTS.has(value.verdict)
  );
}

function isCheckRun(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.category === "string" &&
    typeof value.severity === "string" &&
    SEVERITIES.has(value.severity) &&
    typeof value.type === "string" &&
    TYPES.has(value.type) &&
    typeof value.status === "string" &&
    STATUSES.has(value.status)
  );
}

/**
 * Validates the scanner payload before it reaches the UI, the PDF renderer, or
 * the database. A malformed payload must never produce a partial report.
 */
export function isScanResult(value: unknown): value is ScanResult {
  if (!isRecord(value)) return false;
  if (typeof value.url !== "string" || typeof value.finalUrl !== "string") return false;
  if (value.mode !== "fast" && value.mode !== "deep") return false;
  for (const key of ["score", "hardeningScore", "coverage", "checksRun", "checksTotal", "durationMs"]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key] as number)) return false;
  }
  if (typeof value.summary !== "string" || typeof value.receiptId !== "string") return false;
  if (!Array.isArray(value.findings) || !value.findings.every(isFinding)) return false;
  if (!Array.isArray(value.checks) || !value.checks.every(isCheckRun)) return false;
  if (!Array.isArray(value.notes) || !value.notes.every((note) => typeof note === "string")) return false;
  if (!Array.isArray(value.manualChecks)) return false;
  for (const check of value.manualChecks) {
    if (!isRecord(check) || typeof check.id !== "string" || typeof check.title !== "string" || typeof check.why !== "string") {
      return false;
    }
  }
  const context = value.context;
  if (!isRecord(context)) return false;
  if (
    typeof context.finalUrl !== "string" ||
    typeof context.status !== "number" ||
    typeof context.contentType !== "string" ||
    typeof context.bodyScanned !== "boolean" ||
    typeof context.truncated !== "boolean" ||
    typeof context.sensitive !== "boolean" ||
    typeof context.scriptsScanned !== "number"
  ) {
    return false;
  }
  const counts = value.counts;
  if (!isRecord(counts)) return false;
  for (const key of ["confirmed", "needs_validation", "rejected", "exposures", "signals", "hardening"]) {
    if (typeof counts[key] !== "number") return false;
  }
  return true;
}

function scannerEndpoint(): string | null {
  const base = process.env.SCANNER_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/v1/scan`;
}

export async function requestRemoteScan(
  input: string,
  mode: ScanMode,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<RemoteOutcome> {
  const endpoint = scannerEndpoint();
  const token = process.env.SCANNER_TOKEN;
  if (!endpoint || !token) return { kind: "unavailable", reason: "not_configured" };

  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scanner-token": token,
      },
      body: JSON.stringify({ url: input, mode }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 400 || response.status === 422) {
      let message = "That URL could not be scanned.";
      try {
        const payload = (await response.json()) as { error?: unknown };
        if (typeof payload.error === "string" && payload.error) message = payload.error;
      } catch {
        // keep the generic message
      }
      return { kind: "input", message };
    }

    if (!response.ok) {
      return { kind: "unavailable", reason: `http_${response.status}` };
    }

    const text = await response.text();
    if (text.length > MAX_PAYLOAD_BYTES) {
      return { kind: "unavailable", reason: "payload_too_large" };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return { kind: "unavailable", reason: "invalid_json" };
    }

    if (!isScanResult(payload)) {
      return { kind: "unavailable", reason: "contract_mismatch" };
    }

    return { kind: "ok", result: payload };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return { kind: "unavailable", reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scans with the Go service when configured.
 *
 * Returns null when the caller should use the local engine. Throws
 * RemoteInputError when the target itself is invalid.
 */
export async function remoteScanOrNull(
  input: string,
  mode: ScanMode,
  options: { fetchImpl?: typeof fetch; allowRemote?: boolean } = {},
): Promise<ScanResult | null> {
  if (options.allowRemote === false) return null;
  if (!scannerConfigured()) return null;

  const outcome = await requestRemoteScan(input, mode, { fetchImpl: options.fetchImpl });
  if (outcome.kind === "ok") {
    logEvent("info", "scan_remote_ok", {
      mode,
      scanner: process.env.SCANNER_URL,
      findings: outcome.result.findings.length,
      checksTotal: outcome.result.checksTotal,
    });
    return outcome.result;
  }
  if (outcome.kind === "input") {
    throw new RemoteInputError(outcome.message);
  }

  logEvent("warn", "scan_remote_fallback", { mode, reason: outcome.reason });
  return null;
}
