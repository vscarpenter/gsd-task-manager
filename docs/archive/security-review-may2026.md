# Security Review — May 2026

**Date:** 2026-05-06
**Reviewer:** GitHub Copilot (automated + manual analysis)
**Scope:** Full codebase review — auth, sync, data import/export, schema validation, service worker, CSP headers, Docker/Caddy configuration, MCP server, and logging.

---

## Status of Prior Findings (April 2026)

| Prior # | Issue | Status |
|---------|-------|--------|
| #1 | Hard-coded PocketBase URL fallback leaks data | ❌ **Still open** — see P1-1 |
| #2 | Merge-import sync queue uses stale IDs | ✅ **Fixed** — `tasksEnqueuedForSync` now correctly uses post-remap `tasksToImport` |
| #3 | Notification/snooze state not preserved across sync | ❌ **Still open** — see P2-3 |
| #4 | Duplicate task sync defaults to `enabled ?? true` | ✅ **Fixed** — now correctly `?? false` |
| #5 | Dockerfile references wrong build script name | ✅ **Fixed** — correctly uses `scripts/generate-build-info.cjs` |

---

## New Findings

---

### P1 · High — Fix Before Next Deploy

---

#### P1-1 · Hard-coded PocketBase URL fallback leaks data for self-hosted deployments

**Files:**
- `lib/env-config.ts:21-24` — `KNOWN_REMOTE_POCKETBASE_HOSTS` map
- `lib/env-config.ts:64` — fallback `'https://api.vinny.io'`

**Issue:**
`resolvePocketBaseUrl()` falls through to a hard-coded `https://api.vinny.io` for any non-local, non-whitelisted hostname:

```ts
// lib/env-config.ts
const KNOWN_REMOTE_POCKETBASE_HOSTS = new Map<string, string>([
  ['gsd.vinny.dev', 'https://api.vinny.io'],
  ['gsd-dev.vinny.dev', 'https://api.vinny.io'],
]);

// …falls through to:
return environment === 'development'
  ? 'http://127.0.0.1:8090'
  : 'https://api.vinny.io';   // ← hard-coded third-party server
```

Any fork, white-label deployment, or self-hosted instance on a custom domain will silently direct OAuth tokens and all synced task data to the author's production PocketBase server — without any warning to the operator or user.

**Risk:** Privacy leak and unintended data exfiltration for self-hosted deployments. OAuth tokens sent to the wrong server grant an attacker read/write access to the user's tasks.

**Recommended fix:**
1. Remove the hard-coded `api.vinny.io` production fallback.
2. For unknown non-local hostnames, fall back to `window.location.origin` (correct for the documented single-origin Docker/Caddy setup).
3. Optionally: if `NEXT_PUBLIC_POCKETBASE_URL` is not set and the hostname is unknown, log a visible console warning so self-hosted operators know sync is unconfigured.

```ts
// Suggested replacement for the unknown-hostname fallback:
return environment === 'development'
  ? 'http://127.0.0.1:8090'
  : window.location.origin;  // safe for single-origin deployments
```

---

#### P1-2 · Missing Content-Security-Policy in self-hosted Caddyfile

**File:** `docker/Caddyfile`

**Issue:**
The Caddyfile sets six security headers but omits `Content-Security-Policy`:

```caddy
header {
    X-Content-Type-Options    "nosniff"
    X-Frame-Options           "DENY"
    Referrer-Policy           "strict-origin-when-cross-origin"
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    Permissions-Policy        "geolocation=(), microphone=(), camera=(), payment=()"
    X-XSS-Protection          "1; mode=block"
    -Server
    # ← Content-Security-Policy is absent
}
```

`SECURITY.md` documents a production CSP but it is never applied in the self-hosted path. Without a CSP, any injected or third-party script can freely read `localStorage` and steal the PocketBase JWT that the SDK stores there. `X-XSS-Protection` is a deprecated IE-era header that modern browsers ignore; CSP is the current standard defence.

