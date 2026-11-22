import { NextResponse } from "next/server";
import { z } from "zod";
import { saveWaitlist } from "@/lib/store";

const schema = z.object({ email: z.string().email(), source: z.string().optional() });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    await saveWaitlist(parsed.data.email, parsed.data.source || "website");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save email." }, { status: 500 });
  }
}