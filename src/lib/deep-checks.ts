import { promises as dns } from "node:dns";
import tls from "node:tls";
import type { CheckDef } from "./checks";
import { assertPublicHost } from "./scan";

const f = (
  id: string,
  title: string,
  severity: "critical" | "high" | "medium" | "low",
  type: "exposure" | "signal" | "hardening",
  verdict: "confirmed" | "needs_validation",
  evidence: string,
  fix: string,
) => ({ id, title, severity, type, verdict, evidence, fix });

async function fetchText(url: URL, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await assertPublicHost(url);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "SeaworthyDeepScan/0.1", accept: "text/plain,*/*" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 40_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseCsp(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(";")) {
    const [name, ...rest] = part.trim().split(/\s+/);
    if (name) out[name.toLowerCase()] = rest.join(" ");
  }
  return out;
}

async function probeTls(hostname: string): Promise<{ ok: boolean; daysLeft?: number; error?: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, servername: hostname, port: 443, rejectUnauthorized: false, timeout: 5000 },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        const validTo = cert?.valid_to ? Date.parse(cert.valid_to) : NaN;
        if (!Number.isFinite(validTo)) return resolve({ ok: true });
        resolve({ ok: true, daysLeft: Math.floor((validTo - Date.now()) / 86_400_000) });
      },
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "TLS timeout" });
    });
    socket.on("error", (err) => resolve({ ok: false, error: err.message }));
  });
}

