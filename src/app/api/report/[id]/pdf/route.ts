import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getScan } from "@/lib/store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const doc = new PDFDocument({ margin: 42, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.from(c)));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fillColor("#111827").fontSize(22).text("Seaworthy Security Report", { continued: false });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#4B5563").text(`Receipt: ${scan.receiptId}  |  Score: ${scan.score}/100  |  Coverage: ${scan.coverage}%`);
  doc.text(`Target: ${scan.url}`);
  doc.text(`Checks: ${scan.checksRun}/${scan.checksTotal}  |  Duration: ${Math.max(1, Math.round(scan.durationMs / 1000))}s`);
  doc.moveDown();
  doc.fillColor("#111827").fontSize(12).text("Summary");
  doc.fontSize(10).fillColor("#374151").text(scan.summary, { lineGap: 2 });
  doc.moveDown();
  doc.fillColor("#111827").fontSize(12).text("Findings");
  doc.moveDown(0.5);
  if (!scan.findings.length) {
    doc.fontSize(10).fillColor("#374151").text("No high-signal public findings detected in this fast scan.");
  } else {
    scan.findings.forEach((f, i) => {
      doc.fillColor("#111827").fontSize(10).text(`${i + 1}. [${f.severity.toUpperCase()}] [${f.verdict}] ${f.title}`, { continued: false });
      doc.fillColor("#374151").fontSize(9).text(`Evidence: ${f.evidence}`);
      doc.text(`Fix: ${f.fix}`);
      doc.moveDown(0.6);
      if (doc.y > 760) doc.addPage();
    });
  }
  doc.moveDown();
  doc.fontSize(8).fillColor("#6B7280").text("Best-effort automated review. Not a penetration test or certification.", { align: "left" });
  doc.end();

  const pdf = await done;
  const body = new Uint8Array(pdf);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="seaworthy-${scan.receiptId}.pdf"`,
    },
  });
}