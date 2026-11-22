import { NextResponse } from "next/server";
import { z } from "zod";
import { saveWaitlist } from "@/lib/store";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { captureError, logEvent } from "@/lib/observability";

const MAX_BODY_BYTES = 2048;

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().trim().max(64).optional(),
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const limit = await rateLimit({
    key: rateLimitKey("waitlist", request),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
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

    let body: unknown;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    // Honeypot: real users never fill this hidden field.
    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      return NextResponse.json({ ok: true });
    }

    await saveWaitlist(parsed.data.email, parsed.data.source || "website");
    logEvent("info", "waitlist_signup", { source: parsed.data.source || "website" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await captureError(error, { route: "/api/waitlist" });
    return NextResponse.json({ error: "Could not save email." }, { status: 500 });
  }
}
