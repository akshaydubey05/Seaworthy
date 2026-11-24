import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { CHECKS } from "@/lib/checks";
import { DEEP_CHECKS } from "@/lib/deep-checks";
import { isScanResult, requestRemoteScan, scannerConfigured } from "@/lib/scanner-client";
import { runFastScan } from "@/lib/scan";

const root = process.cwd();

function goCheckIDs(file: string): string[] {
  const source = readFileSync(join(root, "services", "scanner", "internal", "checks", file), "utf8");
  return Array.from(source.matchAll(/^\s*ID:\s*"([A-Z]+-\d+)"/gm), (match) => match[1]);
}

function goResult(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://example.test/",
    finalUrl: "https://example.test/",
    mode: "fast",
    score: 92,
    hardeningScore: 88,
    coverage: 100,
    checksRun: 34,
    checksTotal: 34,
    durationMs: 812,
    findings: [
      {
        id: "SW-013",
        title: "Content-Security-Policy header not set",
        severity: "low",
        verdict: "confirmed",
        type: "hardening",
        evidence: "No enforcing CSP header was found.",
        fix: "Add a CSP.",
      },
    ],
    manualChecks: [{ id: "M-05", title: "Check CSRF protection", why: "Forms are present." }],
    notes: ["Scanned 1 same-origin JavaScript bundle(s) for leaked credentials."],
    context: {
      finalUrl: "https://example.test/",
      status: 200,
      contentType: "text/html",
      bodyScanned: true,
      truncated: false,
      hasForms: true,
      hasPasswordForm: false,
      hasPaymentScript: false,
      sensitive: false,
      scriptsScanned: 1,
    },
    summary: "Found 1 hardening suggestion.",
    receiptId: "SW-ABC123-DEAD",
    checks: [
      {
        id: "SW-013",
        name: "CSP state",
        category: "Headers",
        status: "fail",
        severity: "low",
        type: "hardening",
      },
    ],
    counts: { confirmed: 1, needs_validation: 0, rejected: 0, exposures: 0, signals: 0, hardening: 1 },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Go/TypeScript rule parity", () => {
  it("keeps fast check IDs and order identical", () => {
    expect(goCheckIDs("fast.go")).toEqual(CHECKS.map((check) => check.id));
  });

  it("keeps deep check IDs and order identical", () => {
    expect(goCheckIDs("deep.go")).toEqual(DEEP_CHECKS.map((check) => check.id));
  });

  it("advertises exactly the checks that exist", () => {
    expect(CHECKS).toHaveLength(34);
    expect(new Set(CHECKS.map((check) => check.id)).size).toBe(34);
    expect(DEEP_CHECKS).toHaveLength(8);
  });
});

describe("scanner contract", () => {
  it("accepts a valid Go payload", () => {
    expect(isScanResult(goResult())).toBe(true);
  });

  it("rejects payloads that would break the report", () => {
    expect(isScanResult(null)).toBe(false);
    expect(isScanResult({})).toBe(false);
    expect(isScanResult(goResult({ findings: [{ id: "SW-001" }] }))).toBe(false);
    expect(isScanResult(goResult({ mode: "turbo" }))).toBe(false);
    expect(isScanResult(goResult({ score: "high" }))).toBe(false);
    expect(isScanResult(goResult({ counts: undefined }))).toBe(false);
    expect(isScanResult(goResult({ checks: [{ id: "SW-001" }] }))).toBe(false);
  });
});

describe("remote scanner client", () => {
  it("is disabled without configuration", () => {
    vi.stubEnv("SCANNER_URL", "");
    vi.stubEnv("SCANNER_TOKEN", "");
    expect(scannerConfigured()).toBe(false);
  });

  it("sends the token and returns a validated result", async () => {
    vi.stubEnv("SCANNER_URL", "https://scanner.internal/");
    vi.stubEnv("SCANNER_TOKEN", "secret-token");
    expect(scannerConfigured()).toBe(true);

    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(goResult()), { status: 200, headers: { "content-type": "application/json" } }),
    ) as unknown as typeof fetch;

    const outcome = await requestRemoteScan("example.test", "fast", { fetchImpl });
    expect(outcome.kind).toBe("ok");

    const [endpoint, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(endpoint).toBe("https://scanner.internal/v1/scan");
    expect((init.headers as Record<string, string>)["x-scanner-token"]).toBe("secret-token");
    expect(JSON.parse(String(init.body))).toEqual({ url: "example.test", mode: "fast" });
  });

  it("maps invalid targets to an input error", async () => {
    vi.stubEnv("SCANNER_URL", "https://scanner.internal");
    vi.stubEnv("SCANNER_TOKEN", "secret-token");
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: "local and private network URLs are not allowed" }), { status: 400 }),
    ) as unknown as typeof fetch;

    const outcome = await requestRemoteScan("http://127.0.0.1", "fast", { fetchImpl });
    expect(outcome).toEqual({ kind: "input", message: "local and private network URLs are not allowed" });
  });

  it("falls back when the service is unhealthy or the payload drifts", async () => {
    vi.stubEnv("SCANNER_URL", "https://scanner.internal");
    vi.stubEnv("SCANNER_TOKEN", "secret-token");

    const unhealthy = vi.fn(async () => new Response("upstream down", { status: 503 })) as unknown as typeof fetch;
    expect(await requestRemoteScan("example.test", "fast", { fetchImpl: unhealthy })).toEqual({
      kind: "unavailable",
      reason: "http_503",
    });

    const drifted = vi.fn(async () =>
      new Response(JSON.stringify({ url: "https://example.test" }), { status: 200 }),
    ) as unknown as typeof fetch;
    expect(await requestRemoteScan("example.test", "fast", { fetchImpl: drifted })).toEqual({
      kind: "unavailable",
      reason: "contract_mismatch",
    });

    const throwing = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await requestRemoteScan("example.test", "fast", { fetchImpl: throwing })).toEqual({
      kind: "unavailable",
      reason: "network_error",
    });
  });

  it("uses the remote result in runFastScan when configured", async () => {
    vi.stubEnv("SCANNER_URL", "https://scanner.internal");
    vi.stubEnv("SCANNER_TOKEN", "secret-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(goResult({ receiptId: "SW-REMOTE-1" })), { status: 200 })),
    );

    const result = await runFastScan("example.test");
    expect(result.receiptId).toBe("SW-REMOTE-1");
  });

  it("falls back to the local engine when the scanner is unreachable", async () => {
    vi.stubEnv("SCANNER_URL", "https://scanner.internal");
    vi.stubEnv("SCANNER_TOKEN", "secret-token");

    const page = `<!doctype html><html><body><p>ok</p></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("scanner.internal")) throw new Error("ECONNREFUSED");
        return new Response(page, { headers: { "content-type": "text/html" } });
      }),
    );

    const result = await runFastScan("https://example.test");
    expect(result.receiptId.startsWith("SW-")).toBe(true);
    expect(result.checksTotal).toBe(34);
  });
});
