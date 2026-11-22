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

export async function saveScanRecord(result: ScanResult) {
  await getPool().query(
    `insert into scans
      (receipt_id, url, score, coverage, checks_run, checks_total, duration_ms, findings, summary, checks, counts)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb)
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
  created_at: Date;
};

export async function getScanRecord(id: string): Promise<(ScanResult & { savedAt?: string }) | null> {
  const { rows } = await getPool().query<ScanRow>(
    `select receipt_id, url, score, coverage, checks_run, checks_total, duration_ms, findings, summary, checks, counts, created_at
     from scans where receipt_id = $1 limit 1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    receiptId: row.receipt_id,
    url: row.url,
    score: row.score,
    coverage: row.coverage,
    checksRun: row.checks_run,
    checksTotal: row.checks_total,
    durationMs: row.duration_ms,
    findings: row.findings,
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