export const DEEP_CHECKS: CheckDef[] = [
  {
    id: "D-01",
    name: "Source map disclosure",
    category: "Exposure",
    severity: "high",
    type: "exposure",
    source: "body",
    run: (c) => {
      const maps = c.scripts.filter((s) => /sourceMappingURL=\s*\S+\.map/i.test(s.content));
      if (!maps.length) return null;
      return f(
        "D-01",
        "JavaScript source maps appear publicly reachable",
        "high",
        "exposure",
        "needs_validation",
        `${maps.length} scanned bundle(s) reference source maps. Source maps can expose original source, routes, and secrets.`,
        "Disable production source maps or serve them only behind authenticated access.",
      );
    },
  },
  {
    id: "D-02",
    name: "Security.txt",
    category: "Trust/compliance",
    severity: "low",
    type: "hardening",
    source: "url",
    run: () => null,
    asyncRun: async (c) => {
      const txt = await fetchText(new URL("/.well-known/security.txt", c.finalUrl));
      if (txt && /contact:/i.test(txt)) return null;
      return f(
        "D-02",
        "security.txt not detected",
        "low",
        "hardening",
        "needs_validation",
        "No /.well-known/security.txt with a Contact field was found.",
        "Add /.well-known/security.txt so researchers can report vulnerabilities responsibly.",
      );
    },
  },
  {
    id: "D-03",
    name: "TLS certificate",
    category: "Transport",
    severity: "high",
    type: "exposure",
    source: "url",
    run: () => null,
    asyncRun: async (c) => {
      if (c.finalUrl.protocol !== "https:") return null;
      const tlsResult = await probeTls(c.finalUrl.hostname);
      if (!tlsResult.ok) {
        return f(
          "D-03",
          "TLS connection could not be verified",
          "high",
          "signal",
          "needs_validation",
          `TLS probe failed: ${tlsResult.error || "unknown error"}.`,
          "Verify the certificate chain, hostname, and TLS configuration.",
        );
      }
      if (typeof tlsResult.daysLeft === "number" && tlsResult.daysLeft <= 14) {
        return f(
          "D-03",
          "TLS certificate expires soon",
          tlsResult.daysLeft <= 3 ? "high" : "medium",
          "exposure",
          "confirmed",
          `Certificate expires in ${tlsResult.daysLeft} day(s).`,
          "Renew the certificate and enable automatic renewal.",
        );
      }
      return null;
    },
  },
  {
    id: "D-04",
    name: "Email spoofing posture",
    category: "Trust/compliance",
    severity: "medium",
    type: "signal",
    source: "url",
    run: () => null,
    asyncRun: async (c) => {
      const host = c.finalUrl.hostname.replace(/^www\./, "");
      try {
        const [spfTxt, dmarcTxt] = await Promise.allSettled([
          dns.resolveTxt(host),
          dns.resolveTxt(`_dmarc.${host}`),
        ]);
        const spf = spfTxt.status === "fulfilled" && spfTxt.value.flat().some((r) => /v=spf1/i.test(r));
        const dmarc = dmarcTxt.status === "fulfilled" && dmarcTxt.value.flat().some((r) => /v=DMARC1/i.test(r));
        if (spf && dmarc) return null;
        const missing = [!spf ? "SPF" : "", !dmarc ? "DMARC" : ""].filter(Boolean).join(" and ");
        return f(
          "D-04",
          "Email authentication records missing",
          "medium",
          "signal",
          "needs_validation",
          `${missing} record not found for ${host}.`,
          "Add SPF and DMARC records to reduce spoofing/phishing risk from your domain.",
        );
      } catch {
        return null;
      }
    },
  },
  {
    id: "D-05",
    name: "Cross-origin isolation",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) => {
      const coop = c.headers?.get("cross-origin-opener-policy");
      const corp = c.headers?.get("cross-origin-resource-policy");
      if (coop && corp) return null;
      if (c.sensitive) {
        return f(
          "D-05",
          "Cross-origin isolation headers missing",
          "low",
          "hardening",
          "needs_validation",
          `Missing ${[!coop ? "COOP" : "", !corp ? "CORP" : ""].filter(Boolean).join(" and ")} on a sensitive page.`,
          "Consider COOP/CORP for sensitive surfaces to reduce cross-origin attack surface.",
        );
      }
      return null;
    },
  },
  {
    id: "D-06",
    name: "CORS credentials with wildcard",
    category: "API security",
    severity: "high",
    type: "exposure",
    source: "headers",
    run: (c) => {
      const acao = c.headers?.get("access-control-allow-origin");
      const acac = c.headers?.get("access-control-allow-credentials");
      if (acao === "*" && /true/i.test(acac || "")) {
        return f(
          "D-06",
          "Dangerous CORS configuration",
          "high",
          "exposure",
          "confirmed",
          "Access-Control-Allow-Origin is * while credentials are allowed.",
          "Never combine wildcard origin with credentials. Restrict to trusted origins.",
        );
      }
      return null;
    },
  },
  {
    id: "D-07",
    name: "Robots disclosure",
    category: "Exposure",
    severity: "low",
    type: "signal",
    source: "url",
    run: () => null,
    asyncRun: async (c) => {
      const robots = await fetchText(new URL("/robots.txt", c.finalUrl));
      if (!robots) return null;
      const sensitive = robots.match(/Disallow:\s*\/(?:admin|api|internal|debug|private|backup|\.env|\.git)/i);
      if (!sensitive) return null;
      return f(
        "D-07",
        "Robots.txt reveals sensitive paths",
        "low",
        "signal",
        "needs_validation",
        `robots.txt disallows sensitive-looking paths (e.g. ${sensitive[0].trim()}). This is disclosure, not protection.`,
        "Do not rely on robots.txt for security; protect sensitive paths with auth and avoid advertising them.",
      );
    },
  },
  {
    id: "D-08",
    name: "CSP missing base/object restrictions",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) => {
      const csp = c.headers?.get("content-security-policy");
      if (!csp) return null;
      const directives = parseCsp(csp);
      const missing: string[] = [];
      if (!directives["base-uri"] && !directives["default-src"]) missing.push("base-uri");
      if (!directives["object-src"] && !directives["default-src"]) missing.push("object-src");
      if (!missing.length) return null;
      return f(
        "D-08",
        "CSP missing important directives",
        "low",
        "hardening",
        "confirmed",
        `CSP is present but missing: ${missing.join(", ")}.`,
        "Add base-uri 'self' and object-src 'none' to reduce injection and plugin-based attacks.",
      );
    },
  },
];
