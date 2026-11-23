import { buildManualChecks } from "./checks";
import { DEEP_CHECKS } from "./deep-checks";
import { executeScan, finalizeScan, type CheckRun, type ScanResult } from "./scan";

export async function runDeepScan(input: string): Promise<ScanResult> {
  const { result, ctx } = await executeScan(input, {
    mode: "deep",
    scriptLimit: 8,
    perAssetBytes: 300_000,
  });

  const findings = [...result.findings];
  const checks: CheckRun[] = [...result.checks];
  const startedAt = Date.now() - result.durationMs;

  for (const check of DEEP_CHECKS) {
    const needsBody = check.source === "body" || check.source === "both";
    const needsHeaders = check.source === "headers" || check.source === "both";
    if ((needsBody && !ctx.bodyScanned) || (needsHeaders && !ctx.headers)) {
      checks.push({
        id: check.id,
        name: check.name,
        category: check.category,
        status: "skipped",
        severity: check.severity,
        type: check.type,
      });
      continue;
    }

    try {
      const found = check.asyncRun ? await check.asyncRun(ctx) : check.run(ctx);
      if (found) {
        findings.push(found);
        checks.push({
          id: check.id,
          name: check.name,
          category: check.category,
          status: found.verdict === "needs_validation" ? "needs_validation" : "fail",
          severity: found.severity,
          type: found.type,
        });
      } else {
        checks.push({
          id: check.id,
          name: check.name,
          category: check.category,
          status: "pass",
          severity: check.severity,
          type: check.type,
        });
      }
    } catch {
      checks.push({
        id: check.id,
        name: check.name,
        category: check.category,
        status: "error",
        severity: check.severity,
        type: check.type,
      });
    }
  }

  const manualChecks = buildManualChecks(ctx);
  const notes = [
    ...result.notes,
    "Deep scan includes same-origin JS bundle scanning, TLS/cert checks, DNS email-auth checks, and security.txt/robots probes.",
    "Deep scan still does not authenticate, crawl private routes, or exploit vulnerabilities.",
  ];

  const totalChecks = result.checksTotal + DEEP_CHECKS.length;
  return finalizeScan({
    base: { ...result, manualChecks },
    findings,
    checks,
    manualChecks,
    notes,
    totalChecks,
    mode: "deep",
    startedAt,
  });
}
