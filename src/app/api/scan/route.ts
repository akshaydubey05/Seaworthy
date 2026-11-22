import { NextResponse } from "next/server";
import { runFastScan } from "@/lib/scan";
import { saveScan } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json({ error: "A URL is required." }, { status: 400 });
    }
    const result = await runFastScan(body.url);
    await saveScan(result).catch(() => {});
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}