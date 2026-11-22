type Level = "info" | "warn" | "error";

const REDACT_KEYS = /(authorization|cookie|token|secret|password|passwd|api[-_]?key|private[-_]?key|email)/i;
const MAX_DEPTH = 4;

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 600 ? `${value.slice(0, 600)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 8).join("\n") };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT_KEYS.test(key) ? "[redacted]" : redactValue(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function hashIdentifier(value: string) {
  // Non-cryptographic, deterministic hash. The goal is to avoid storing raw IPs
  // in rate-limit keys and logs, not to provide a security primitive.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

export function logEvent(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(redactValue(fields, 0) as Record<string, unknown>),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export async function captureError(error: unknown, context: Record<string, unknown> = {}) {
  logEvent("error", "error_captured", { error, ...context });

  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Seaworthy error: ${error instanceof Error ? error.message : String(error)}`,
        source: "seaworthy",
        context: redactValue(context, 0),
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Never let observability failures affect the request.
  }
}
