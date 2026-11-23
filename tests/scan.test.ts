import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { runFastScan, ScanInputError } from "@/lib/scan";
import { runDeepScan } from "@/lib/deep";

const html = (body: string, head = "") =>
  `<!doctype html><html><head><title>T</title>${head}</head><body>${body}</body></html>`;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  return vi.fn(async (input: string | URL | Request) => handler(typeof input === "string" ? input : input.toString()));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scan normalization and safety", () => {
  it("rejects localhost/private targets", async () => {
    await expect(runFastScan("http://localhost:3000")).rejects.toBeInstanceOf(ScanInputError);
    await expect(runFastScan("http://127.0.0.1")).rejects.toBeInstanceOf(ScanInputError);
  });
});

describe("false-positive controls", () => {
  it("does not flag schema.org or meta referrer/report-only CSP as exposure", async () => {
    const page = html('<div itemtype="http://schema.org/WebPage">ok</div>', [
      '<meta content="origin" name="referrer">',
      '<meta http-equiv="Content-Security-Policy-Report-Only" content="default-src \'self\'">',
    ].join(""));
    vi.stubGlobal(
      "fetch",
      mockFetch(() => new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } })),
    );

    const result = await runFastScan("https://example.test");
    expect(result.findings.some((f) => f.id === "SW-023")).toBe(false);
    expect(result.findings.some((f) => f.id === "SW-018")).toBe(false);
    expect(result.findings.find((f) => f.id === "SW-013")?.severity).toBe("low");
    expect(result.findings.some((f) => f.type === "exposure")).toBe(false);
  });

  it("does not flag Stripe marketing mention as webhook finding", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => new Response(html("<p>We support Stripe payments.</p>"), { headers: { "content-type": "text/html" } })),
    );
    const result = await runFastScan("https://example.test");
    expect(result.findings.some((f) => f.title.toLowerCase().includes("stripe"))).toBe(false);
  });

  it("skips privacy/terms check when body is truncated", async () => {
    const big = html("<p>hi</p>" + "a".repeat(310_000));
    vi.stubGlobal("fetch", mockFetch(() => new Response(big, { headers: { "content-type": "text/html" } })));
    const result = await runFastScan("https://example.test");
    expect(result.findings.some((f) => f.id === "SW-029")).toBe(false);
  });
});

describe("real exposure detection", () => {
  it("detects secrets in same-origin JS bundles", async () => {
    const page = html('<script src="/app.js"></script>');
    const bundle = 'const k="AKIA1234567890ABCD12";';
    vi.stubGlobal(
      "fetch",
      mockFetch((url) => {
        if (url.endsWith("/app.js")) return new Response(bundle, { headers: { "content-type": "application/javascript" } });
        return new Response(page, { headers: { "content-type": "text/html" } });
      }),
    );

    const result = await runFastScan("https://example.test");
    const finding = result.findings.find((f) => f.id === "SW-032");
    expect(finding?.type).toBe("exposure");
    expect(finding?.severity).toBe("critical");
    expect(result.context.scriptsScanned).toBe(1);
  });

  it("detects weak CSP as hardening, not exposure", async () => {
    const page = html("<p>ok</p>");
    vi.stubGlobal(
      "fetch",
      mockFetch(() =>
        new Response(page, {
          headers: {
            "content-type": "text/html",
            "content-security-policy": "default-src *; script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          },
        }),
      ),
    );
    const result = await runFastScan("https://example.test");
    const finding = result.findings.find((f) => f.id === "SW-033");
    expect(finding?.type).toBe("hardening");
    expect(result.score).toBeGreaterThanOrEqual(94);
  });
});

describe("deep scan", () => {
  it("adds deep checks and reports deep mode", async () => {
    const page = html("<p>ok</p><script src='/app.js'></script>");
    vi.stubGlobal(
      "fetch",
      mockFetch((url) => {
        if (url.includes("/.well-known/security.txt")) return new Response("not found", { status: 404 });
        if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /admin", { headers: { "content-type": "text/plain" } });
        if (url.endsWith("/app.js")) return new Response("//# sourceMappingURL=app.js.map", { headers: { "content-type": "application/javascript" } });
        return new Response(page, { headers: { "content-type": "text/html" } });
      }),
    );

    const result = await runDeepScan("https://example.test");
    expect(result.mode).toBe("deep");
    expect(result.checksTotal).toBeGreaterThan(34);
    expect(result.findings.some((f) => ["D-01", "D-02", "D-07"].includes(f.id))).toBe(true);
  });
});
