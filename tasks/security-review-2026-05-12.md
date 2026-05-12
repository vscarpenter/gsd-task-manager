# Security Review — May 2026 (Post-Inkwell)

**Date:** 2026-05-12
**Reviewer:** Claude Opus 4.7 (7-agent parallel audit + advisor reconcile)
**Scope:** Full codebase since commit `e69591e` (May 6 security fix). Covers new Inkwell design system (#266), bookmarklet share-capture (#264), and current state of every attack surface.
**Baseline:** All 10 findings from `security-review-may2026.md` confirmed fixed and intact.

---

## Executive Summary

| Severity | Count | Notes |
|---|---|---|
| Critical | 0 | |
| High (P1) | 7 | Includes 7 high-severity CVEs in `next` (single dep bump) |
| Medium (P2) | 8 | |
| Low (P3) | 9 | |
| Informational | 4 | Accepted trade-offs / verification clears |

The audit found **no critical vulnerabilities** and **no XSS sinks** in the application. All identified High items are either dependency CVEs (mechanical fix), MCP setup flow gaps that leak the auth token to the user's own terminal (no remote attacker required), or sync-layer privacy regressions on shared devices.

---

## P1 · High — Fix Before Next Release

### P1-3 · MCP setup wizard echoes the auth token to stdout in plaintext

**File:** `packages/mcp-server/src/cli/setup-wizard.ts:88-102`

After `promptPassword` collects the token, the wizard prints the full JSON config block — including `GSD_AUTH_TOKEN` in plaintext — to stdout so the user can paste it into Claude Desktop config. The token then lives in terminal scrollback, in `script`/`tmux` logs, in any screen-share/screen-recording of the setup flow, and in `bash` history if redirected. The PocketBase token grants 14–30 days of full read/write/delete access to all of the user's tasks.

**Fix:** Write the config snippet to `~/.gsd-mcp-setup.json` with `chmod 600` and tell the user to copy it. Or display the JSON with the token field redacted plus a separate "token is N chars, starts with X…" verification line.

---

### P1-4 · MCP `promptPassword` does not actually suppress echo

**File:** `packages/mcp-server/src/cli/index.ts:137`

```ts
const originalMode = stdin.isTTY && stdin.setRawMode ? stdin.setRawMode(false) : null;
```

`setRawMode(false)` puts stdin into **cooked mode**, which is the mode that echoes characters as the user types. The comment claiming this disables echo is incorrect about Node.js TTY behavior. `rl.question()` does not suppress echo on its own. Combined with P1-3, the token is exposed twice in the same setup session.

**Fix:** Replace with a real hidden-input implementation:
```ts
stdin.setRawMode(true);
// then handle keypresses manually, print '*' (or nothing), break on '\r'
```
Or add `@inquirer/prompts` and use its `type: 'password'` input.

---

### P1-5 · `next@16.2.3` has 7 high-severity CVEs

**File:** `package.json:44`

`bun audit` reports SSRF, DoS, and middleware-bypass advisories for the pinned version. Even though this app is a static export (no server runtime), the dev server, build process, and any contributor running `bun dev` is exposed.

**Fix:** Bump `next` to `16.2.6` (or current latest 16.2.x). Run `bun audit` after to confirm clearance.

---

### P1-6 · `hono` override is too loose; 5 advisories still apply

**File:** `package.json:overrides`

```jsonc
"hono": ">=4.12.14"   // still vulnerable
```

Current resolution does not pull in the patch for JWT date-validation and cache-leak advisories.

**Fix:** Tighten the override to `">=4.12.18"` (or latest 4.12.x). Run `bun install && bun audit`.

---

### P1-7 · OAuth provider has no runtime whitelist

**File:** `lib/sync/pb-auth.ts:30-34`

```ts
export async function loginWithProvider(provider: OAuthProvider): Promise<AuthState> {
  const authData = await pb.collection('users').authWithOAuth2({ provider });
```

`OAuthProvider` is a TypeScript type — erased at runtime. Any caller (XSS payload, future feature regression, console invocation) can pass an arbitrary provider string. The PocketBase server may have additional providers configured.

**Fix:**
```ts
const ALLOWED_PROVIDERS = new Set<OAuthProvider>(['google', 'github']);
if (!ALLOWED_PROVIDERS.has(provider)) {
  throw new Error(`OAuth provider not allowed: ${provider}`);
}
```

---

### P1-8 · Sync history retained across logout (privacy leak on shared device)

**File:** `lib/sync/config/disable.ts:31-51`

`disableSync()` clears the sync queue and auth state but never touches `db.syncHistory`. After logout, the next user on the same browser sees up to 100 prior sync entries — timestamps, device IDs, push/pull counts, and error messages (which may contain task IDs via `recordAttemptFailure`). Important for self-hosted/kiosk deployments.

**Fix:** Add to `resetSyncConfigState`:
```ts
const { clearHistory } = await import('@/lib/sync-history');
await clearHistory();
```

---

### P1-9 · Missing Cross-Origin-Opener-Policy for OAuth popup

**File:** `docker/Caddyfile:24-32` (and CloudFront Response Headers Policy, not in repo)

OAuth uses popup-based flow. Without `Cross-Origin-Opener-Policy: same-origin-allow-popups`, the popup retains a `window.opener` reference vulnerable to tabnabbing and cross-origin manipulation.

**Fix:**
```caddy
header {
    # ...existing headers
    Cross-Origin-Opener-Policy "same-origin-allow-popups"
    Cross-Origin-Resource-Policy "same-origin"
}
```
Skip COEP — it would break OAuth popup `postMessage`. Apply equivalent change in the CloudFront policy.

---

### P1-10 · MCP `pocketBaseUrl` validator uses `startsWith` — bypassable

**File:** `packages/mcp-server/src/server/config.ts:11-14`

```ts
url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
```

`http://localhost.attacker.com` and `http://127.0.0.1.attacker.com` (DNS-resolvable on public infra) both pass the prefix check. If a user is tricked into setting `GSD_POCKETBASE_URL` to such a value, the auth token and all task content exfiltrates on every tool call.

**Fix:**
```ts
.refine((u) => {
  const parsed = new URL(u);
  if (parsed.protocol === 'https:') return true;
  return parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
}, { message: 'PocketBase URL must use HTTPS (except localhost for local dev)' })
```

---

## P2 · Medium

### P2-7 · Logger sanitizer misses `jwt`, `refresh`, `access`, `bearer` patterns

**File:** `lib/logger.ts:136`

`sensitivePatterns` covers `token`, `password`, `secret`, `apiKey`, `authorization`, `cookie` — but a metadata key named `jwt`, `refreshToken`, `accessToken`, or `bearerToken` would pass through. Recursion and case-insensitive matching are correct; only the keyword list is incomplete.

**Fix:** Add `'jwt'`, `'refresh'`, `'access'`, `'bearer'` to the array. Verify with a test case.

---

### P2-8 · Sync queue persists raw error messages with task content

**File:** `lib/sync/queue.ts:102-131` (writer), `lib/sync/pb-push.ts:115` (source)

`recordAttemptFailure` writes `error.message` directly into `db.syncQueue.lastError` up to 500 chars. PocketBase 4xx responses echo the request payload back (e.g. validation messages including field values), so task titles/descriptions can land in the persisted error field.

**Fix:** Replace raw `error.message` with the categorized code from `error-categorizer.ts` (e.g. `'validation_failed'`, `'unauthorized'`, `'rate_limited'`).

---

### P2-9 · Echo filter fails closed if `currentDeviceId` is null

**File:** `lib/sync/pb-realtime.ts:66`, `lib/sync/pb-sync-helpers.ts:49`

If the realtime subscription opens before `currentDeviceId` is set (race during cold start), and a remote record has empty/null `device_id` (legacy data), the strict-equality check filters all events as echoes, silently breaking realtime sync.

**Fix:**
```ts
if (record.device_id && currentDeviceId && record.device_id === currentDeviceId) {
  // skip own-device echo
}
```
Also assert `currentDeviceId` is non-null before calling `subscribe`.

---

### P2-10 · No max-retry cap on user-triggered sync (429 amplification)

**File:** `lib/sync/retry-manager.ts:71-78`, `lib/sync/sync-coordinator.ts:58-72`

`shouldRetry()` blocks auto-sync after `MAX_RETRIES`, but user-triggered syncs bypass that gate. A 429-flapping server lets a user retry repeatedly, each attempt running a full queue push at 100ms throttle.

**Fix:** Detect HTTP 429 in `pb-push.ts`, parse `Retry-After`, abort the push loop early. Apply the auto-sync retry cap to user-triggered syncs after N consecutive 429s.

---

### P2-11 · `bulk_update_tasks` accepts caller-supplied `maxTasks` and has no dry-run default for deletes

**File:** `packages/mcp-server/src/write-ops/bulk-operations.ts:82`, `packages/mcp-server/src/tools/handlers/input-schemas.ts:148-155`

`maxTasks` is an open positive integer in the input schema. `bulkUpdateTasks` uses `options?.maxTasks ?? 50` as the ceiling — the caller (LLM) controls the limit it would be compared against. The 50-id Zod cap on `taskIds` saves the day today, but the design puts the policy ceiling in the wrong place. Additionally, destructive `operation.type === 'delete'` has no `dryRun: true` default, so a confused LLM call can wipe up to 50 tasks per invocation with no preview.

**Fix:**
1. Remove `maxTasks` from the tool input schema; make it a server-side constant.
2. Default `dryRun: true` for deletes; require explicit `dryRun: false` to actually delete.
3. Cap deletes at 10 per call.

---

### P2-12 · WebMCP `create_task` schema missing `maxItems` on tags and `additionalProperties: false`

**File:** `components/webmcp-register.tsx:68-72`

```ts
tags: { type: "array", items: { type: "string", minLength: 1, maxLength: 32 } }
// no maxItems
// inputSchema lacks additionalProperties: false at root
```

The Zod schema in `createTask()` enforces `MAX_TAGS = 20`, but the WebMCP JSON Schema doesn't declare it. AI will generate >20 tags and hit a Zod error instead of a clear schema constraint. Same pattern as P3-4 in the previous review.

**Fix:** Add `maxItems: SCHEMA_LIMITS.MAX_TAGS` and `additionalProperties: false` to `inputSchema`.

---

### P2-13 · CloudFront Response Headers Policy not in version control (drift risk)

**File:** `cloudfront-function-response-headers.cjs:18-20` (references external `gsd-security-headers` policy)

The authoritative production CSP/HSTS/etc. lives in an AWS-managed Response Headers Policy that is not in the repo and not deployed by `scripts/deploy-cloudfront-function.sh`. No mechanism exists to diff CloudFront's live policy against the Caddyfile or `SECURITY.md` to detect drift.

**Fix:** Codify in `deploy-cloudfront-function.sh` via `aws cloudfront create-response-headers-policy --response-headers-policy-config file://...`, or move to CDK/Terraform. Add a CI assertion comparing the two configurations.

---

### P2-14 · Docker `POCKETBASE_VERSION` lags client SDK

**File:** `docker/Dockerfile:28`

`ARG POCKETBASE_VERSION=0.26.1` while the client SDK in `package.json` is `0.26.8` (and 0.26.9 is available). Patch-level drift can produce subtle auth/realtime bugs in self-hosted deployments.

**Fix:** Bump to `0.26.9`. Verify against PocketBase changelog. Also update `docker/README.md` and `docker/docker-setup-and-run.md` examples that still show `0.25.6`.

---

## P3 · Low

### P3-6 · `device_id` not validated on inbound realtime records

`lib/sync/pb-realtime.ts:66-92` — Zod schema should include `device_id: z.string()`.

### P3-7 · `import-dialog.tsx` re-parses JSON without size guard

`components/import-dialog.tsx:26-37` — practical exposure is small (caller `settings-page` enforces 10MB) but the dialog is a public component with no documented precondition. Call `importPayloadSchema.safeParse` (or `Array.isArray(parsed.tasks)`) before reading `.length`.

### P3-8 · `getDescriptionSegments` no defensive length cap

`lib/task-description.tsx` (`getDescriptionSegments`) — Zod bounds the field at `TASK_DESCRIPTION_MAX_LENGTH`, but a defensive `description.slice(0, MAX)` at the top of the segmenter protects against any future bypass.

### P3-9 · CloudFront URL rewrite: no `..` / control-char validation

`cloudfront-function-url-rewrite.cjs:25-29` — defensive validation is cheap. Reject URIs containing `\r`, `\n`, `\0`, or `..` before appending `/index.html`.

### P3-10 · `Permissions-Policy` underspecified

`docker/Caddyfile:29` — locks 4 directives; should also disable `usb, serial, hid, bluetooth, accelerometer, gyroscope, magnetometer, midi, browsing-topics, interest-cohort, display-capture, encrypted-media, autoplay`.

### P3-11 · MCP error messages echo full PocketBase URL

`packages/mcp-server/src/api/client.ts:52-60`, `tools/list-tasks.ts:72-80` — for users with private self-hosted PocketBase URLs, errors leak the host verbatim. If MCP error output is ever forwarded outside the user's machine (shared chat logs), the URL is disclosed. Redact host in user-facing error strings.

### P3-12 · Caddy `-X-Powered-By` header not stripped

`docker/Caddyfile:31` — Caddy strips `Server` but upstream PocketBase may add `X-Powered-By`. Cosmetic; add `-X-Powered-By` to the header block.

### P3-13 · Service worker SPA fallback returns `/` for any failed path

`public/sw.js:96-108` — acceptable for this app (no sensitive paths), flagged only for future codebase reuse.

### P3-14 · Service worker network-first HTML cache lacks `response.type === 'basic'` check

`public/sw.js:81-93` — opaque/cors HTML cannot currently reach this path (sw skips cross-origin on line 62), so this is defensive hardening only.

---

## Informational — Verified Clean

- **No XSS sinks anywhere.** No raw-HTML injection sinks, no `eval`, no dynamic `Function()` constructor, no string-form `setTimeout`, no `srcDoc`, no `javascript:` href injection. URL allowlist (`sanitizeHttpUrl`) is consistently applied in `task-links.ts`, `share-capture.ts`, `capture-parser.ts`. The bookmarklet feature (#264) uses the existing allowlist correctly. Double-filtered: capture-time and render-time.
- **No prototype pollution vector.** Every `JSON.parse` user-input path is wrapped by `importPayloadSchema.safeParse`. Zod produces a fresh object graph; spread operators in `regenerateConflictingIds` operate on already-validated records.
- **No ReDoS.** All regexes (`URL_CANDIDATE_PATTERN`, tag/bang/star matchers) use single negated-character-class repetitions with no nested quantifiers.
- **No shell-command injection in the MCP server.** No subprocess invocations, no `eval`, no dynamic `require` paths. The single `node:readline` import is a static module specifier.
- **Owner enforcement is sound.** PocketBase API rules (`scripts/setup-pocketbase-collections.sh:49-53`) enforce `owner = @request.auth.id` on every operation. `taskRecordToPocketBase` writes `owner` from `getCurrentUserId()`, not from the local record. Forged owners on JSON import cannot bypass the server check.
- **No secrets in working tree.** `.env.local` is gitignored; sample data files contain only fictional content.

---

## Findings the audit considered but did NOT carry forward

These were raised by individual sub-agents but rejected after verification or as out-of-scope per architecture:

- **Caddyfile `connect-src 'self'`** — intentional for the documented single-origin Docker/Caddy setup. Not a vulnerability.
- **SW HTML cache lifetime** — static-export HTML has no per-user data. Informational only (covered as P3-14 defensive note).
- **SPA fallback to `/`** — acceptable for this app.
- **gitleaks historic JWT** — `exp 2025-10-22` (already expired). PII (email in payload) is the only residual concern, and the working tree is clean. Decision logged below; no code change.

---

## Open Decision: Historic JWT in Git History

A `gitleaks-report.json` from October 2025 flagged a real JWT for `vscarpenter@gmail.com` in commit `f3e5edf`. The token is expired (`exp 2025-10-22`); the working tree is clean (file was renamed to `.example`). Three options:

1. **Accept and document** — add an allowlist entry to `.gitleaksignore` documenting the expired token. Lowest effort, residual: email PII in git history.
2. **Rewrite history** with `git filter-repo` — removes the expired token and 34 other historical findings, but rewrites every commit hash after `f3e5edf`. High coordination cost (every clone needs to re-clone). Recommended only if there's a separate reason to rewrite (e.g. a never-expired credential).
3. **Public-disclosure note in `SECURITY.md`** — acknowledge the history publicly with a date and an "expired, no action needed" line.

Recommended: **Option 1**. Token is expired; PII risk is acceptable for a public personal repo where the maintainer's email is already in `git log` author headers.

---

## Remediation Plan (Tranches)

Suggested order and grouping. Each tranche is a self-contained PR with its own test pass.

### Tranche 1 — Dependencies & Logger (no behavioral risk)
- P1-5: Bump `next` to `16.2.6`
- P1-6: Tighten `hono` override to `>=4.12.18`
- P2-14: Bump Docker `POCKETBASE_VERSION` to `0.26.9`
- P2-7: Add `jwt|refresh|access|bearer` to `lib/logger.ts` sensitive patterns + test

**Risk:** very low. Run `bun audit`, `bun typecheck`, `bun lint`, `bun run test`. Build verifies static export.

### Tranche 2 — MCP Server (single package, well-tested surface)
- P1-3: Setup wizard writes config file with `chmod 600` instead of stdout
- P1-4: Real hidden-input password prompt
- P1-10: Hostname pinning (`URL.hostname` exact match for localhost)
- P2-11: Remove caller-supplied `maxTasks`; default `dryRun: true` for deletes; delete cap = 10
- P3-11: Redact PB URL in user-facing MCP errors

**Risk:** isolated to `packages/mcp-server`. Add tests for the new validators.

### Tranche 3 — Sync Layer (behavioral changes — needs thorough testing)
- P1-7: OAuth provider runtime whitelist (`Set<OAuthProvider>`)
- P1-8: Clear `syncHistory` on logout
- P2-8: Replace raw `error.message` with categorized codes in sync queue
- P2-9: Strengthen echo filter against null/empty `device_id`
- P2-10: 429 handling — parse `Retry-After`, cap user-triggered retries
- P3-6: Add `device_id: z.string()` to inbound Zod schema

**Risk:** highest. OAuth flow change especially needs a manual end-to-end test with Google and GitHub. The error-message change has a downstream user-facing impact on sync history display.

### Tranche 4 — Headers & Infrastructure
- P1-9: Add COOP/CORP to `docker/Caddyfile` and CloudFront policy
- P2-13: Codify CloudFront Response Headers Policy in deploy script (or CDK)
- P3-9: CloudFront URL rewrite path validation
- P3-10: Expand `Permissions-Policy` directives
- P3-12: Strip `X-Powered-By`

**Risk:** changes touch deployment infrastructure. COOP needs a real OAuth popup test post-deploy.

### Tranche 5 — Defensive Hardening (P3 cleanups; bundle as one)
- P2-12: WebMCP `maxItems` + `additionalProperties: false`
- P3-7: Validate JSON shape in `import-dialog.tsx` before reading `.length`
- P3-8: Defensive `slice` in `getDescriptionSegments`
- P3-13, P3-14: SW comments / documentation

**Risk:** low.

---

## Validation Commands

```bash
bun audit                       # zero high after Tranche 1
bun typecheck                   # passes after every tranche
bun lint                        # passes after every tranche
bun run test                    # full suite + new tests for each tranche
bun run build                   # static export builds clean
cd packages/mcp-server && bun audit   # zero high
```

Manual verification after Tranche 3: OAuth login with Google AND GitHub from a clean browser profile. Manual verification after Tranche 4: confirm CSP/COOP headers in deployed environment using `curl -I`.

---

## Acknowledgments

7 parallel sub-agents covered: prior-finding verification, XSS surface, MCP server, sync/auth, headers/deployment, import/export parsing, and dependencies/secrets. Advisor reconciliation flagged 3 findings to downgrade (kept here as informational rejects) and 2 to verify before treating as High (both confirmed real after direct file inspection).
