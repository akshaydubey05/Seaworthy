import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ScanResult } from "./scan";

const DATA_DIR = path.join(process.cwd(), ".data");
const SCANS_FILE = path.join(DATA_DIR, "scans.json");
const WAITLIST_FILE = path.join(DATA_DIR, "waitlist.json");

async function ensure() {
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
  await ensure();
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function saveScan(result: ScanResult) {
  const scans = await readJson<ScanResult[]>(SCANS_FILE, []);
  scans.unshift({ ...result, savedAt: new Date().toISOString() } as ScanResult & { savedAt: string });
  await writeJson(SCANS_FILE, scans.slice(0, 200));
}

export async function getScan(id: string): Promise<(ScanResult & { savedAt?: string }) | null> {
  const scans = await readJson<(ScanResult & { savedAt?: string })[]>(SCANS_FILE, []);
  return scans.find((s) => s.receiptId === id) || null;
}

export async function saveWaitlist(email: string, source: string) {
  const items = await readJson<Array<{ email: string; source: string; createdAt: string }>>(WAITLIST_FILE, []);
  const normalized = email.toLowerCase().trim();
  if (!items.some((i) => i.email === normalized)) {
    items.unshift({ email: normalized, source, createdAt: new Date().toISOString() });
    await writeJson(WAITLIST_FILE, items.slice(0, 1000));
  }
  return { ok: true };
}