import { connection, NextResponse } from "next/server";
import { checkStorageHealth, storageMode } from "@/lib/store";

export async function GET() {
  await connection();

  const storage = await checkStorageHealth();
  const body = {
    ok: storage.ok,
    service: "seaworthy",
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    storage: {
      mode: storage.mode,
      ok: storage.ok,
      ...(storage.detail ? { detail: storage.detail } : {}),
    },
    configured: {
      database: storageMode() === "postgres",
      distributedRateLimit: Boolean(
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
      ),
      errorWebhook: Boolean(process.env.ERROR_WEBHOOK_URL),
    },
  };

  return NextResponse.json(body, {
    status: storage.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