**Risk:** Any successful XSS in the self-hosted deployment (even via a browser extension or injected ad) can exfiltrate the auth token with no browser-level mitigation.

**Recommended fix:**
Add the production CSP from `SECURITY.md` to the Caddyfile:

```caddy
header {
    # … existing headers …
    Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.vinny.io https://accounts.google.com https://github.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com https://github.com;"
}
```

Adjust `connect-src` to match the PocketBase host set in the Docker environment.

---

### P2 · Medium

---

#### P2-1 · No file size limit on JSON import

**Files:**
- `components/settings-page/index.tsx:176`
- `components/settings/settings-dialog.tsx:119-122`

**Issue:**
Both import code paths call `file.text()` immediately after the user selects a file, with no size check:

```ts
// components/settings-page/index.tsx
const file = (event.target as HTMLInputElement).files?.[0];
if (!file) return;
const contents = await file.text();   // ← no size guard
JSON.parse(contents);
```

A file that is hundreds of megabytes (or gigabytes) will be read entirely into memory before any validation runs. On desktop this causes a janky tab; on iOS PWA, where memory budgets are tight, it silently crashes the tab and loses unsaved state.

**Risk:** Denial-of-service against the user's own browser session. A malicious actor could craft a large "export" file and socially-engineer a victim into importing it.

**Recommended fix:**
Reject files above a reasonable limit before reading:

```ts
const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB

if (file.size > MAX_IMPORT_BYTES) {
  toast.error(`Import file is too large (max 10 MB). Selected file: ${(file.size / 1024 / 1024).toFixed(1)} MB`);
  return;
}
const contents = await file.text();
```

Apply the check in both `settings-page/index.tsx` and `settings/settings-dialog.tsx`.

---

#### P2-2 · Unbounded array fields in Zod schema

**File:** `lib/schema.ts`

**Issue:**
Four array fields in `taskDraftSchema` (and the corresponding `taskRecordImportSchema`) have no maximum length:

```ts
tags: z.array(z.string().min(1).max(SCHEMA_LIMITS.TAG_MAX_LENGTH)).default([]),
subtasks: z.array(subtaskSchema).default([]),
dependencies: z.array(z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH)).default([]),
timeEntries: z.array(timeEntrySchema).default([]),
```

A crafted import file or a malicious PocketBase record (via sync pull) can include thousands of entries in any of these fields. Each entry passes Zod validation individually, but the aggregate can:
- Freeze the React renderer (re-rendering a task card with 10,000 subtasks)
- Bloat IndexedDB to an unusable size
- Cause performance degradation across all sync operations

**Risk:** Denial-of-service against the local application via import or sync.

**Recommended fix:**
Add `.max(N)` to each array and expose the limits through `SCHEMA_LIMITS`:

```ts
// lib/constants/schema.ts additions
MAX_TAGS: 20,
MAX_SUBTASKS: 50,
MAX_DEPENDENCIES: 50,
MAX_TIME_ENTRIES: 1000,

// lib/schema.ts
tags: z.array(z.string().min(1).max(SCHEMA_LIMITS.TAG_MAX_LENGTH))
        .max(SCHEMA_LIMITS.MAX_TAGS).default([]),
subtasks: z.array(subtaskSchema).max(SCHEMA_LIMITS.MAX_SUBTASKS).default([]),
dependencies: z.array(z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH))
               .max(SCHEMA_LIMITS.MAX_DEPENDENCIES).default([]),
timeEntries: z.array(timeEntrySchema).max(SCHEMA_LIMITS.MAX_TIME_ENTRIES).default([]),
```

Apply the same limits in `taskRecordImportSchema`.

---

#### P2-3 · Notification/snooze state races across sync *(from prior review #3, still open)*

**Files:**
- `lib/sync/task-mapper.ts:103-106` — `pocketBaseToTaskRecord` sets `notificationSent: r.notification_sent`
- `lib/notification-checker.ts`
- `lib/tasks/crud/snooze.ts`

