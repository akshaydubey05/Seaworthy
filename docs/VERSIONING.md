# Versioning and releases

Seaworthy uses **Semantic Versioning** with Git tags and GitHub Releases.

## Version format

- `v1.1.0` - patch/minor/major release tag
- **MAJOR**: breaking behavior/data/API changes
- **MINOR**: backward-compatible features (new checks, new pages, new scan mode)
- **PATCH**: backward-compatible fixes (false positives, UI bugs, docs)

## Release flow

### Option A: one click in GitHub (recommended)

1. Merge your work to `main`.
2. GitHub → **Actions** → **Bump version** → **Run workflow**.
3. Choose the release type:

   | Choice | Example | Use it for |
   |---|---|---|
   | `patch` | 1.2.0 → 1.2.1 | Bug fixes, copy, docs, false-positive fixes |
   | `minor` | 1.2.0 → 1.3.0 | New checks, features, pages — backwards compatible |
   | `major` | 1.2.0 → 2.0.0 | Breaking changes or a new product era |

4. The workflow runs lint, typecheck, tests, and build. If they pass it bumps
   `package.json`, `package-lock.json`, the Go scanner version constant, and
   `CHANGELOG.md`, then commits, tags, pushes, and publishes the GitHub Release.
5. Enable **dry run** to preview the version number without changing anything.

Before the first run: if `main` is protected, allow the GitHub Actions bot to
push (Settings → Rules → allow bypass for this workflow) or the commit step will
be rejected. A `GITHUB_TOKEN` push does not trigger other workflows, which is why
this workflow creates the Release itself.

### Option B: locally

1. Finish work on a branch or `main`.
2. Update `CHANGELOG.md` under `## [Unreleased]`, then move items into a new version section.
3. Run checks locally:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

4. Bump the version (same rules as above):

   ```bash
   node scripts/release.mjs minor   # or patch / major
   ```

5. Commit, tag, and push:

   ```bash
   git add -A
   git commit -m "chore(release): v1.3.0"
   git tag v1.3.0
   git push origin main
   git push origin v1.3.0
   ```

6. The `.github/workflows/release.yml` workflow runs on `v*` tags and creates a GitHub Release with generated notes.

## Vercel deploys

- Every push to `main` can be deployed by Vercel (if the repo is connected in Vercel).
- For production-only deploys, use Vercel's production branch setting (usually `main`) or promote a deployment in the Vercel dashboard.
- Optional: add a GitHub Action using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets for controlled deploys. Keep secrets in GitHub Secrets, never in code.

## Suggested version plan

| Version | Meaning |
|---|---|
| v1.1.0 | Launch hardening + deep-scan foundations |
| v1.2.0 | Current: Go scanner service, contract validation, fallback, CI parity |
| v2.0.0 | Accounts, DB-backed history, billing/entitlements, dashboard |
