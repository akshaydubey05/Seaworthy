import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.QA_BASE_URL || "http://localhost:3010";
const DEBUG_PORT = Number(process.env.QA_DEBUG_PORT || 9333);
const OUT_DIR = path.resolve("qa");
const VIEWPORTS = [
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1024", width: 1024, height: 768, mobile: false },
  { name: "1440", width: 1440, height: 900, mobile: false },
];

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromePath) {
  console.error("No Chrome/Edge executable found. Set CHROME_PATH.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "evaluate failed");
    }
    return result.result?.value;
  }

  async waitFor(expression, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await this.evaluate(expression).catch(() => null);
      if (value) return value;
      await sleep(250);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async screenshot(name) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const file = path.join(OUT_DIR, name);
    writeFileSync(file, Buffer.from(data, "base64"));
    return file;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

async function waitForDebugger() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error("Chrome debugger did not start.");
}

const summary = {
  base: BASE,
  viewports: {},
  consoleErrors: [],
  scan: {},
  report: {},
  pdf: {},
  waitlist: {},
  keyboard: {},
  rateLimit: {},
};

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${path.join(OUT_DIR, "chrome-profile")}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

let cdp;
try {
  await waitForDebugger();
  const pageRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: "PUT" });
  const page = await pageRes.json();
  cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.open();

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");

  // Responsive pass.
  for (const viewport of VIEWPORTS) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    });
    await cdp.send("Page.navigate", { url: `${BASE}/` });
    await cdp.waitFor("document.readyState === 'complete' && !!document.querySelector('#scan-url')", 40_000);
    await sleep(600);

    const layout = await cdp.evaluate(`(() => {
      const doc = document.documentElement;
      const offenders = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const style = getComputedStyle(el);
          if (style.position === 'fixed' || style.visibility === 'hidden' || style.display === 'none') return false;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          return rect.right > window.innerWidth + 1 || rect.left < -1;
        })
        .slice(0, 8)
        .map((el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : ''));
      return {
        innerWidth: window.innerWidth,
        scrollWidth: doc.scrollWidth,
        overflow: doc.scrollWidth > window.innerWidth + 1,
        offenders,
        h1: document.querySelector('h1')?.textContent?.trim().replace(/\\s+/g, ' '),
        navVisible: !!document.querySelector('nav[aria-label="Primary"]') && getComputedStyle(document.querySelector('nav[aria-label="Primary"]')).display !== 'none',
        scanButtonVisible: (() => { const el = document.querySelector('#scan button[type="submit"]'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
      };
    })()`);

    const shot = await cdp.screenshot(`home-${viewport.name}.png`);
    summary.viewports[viewport.name] = { ...layout, screenshot: shot };
  }

  // Reset to desktop for functional flow.
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: `${BASE}/` });
  await cdp.waitFor("document.readyState === 'complete' && !!document.querySelector('#scan-url')", 40_000);

  // Keyboard focus pass.
  await cdp.evaluate("document.body.focus()");
  const focusSteps = [];
  for (let i = 0; i < 6; i += 1) {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await sleep(120);
    focusSteps.push(
      await cdp.evaluate(`(() => {
        const el = document.activeElement;
        if (!el) return null;
        const style = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          outline: style.outlineStyle + ' ' + style.outlineWidth,
        };
      })()`),
    );
  }
  summary.keyboard = { steps: focusSteps };

  // Real scan flow.
  await cdp.evaluate(`(() => {
    const input = document.querySelector('#scan-url');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'https://example.com');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#scan form').requestSubmit();
  })()`);

  const reportHref = await cdp.waitFor(
    "document.querySelector('#scan a[href^=\"/report/\"]')?.getAttribute('href') || null",
    45_000,
  );
  const scoreText = await cdp.evaluate("document.querySelector('#scan .score span')?.textContent || null");
  summary.scan = { reportHref, score: scoreText };

  const receipt = reportHref.split("/").pop();
  const reportApi = await fetch(`${BASE}/api/report/${receipt}`);
  summary.report = {
    apiStatus: reportApi.status,
    json: await reportApi.json().catch(() => null),
  };

  const pdfRes = await fetch(`${BASE}/api/report/${receipt}/pdf`);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  summary.pdf = {
    status: pdfRes.status,
    contentType: pdfRes.headers.get("content-type"),
    bytes: pdfBuffer.length,
    header: pdfBuffer.subarray(0, 5).toString("ascii"),
  };

  await cdp.send("Page.navigate", { url: `${BASE}${reportHref}` });
  await cdp.waitFor("document.readyState === 'complete' && !!document.querySelector('h1')", 40_000);
  summary.report.page = await cdp.evaluate(`(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    summary: document.querySelector('main .card p')?.textContent?.trim().slice(0, 120),
    pdfLink: !!document.querySelector('a[href$="/pdf"]'),
  }))()`);
  await cdp.screenshot("report-1440.png");

  // Waitlist flow.
  await cdp.send("Page.navigate", { url: `${BASE}/` });
  await cdp.waitFor("document.readyState === 'complete' && !!document.querySelector('#waitlist-email')", 40_000);
  const testEmail = `qa+${Date.now()}@example.com`;
  await cdp.evaluate(`(() => {
    const input = document.querySelector('#waitlist-email');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(testEmail)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.closest('form').requestSubmit();
  })()`);
  summary.waitlist = {
    email: testEmail,
    success: await cdp.waitFor("document.body.innerText.includes('on the list')", 20_000).catch(() => false),
  };

  // Rate limit: invalid waitlist requests still consume the limiter.
  const statuses = [];
  for (let i = 0; i < 8; i += 1) {
    const res = await fetch(`${BASE}/api/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    statuses.push(res.status);
    if (res.status === 429) break;
  }
  summary.rateLimit = { statuses, limited: statuses.includes(429) };

  // Console errors collected during the run.
  summary.consoleErrors = cdp.events
    .filter((event) => event.method === "Runtime.exceptionThrown" || (event.method === "Runtime.consoleAPICalled" && event.params?.type === "error"))
    .map((event) => {
      if (event.method === "Runtime.exceptionThrown") {
        return event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text;
      }
      return (event.params?.args || []).map((arg) => arg.value ?? arg.description).join(" ");
    })
    .filter(Boolean)
    .slice(0, 20);
} finally {
  cdp?.close();
  chrome.kill();
}

console.log(JSON.stringify(summary, null, 2));

const failures = [];
for (const [name, result] of Object.entries(summary.viewports)) {
  if (result.overflow) failures.push(`viewport ${name}: horizontal overflow (${result.scrollWidth} > ${result.innerWidth})`);
  if (!result.scanButtonVisible) failures.push(`viewport ${name}: scan button not visible`);
}
if (summary.scan.reportHref?.includes("/report/") !== true) failures.push("scan flow: no report link");
if (summary.report.apiStatus !== 200) failures.push(`report API: ${summary.report.apiStatus}`);
if (summary.pdf.status !== 200 || !String(summary.pdf.contentType).includes("application/pdf")) failures.push("pdf: invalid response");
if (summary.waitlist.success !== true) failures.push("waitlist: no success state");
if (summary.rateLimit.limited !== true) failures.push("rate limit: no 429 observed");
if (summary.consoleErrors.length > 0) failures.push(`console errors: ${summary.consoleErrors.length}`);

if (failures.length) {
  console.error("\nQA FAILURES:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("\nQA PASS");
