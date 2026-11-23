import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getScan } from "@/lib/store";
import type { Finding } from "@/lib/scan";

const TYPE_LABEL: Record<string, string> = {
  exposure: "EXPOSURE",
  signal: "SIGNAL",
  hardening: "HARDENING",
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const doc = new PDFDocument({ margin: 42, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.from(c)));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const findings = scan.findings || [];
  const manualChecks = scan.manualChecks || [];
  const notes = scan.notes || [];
  const hardeningScore = typeof scan.hardeningScore === "number" ? scan.hardeningScore : null;
  const typeOf = (finding: Finding) => finding.type || "signal";

  const section = (title: string, items: Finding[]) => {
    if (!items.length) return;
    doc.moveDown(0.6);
    doc.fillColor("#111827").fontSize(12).text(title);
    doc.moveDown(0.4);
    items.forEach((f, i) => {
      doc.fillColor("#111827").fontSize(10).text(`${i + 1}. [${f.severity.toUpperCase()}] [${TYPE_LABEL[typeOf(f)] || "SIGNAL"}] ${f.title}`, { continued: false });
      doc.fillColor("#374151").fontSize(9).text(`Evidence: ${f.evidence}`);
      doc.text(`Fix: ${f.fix}`);
      doc.moveDown(0.5);
      if (doc.y > 740) doc.addPage();
    });
  };

  doc.fillColor("#111827").fontSize(22).text("Seaworthy Security Report", { continued: false });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#4B5563").text(
    `Receipt: ${scan.receiptId}  |  Exposure score: ${scan.score}/100${hardeningScore === null ? "" : `  |  Hardening: ${hardeningScore}/100`}`,
  );
  doc.text(`Coverage: ${scan.coverage}%  |  Checks: ${scan.checksRun}/${scan.checksTotal}  |  Duration: ${Math.max(1, Math.round(scan.durationMs / 1000))}s`);
  doc.text(`Target: ${scan.finalUrl || scan.url}`);
  doc.moveDown();
  doc.fillColor("#111827").fontSize(12).text("Summary");
  doc.fontSize(10).fillColor("#374151").text(scan.summary, { lineGap: 2 });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor("#6B7280").text(
    "A finding is a signal from one public page, not proof of exploitability. Exposure findings are the priority. Hardening items are best-practice gaps and count little toward the exposure score.",
    { lineGap: 2 },
  );

  section("Exposures", findings.filter((f) => typeOf(f) === "exposure"));
  section("Signals to validate", findings.filter((f) => typeOf(f) === "signal"));
  section("Hardening suggestions", findings.filter((f) => typeOf(f) === "hardening"));

  if (!findings.length) {
    doc.moveDown();
    doc.fontSize(10).fillColor("#374151").text("No exposure signals or hardening gaps were observed on this public page.");
  }

  if (manualChecks.length) {
    doc.moveDown(0.6);
    doc.fillColor("#111827").fontSize(12).text("Verify manually");
    doc.moveDown(0.4);
    manualChecks.forEach((check) => {
      doc.fillColor("#111827").fontSize(10).text(`- ${check.title}`);
      doc.fillColor("#374151").fontSize(9).text(check.why);
      doc.moveDown(0.4);
      if (doc.y > 740) doc.addPage();
    });
  }

  if (notes.length) {
    doc.moveDown(0.6);
    doc.fillColor("#111827").fontSize(12).text("Scan limitations");
    doc.moveDown(0.4);
    notes.forEach((note) => {
      doc.fillColor("#374151").fontSize(9).text(`- ${note}`, { lineGap: 1 });
      doc.moveDown(0.3);
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
