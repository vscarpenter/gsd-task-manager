# Security Configuration

This document outlines the security measures implemented in GSD Task Manager and deployment instructions for CloudFront security headers.

## Table of Contents

- [Overview](#overview)
- [Client-Side Security](#client-side-security)
- [Cloud Sync Security](#cloud-sync-security-optional)
- [MCP Server Security](#mcp-server-security-optional)
- [CloudFront Security Headers](#cloudfront-security-headers)
- [Deployment Instructions](#deployment-instructions)
- [Security Best Practices](#security-best-practices)
- [Security Audit Results](#security-audit-results)

## Overview

GSD Task Manager is a privacy-first application where all data is stored locally in the browser using IndexedDB by default. **Optional cloud sync** (v6.9.0+) enables multi-device access through a PocketBase server: the hosted service at `https://api.vinny.io`, or one you run yourself.

## Client-Side Security

### Implemented Protections

1. **Local Data Storage by Default**
   - All tasks stored in IndexedDB (client-side)
   - No background network calls in local-only mode. The exception is the
     app's own origin: the service worker fetches pages and checks for its
     own update there
   - Two user actions send a request. The first is the feedback a user chooses
     to send from Settings; it is never automatic and carries no account,
     device, or task data
   - The second is reaching for a sign-in button. Hovering or focusing one
     fetches the sign-in methods from the PocketBase server before the click
     (`prepareOAuthLogin` in `lib/sync/pb-auth.ts`). Opening the dialog alone
     sends nothing
   - PocketBase request logs record client IPs, so operators must keep the log
     retention window short for the feedback route to stay unlinkable
   - Export/import functionality for user-controlled backups
   - Optional cloud sync requires explicit user opt-in

2. **Input Validation**
   - Zod schema validation for all task operations
   - Sanitized error messages for import failures
   - Try-catch blocks around JSON parsing

3. **Dependency Management**
   - Blocking `bun audit --audit-level=high` checks for known vulnerabilities.
     CI accepts only the advisory listed under Known Trade-offs
   - Blocking `bun run license:check` policy plus a CycloneDX SBOM artifact in CI
   - Pinned GitHub Action revisions, runner images, and container base digests
   - Dependency updates are reviewed manually. No Dependabot or Renovate
     configuration is checked in

4. **Privacy-Safe Web Capture**
   - Bookmarklets pass task content in a client-only URL fragment:
     `#action=capture&title=…&url=…&tags=…`
   - Capture data opens the existing task drawer and is not persisted until the
     user selects **Create task**
   - The retired query-string form (`?action=capture`) is rejected; the service
     worker removes its private fields before any controlled network request or
     cache write and deletes legacy capture cache entries during activation

   - Sharing into the installed PWA (the manifest's `share_target`) uses a POST
     to `/share-target/`. While the service worker is active it answers the POST
     itself and redirects to the same fragment form, so shared text does not
     become a network request, a log line, or a cache key. If site storage is
     cleared while the PWA stays installed, the worker is gone and the POST
     reaches the static host. CloudFront does not log request bodies, but the
     host has no handler for a POST, so the share fails and the person gets
     no draft. Opening the app again registers the worker, and sharing works
     again

   **Settings → Bookmarklet** generates the bookmarklet link for the current
   origin, with optional default tags. The generator encodes the whole source,
   because browsers percent-decode a `javascript:` URL before running it. The
   bookmarklet opens GSD with `noopener,noreferrer`, so the browser sends no
   `Referer` header and the source page gets no handle on the GSD tab. Written by hand, the source looks like this:

   ```js
   javascript:(function(){var p=new URLSearchParams({action:"capture",title:document.title,url:location.href,tags:"readme,todo"});window.open("https://gsd.vinny.dev/#"+p.toString(),"_blank","noopener,noreferrer");})();
   ```

5. **No Error Telemetry**
   - The app ships no error-reporting SDK. Runtime errors are logged to the
     browser console only and never leave the device (see ADR 0017)
   - Console log metadata is still masked: tokens, credentials, and other
     secret-shaped keys are replaced before anything is written
   - The CloudFront `connect-src` directive names only the sync backend and the Google and
     GitHub OAuth origins, so there is no telemetry origin for the browser to reach

## Cloud Sync Security (Optional)

When users enable cloud sync, the following security measures protect their data:

### PocketBase Architecture

Cloud sync talks to one PocketBase server. The build served at `gsd.vinny.dev`
points at the hosted service, and the Docker image under `docker/` lets you run
your own. On any other production host the app uses its own origin, and
`NEXT_PUBLIC_POCKETBASE_URL` overrides either default (`lib/env-config.ts`).
The hosted service and the self-host image store task content differently at
rest.

1. **Hosted Service (`https://api.vinny.io`)**
   - I run this server as a PocketBase binary on an AWS EC2 instance
   - The hosted service does not encrypt task content at rest. Titles,
     descriptions, tags, subtasks, and time entries are plaintext in the
     PocketBase database
   - TLS protects task data in transit, and owner-scoped API rules keep each
     account to its own tasks
   - As the operator, I have technical access to synced task content. Stay in
     local-only mode or self-host if that does not fit your needs
   - [ADR 0016](docs/adr/0016-hosted-sync-defers-field-encryption.md) records
     why the field encryption hooks are not deployed here

2. **Self-Hosted Docker Image (`docker/`)**
   - The hooks in `docker/pb_hooks/tasks_encryption.pb.js` encrypt the same
     five task content fields at rest
   - The container refuses to start without a 32-character
     `GSD_TASKS_ENC_KEY`, and the one-shot migration encrypts existing
     plaintext rows
   - You control data retention and access, and no third party sees task data

3. **Data Model**
   - Tasks stored with owner-scoped API rules: `@request.auth.id != "" && owner = @request.auth.id`
   - Each user can only access their own tasks
   - The update rule also refuses a request that changes `owner`
   - PocketBase enforces row-level security at the API layer

4. **Sync Protocol**
   - Last-write-wins (LWW) conflict resolution using `client_updated_at` timestamps
   - PocketBase SSE (Server-Sent Events) for realtime cross-device updates
   - Echo filtering prevents processing own-device changes
   - The offline queue replays on the next sync after connectivity returns.
     Sign-out clears the queue, and a row that keeps failing retires at
     `MAX_RETRIES` (`lib/constants/sync.ts`)
   - A push checks that the sync session still names the signed-in account
     before it reads the queue and before each row (`lib/sync/pb-push.ts`), so
     a queued write stays in the account that made it

### OAuth Authentication

1. **Providers**
   - Google, GitHub, and Apple, through PocketBase's built-in OAuth2

2. **Sign-in Flow**
   - The tab that starts sign-in gets a per-request `state` and PKCE code
     verifier from PocketBase and keeps both in memory
   - The provider returns to `/api/gsd/oauth-callback`, a PocketBase hook
     that redirects to `/auth/callback/` with the code, state, or error in the
     URL fragment. The redirect target comes from `GSD_WEB_OAUTH_CALLBACK_URL` or
     a fixed default, never from the request, so it can't be an open redirect
   - The callback page relays the result over a same-origin
     `BroadcastChannel` and clears it from the address bar. It closes once a
     tab acknowledges the result, and otherwise stays open with a message. Only
     the tab whose `state` matches exchanges the code, using its own verifier
   - PocketBase's realtime `/api/oauth2-redirect` route answers 404, through
     a hook on the server and a deny rule in the self-host Caddyfile. Left
     enabled, that route would hand the code to whichever realtime client the
     `state` names, not to the browser that started sign-in
   - Self-hosters register `https://<server>/api/gsd/oauth-callback` with each
     provider (see `docker/README.md`)

3. **Tokens**
   - Auth tokens stored in PocketBase's built-in `authStore` (localStorage)
   - Tokens last 30 days. The app renews one at the start of a sync once it
     is within 7 days of expiry (`ensureValidAuth` in `lib/sync/pb-auth.ts`)
   - An expired token can't renew, so the user signs in again

### Network Security

- HTTPS communication with the PocketBase server in production. Local
  development defaults to `http://127.0.0.1:8090`
- CORS configured at PocketBase level
- HSTS headers enforce secure connections
- TLS 1.2+ required

## MCP Server Security (Optional)

The MCP server allows Claude Desktop to access and manage tasks via natural language queries.

### Security Model

1. **PocketBase API Access**
   - MCP server communicates directly with PocketBase using auth token
   - The server reads the auth token from `GSD_AUTH_TOKEN`, which the Claude
     Desktop config file supplies. It is the same session token the browser
     holds
   - The server refuses a PocketBase superuser token. It also refuses a
     PocketBase URL that is neither HTTPS nor loopback, or that carries
     credentials, a query string, or a fragment
     (`packages/mcp-server/src/server/config.ts`)
   - On a self-hosted Docker server, PocketBase hooks encrypt selected content
     fields before persistence and decrypt them after reads. The hosted
     service stores them as plaintext. API clients receive the normal task
     shape over HTTPS either way

2. **Read & Write Access**
   - MCP tools support both read and write operations
   - Write operations support dry-run mode for safe exploration
   - All operations scoped to authenticated user's tasks only

3. **Opt-In Feature**
   - Requires explicit configuration by user
   - Must set PocketBase URL and auth token in Claude Desktop config
   - Not enabled by default

### Configuration Security

```json
// Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json)
{
  "mcpServers": {
    "gsd-tasks": {
      "env": {
        "GSD_POCKETBASE_URL": "https://api.vinny.io",
        "GSD_AUTH_TOKEN": "eyJ..."
      }
    }
  }
}
```

This excerpt shows only the two variables. The full entry, with `command` and
`args`, is in `packages/mcp-server/README.md`.

**Important**: The config file contains the auth token. Ensure appropriate file permissions (`chmod 600`).

## CloudFront Security Headers

### Required Headers

CloudFront sends the following security headers. Their source of truth is
`cloudfront/response-headers-policy.json`, and `docker/Caddyfile` sends the same
set for the self-host image, except where noted:

#### 1. Content Security Policy (CSP)

**Development:**

`next dev` has no response-header policy. `app/layout.tsx` adds a looser policy
as a `<meta>` tag when `NODE_ENV` is not `production`. It allows
`'unsafe-inline'` and `'unsafe-eval'` scripts for React and Next.js tooling.
Under `NODE_ENV=development` it also allows local PocketBase origins in
`connect-src`. The production export omits the tag.
The export test server and `bun run test:csp` serve the production policy.

**Production (Current):**

`config/csp.cjs` defines the policy once. `buildCsp("cloudfront")` returns the
CloudFront policy, and `buildCsp("selfhost")` returns the Caddy policy for the
self-host image. `tests/data/csp-single-source.test.ts` keeps
the copies in `cloudfront/response-headers-policy.json` and `docker/Caddyfile`
equal to it.

> **Note:** The build externalizes Next.js hydration/RSC script blocks and
> stable style blocks into hashed same-origin assets before deployment.
> `style-src-attr 'unsafe-inline'` remains narrowly scoped to React's dynamic
> style attributes (virtualized positioning, chart dimensions, and drag
> transforms). Executable inline script and script attributes are denied, and
> the production browser smoke test guards the script directives.
>
> `style-src-elem` allows `'unsafe-inline'` because the scroll lock that
> `@radix-ui/react-dialog` applies through `react-remove-scroll` cannot be
> hash-pinned. That library interpolates the measured scrollbar width into the
> stylesheet it injects, so the text differs across platforms and zoom levels —
> a hash computed on one machine fails on another. Enforcing hashes here did
> not harden the app; it silently broke every modal, leaving the page scrollable
> behind open dialogs. A hash in the directive also makes `'unsafe-inline'`
> inert, so the two cannot coexist.
>
> The residual risk is bounded: an attacker who could inject a style element
> already needs the HTML injection that `script-src 'self'` denies, and
> `style-src-attr 'unsafe-inline'` was already permitted. Script execution,
> `base-uri`, `form-action`, and `connect-src` remain locked down.

#### 2. X-Frame-Options
```
X-Frame-Options: DENY
```
Prevents clickjacking attacks by disallowing the page to be embedded in frames.

#### 3. X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
Prevents MIME-sniffing attacks.

#### 4. Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```
Forces HTTPS connections for 2 years and includes subdomains.

#### 5. X-XSS-Protection
```
X-XSS-Protection: 0
```
The CloudFront policy turns the legacy browser XSS filter off
(`"Protection": false`), and the CSP does that job. The self-host Caddyfile
sends no `X-XSS-Protection` header.

#### 6. Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
Controls referrer information sent with requests.

#### 7. Permissions-Policy

The policy denies 17 browser features, including geolocation, microphone,
camera, and payment, and allows `fullscreen` for the app's own origin. The
`Permissions-Policy` entry in `cloudfront/response-headers-policy.json` holds
the full directive list.

#### 8. Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy
```
Cross-Origin-Opener-Policy: same-origin-allow-popups
Cross-Origin-Resource-Policy: same-origin
```
The `docker/Caddyfile` comment records why the opener policy is set, and
why `Cross-Origin-Embedder-Policy` is not set.

## Deployment Instructions

### Deploy script (Recommended)

`scripts/deploy-cloudfront-response-headers-policy.sh` applies
`cloudfront/response-headers-policy.json` from version control. It creates the
`gsd-security-headers` policy, or updates it with the current ETag. It then
checks that the distribution's default cache behavior references that policy,
and exits 1 if it does not.

```bash
CLOUDFRONT_DISTRIBUTION_ID=E1T6GDX0TQEP94 \
  bash scripts/deploy-cloudfront-response-headers-policy.sh
```

The script needs `aws` and `jq`. The `deploy-cloudfront-infra` workflow runs it
on a push to `main` that changes the policy file or the script, or on a manual
dispatch that includes the policy. The run waits
for the security audit and for approval on the `cloudfront-infra` environment.

The script does not attach the policy. On a new distribution the first run
creates the policy and then exits 1. Attach the policy once in the console
(next section), then run the script again.

### Attaching the policy in the AWS Console

Do this once per distribution, after the script has created the policy. Edit
header values in the policy file, not in the console, so the two don't drift.

1. **Attach Policy to Distribution**
   - Go to your CloudFront distribution (e.g., `E1T6GDX0TQEP94`)
   - Edit the default cache behavior
   - Under "Response headers policy", select `gsd-security-headers`
   - Save changes

2. **Create Invalidation**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id E1T6GDX0TQEP94 \
     --paths "/*"
   ```

### Terraform/CloudFormation

Adapt the header values in `cloudfront/response-headers-policy.json` into your IaC tool's response headers policy resource.

## Security Best Practices

### For Developers

1. **Regular Audits**
   ```bash
   bun audit --audit-level=high
   bun run license:check
   ```
   `bun audit` exits 1 while the accepted `braces` advisory below is open. CI
   passes the JSON report to `scripts/check-audit-results.cjs`. That script
   fails the job for any High or Critical advisory it does not accept. CI also runs `bun audit --prod --audit-level=high` with no
   exceptions.

2. **Keep Dependencies Updated**
   - Review `bun outdated` regularly. Keep `typescript` 6.x beside
     `@typescript/native` (TypeScript 7) until downstream tooling supports 7
   - Test thoroughly after major version updates
   - Avoid canary/RC versions in production

3. **Code Reviews**
   - Review all import/export functionality changes
   - Validate error handling in data operations
   - Check for potential XSS in user-generated content

4. **Testing**
   - Keep coverage at or above the `vitest.config.ts` thresholds: 80% for
     statements, lines, and functions, and 75% for branches
   - Include security test cases for data operations
   - Run `bun run test:csp` against the built export before a production deploy

### For Users

1. **Regular Backups**
   - Export tasks regularly using the export feature
   - Store backups securely (they contain your task data)

2. **Browser Security**
   - Keep browser updated to latest version
   - Be cautious about browser extensions that access storage
   - Clear browser data carefully (will delete all tasks!)

3. **Data Privacy**
   - Local-only mode is not backed up automatically
   - When optional sync is enabled, task data is transmitted to the configured
     PocketBase server
   - Export before clearing browser data
   - Import only from trusted export files

## Vulnerability Reporting

This section has a machine-readable counterpart at
[`/.well-known/security.txt`](https://gsd.vinny.dev/.well-known/security.txt),
published per RFC 9116.

If you discover a security vulnerability, please:

1. **Do NOT** open a public GitHub issue
2. [Open a private security advisory](https://github.com/vscarpenter/gsd-task-manager/security/advisories/new)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

## Security Audit Results

### 2026-10-22: GHSA-673q-mjm6-r5xr review and upgrade

Aikido issue `52751721` was identified by the owner as
[GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).
Its scanned commit was unavailable. The initial review covered local source at
`479fc798a9287099bfe6b0fef50f504cfbc294e4` and existing manifest/lockfile
edits. Both Next.js and eslint-config-next initially resolved to `16.3.8`.

The advisory affects `next >=16.0.0 <=16.4.0` and is patched in `16.4.1`.
It describes unauthenticated remote code execution in App Router applications
with Cache Components and a `use cache` function returning multiple typed
arrays. The [upstream React advisory](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3)
also requires an attacker-controlled value in the transported response.
Next bundles its own React Server Components implementation; changing the
root `react` package alone would not establish remediation.

The initial applicability review found no affected execution path in the
supported application configurations:

- `next.config.ts` uses `output: "export"`. The resolved production build
  configuration disabled both `cacheComponents` and `experimental.useCache`;
  application source had no cache directive or `next/cache` import.
- `.github/workflows/deploy-production-release.yml` and `scripts/deploy-app.sh`
  package and upload `out/` to S3/CloudFront. They do not deploy a Next server.
- `docker/Dockerfile` copies `out/` into the final Caddy image. Its entrypoint
  runs Caddy and PocketBase; Next runs only in the separate build stage.
- Server Components such as `app/layout.tsx` execute at build time for this
  export. Static RSC navigation payloads do not establish a network-accessible
  Cache Components execution path. Local `next dev` runs a server, but the
  affected cache feature and functions were absent.

The owner subsequently authorized following the
[upstream upgrade recommendation](https://nextjs.org/blog/nextjs-security-update-october-14-2026),
which applies even without similar cached functions. The workspace now pins
and resolves both `next` and `eslint-config-next` to **`16.4.1`**, the smallest
published patched Next release for this advisory. The regenerated Bun lockfile
changes only twelve Next-related package records; all 889 unrelated records
and pre-existing Stagehand/Playwright manifest edits were preserved. Root React
remains `19.3.0`. The existing build-configuration regression guard now requires
Next `16.4.1` or later and an exactly aligned eslint-config-next release.

This is a local dependency remediation, not proof of deployed exposure or
Aikido resolution. No runtime configuration, CSP, test suppression, audit
exception, credential, or security setting was changed. No production probe,
deployment, or Aikido re-scan was performed. The latest 2026-10-22 upgrade entry
in `tasks/todo.md` records verification and remaining release blockers.

The subsequent authorized browser-test repair uses a dedicated `build:e2e`
backend override allowed by the unchanged production CSP and a disposable
macOS Firefox app-data home. The exact staged PR snapshot passed all 352
executable export-browser cases; two existing native-clipboard cases remain
skipped. This resolves the local feedback/CSP and Firefox validation blockers,
without establishing deployment or Aikido clearance.

### Full Audit: 2026-08-10

- ✅ `bun audit --audit-level=high` reports no known vulnerabilities
- ✅ Dependency licenses are fail-closed and a CycloneDX SBOM is produced in CI
- ✅ PocketBase 0.39.10 upgrade and encryption cleanup paths are system-tested
- ✅ OAuth authentication uses PocketBase built-in providers
- ✅ Owner immutability and row-level task scoping are regression-tested
- ✅ Full-history Gitleaks runs as a blocking, baseline-aware gate

Since that audit, the Docker image and the system test moved to PocketBase
0.40.4 (`docker/Dockerfile`). The audit command now reports the accepted
`braces` advisory listed under Known Trade-offs.

### Known Trade-offs (Documented)

1. **Auth Token in localStorage**: PocketBase SDK stores auth tokens in localStorage via its built-in `authStore`. Mitigated by React XSS protection, CSP headers, and HTTPS-only communication.

2. **Expired token retained in shared Git history**: Commit `e9230cb` contains
   an expired PocketBase JWT and associated identity claims. `.gitleaksignore`
   lists the same `jwt` entries under commit `f3e5edf`, so a rewrite must cover
   both. The current tree
   does not contain the credential, and blocking full-history Gitleaks scans
   allow only the committed content-free fingerprints in `.gitleaksignore`.
   Removing the historical object requires a coordinated history rewrite and
   force-push, which can invalidate collaborators' clones and open branches;
   that destructive operation is a separately approved manual gate. Until
   then, the exception must not be broadened, the old files must not be
   restored, and any evidence that the credential is usable must be handled as
   an incident rather than as an allowlist update.

3. **Accepted dev-only advisory**: `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm) has no
   patched release. It reaches this repo only through `eslint-config-next`,
   which never passes it a pattern, and it doesn't ship in the static export.
   `scripts/check-audit-results.cjs` accepts it at High severity until
   2027-01-05. A higher severity or a passed expiry date blocks it again until
   someone re-reviews it. The workflow also audits production dependencies
   with no exceptions, so the gate fails if `braces` ever reaches runtime code.

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [AWS CloudFront Security](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-response-headers.html)
