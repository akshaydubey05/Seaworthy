import { NextResponse } from "next/server";
import { getScan } from "@/lib/store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json(scan);
}