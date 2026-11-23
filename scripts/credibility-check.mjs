/**
 * Credibility regression check.
 *
 * These are real, well-secured sites. The scanner should not present
 * hardening gaps as vulnerabilities, and should not invent findings from
 * schema.org URLs, report-only CSP, or marketing mentions of Stripe.
 *
 * Usage: npm run qa:credibility
 */
const BASE = process.env.QA_BASE_URL || "http://localhost:3000";

const cases = [
  {
    url: "https://google.com",
    label: "Google",
    expect: (r) => {
      const problems = [];
      if (r.score < 90) problems.push(`exposure score ${r.score} < 90`);
      if (r.findings.some((f) => f.type === "exposure")) problems.push("exposure finding on a hardened site");
      if (r.findings.some((f) => ["critical", "high", "medium"].includes(f.severity))) {
        problems.push("hardening note rated medium or higher");
      }
      if (r.findings.some((f) => f.id === "SW-023")) problems.push("false mixed-content finding (SW-023)");
      if (r.findings.some((f) => !f.type)) problems.push("finding missing a type");
      return problems;
    },
  },
  {
    url: "https://cloudflare.com",
    label: "Cloudflare",
    expect: (r) => {
      const ids = r.findings.map((f) => f.id);
      const problems = [];
      if (r.score < 95) problems.push(`exposure score ${r.score} < 95`);
      if (ids.includes("SW-015")) problems.push("false Stripe-webhook finding (SW-015)");
      if (r.findings.some((f) => f.type === "exposure")) problems.push("exposure finding on a hardened site");
      if (r.findings.some((f) => !f.type)) problems.push("finding missing a type");
      return problems;
    },
  },
  {
    url: "https://example.com",
    label: "Example",
    expect: (r) => {
      const problems = [];
      if (!r.findings.some((f) => f.type === "hardening")) problems.push("expected hardening suggestions");
      if (typeof r.hardeningScore !== "number") problems.push("missing hardening score");
      if (!Array.isArray(r.notes)) problems.push("missing scan notes");
      return problems;
    },
  },
];

const results = [];
let failed = false;

for (const test of cases) {
  try {
    const res = await fetch(`${BASE}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: test.url }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    const problems = test.expect(body);
    results.push({
      label: test.label,
      url: test.url,
      status: res.status,
      score: body.score,
      hardeningScore: body.hardeningScore,
      findings: body.findings.map((f) => `${f.id}:${f.type}:${f.severity}`),
      problems,
    });
    if (problems.length) failed = true;
  } catch (error) {
    failed = true;
    results.push({ label: test.label, url: test.url, error: String(error) });
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
}

console.log(JSON.stringify(results, null, 2));

if (failed) {
  console.error("\nCREDIBILITY CHECK FAILED");
  process.exit(1);
}
console.log("\nCREDIBILITY CHECK PASS");
