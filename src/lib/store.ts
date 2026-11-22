import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ScanResult } from "./scan";
import {
  checkDatabaseHealth,
  getScanRecord,
  isDatabaseConfigured,
  saveScanRecord,
  saveWaitlistRecord,
} from "./db";
import { logEvent } from "./observability";

const DATA_DIR = path.join(process.cwd(), ".data");
const SCANS_FILE = path.join(DATA_DIR, "scans.json");
const WAITLIST_FILE = path.join(DATA_DIR, "waitlist.json");

export type StorageMode = "postgres" | "file";

export function storageMode(): StorageMode {
  return isDatabaseConfigured() ? "postgres" : "file";
}

let warnedAboutFileStorage = false;

function warnIfFileStorage() {
  if (storageMode() === "file" && process.env.NODE_ENV === "production" && !warnedAboutFileStorage) {
    warnedAboutFileStorage = true;
    logEvent("warn", "file_storage_in_use", {
      message: "DATABASE_URL is not set. Scans are stored on local disk and are not durable on serverless.",
    });
  }
}

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await ensureDir();
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function saveScan(result: ScanResult) {
  warnIfFileStorage();
  if (storageMode() === "postgres") return saveScanRecord(result);

  const scans = await readJson<ScanResult[]>(SCANS_FILE, []);
  scans.unshift({ ...result, savedAt: new Date().toISOString() } as ScanResult & { savedAt: string });
  await writeJson(SCANS_FILE, scans.slice(0, 200));
}

export async function getScan(id: string): Promise<(ScanResult & { savedAt?: string }) | null> {
  if (storageMode() === "postgres") return getScanRecord(id);

  const scans = await readJson<(ScanResult & { savedAt?: string })[]>(SCANS_FILE, []);
  return scans.find((scan) => scan.receiptId === id) || null;
}

export async function saveWaitlist(email: string, source: string) {
  warnIfFileStorage();
  if (storageMode() === "postgres") return saveWaitlistRecord(email, source);

  const items = await readJson<Array<{ email: string; source: string; createdAt: string }>>(WAITLIST_FILE, []);
  const normalized = email.toLowerCase().trim();
  if (!items.some((item) => item.email === normalized)) {
    items.unshift({ email: normalized, source, createdAt: new Date().toISOString() });
    await writeJson(WAITLIST_FILE, items.slice(0, 1000));
  }
  return { ok: true };
}

export async function checkStorageHealth(): Promise<{ ok: boolean; mode: StorageMode; detail?: string }> {
  if (storageMode() === "postgres") {
    try {
      await checkDatabaseHealth();
      return { ok: true, mode: "postgres" };
    } catch (error) {
      return {
        ok: false,
        mode: "postgres",
        detail: error instanceof Error ? error.message : "database unavailable",
      };
    }
  }

  try {
    await ensureDir();
    return { ok: true, mode: "file" };
  } catch (error) {
    return {
      ok: false,
      mode: "file",
      detail: error instanceof Error ? error.message : "storage unavailable",
    };
  }
}
