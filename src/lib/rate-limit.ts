import { hashIdentifier } from "./observability";

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  key: string;
};

type MemoryEntry = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as { __seaworthyLimiter?: Map<string, MemoryEntry> };
const memory = globalForLimiter.__seaworthyLimiter ?? new Map<string, MemoryEntry>();
globalForLimiter.__seaworthyLimiter = memory;

function pruneMemory(now: number) {
  if (memory.size < 2000) return;
  for (const [key, entry] of memory) {
    if (entry.resetAt <= now) memory.delete(key);
  }
}

function memoryLimit(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    memory.set(key, { count: 1, resetAt });
    pruneMemory(now);
    return { ok: true, limit, remaining: limit - 1, resetAt, key };
  }
  entry.count += 1;
  const ok = entry.count <= limit;
  return { ok, limit, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt, key };
}

async function upstashLimit(
  baseUrl: string,
  token: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const now = Date.now();
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PTTL", key],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(data?.[0]?.result ?? 0);
    const ttl = Number(data?.[1]?.result ?? -1);
    if (!Number.isFinite(count) || count <= 0) return null;

    let resetAt = now + windowMs;
    if (ttl > 0) {
      resetAt = now + ttl;
    } else {
      await fetch(`${baseUrl.replace(/\/+$/, "")}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([["PEXPIRE", key, windowMs]]),
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      }).catch(() => {});
    }

    const ok = count <= limit;
    return { ok, limit, remaining: Math.max(0, limit - count), resetAt, key };
  } catch {
    return null;
  }
}

export async function rateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const now = Date.now();
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    const result = await upstashLimit(redisUrl, redisToken, key, limit, windowMs);
    if (result) return result;
  }

  return memoryLimit(key, limit, windowMs, now);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    "unknown"
  );
}

export function rateLimitKey(scope: string, request: Request) {
  return `sw:rl:${scope}:${hashIdentifier(getClientIp(request))}`;
}
