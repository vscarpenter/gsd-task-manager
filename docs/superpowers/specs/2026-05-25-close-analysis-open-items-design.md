# Close Remaining Codebase Analysis Open Items

**Date:** 2026-05-25
**Status:** Approved
**Deciders:** Vinny Carpenter

## Goal

Close the 4 remaining open items from the May 25, 2026 codebase analysis report. Deliver as 3 focused PRs, each independently reviewable and shippable.

Note: Item 2 from the original report (realtime handler try/catch) was found to already be fixed in `pb-realtime.ts:110-118`.

## Constraints

- TDD workflow: failing test first, then implementation
- Each PR ≤ 400 lines of non-generated code
- Coverage for changed files ≥ 80%
- No new `any` types without justification
- Sentry must be a no-op when `NEXT_PUBLIC_SENTRY_DSN` is not set (local dev, self-hosted without Sentry)

## Anti-Goals

- No server-side Sentry config (this is a static export PWA)
- No Sentry session replay (privacy-first app)
- No changes to the sync engine logic
- No refactoring beyond what's needed for these 3 items

---

## PR 1: Migrate `.parse()` to `.safeParse()`

### Inputs / Outputs

| Call Site | Input | Current Behavior | New Behavior |
|-----------|-------|-----------------|--------------|
| `lib/tasks/crud/update.ts:28` | `TaskDraft` object | Throws `ZodError` on invalid | Returns validation result; throws typed error with field details |
| `lib/notifications/settings.ts:33` | `NotificationSettings` from DB | Throws `ZodError` on corrupt record | Returns default settings on failure (self-healing) |
| `lib/notifications/settings.ts:53` | Merged `NotificationSettings` | Throws `ZodError` on invalid | Returns validation result; throws typed error |

### Edge Cases

- Corrupt notification settings record in IndexedDB (e.g., from a prior schema version) — should self-heal to defaults, not crash
- Partial task update with invalid field values — should surface which fields failed validation
- Empty/null fields that have Zod defaults — `.safeParse()` should still apply defaults correctly

### Acceptance Criteria

- [ ] All 3 `.parse()` calls replaced with `.safeParse()`
- [ ] `updateTask()` with invalid draft returns a descriptive error mentioning failed fields
- [ ] `getNotificationSettings()` with corrupt DB record returns default settings and logs a warning
- [ ] `updateNotificationSettings()` with invalid input throws with a clear message
- [ ] Existing tests still pass
- [ ] New negative-case tests for each call site
- [ ] Zero `ZodError` exceptions can reach the error boundary from these paths

### Test Stubs

```
should return validation error with field details when task draft is invalid
should update task successfully when draft is valid (existing test, verify still passes)
should return default settings when stored settings are corrupt
should log warning when stored settings fail validation
should throw descriptive error when notification settings update is invalid
should save valid notification settings successfully (existing test, verify still passes)
```

---

## PR 2: Add Global `unhandledrejection` Listener

### Inputs / Outputs

| Signal | Source | Current Behavior | New Behavior |
|--------|--------|-----------------|--------------|
| `unhandledrejection` event | Any uncaught async error | Silent failure | Logged via `createLogger('GLOBAL_ERROR')` + `toast.error()` shown to user |

### Architecture

New component: `components/global-error-listener.tsx`
- `"use client"` component
- Registers handler in `useEffect`, cleans up on unmount
- Calls `event.preventDefault()` to suppress browser default console error
- Logs structured error with `createLogger('GLOBAL_ERROR')`
- Shows `toast.error('An unexpected error occurred')` for user visibility
- Renders `null` (no DOM output)

Mounted in `app/layout.tsx` alongside other global components (`PwaRegister`, `InstallPwaPrompt`, etc.).

### Edge Cases

- Multiple rapid unhandled rejections — debounce toast to avoid flooding the UI
- Non-Error rejection values (strings, objects, undefined) — handle gracefully
- Component unmounts before handler fires — cleanup prevents memory leak

### Acceptance Criteria

