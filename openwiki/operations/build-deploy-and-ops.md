# Build, Deploy & Operations

This page covers local commands, the static build, hosting options (Docker self-host and AWS
S3/CloudFront), CI workflows, and the security/observability posture.

Package manager is **Bun** (`bun.lock`, workspaces `packages/*`). Commands are defined in
`/package.json`.

---

## Commands

| Command | Runs |
| --- | --- |
| `bun dev` | `next dev` (http://localhost:3000) |
| `bun run build` | build info + SW version scripts, then `next build` (static export → `out/`) |
| `bun start` | `next start` |
| `bun run test` | Vitest (`vitest run`) — **not** `bun test` |
| `bun run test:watch` | Vitest watch |
| `bun typecheck` | `tsc --noEmit` |
| `bun lint` | `eslint .` |
| `bun run test:e2e` | Playwright |
| `bun run deploy` / `deploy:dev` | `scripts/deploy-prod.sh` / `deploy-dev.sh` |
| `bun run audit` | `audit-ci --high` |

`build` runs `prebuild` first (`rimraf .next out`), then
`scripts/generate-build-info.cjs` (auto-increments patch, writes `.build-info.json` +
`.build-env.sh`) and `scripts/update-sw-version.cjs` (bumps the service worker cache version).

---

## Static export (`/next.config.ts`)

- `output: "export"`, `trailingSlash: true`, `images.unoptimized: true`, `typedRoutes: true`,
  `reactCompiler: true`.
- Build number/date are injected as `NEXT_PUBLIC_*` env from the package version or CI env.
- **Security headers cannot be set in Next config for static export** — they are enforced at
  the CDN (CloudFront). See `/SECURITY.md`.

---

## Docker self-hosting (`/docker/`)

A single container bundles **Caddy (HTTPS reverse proxy) + PocketBase (sync backend) + the
static PWA** behind one HTTPS origin (no CORS/mixed-content issues). Files: `Dockerfile`,
`docker-compose.yml`, `docker-entrypoint.sh`, `Caddyfile`, `pb_hooks/`, `pb_migrations/`, plus
`README.md` and `docker-setup-and-run.md`.

Quick start:

```bash
cd docker && docker compose up --build   # → https://localhost (self-signed cert)
```

First-run setup: create a PocketBase superuser, then run
`scripts/setup-pocketbase-collections.sh` to create the `tasks` collection. The collection's
API rule scopes records to the owner:
`@request.auth.id != "" && owner = @request.auth.id`.

Notable config: `SITE_ADDRESS`, `TLS_CERT`/`TLS_KEY` (or `internal` self-signed / automatic
Let's Encrypt for public domains), `POCKETBASE_VERSION`, `NEXT_PUBLIC_POCKETBASE_URL`, and
`GSD_TASKS_ENC_KEY` (32-char AES-256 key for at-rest task encryption). Data persists in the
`pb_data` volume.

Published images: `/.github/workflows/publish-docker.yml` pushes to GHCR (always) and Docker
Hub (if secrets set).

---

## AWS S3 / CloudFront deploy (`/scripts/`)

- `deploy-prod.sh` / `deploy-dev.sh` — thin wrappers: build, then set env
  (`S3_BUCKET`, `CLOUDFRONT_ID`, `ENV_LABEL`, `SITE_URL`) and call `deploy-app.sh`.
- `deploy-app.sh` — deploys an existing `out/` (no build). Two-pass S3 sync:
  immutable `max-age=31536000` for assets, `max-age=0,must-revalidate` for HTML and the
  service worker files, `no-cache` forced on `index.html`. Fixes content-types, then creates
  a CloudFront `/*` invalidation.
- CloudFront infra scripts: `deploy-cloudfront-function.sh` (viewer-request URL rewrite),
  `deploy-cloudfront-response-headers-policy.sh` (security headers).
- `smoke-test.sh` — cheap post-deploy HTTP checks (root 200, `sw.js` cache marker,
  api-catalog content-type, `index.html` no-cache).
- PocketBase ops scripts: `setup-pocketbase-collections.sh`,
  `update-pocketbase-tasks-schema.sh`, `verify-pb-encryption*.sh`.

---

## CI / CD (`/.github/workflows/`)

- `ci.yml` — on PR / push to main: parallel `typecheck`, `lint`, `test`, and `build` (via the
  `build-static-export` composite action; uploads a `static-export-<sha>` artifact on push to
  main).
- `deploy-dev.yml` — triggered after CI succeeds on main; **downloads the CI artifact** (no
  rebuild), authenticates to AWS via **OIDC**, waits for invalidation, runs the smoke test.
  Deploys are queued, never cancelled.
- `deploy-prod.yml` — tag-triggered (`v*.*.*`); verifies the tag commit is on `main` and the
  tag matches `package.json` version; uses a `production` environment with a
  required-reviewer gate; rebuilds deterministically.
- `deploy-cloudfront-infra.yml` — path-filtered; gated `cloudfront-infra` environment.
- `publish-docker.yml`, `publish-mcp-server.yml` — publish the self-host image and the MCP
  package.
- `sonarcloud.yml`, `security-audit.yml`, `claude.yml`, `claude-code-review.yml` — quality,
  security audit, and Claude automation.

---

## Security & observability

- **Sentry** (opt-in): `/lib/sentry.ts` initializes only when `NEXT_PUBLIC_SENTRY_DSN` is set,
  with aggressive PII/token sanitization. `/lib/logger.ts` + `/lib/error-logger.ts` forward
  logs through an allowlist so only safe metadata leaves the device.
- **SonarCloud** enforces coverage via its Quality Gate (`sonarcloud.yml`).
- **Dependency audit**: `security-audit.yml` runs `bun audit` on push/PR and on a daily cron.
- **Secrets**: do not commit secrets. `.env.example` documents placeholders; live values go in
  untracked env files / CI secrets. See `/SECURITY.md`.

---

## Where to start when changing ops

- **Changing cache/headers behavior:** update `scripts/deploy-app.sh` (cache-control) and/or
  the CloudFront response-headers policy script; SW cache logic lives in
  `/lib/sw-cache-logic.ts` (see [Sync & offline](../workflows/sync-and-offline.md)).
- **Changing the deploy pipeline:** edit the relevant workflow in `/.github/workflows/`; note
  prod requires tag/version/branch consistency and reviewer approval.
- **Self-host changes:** edit `/docker/` files and validate with `docker compose up --build`.

---

## Rendered OpenWiki docs site

The Markdown in `/openwiki/` can be rendered to a **self-contained static HTML site**:

```bash
bun run build:docs          # or: node scripts/build-openwiki-site.cjs
```

- Generator: `/scripts/build-openwiki-site.cjs` — a zero-dependency Node script (no
  MkDocs/Docusaurus) that converts every `.md` page under `/openwiki/` (excluding `site/`
  itself) into styled HTML with a sidebar, light/dark toggle, and rewritten internal links.
- Output: `/openwiki/site/` (git-ignored). Open `/openwiki/site/index.html` in a browser, or
  serve the folder statically. Because pages are self-contained (inline CSS, no external
  assets), they also work when opened directly via `file://`.
- Re-run `bun run build:docs` after editing any `/openwiki/*.md` page to refresh the site.
- To deploy, upload `/openwiki/site/` to any static host (e.g. an S3 prefix behind the
  existing CloudFront distribution, or GitHub Pages).

---

## Automated OpenWiki updates (`/.github/workflows/openwiki-update.yml`)

A scheduled workflow keeps `/openwiki/` in sync with the codebase.

- **Triggers:** nightly cron (`03:17 UTC`), push to `main` that touches documentation-relevant
  paths (post-merge), and manual `workflow_dispatch` (with an optional focus message).
- **What it does:** runs `openwiki --update`, rebuilds the HTML site (`bun run build:docs`), and
  **opens a pull request** with any changes via `peter-evans/create-pull-request`. It does not
  push directly to `main`, so AI-generated doc edits get a human review and cannot cause a
  push -> CI -> push loop. If nothing changed, no PR is created.
- **Required setup (one-time):**
  - Add repo secret **`OPENWIKI_API_KEY`** — the model API key the OpenWiki CLI needs (exported
    to the CLI as both `OPENWIKI_API_KEY` and `ANTHROPIC_API_KEY`).
  - Enable **Settings -> Actions -> General -> Workflow permissions -> "Allow GitHub Actions to
    create and approve pull requests"** so the job can open the PR.
- **Notes:** the CLI is invoked with `bunx openwiki` (no need to add it as a project
  dependency); checkout uses `fetch-depth: 0` so OpenWiki can diff commits since its last run
  (`gitHead` in `openwiki/.last-update.json`). Tune the `push` path filters in the workflow to
  match which source areas should trigger a refresh.
