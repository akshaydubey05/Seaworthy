# Versioning and releases

Seaworthy uses **Semantic Versioning** with Git tags and GitHub Releases.

## Version format

- `v1.1.0` - patch/minor/major release tag
- **MAJOR**: breaking behavior/data/API changes
- **MINOR**: backward-compatible features (new checks, new pages, new scan mode)
- **PATCH**: backward-compatible fixes (false positives, UI bugs, docs)

## Release flow

1. Finish work on a branch or `main`.
2. Update `CHANGELOG.md` under `## [Unreleased]`, then move items into a new version section.
3. Run checks locally:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

4. Commit the release prep:

   ```bash
   git add -A
   git commit -m "Release v1.1.0"
   ```

5. Create a tag and push:

   ```bash
   git tag v1.1.0
   git push origin main
   git push origin v1.1.0
   ```

6. The `.github/workflows/release.yml` workflow runs on `v*` tags and creates a GitHub Release with generated notes.

## Vercel deploys

- Every push to `main` can be deployed by Vercel (if the repo is connected in Vercel).
- For production-only deploys, use Vercel's production branch setting (usually `main`) or promote a deployment in the Vercel dashboard.
- Optional: add a GitHub Action using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets for controlled deploys. Keep secrets in GitHub Secrets, never in code.

## Suggested version plan

| Version | Meaning |
|---|---|
| v1.1.0 | Current shipped hardening + deep-scan foundations |
| v1.2.0 | Small feature/fix releases |
| v2.0.0 | Accounts, DB-backed history, billing/entitlements, dashboard |