**Issue:**
`notificationSent`, `lastNotificationAt`, and `snoozedUntil` are device-local behavioural fields, but they are included in the sync schema and the pull mapper resets them from remote values on every pull. This causes:

1. **Duplicate reminders**: A notification fires on device A, sets `notificationSent = true`. Device B pulls the update and remote value resets `notificationSent = false` → notification fires again on device B.
2. **Lost snooze**: A task is snoozed on device A. An unrelated update on device B triggers a sync pull that overwrites `snoozedUntil` with the remote value (or empty string), un-snoozing the task.

**Risk:** User-facing data integrity issue; notifications become unreliable and annoying.

**Recommended fix (option A — device-local):**
Strip these three fields from `PBTaskRecord`, `pbTaskRecordSchema`, and `taskRecordToPocketBase`. The pull mapper should never touch them; keep whatever value is already in IndexedDB:

```ts
// In pocketBaseToTaskRecord, preserve existing local values instead of mapping from remote:
const existing = await db.tasks.get(r.task_id);
return {
  // … other fields from remote …
  notificationSent: existing?.notificationSent ?? false,
  lastNotificationAt: existing?.lastNotificationAt,
  snoozedUntil: existing?.snoozedUntil,
};
```

**Recommended fix (option B — shared state):**
Add `notification_sent`, `last_notification_at`, and `snoozed_until` to the PocketBase `tasks` collection schema. Already done in `taskRecordToPocketBase` (they are sent up). The gap is only on the pull side.

---

### P3 · Low

---

#### P3-1 · `exportTasks()` uses `.parse()` which throws on corrupt records

**File:** `lib/tasks/import-export.ts:13`

**Issue:**

```ts
const normalized = tasks.map((task) => taskRecordSchema.parse(task));
```

`taskRecordSchema.parse()` throws a `ZodError` if any single task in IndexedDB has invalid or legacy data. This aborts the entire export silently — the user sees a generic error toast and loses all their data. The project's own coding standards require `.safeParse()` on all user-data paths.

**Recommended fix:**

```ts
const normalized: TaskRecord[] = [];
for (const task of tasks) {
  const result = taskRecordSchema.safeParse(task);
  if (result.success) {
    normalized.push(result.data);
  } else {
    logger.warn('Skipping corrupt task during export', { taskId: task.id });
  }
}
```

---

#### P3-2 · Email recipient not validated in share dialog

**File:** `components/share-task-dialog/index.tsx:49-51`

**Issue:**
The `recipientEmail` state value is placed directly into the `mailto:` URI without any format validation:

```ts
const mailto = recipientEmail
  ? `mailto:${recipientEmail}?subject=...`
  : `mailto:?subject=...`;
```

A value like `victim@example.com?bcc=other@example.com` or a value containing newlines produces a malformed URI that some mail clients may misinterpret. Low severity because only the user themselves enters this value — but it violates the "validate all user input" standard and can produce confusing results.

**Recommended fix:**
Validate the email with a basic pattern before constructing the URI:

```ts
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const handleOpenEmailClient = () => {
  if (recipientEmail && !isValidEmail(recipientEmail)) {
    toast.error("Please enter a valid email address");
    return;
  }
  // … rest of handler
};
```

---

#### P3-3 · Stack traces included in production console logs

**File:** `lib/logger.ts:200-210`

**Issue:**
`Logger.error()` always includes `error?.stack` in the log output regardless of environment:

```ts
const errorMetadata: LogMetadata = {
  ...metadata,
  errorType: error?.constructor.name,
  errorMessage: error?.message,
  stack: error?.stack,   // ← always included
};
```

Stack traces expose internal file paths, module names, and call chains to anyone with browser DevTools open. This is a minor disclosure risk for a client-side app, but inconsistent with the principle of minimum disclosure in production.

**Recommended fix:**

```ts
stack: process.env.NODE_ENV !== 'production' ? error?.stack : undefined,
```

---

