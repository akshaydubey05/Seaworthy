# Getting started (beginner-friendly)

This guide explains the confusing parts: database URL, deployment, tests, CI/CD, versioned releases, and legal.

## 1. What `DATABASE_URL` means

`DATABASE_URL` is just the **address + password** Seaworthy uses to connect to a Postgres database.

It looks like this:

```text
postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Example shape (not real):

```text
postgresql://seaworthy_user:Abc123pass@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Easiest way to get one (Neon, free tier)

1. Go to https://neon.tech and create an account.
2. Create a new project named `seaworthy`.
3. Neon will show a **Connection string**. Choose the one that includes password and `sslmode=require`.
4. Copy that whole string.
5. In your local project, create `.env.local`:

   ```env
   DATABASE_URL="postgresql://...your connection string..."
   ```

6. Run:

   ```bash
   npm run db:migrate
   npm run dev
   ```

7. Open `http://localhost:3000/api/health`. It should show `"mode":"postgres"`.

**Do not commit** `.env.local`. It contains secrets.

## 2. Deploy to Vercel (beginner steps)

### Prerequisites
- GitHub repo pushed (already done).
- A Vercel account: https://vercel.com
- A Neon/Supabase `DATABASE_URL`.

### Steps

1. Sign into Vercel with GitHub.
2. Click **Add New... > Project**.
3. Import `akshaydubey05/Seaworthy`.
4. Framework should auto-detect as **Next.js**. Leave build command as `npm run build`.
5. Before deploying, open **Environment Variables** and add:

   | Name | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | your Postgres URL | required for durable storage |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` | use Vercel URL first if no domain |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | your email | shown on legal pages |
   | `NEXT_PUBLIC_SECURITY_EMAIL` | security email | for vulnerability reports |
   | `NEXT_PUBLIC_COMPANY_NAME` | your name/company | legal pages |
   | `NEXT_PUBLIC_JURISDICTION` | e.g. `Delhi, India` | legal pages |
   | `DEEP_SCAN_ENABLED` | `false` initially | enable only when paid key/billing is ready |
   | `DEEP_SCAN_KEY` | long random secret | only if deep scan enabled |

6. Click **Deploy**.
7. After deploy, run the schema against production DB once (from your machine):

   ```bash
   # in .env.local set DATABASE_URL to the production DB URL temporarily, or pass it inline
   npm run db:migrate
   ```

8. Check:
   - `https://your-site.vercel.app/api/health` returns `storage.mode: "postgres"`
   - Run a scan, open the report, download PDF.
   - `/.well-known/security.txt` loads.

### Custom domain

1. In Vercel project > **Settings > Domains**, add your domain.
2. Vercel shows DNS records. Add them at your domain registrar (Namecheap/GoDaddy/Cloudflare).
3. Wait for DNS to propagate.
4. Update `NEXT_PUBLIC_SITE_URL` to the real domain and redeploy.

## 3. Tests

Tests live in `tests/` and use Vitest.

```bash
npm test            # run once
npm run test:watch  # during development
npm run qa:credibility  # scans real Google/Cloudflare/example.com (needs dev server running)
```

What tests cover:
- private/local URL rejection (SSRF guard)
- false-positive controls (schema.org, meta referrer, report-only CSP, Stripe mentions, truncated footer)
- real exposure detection (secret in JS bundle)
- CSP quality classification
- deep scan mode

## 4. CI/CD (runs on every push)

GitHub Actions workflow: `.github/workflows/ci.yml`.

On every push/PR it runs:
1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

If any step fails, the push/PR is marked red. Fix before merging.

## 5. Versioned releases (V1.1, V2.0 style)

We use Git tags like `v1.1.0`, `v2.0.0` and semantic versioning: `MAJOR.MINOR.PATCH`.

- `patch` (1.2.0 → 1.2.1): fixes, copy, docs.
- `minor` (1.2.0 → 1.3.0): new features, still backwards compatible.
- `major` (1.2.0 → 2.0.0): breaking changes or a new product era.

### Easiest: the GitHub button

1. Open **Actions** → **Bump version** → **Run workflow**.
2. Pick `patch`, `minor`, or `major`.
3. It runs lint/typecheck/tests/build, updates all version numbers, commits,
   tags, pushes, and creates the GitHub Release for you.

Use the **dry run** checkbox to preview the next version without changing anything.
Full details in `docs/VERSIONING.md`.

### Manual alternative

```bash
npm run lint && npm run typecheck && npm test && npm run build
node scripts/release.mjs minor     # or patch / major
git add -A
git commit -m "chore(release): v1.3.0"
git tag v1.3.0
git push origin main
git push origin v1.3.0
```

Pushing the `v*` tag triggers `.github/workflows/release.yml`, which creates a GitHub Release automatically.

See `docs/VERSIONING.md` for details.

## 6. Legal - plain language

**I am not a lawyer.** The app already has draft Terms/Privacy/Security pages. They are reasonable starting drafts, but not legal advice.

What you should do:

1. **Set your details** in env vars: `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_JURISDICTION`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SECURITY_EMAIL`.
2. **Read the pages** at `/terms`, `/privacy`, `/security`. Make sure they match what you actually do.
3. **Before charging real users**, have a lawyer review Terms and Privacy for your jurisdiction. This is especially important if you take payments, store emails, or scan user-provided targets.
4. **Don't claim certification**. Seaworthy is "best-effort automated review", not a pentest or compliance certification. The UI already says this - keep it that way.
5. **Security reports**: keep `security@...` monitored. Respond politely and promptly.

See `docs/LEGAL-CHECKLIST.md`.

## 7. Optional: run the Go scanner

The website works without this step. The Go scanner is faster and is the engine
that receives new checks first.

Local:

```bash
cd services/scanner
SCANNER_TOKEN=local-test-token go run ./cmd/scanner
```

In another terminal, add to `.env.local`:

```bash
SCANNER_URL=http://localhost:8080
SCANNER_TOKEN=local-test-token
```

Restart `npm run dev`. A scan now logs `scan_remote_ok`. If you stop the Go
process, the next scan logs `scan_remote_fallback` and still works.

Test the service itself:

```bash
cd services/scanner
go vet ./...
go test ./...
```

Production: deploy the Dockerfile to Fly.io/Render/Railway/Cloud Run, set the same
`SCANNER_TOKEN` on both sides, and set `SCANNER_URL` in Vercel. Full steps:
`DEPLOYMENT.md` section 8 and `services/scanner/README.md`.