- [ ] `GlobalErrorListener` component created and mounted in layout
- [ ] Unhandled promise rejections are logged with structured context
- [ ] User sees a toast notification for unhandled errors
- [ ] Rapid successive errors don't flood the toast queue (debounce/throttle)
- [ ] Non-Error rejection values (string, object, undefined) are handled without crashing
- [ ] Handler is cleaned up on unmount
- [ ] Component renders null (no DOM output)

### Test Stubs

```
should log unhandled promise rejection with error details
should show toast.error for unhandled rejection
should handle non-Error rejection values (string, object, undefined)
should throttle rapid successive rejections
should clean up event listener on unmount
should render nothing (null)
```

---

## PR 3: Sentry Integration (Free Tier)

### Inputs / Outputs

| Integration Point | Current | New |
|-------------------|---------|-----|
| `lib/error-logger.ts:47` | `console.error()` only | `Sentry.captureException()` + console |
| `components/error-boundary.tsx:30` | `logger.error()` only | `logger.error()` + `Sentry.captureException()` |
| `components/global-error-listener.tsx` | `logger.error()` + toast | `logger.error()` + toast + `Sentry.captureException()` |
| Environment | No DSN | `NEXT_PUBLIC_SENTRY_DSN` env var |

### Architecture

**New file: `lib/sentry.ts`**
- Initializes `@sentry/browser` browser SDK
- Configuration:
  - `dsn`: from `NEXT_PUBLIC_SENTRY_DSN`
  - `environment`: from `ENV_CONFIG.environment`
  - `tracesSampleRate`: `0.1` (10% of transactions)
  - `replaysSessionSampleRate`: `0` (disabled — privacy-first)
  - `replaysOnErrorSampleRate`: `0` (disabled — privacy-first)
  - `enabled`: `Boolean(dsn)` — graceful no-op when DSN not set
- Exports `captureException(error, context?)` wrapper that checks initialization
- Exports `isInitialized()` for conditional use

**Updated files:**
- `lib/error-logger.ts` — import and call `captureException` in the production branch
- `components/error-boundary.tsx` — add `captureException` in `componentDidCatch`
- `components/global-error-listener.tsx` — add `captureException` in rejection handler
- `.env.example` — add `NEXT_PUBLIC_SENTRY_DSN=` placeholder with comment

### Edge Cases

- No DSN set (local dev, self-hosted without Sentry) — all Sentry calls are no-ops
- Sentry SDK fails to load (network issues, CSP blocks) — app continues normally
- CSP `connect-src` — `layout.tsx` already allows `https:` which covers Sentry's ingest endpoint

### Acceptance Criteria

- [ ] `@sentry/browser` installed as production dependency
- [ ] `lib/sentry.ts` initializes Sentry only when DSN is present
- [ ] `captureException` called in `error-logger.ts` production path
- [ ] `captureException` called in `ErrorBoundary.componentDidCatch`
- [ ] `captureException` called in `GlobalErrorListener` rejection handler
- [ ] App functions normally with no DSN set (no errors, no console warnings)
- [ ] `.env.example` documents the new env var
- [ ] All Sentry imports are dynamic or behind initialization check (no crash if SDK fails)

### Test Stubs

```
should initialize Sentry when DSN is provided
should not initialize Sentry when DSN is empty
should call Sentry.captureException in error-logger production path
should not call Sentry when not initialized
should call captureException in ErrorBoundary componentDidCatch
should call captureException in global error listener
should handle Sentry SDK load failure gracefully
```

---

## Out of Scope

- Server-side Sentry configuration (static export PWA, no Node.js runtime)
- Sentry session replay (privacy-first — no screen recording)
- Sentry performance monitoring beyond basic `tracesSampleRate`
- Changes to sync engine error handling (already robust)
- Hard-coded PocketBase URL changes (already mitigated — `env-config.ts` falls back to `window.location.origin` for unknown hosts; the `KNOWN_REMOTE_POCKETBASE_HOSTS` map is intentional for known deployments)
- Source map upload to Sentry (can be added later as a CI step)

## Ordering

PRs should be merged in order: PR 1 → PR 2 → PR 3 (PR 3 depends on the `GlobalErrorListener` from PR 2).
