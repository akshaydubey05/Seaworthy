import { Pool } from "pg";
import type { ScanResult } from "./scan";

const globalForDb = globalThis as unknown as { __seaworthyPool?: Pool };

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  if (!globalForDb.__seaworthyPool) {
    globalForDb.__seaworthyPool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForDb.__seaworthyPool;
}

type ScanMeta = {
  finalUrl?: string;
  hardeningScore?: number;
  manualChecks?: ScanResult["manualChecks"];
  notes?: string[];
  context?: ScanResult["context"];
  mode?: ScanResult["mode"];
};

export async function saveScanRecord(result: ScanResult) {
  const meta: ScanMeta = {
    finalUrl: result.finalUrl,
    hardeningScore: result.hardeningScore,
    manualChecks: result.manualChecks,
    notes: result.notes,
    context: result.context,
    mode: result.mode,
  };

  await getPool().query(
    `insert into scans
      (receipt_id, url, score, coverage, checks_run, checks_total, duration_ms, findings, summary, checks, counts, meta)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12::jsonb)
     on conflict (receipt_id) do nothing`,
    [
      result.receiptId,
      result.url,
      result.score,
      result.coverage,
      result.checksRun,
      result.checksTotal,
      result.durationMs,
      JSON.stringify(result.findings),
      result.summary,
      JSON.stringify(result.checks),
      JSON.stringify(result.counts),
      JSON.stringify(meta),
    ],
  );
}

type ScanRow = {
  receipt_id: string;
  url: string;
  score: number;
  coverage: number;
  checks_run: number;
  checks_total: number;
  duration_ms: number;
  findings: ScanResult["findings"];
  summary: string;
  checks: ScanResult["checks"];
  counts: ScanResult["counts"];
  meta: ScanMeta | null;
  created_at: Date;
};

export async function getScanRecord(id: string): Promise<(ScanResult & { savedAt?: string }) | null> {
  const { rows } = await getPool().query<ScanRow>(
    `select receipt_id, url, score, coverage, checks_run, checks_total, duration_ms, findings, summary, checks, counts, meta, created_at
     from scans where receipt_id = $1 limit 1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const meta = row.meta || {};
  return {
    receiptId: row.receipt_id,
    url: row.url,
    finalUrl: meta.finalUrl || row.url,
    mode: meta.mode || "fast",
    score: row.score,
    hardeningScore: meta.hardeningScore ?? row.score,
    coverage: row.coverage,
    checksRun: row.checks_run,
    checksTotal: row.checks_total,
    durationMs: row.duration_ms,
    findings: row.findings,
    manualChecks: meta.manualChecks || [],
    notes: meta.notes || [],
    context: {
      finalUrl: meta.context?.finalUrl || meta.finalUrl || row.url,
      status: meta.context?.status ?? 200,
      contentType: meta.context?.contentType || "text/html",
      bodyScanned: meta.context?.bodyScanned ?? true,
      truncated: meta.context?.truncated ?? false,
      hasForms: meta.context?.hasForms ?? false,
      hasPasswordForm: meta.context?.hasPasswordForm ?? false,
      hasPaymentScript: meta.context?.hasPaymentScript ?? false,
      sensitive: meta.context?.sensitive ?? false,
      scriptsScanned: meta.context?.scriptsScanned ?? 0,
    },
    summary: row.summary,
    checks: row.checks,
    counts: row.counts,
    savedAt: row.created_at.toISOString(),
  };
}

export async function saveWaitlistRecord(email: string, source: string) {
  await getPool().query(
    `insert into waitlist (email, source) values ($1, $2) on conflict (email) do nothing`,
    [email, source],
  );
  return { ok: true };
}

export async function checkDatabaseHealth() {
  const started = Date.now();
  await getPool().query("select 1");
  return { ok: true, latencyMs: Date.now() - started };
}
