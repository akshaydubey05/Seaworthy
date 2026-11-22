import { NextResponse } from "next/server";
import { runFastScan } from "@/lib/scan";
import { saveScan } from "@/lib/store";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { captureError, logEvent } from "@/lib/observability";

const MAX_BODY_BYTES = 4096;
const LIMIT = 6;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const limit = await rateLimit({
    key: rateLimitKey("scan", request),
    limit: LIMIT,
    windowMs: WINDOW_MS,
  });

  if (!limit.ok) {
    logEvent("warn", "scan_rate_limited", { key: limit.key, path: "/api/scan" });
    return NextResponse.json(
      { error: "Too many scans from this network. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) },
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }

    let body: { url?: unknown };
    try {
      body = JSON.parse(raw || "{}") as { url?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json({ error: "A URL is required." }, { status: 400 });
    }
    if (body.url.length > 2048) {
      return NextResponse.json({ error: "URL is too long." }, { status: 400 });
    }

    const result = await runFastScan(body.url);
    await saveScan(result).catch((error) => {
      logEvent("warn", "scan_persist_failed", { error });
    });

    logEvent("info", "scan_completed", {
      receiptId: result.receiptId,
      score: result.score,
      findings: result.findings.length,
      durationMs: result.durationMs,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    await captureError(error, { route: "/api/scan", ipHash: limit.key });
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 400 });
  }
}