#### P3-4 · WebMCP `create_task` schema declares `maxLength: 200` but Zod enforces 80

**File:** `components/webmcp-register.tsx:43`

**Issue:**
The JSON Schema exposed to AI model integrations via `navigator.modelContext` declares:

```ts
title: {
  type: "string",
  description: "Short, action-oriented title (e.g. 'Review PR #42').",
  minLength: 1,
  maxLength: 200,   // ← inconsistent
},
```

But `SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH` is `80`. An AI model will generate titles up to 200 characters, which then fail Zod validation at the `createTask()` call, producing a confusing error rather than a clear length constraint.

**Recommended fix:**

```ts
import { SCHEMA_LIMITS } from "@/lib/constants/schema";

// In the inputSchema:
maxLength: SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH,
```

---

#### P3-5 · Docker PocketBase binary version (0.24.4) lags JS SDK version (0.26.8)

**File:** `docker/Dockerfile:29`

**Issue:**

```dockerfile
ARG POCKETBASE_VERSION=0.24.4
```

The `pocketbase` npm package in `package.json` is `0.26.8`. PocketBase 0.26.x introduced changes to the auth API (notably the `_superusers` collection endpoint). Running the client SDK against a 0.24.x binary can cause silent authentication failures or unexpected API behaviour in the self-hosted Docker path.

**Recommended fix:**
Align the binary version with the SDK:

```dockerfile
ARG POCKETBASE_VERSION=0.26.1   # or latest 0.26.x stable
```

Verify compatibility against the PocketBase changelog before upgrading.

---

### Informational — Documented Trade-offs (No Code Change Required)

These items represent accepted architectural trade-offs that are already documented in `SECURITY.md`. No code changes are recommended.

**Auth token in `localStorage`**
The PocketBase SDK stores the JWT in `localStorage` via its built-in `AuthStore`. This is the SDK's standard behaviour. Mitigated by React's XSS protection, no `dangerouslySetInnerHTML` usage anywhere in the codebase, HTTPS-only communication, and — once P1-2 is resolved — CSP headers blocking script injection. Accepted.

**MCP server `GSD_AUTH_TOKEN` in plaintext config file**
The auth token lives in `~/Library/Application Support/Claude/claude_desktop_config.json`. No programmatic mitigation is available; the guidance in `SECURITY.md` to `chmod 600` the file is correct and sufficient. Accepted.

**Task content visible in browser console logs**
On validation failure, `lib/tasks/crud/create.ts:19` logs the full input object: `logger.error("Task validation failed", undefined, { input, ... })`. The `sanitizeMetadata()` function strips known secret-like key names (token, password, etc.) but does not deep-sanitize task content. Task titles and descriptions may appear in console output. For a client-side PWA where the user owns their browser session, this is acceptable. Accepted.

---

## Validation Baseline

Commands run during review:

```bash
bun typecheck   # passed
bun lint        # passed (5 pre-existing warnings, unchanged)
bun run test    # 16 pre-existing UI test failures (unchanged from prior audit)
```

The failing UI tests are pre-existing drift against the current UI and are not related to any finding in this review.

---

## Remediation Priority

| ID | Title | Priority | Effort |
|----|-------|----------|--------|
| P1-1 | Remove hard-coded PocketBase URL fallback | P1 | Small |
| P1-2 | Add CSP to Caddyfile | P1 | Small |
| P2-1 | Add file size limit on import | P2 | Small |
| P2-2 | Add array max-length guards in Zod schema | P2 | Small |
| P2-3 | Resolve notification/snooze sync state conflict | P2 | Medium |
| P3-1 | Replace `.parse()` with `.safeParse()` in export | P3 | Small |
| P3-2 | Validate recipient email in share dialog | P3 | Small |
| P3-3 | Strip stack traces from production logs | P3 | Trivial |
| P3-4 | Align WebMCP schema with `SCHEMA_LIMITS` | P3 | Trivial |
| P3-5 | Align Docker PocketBase binary version with SDK | P3 | Trivial |
