#!/usr/bin/env node
/**
 * Release helper used by .github/workflows/bump-version.yml and locally.
 *
 * Usage:
 *   node scripts/release.mjs patch              # 1.2.0 -> 1.2.1
 *   node scripts/release.mjs minor --dry-run    # 1.2.0 -> 1.3.0, no writes
 *   node scripts/release.mjs major              # 1.2.0 -> 2.0.0
 *
 * The script only changes version strings and the changelog heading. It never
 * commits, tags, or pushes; the workflow does that so permissions stay explicit.
 */
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const KINDS = new Set(["patch", "minor", "major"]);
const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const kind = args.find((arg) => !arg.startsWith("--"));

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

if (!kind || !KINDS.has(kind)) {
  fail("usage: node scripts/release.mjs <patch|minor|major> [--dry-run]");
}

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = pkg.version;

if (!/^\d+\.\d+\.\d+$/.test(current ?? "")) {
  fail(`package.json version "${current}" is not a plain x.y.z semver version`);
}

const [major, minor, patch] = current.split(".").map(Number);
const next = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`,
}[kind];

const today = new Date().toISOString().slice(0, 10);
const changes = [];

changes.push(`package.json ${current} -> ${next}`);
changes.push(`package-lock.json ${current} -> ${next}`);

const goMainPath = resolve(root, "services", "scanner", "cmd", "scanner", "main.go");
const goMain = readFileSync(goMainPath, "utf8");
const goVersionPattern = /const version = "\d+\.\d+\.\d+"/;
if (!goVersionPattern.test(goMain)) {
  fail("could not find the scanner version constant in services/scanner/cmd/scanner/main.go");
}
changes.push(`scanner version ${current} -> ${next}`);

const changelogPath = resolve(root, "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
const changelogEntry = `## [${next}] - ${today}`;
const hasEntry = changelog.includes(changelogEntry);
changes.push(`CHANGELOG.md ${hasEntry ? "entry already exists" : `+ ${changelogEntry}`}`);

if (dryRun) {
  console.log(`release: ${current} -> ${next} (${kind}), dry run`);
  for (const change of changes) console.log(`  - ${change}`);
  process.exit(0);
}

execSync(`npm version ${next} --no-git-tag-version --allow-same-version`, {
  cwd: root,
  stdio: "inherit",
});

writeFileSync(goMainPath, goMain.replace(goVersionPattern, `const version = "${next}"`));

if (!hasEntry) {
  const unreleasedHeading = "## [Unreleased]";
  const unreleasedIndex = changelog.indexOf(unreleasedHeading);
  if (unreleasedIndex === -1) {
    fail("CHANGELOG.md is missing a '## [Unreleased]' section");
  }
  const nextSectionIndex = changelog.indexOf("\n## [", unreleasedIndex + unreleasedHeading.length);
  const unreleasedBody = changelog
    .slice(unreleasedIndex + unreleasedHeading.length, nextSectionIndex === -1 ? changelog.length : nextSectionIndex)
    .trim();
  const sectionBody = unreleasedBody || `### Changed\n- Release ${next}.`;
  const replacement = `${unreleasedHeading}\n\n${changelogEntry}\n\n${sectionBody}\n`;
  const updated =
    nextSectionIndex === -1
      ? `${changelog.slice(0, unreleasedIndex)}${replacement}`.trimEnd() + "\n"
      : `${changelog.slice(0, unreleasedIndex)}${replacement}${changelog.slice(nextSectionIndex)}`;
  writeFileSync(changelogPath, updated);
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${next}\n`);
}

console.log(`release: ${current} -> ${next} (${kind})`);
for (const change of changes) console.log(`  - ${change}`);
