import type { Finding, FindingType, ManualCheck, ScanMode, ScanSeverity } from "./scan";

/** A same-origin JavaScript bundle fetched and scanned for leaked material. */
export type ScriptAsset = {
  url: string;
  content: string;
  bytes: number;
  truncated: boolean;
};

export type CheckContext = {
  url: URL;
  finalUrl: URL;
  html: string;
  lower: string;
  headers: Headers | null;
  fetchError: string;
  bodyScanned: boolean;
  truncated: boolean;
  hasForms: boolean;
  hasPasswordForm: boolean;
  hasPaymentScript: boolean;
  sensitive: boolean;
  scripts: ScriptAsset[];
  mode: ScanMode;
};

export type CheckDef = {
  id: string;
  name: string;
  category: string;
  severity: ScanSeverity;
  type: FindingType;
  /** Which part of the response the check needs. */
  source: "body" | "headers" | "both" | "url";
  run: (ctx: CheckContext) => Finding | null;
  asyncRun?: (ctx: CheckContext) => Promise<Finding | null>;
};

const f = (
  id: string,
  title: string,
  severity: ScanSeverity,
  type: FindingType,
  verdict: Finding["verdict"],
  evidence: string,
  fix: string,
): Finding => ({ id, title, severity, type, verdict, evidence, fix });

const header = (ctx: CheckContext, name: string) => ctx.headers?.get(name);

function setCookies(ctx: CheckContext): string[] {
  const headers = ctx.headers as (Headers & { getSetCookie?: () => string[] }) | null;
  if (!headers) return [];
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? raw.split(/,(?=\s*[^;,]+=)/) : [];
}

/** Resource-loading attributes only; itemtype/xmlns/a-href are not mixed content. */
const MIXED_CONTENT = /(?:src|poster|action)\s*=\s*["']http:\/\/(?!localhost|127\.0\.0\.1)|<link\b[^>]*\bhref\s*=\s*["']http:\/\/(?!localhost|127\.0\.0\.1)/i;

type SecretPattern = {
  label: string;
  re: RegExp;
  severity: ScanSeverity;
};

/** High-confidence token shapes only. Generic `sk-…` strings are excluded on purpose. */
const CLOUD_TOKEN_PATTERNS: SecretPattern[] = [
  { label: "AWS access key ID", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, severity: "critical" },
  { label: "GitHub token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/, severity: "critical" },
  { label: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, severity: "critical" },
];

const BUNDLE_SECRET_PATTERNS: SecretPattern[] = [
  ...CLOUD_TOKEN_PATTERNS,
  { label: "Stripe live secret key", re: /\bsk_live_[0-9a-zA-Z]{16,}\b/, severity: "critical" },
  {
    label: "AI provider key",
    re: /\bsk-(?:proj|svcacct|ant|or)-[A-Za-z0-9_-]{20,}\b|\bAIzaSy[A-Za-z0-9_-]{30,}\b/,
    severity: "critical",
  },
  {
    label: "private key block",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    label: "Supabase service role JWT",
    re: /service_role[\s\S]{0,200}eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    severity: "critical",
  },
];

function redact(value: string) {
  if (value.length <= 10) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 6)}…${value.length} chars`;
}

function shortUrl(raw: string) {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return raw;
  }
}

function findSecret(text: string, patterns: SecretPattern[] = BUNDLE_SECRET_PATTERNS) {
  for (const pattern of patterns) {
    const match = text.match(pattern.re);
    if (match) return { ...pattern, value: match[0] };
  }
  return null;
}

function parseCsp(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(";")) {
    const [name, ...rest] = part.trim().split(/\s+/);
    if (name) out[name.toLowerCase()] = rest.join(" ");
  }
  return out;
}


export const CHECKS: CheckDef[] = [
  {
    id: "SW-001",
    name: "Supabase service role key",
    category: "Secrets",
    severity: "critical",
    type: "exposure",
    source: "body",
    run: (c) =>
      /service_role[\s\S]{0,200}eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}[\s\S]{0,200}service_role/i.test(c.html)
        ? f("SW-001", "Possible Supabase service role credential exposed", "critical", "exposure", "confirmed", "A service_role reference appears next to a JWT-like token in publicly fetched content.", "Rotate the key immediately, keep it server-side only, and audit git history for exposure.")
        : null,
  },
  {
    id: "SW-002",
    name: "Stripe secret key",
    category: "Secrets",
    severity: "critical",
    type: "exposure",
    source: "body",
    run: (c) =>
      /\bsk_live_[0-9a-zA-Z]{16,}/.test(c.html)
        ? f("SW-002", "Possible Stripe live secret key exposed", "critical", "exposure", "confirmed", "Matched a Stripe live secret key pattern in publicly fetched content.", "Rotate the key in Stripe, move it to server-side env vars, and search git history.")
        : null,
  },
  {
    id: "SW-003",
    name: "AI provider key",
    category: "Secrets",
    severity: "critical",
    type: "exposure",
    source: "body",
    run: (c) =>
      /\bsk-(?:proj|svcacct|ant|or)-[A-Za-z0-9_-]{20,}|\bAIzaSy[A-Za-z0-9_-]{30,}/.test(c.html)
        ? f("SW-003", "Possible AI/provider API key exposed", "critical", "exposure", "confirmed", "Matched a high-confidence API key prefix in publicly fetched content.", "Rotate the key, move calls server-side, and add spend limits.")
        : null,
  },
  {
    id: "SW-004",
    name: "Private key material",
    category: "Secrets",
    severity: "critical",
    type: "exposure",
    source: "body",
    run: (c) =>
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(c.html)
        ? f("SW-004", "Private key material exposed", "critical", "exposure", "confirmed", "Detected a private key block in publicly fetched content.", "Remove the key, rotate it immediately, and purge it from git history.")
        : null,
  },
  {
    id: "SW-005",
    name: "Env/debug leak",
    category: "Secrets",
    severity: "high",
    type: "signal",
    source: "body",
    run: (c) => {
      const match = c.html.match(/\b(DATABASE_URL|AWS_SECRET_ACCESS_KEY|NEXTAUTH_SECRET|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*["']?[A-Za-z0-9_\-:/@.]{12,}/);
      if (!match) return null;
      return f("SW-005", "Possible secret environment variable exposed", "high", "signal", "needs_validation", `${match[1]} appears with a value-like assignment in public content (value redacted).`, "Ensure secrets are server-only, not bundled to the client, and rotate if exposed.");
    },
  },
  {
    id: "SW-006",
    name: "Source maps",
    category: "Exposure",
    severity: "medium",
    type: "signal",
    source: "body",
    run: (c) => {
      const inHtml = /sourceMappingURL=/i.test(c.html) || /src=["'][^"']+\.js\.map/i.test(c.html);
      const inBundle = c.scripts.some((script) => /sourceMappingURL=\s*\S+\.map/i.test(script.content));
      return inHtml || inBundle
        ? f("SW-006", "Source maps may be exposed", "medium", "signal", "needs_validation", "Detected a sourceMappingURL or .js.map reference in fetched content.", "Disable production source maps or restrict access to them.")
        : null;
    },
  },
  {
    id: "SW-007",
    name: "Exposed git/config path",
    category: "Exposure",
    severity: "medium",
    type: "signal",
    source: "body",
    run: (c) =>
      /(?:href|src|action)=["'][^"']*\/(?:\.git|\.env)\b|["'][^"']*wp-config\.php/i.test(c.html)
        ? f("SW-007", "Sensitive path reference detected", "medium", "signal", "needs_validation", "Found a reference to a sensitive path in fetched content.", "Block access to .git/.env/config files and verify they are not deployed.")
        : null,
  },
  {
    id: "SW-008",
    name: "Supabase anon usage",
    category: "Data access",
    severity: "high",
    type: "signal",
    source: "body",
    run: (c) =>
      /supabase\.co/i.test(c.html) && /(?:anon|publishable)[_-]?key/i.test(c.html)
        ? f("SW-008", "Supabase client usage detected; RLS needs validation", "high", "signal", "needs_validation", "Detected Supabase URL/anon-key usage in client content. RLS cannot be confirmed from outside.", "Verify RLS is enabled on every table and that policies are not permissive.")
        : null,
  },
  {
    id: "SW-009",
    name: "Firebase public config",
    category: "Data access",
    severity: "medium",
    type: "signal",
    source: "body",
    run: (c) =>
      /(?:firebaseio\.com|firebaseapp\.com|firestore\.googleapis\.com|firebaseConfig)/i.test(c.html) && /apiKey["']?\s*[:=]/i.test(c.html)
        ? f("SW-009", "Firebase config exposed; rules need validation", "medium", "signal", "needs_validation", "Detected a Firebase web config in client content. Security rules cannot be confirmed from outside.", "Verify Firestore/Storage rules deny unauthorized access and restrict the API key.")
        : null,
  },
  {
    id: "SW-010",
    name: "Open admin/debug path",
    category: "Access control",
    severity: "medium",
    type: "signal",
    source: "body",
    run: (c) =>
      /(?:href|action)=["'][^"']*\/(?:admin|debug)\b/i.test(c.html)
        ? f("SW-010", "Admin/debug route reference exposed", "medium", "signal", "needs_validation", "Found links to admin/debug paths in public content.", "Ensure admin/debug routes require strong authentication and are not exposed in production.")
        : null,
  },
  {
    id: "SW-011",
    name: "Client-only auth signal",
    category: "Access control",
    severity: "medium",
    type: "signal",
    source: "body",
    run: (c) =>
      /localStorage\.(?:getItem|setItem)\(\s*["'](?:token|auth|jwt|access_token)/i.test(c.html)
        ? f("SW-011", "Client-stored auth token signal", "medium", "signal", "needs_validation", "Detected auth/token storage in localStorage patterns.", "Prefer HttpOnly secure cookies for session tokens and validate auth server-side.")
        : null,
  },
  {
    id: "SW-012",
    name: "Permissive CORS hint",
    category: "API security",
    severity: "medium",
    type: "exposure",
    source: "headers",
    run: (c) => {
      const acao = header(c, "access-control-allow-origin");
      return acao === "*"
        ? f("SW-012", "Permissive CORS header detected", "medium", "exposure", "confirmed", "Access-Control-Allow-Origin is set to *.", "Restrict CORS to trusted origins, especially for authenticated endpoints.")
        : null;
    },
  },
  {
    id: "SW-013",
    name: "CSP state",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) => {
      if (header(c, "content-security-policy")) return null;
      const reportOnly = header(c, "content-security-policy-report-only");
      const metaOnly = c.bodyScanned && /<meta[^>]+http-equiv=["']?content-security-policy/i.test(c.html);
      if (reportOnly || metaOnly) {
        return f("SW-013", "CSP is not enforcing yet", "low", "hardening", "confirmed", "A Content-Security-Policy is present only as report-only or in a meta tag, so it does not block anything yet.", "Review report-only violations, then ship an enforcing Content-Security-Policy header.");
      }
      return f("SW-013", "Content-Security-Policy header not set", c.sensitive ? "medium" : "low", "hardening", c.bodyScanned ? "confirmed" : "needs_validation", c.bodyScanned ? "No enforcing Content-Security-Policy header or meta tag was found." : "No CSP header was found; the page body was not scanned, so a meta CSP could not be ruled out.", "Add a CSP appropriate for your app to reduce XSS impact.");
    },
  },
  {
    id: "SW-014",
    name: "Frame protection",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) => {
      const xfo = header(c, "x-frame-options");
      const csp = header(c, "content-security-policy") || "";
      if (xfo || /frame-ancestors/i.test(csp)) return null;
      const reportOnly = header(c, "content-security-policy-report-only") || "";
      if (/frame-ancestors/i.test(reportOnly)) {
        return f("SW-014", "Frame protection is report-only", "low", "hardening", "confirmed", "frame-ancestors appears only in a report-only CSP, which does not block framing.", "Move frame-ancestors into the enforcing CSP, or add X-Frame-Options.");
      }
      return f("SW-014", "Clickjacking protection not set", c.sensitive ? "medium" : "low", "hardening", "confirmed", "No X-Frame-Options and no enforcing CSP frame-ancestors were found.", "Add X-Frame-Options: DENY (or SAMEORIGIN) or CSP frame-ancestors.");
    },
  },
  {
    id: "SW-016",
    name: "HSTS",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) =>
      c.url.protocol === "https:" && !header(c, "strict-transport-security")
        ? f("SW-016", "HSTS header not set", "low", "hardening", "confirmed", "The HTTPS response did not include Strict-Transport-Security.", "Add HSTS after confirming every subdomain supports HTTPS: max-age=31536000; includeSubDomains.")
        : null,
  },
  {
    id: "SW-017",
    name: "X-Content-Type-Options",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) =>
      !header(c, "x-content-type-options")
        ? f("SW-017", "X-Content-Type-Options not set", "low", "hardening", "confirmed", "The response did not include X-Content-Type-Options: nosniff.", "Set X-Content-Type-Options: nosniff on HTML and API responses.")
        : null,
  },
  {
    id: "SW-018",
    name: "Referrer-Policy",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) => {
      if (header(c, "referrer-policy")) return null;
      const meta = c.bodyScanned && /<meta[^>]+name=["']?referrer/i.test(c.html);
      return meta
        ? null
        : f("SW-018", "Referrer-Policy not set", "low", "hardening", "confirmed", "No Referrer-Policy header or meta referrer tag was observed for this client. Some sites vary headers by user agent or edge node.", "Set Referrer-Policy: strict-origin-when-cross-origin (or stricter).");
    },
  },
  {
    id: "SW-019",
    name: "Permissions-Policy",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) =>
      !header(c, "permissions-policy")
        ? f("SW-019", "Permissions-Policy not set", "low", "hardening", "confirmed", "The response did not include Permissions-Policy. Note that some CDNs send different headers to different user agents.", "Disable browser features you do not use: camera=(), microphone=(), geolocation=().")
        : null,
  },
  {
    id: "SW-020",
    name: "Server header exposure",
    category: "Exposure",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) => {
      const server = header(c, "server");
      const poweredBy = header(c, "x-powered-by");
      const versioned = server && /\d/.test(server);
      if (!versioned && !poweredBy) return null;
      return f("SW-020", "Server technology details exposed", "low", "hardening", "confirmed", `Detected version/technology headers: ${[versioned ? `server=${server}` : "", poweredBy ? `x-powered-by=${poweredBy}` : ""].filter(Boolean).join(", ")}.`, "Remove or minimize version-revealing headers.");
    },
  },
  {
    id: "SW-021",
    name: "Directory listing/error leak",
    category: "Exposure",
    severity: "medium",
    type: "signal",
    source: "body",
    run: (c) =>
      /Traceback \(most recent call last\)|SQLSTATE\[\d+\]|Stack trace:|Fatal error:|Uncaught \w*Exception|Index of \//i.test(c.html)
        ? f("SW-021", "Possible debug/error information exposed", "medium", "signal", "needs_validation", "Detected debug/error/listing patterns in the public response.", "Disable verbose errors in production and turn off directory listing.")
        : null,
  },
  {
    id: "SW-022",
    name: "Insecure form action",
    category: "Transport",
    severity: "medium",
    type: "exposure",
    source: "body",
    run: (c) =>
      c.url.protocol === "https:" && /action=["']http:\/\//i.test(c.html)
        ? f("SW-022", "Insecure HTTP form action on HTTPS page", "medium", "exposure", "confirmed", "Found a form posting to an http:// URL from an HTTPS page.", "Use HTTPS for all form actions.")
        : null,
  },
  {
    id: "SW-023",
    name: "Mixed content",
    category: "Transport",
    severity: "medium",
    type: "signal",
    source: "body",
    run: (c) =>
      c.url.protocol === "https:" && MIXED_CONTENT.test(c.html)
        ? f("SW-023", "Possible mixed content on HTTPS page", "medium", "signal", "needs_validation", "Found an http:// resource loaded from an HTTPS page (src, poster, form action, or stylesheet).", "Serve all assets and endpoints over HTTPS.")
        : null,
  },
  {
    id: "SW-024",
    name: "Open redirect parameter signal",
    category: "API security",
    severity: "low",
    type: "signal",
    source: "url",
    run: (c) =>
      /[?&](?:redirect|next|returnTo|url)=/i.test(c.url.search)
        ? f("SW-024", "Redirect parameter present; open redirect needs validation", "low", "signal", "needs_validation", "The URL contains a redirect-style parameter.", "Validate redirect targets against an allowlist and reject external URLs.")
        : null,
  },
  {
    id: "SW-025",
    name: "File upload surface",
    category: "Input handling",
    severity: "low",
    type: "signal",
    source: "body",
    run: (c) =>
      /type=["']file["']/i.test(c.html)
        ? f("SW-025", "File upload input detected; validation needs review", "low", "signal", "needs_validation", "Detected a file upload control in public content.", "Validate file type and size server-side, store uploads outside the web root, and scan them.")
        : null,
  },
  {
    id: "SW-026",
    name: "Database error details",
    category: "Input handling",
    severity: "medium",
    type: "exposure",
    source: "body",
    run: (c) =>
      /SQL syntax|mysql_fetch|sqlite3\.OperationalError|PostgreSQL query failed|SQLSTATE\[\d+\]/i.test(c.html)
        ? f("SW-026", "Database error details exposed", "medium", "exposure", "confirmed", "Detected database error patterns in the response.", "Hide raw database errors and use parameterized queries.")
        : null,
  },
  {
    id: "SW-027",
    name: "Cookie security flags",
    category: "Auth/session",
    severity: "medium",
    type: "exposure",
    source: "headers",
    run: (c) => {
      const weak = setCookies(c).filter((cookie) => {
        const name = cookie.split("=")[0]?.trim().toLowerCase() || "";
        if (!/session|sid|auth|token|jwt|connect\.sid/i.test(name)) return false;
        return !/httponly/i.test(cookie) || !/secure/i.test(cookie);
      });
      if (!weak.length) return null;
      const names = weak.map((cookie) => cookie.split("=")[0]?.trim()).filter(Boolean).join(", ");
      return f("SW-027", "Session cookie missing security flags", "medium", "exposure", "confirmed", `Session-like cookie(s) missing HttpOnly or Secure: ${names}.`, "Set Secure, HttpOnly, and an appropriate SameSite value on session cookies.");
    },
  },
  {
    id: "SW-028",
    name: "Password/autocomplete signal",
    category: "Auth/session",
    severity: "low",
    type: "hardening",
    source: "body",
    run: (c) =>
      /type=["']password["']/i.test(c.html) && /autocomplete=["']off["']/i.test(c.html)
        ? f("SW-028", "Password autocomplete disabled", "low", "hardening", "needs_validation", "A password input with autocomplete=off was detected.", "Allow password managers by using the appropriate autocomplete attributes.")
        : null,
  },
  {
    id: "SW-029",
    name: "Privacy/terms links",
    category: "Trust/compliance",
    severity: "low",
    type: "hardening",
    source: "body",
    run: (c) => {
      if (c.truncated) return null;
      const privacy = /(?:privacy policy|privacy notice)/i.test(c.html) || /href=["'][^"']*privacy/i.test(c.html);
      const terms = /(?:terms of (?:service|use)|terms and conditions)/i.test(c.html) || /href=["'][^"']*terms/i.test(c.html);
      if (privacy && terms) return null;
      return f("SW-029", "Privacy/terms links not detected in HTML", "low", "hardening", "needs_validation", "Could not find both privacy and terms links in the fetched HTML. Footer links may be rendered client-side.", "Add visible Privacy Policy and Terms links before charging users.");
    },
  },
  {
    id: "SW-030",
    name: "Public fetch failure",
    category: "Availability",
    severity: "medium",
    type: "signal",
    source: "url",
    run: (c) =>
      c.fetchError
        ? f("SW-030", "Public fetch could not be completed", "medium", "signal", "needs_validation", `Fetch error: ${c.fetchError}`, "Confirm the URL is public and reachable over HTTPS, then run a verified deep audit.")
        : null,
  },
  {
    id: "SW-031",
    name: "Plain HTTP target",
    category: "Transport",
    severity: "medium",
    type: "exposure",
    source: "url",
    run: (c) =>
      c.finalUrl.protocol === "http:"
        ? f("SW-031", "Target is served over plain HTTP", "medium", "exposure", "confirmed", "The final response uses http://, so content and credentials can be intercepted or modified in transit.", "Serve the app over HTTPS and redirect all HTTP traffic to HTTPS.")
        : null,
  },
  {
    id: "SW-032",
    name: "Secret in client JavaScript",
    category: "Secrets",
    severity: "critical",
    type: "exposure",
    source: "body",
    run: (c) => {
      if (!c.scripts.length) return null;
      for (const script of c.scripts) {
        const hit = findSecret(script.content);
        if (!hit) continue;
        return f(
          "SW-032",
          `Possible ${hit.label} in client JavaScript`,
          hit.severity,
          "exposure",
          "confirmed",
          `${hit.label} pattern matched in ${shortUrl(script.url)} (value redacted: ${redact(hit.value)}). Anything shipped in a browser bundle is public.`,
          "Remove the secret from client bundles, rotate it immediately, and call the provider from a server route or function.",
        );
      }
      return null;
    },
  },
  {
    id: "SW-033",
    name: "CSP quality",
    category: "Headers",
    severity: "low",
    type: "hardening",
    source: "headers",
    run: (c) => {
      const csp = header(c, "content-security-policy");
      if (!csp) return null;
      const directives = parseCsp(csp);
      const scriptSrc = directives["script-src"] || directives["default-src"] || "";
      const hasNonceOrHash = /'nonce-|'sha(?:256|384|512)-|'strict-dynamic'/i.test(scriptSrc);
      const issues: string[] = [];
      if (/'unsafe-eval'/i.test(scriptSrc)) issues.push("'unsafe-eval' is allowed");
      if (/'unsafe-inline'/i.test(scriptSrc) && !hasNonceOrHash) {
        issues.push("'unsafe-inline' is allowed without a nonce, hash, or strict-dynamic");
      }
      if (!directives["object-src"] && !directives["default-src"]) issues.push("object-src is not restricted");
      if (!issues.length) return null;
      return f(
        "SW-033",
        "Content-Security-Policy is weak",
        "low",
        "hardening",
        "confirmed",
        `The enforcing CSP has gaps: ${issues.join("; ")}.`,
        "Tighten script-src with nonces or hashes, remove unsafe-eval, and set object-src 'none'.",
      );
    },
  },
  {
    id: "SW-034",
    name: "Cloud provider token",
    category: "Secrets",
    severity: "critical",
    type: "exposure",
    source: "body",
    run: (c) => {
      const hit = findSecret(c.html, CLOUD_TOKEN_PATTERNS);
      if (!hit) return null;
      return f(
        "SW-034",
        `Possible ${hit.label} exposed in page content`,
        hit.severity,
        "exposure",
        "confirmed",
        `${hit.label} pattern matched in public HTML (value redacted: ${redact(hit.value)}).`,
        "Rotate the credential, move it to a server-side secret store, and audit git history for other copies.",
      );
    },
  },
  {
    id: "SW-035",
    name: "External script without SRI",
    category: "Supply chain",
    severity: "low",
    type: "hardening",
    source: "body",
    run: (c) => {
      let missing = 0;
      for (const match of c.html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>/gi)) {
        const tag = match[0];
        const raw = match[1];
        if (/\bintegrity\s*=/i.test(tag)) continue;
        let parsed: URL;
        try {
          parsed = new URL(raw, c.url);
        } catch {
          continue;
        }
        if (parsed.host === c.url.host) continue;
        missing += 1;
      }
      if (!missing) return null;
      return f(
        "SW-035",
        "External script without Subresource Integrity",
        "low",
        "hardening",
        "needs_validation",
        `${missing} cross-origin script${missing === 1 ? "" : "s"} have no integrity attribute.`,
        "Add integrity + crossorigin to static third-party scripts where the provider supports it.",
      );
    },
  },
];

export function buildManualChecks(ctx: CheckContext): ManualCheck[] {
  const checks: ManualCheck[] = [];
  const add = (id: string, title: string, why: string) => {
    if (!checks.some((check) => check.id === id)) checks.push({ id, title, why });
  };

  if (/supabase\.co/i.test(ctx.html)) {
    add("M-01", "Verify Supabase Row Level Security", "Supabase is referenced publicly. Enable RLS on every table and test reads/writes with the anon key.");
  }
  if (/(?:firebaseio\.com|firebaseapp\.com|firestore\.googleapis\.com|firebaseConfig)/i.test(ctx.html)) {
    add("M-02", "Verify Firebase security rules", "A Firebase config is public. Confirm Firestore/Storage rules deny unauthenticated reads and writes.");
  }
  if (ctx.hasPaymentScript) {
    add("M-03", "Verify Stripe webhook signatures", "Stripe.js is loaded. Confirm webhooks verify the Stripe-Signature header and reject unsigned events.");
  }
  if (ctx.hasPasswordForm) {
    add("M-04", "Review login rate limiting and sessions", "A password field is present. Check login throttling, lockout, MFA options, and session cookie lifetime.");
  }
  if (ctx.hasForms) {
    add("M-05", "Check CSRF protection on forms", "Forms are present. Confirm state-changing requests require a CSRF token or SameSite cookies.");
  }
  if (/type=["']file["']/i.test(ctx.html)) {
    add("M-06", "Review file upload handling", "An upload control is present. Validate type/size server-side, store outside the web root, and scan files.");
  }
  if (/(?:href|action)=["'][^"']*\/(?:admin|debug)\b/i.test(ctx.html)) {
    add("M-07", "Confirm admin/debug routes require auth", "Links to admin or debug paths are public. Verify strong authentication and authorization on every route.");
  }
  if (/[?&](?:redirect|next|returnTo|url)=/i.test(ctx.url.search)) {
    add("M-08", "Test redirect parameters for open redirects", "The URL has a redirect-style parameter. Confirm targets are allowlisted and external URLs are rejected.");
  }

  return checks;
}
