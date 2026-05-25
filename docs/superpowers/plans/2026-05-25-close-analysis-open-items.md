# Close Remaining Codebase Analysis Open Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 3 remaining open items from the codebase analysis report: migrate `.parse()` to `.safeParse()`, add a global `unhandledrejection` listener, and integrate `@sentry/browser` for production error tracking.

**Architecture:** Three independent PRs, merged in order. PR 1 is a pure logic change (3 call sites). PR 2 adds a new React component mounted in the root layout. PR 3 adds Sentry SDK with a thin wrapper module that wires into existing error logging infrastructure.

**Tech Stack:** TypeScript, React 19, Zod, Vitest, `@sentry/browser`, sonner (toast)

**Spec:** `docs/superpowers/specs/2026-05-25-close-analysis-open-items-design.md`

---

## File Map

### PR 1 — safeParse migration
| Action | File | Purpose |
|--------|------|---------|
| Modify | `lib/tasks/crud/update.ts` | Replace `.parse()` with `.safeParse()` |
| Modify | `lib/notifications/settings.ts` | Replace 2 `.parse()` calls with `.safeParse()` |
| Modify | `tests/data/tasks/crud.test.ts` | Add negative-case test for invalid draft |
| Modify | `tests/data/functions-branches-boost.test.ts` | Add negative-case tests for corrupt/invalid settings |

### PR 2 — Global error listener
| Action | File | Purpose |
|--------|------|---------|
| Create | `components/global-error-listener.tsx` | `unhandledrejection` handler component |
| Modify | `app/layout.tsx` | Mount `<GlobalErrorListener />` |
| Create | `tests/ui/global-error-listener.test.tsx` | Unit tests for the component |

### PR 3 — Sentry integration
| Action | File | Purpose |
|--------|------|---------|
| Create | `lib/sentry.ts` | Sentry init + `captureException` wrapper |
| Modify | `lib/error-logger.ts` | Call `captureException` in production path |
| Modify | `components/error-boundary.tsx` | Call `captureException` in `componentDidCatch` |
| Modify | `components/global-error-listener.tsx` | Call `captureException` in rejection handler |
| Modify | `.env.example` | Add `NEXT_PUBLIC_SENTRY_DSN` placeholder |
| Create | `tests/data/sentry.test.ts` | Tests for sentry wrapper module |
| Modify | `tests/data/error-logger.test.ts` | Add test for Sentry call in production path |
| Modify | `tests/ui/error-boundary.test.tsx` | Add test for Sentry call in componentDidCatch |

---

## PR 1: Migrate `.parse()` to `.safeParse()`

### Task 1: safeParse in `updateTask()`

**Files:**
- Modify: `lib/tasks/crud/update.ts:27-28`
- Modify: `tests/data/tasks/crud.test.ts` (add test after line ~278)

- [ ] **Step 1: Write failing test for invalid draft validation**

Add this test inside the `describe('updateTask', ...)` block in `tests/data/tasks/crud.test.ts`, after the "should reset notification state" test:

```typescript
    it('should throw descriptive error with field details when draft is invalid', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);

      await expect(
        updateTask('task-1', { title: '' })
      ).rejects.toThrow('Task validation failed');
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/data/tasks/crud.test.ts -t "should throw descriptive error"`

Expected: FAIL — currently `.parse()` throws a raw `ZodError` which the catch block wraps as `"Task validation failed: ..."` but the Zod message format is verbose JSON. The test should pass because the existing catch already handles `ZodError`. Let's verify and adjust.

Actually, looking at the existing code at `update.ts:50`, the catch block already catches `ZodError` and re-throws with `"Task validation failed: ${error.message}"`. So this test may pass. Run it — if it passes, we still need to change the implementation to use `.safeParse()` (the spec requires it), so add a more specific assertion:

```typescript
    it('should throw descriptive error with field details when draft is invalid', async () => {
      const existing: TaskRecord = {
        ...baseDraft,
        id: 'task-1',
        quadrant: 'urgent-important',
        completed: false,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        notificationSent: false,
      };

      mockDb.tasks.get.mockResolvedValue(existing);

      await expect(
        updateTask('task-1', { title: '' })
      ).rejects.toThrow(/Task validation failed.*title/i);
    });
```

- [ ] **Step 3: Implement safeParse in `updateTask()`**

Replace lines 27-28 in `lib/tasks/crud/update.ts`:

```typescript
    // OLD:
    // const validated = taskDraftSchema.parse(nextDraft);

    // NEW:
    const result = taskDraftSchema.safeParse(nextDraft);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Task validation failed: invalid fields — ${fields}`);
    }
    const validated = result.data;
```

Also remove the `ZodError`-specific catch logic at lines 50-52 since `safeParse` never throws:

```typescript
    // Remove these lines:
    // if (error instanceof Error && error.name === "ZodError") {
    //   throw new Error(`Task validation failed: ${error.message}`);
    // }
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `bun run test -- tests/data/tasks/crud.test.ts -v`

Expected: ALL tests pass including the new one. The existing "should update task with partial changes" test validates the happy path still works.

- [ ] **Step 5: Commit**

```bash
git add lib/tasks/crud/update.ts tests/data/tasks/crud.test.ts
git commit -m "fix(tasks): use safeParse for task draft validation

Returns descriptive field-level errors instead of raw ZodError.
Prevents unhandled ZodError from reaching the error boundary."
```

---

### Task 2: safeParse in `getNotificationSettings()`

**Files:**
- Modify: `lib/notifications/settings.ts:32-33`
- Modify: `tests/data/functions-branches-boost.test.ts` (add tests after line ~111)

- [ ] **Step 1: Write failing test for corrupt settings self-healing**

Add these tests inside the `describe("notification settings", ...)` block in `tests/data/functions-branches-boost.test.ts`, after the "preserves id field" test:

```typescript
  it("getNotificationSettings returns defaults when stored settings are corrupt", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    // Insert a corrupt record — missing required `updatedAt` field
    await db.notificationSettings.put({
      id: "settings",
      enabled: "not-a-boolean",
      updatedAt: 12345,
    } as unknown as import("@/lib/types").NotificationSettings);

    const { getNotificationSettings } = await import(
      "@/lib/notifications/settings"
    );

    const settings = await getNotificationSettings();

    // Should self-heal to defaults instead of crashing
    expect(settings.enabled).toBe(true);
    expect(settings.soundEnabled).toBe(true);
    expect(settings.id).toBe("settings");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/data/functions-branches-boost.test.ts -t "corrupt"`

Expected: FAIL — currently `.parse()` throws `ZodError` on the corrupt record.

- [ ] **Step 3: Implement safeParse in `getNotificationSettings()`**

Replace line 32-33 in `lib/notifications/settings.ts`. Add a logger import at the top:

```typescript
import { createLogger } from "@/lib/logger";

const logger = createLogger("NOTIFICATION_SETTINGS");
```

Replace the return statement at line 32-33:

```typescript
  // OLD:
  // return notificationSettingsSchema.parse(settings);

  // NEW:
  const result = notificationSettingsSchema.safeParse(settings);
  if (!result.success) {
    logger.warn("Stored notification settings are corrupt, returning defaults", {
      issues: result.error.issues.map((i) => i.path.join(".")).join(", "),
    });
    const defaultSettings: NotificationSettings = {
      id: "settings",
      enabled: true,
      defaultReminder: NOTIFICATION_TIMING.DEFAULT_REMINDER_MINUTES,
      soundEnabled: true,
      permissionAsked: false,
      updatedAt: new Date().toISOString(),
    };
    await db.notificationSettings.put(defaultSettings);
    return defaultSettings;
  }
  return result.data;
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `bun run test -- tests/data/functions-branches-boost.test.ts -v`

Expected: ALL tests pass, including the new "corrupt" test and the existing "creates defaults" and "returns existing settings" tests.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/settings.ts tests/data/functions-branches-boost.test.ts
git commit -m "fix(notifications): self-heal corrupt settings with safeParse

getNotificationSettings now returns defaults and re-persists them
when stored settings fail Zod validation, instead of crashing."
```

---

### Task 3: safeParse in `updateNotificationSettings()`

**Files:**
- Modify: `lib/notifications/settings.ts:52-53`
- Modify: `tests/data/functions-branches-boost.test.ts` (add test)

- [ ] **Step 1: Write failing test for invalid settings update**

Add this test inside the `describe("notification settings", ...)` block:

```typescript
  it("updateNotificationSettings throws descriptive error for invalid input", async () => {
    const { getNotificationSettings, updateNotificationSettings } =
      await import("@/lib/notifications/settings");

    await getNotificationSettings(); // initialize

    await expect(
      updateNotificationSettings({
        defaultReminder: -5,
      })
    ).rejects.toThrow(/Notification settings validation failed/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/data/functions-branches-boost.test.ts -t "invalid input"`

Expected: FAIL — currently `.parse()` throws a raw `ZodError`. The error message won't contain "Notification settings validation failed".

- [ ] **Step 3: Implement safeParse in `updateNotificationSettings()`**

Replace lines 52-54 in `lib/notifications/settings.ts`:

```typescript
  // OLD:
  // const validated = notificationSettingsSchema.parse(updated);
  // await db.notificationSettings.put(validated);

  // NEW:
  const result = notificationSettingsSchema.safeParse(updated);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Notification settings validation failed: invalid fields — ${fields}`);
  }
  await db.notificationSettings.put(result.data);
```

- [ ] **Step 4: Run full test suite for affected files**

Run: `bun run test -- tests/data/functions-branches-boost.test.ts tests/data/tasks/crud.test.ts -v`

Expected: ALL tests pass.

- [ ] **Step 5: Run full test suite + typecheck + lint**

Run: `bun run test && bun typecheck && bun lint`

Expected: All green. Zero failures.

- [ ] **Step 6: Commit**

```bash
git add lib/notifications/settings.ts tests/data/functions-branches-boost.test.ts
git commit -m "fix(notifications): use safeParse for settings updates

Returns descriptive field-level errors instead of raw ZodError.
Completes the safeParse migration across all 3 call sites."
```

- [ ] **Step 7: Create PR for safeParse migration**

```bash
git push -u origin HEAD
gh pr create --title "fix(validation): migrate .parse() to .safeParse() across 3 call sites" --body "$(cat <<'EOF'
## Summary
- Replaces `.parse()` with `.safeParse()` in `lib/tasks/crud/update.ts` and `lib/notifications/settings.ts`
- `updateTask()` now returns descriptive field-level errors instead of raw ZodError
- `getNotificationSettings()` self-heals corrupt DB records to defaults instead of crashing
- `updateNotificationSettings()` throws a clear message on invalid input
- Closes codebase analysis report item: ".parse() on user-input paths should be .safeParse()"

## Test plan
- [ ] `bun run test` — all 1,893+ tests pass
- [ ] `bun typecheck` — zero errors
- [ ] New negative-case tests cover all 3 call sites
EOF
)"
```

---

## PR 2: Add Global `unhandledrejection` Listener

### Task 4: Create `GlobalErrorListener` component

**Files:**
- Create: `components/global-error-listener.tsx`
- Create: `tests/ui/global-error-listener.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/ui/global-error-listener.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { GlobalErrorListener } from "@/components/global-error-listener";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("GlobalErrorListener", () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>;
  let removeEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addEventSpy = vi.spyOn(window, "addEventListener");
    removeEventSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    cleanup();
    addEventSpy.mockRestore();
    removeEventSpy.mockRestore();
  });

  it("should render nothing", () => {
    const { container } = render(<GlobalErrorListener />);
    expect(container.innerHTML).toBe("");
  });

  it("should register unhandledrejection listener on mount", () => {
    render(<GlobalErrorListener />);
    expect(addEventSpy).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function)
    );
  });

  it("should remove listener on unmount", () => {
    const { unmount } = render(<GlobalErrorListener />);
    unmount();
    expect(removeEventSpy).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function)
    );
  });

  it("should log error details for Error rejection", async () => {
    const { createLogger } = await import("@/lib/logger");
    const mockLogger = (createLogger as ReturnType<typeof vi.fn>)();

    render(<GlobalErrorListener />);

    const handler = addEventSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection"
    )?.[1] as EventListener;

    const event = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: new Error("async failure"),
    });
    handler(event);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unhandled promise rejection",
      expect.any(Error),
      expect.any(Object)
    );
  });

  it("should show toast for unhandled rejection", async () => {
    const { toast } = await import("sonner");

    render(<GlobalErrorListener />);

    const handler = addEventSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection"
    )?.[1] as EventListener;

    const event = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: new Error("async failure"),
    });
    handler(event);

    expect(toast.error).toHaveBeenCalledWith("An unexpected error occurred");
  });

  it("should handle non-Error rejection values", async () => {
    const { createLogger } = await import("@/lib/logger");
    const mockLogger = (createLogger as ReturnType<typeof vi.fn>)();

    render(<GlobalErrorListener />);

    const handler = addEventSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection"
    )?.[1] as EventListener;

    // String rejection
    const event = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: "string error",
    });
    handler(event);

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should throttle rapid successive rejections", async () => {
    const { toast } = await import("sonner");

    render(<GlobalErrorListener />);

    const handler = addEventSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection"
    )?.[1] as EventListener;

    // Fire 5 rapid rejections
    for (let i = 0; i < 5; i++) {
      const event = new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: new Error(`error ${i}`),
      });
      handler(event);
    }

    // Toast should only fire once due to throttling
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/ui/global-error-listener.test.tsx -v`

Expected: FAIL — component does not exist yet.

- [ ] **Step 3: Implement `GlobalErrorListener`**

Create `components/global-error-listener.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { createLogger } from "@/lib/logger";

const logger = createLogger("GLOBAL_ERROR");

const THROTTLE_MS = 2000;

export function GlobalErrorListener() {
  useEffect(() => {
    let lastToastTime = 0;

    function handleRejection(event: PromiseRejectionEvent) {
      event.preventDefault();

      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason ?? "Unknown rejection"));

      logger.error("Unhandled promise rejection", error, {
        type: event.reason instanceof Error ? event.reason.name : typeof event.reason,
      });

      const now = Date.now();
      if (now - lastToastTime >= THROTTLE_MS) {
        lastToastTime = now;
        toast.error("An unexpected error occurred");
      }
    }

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/ui/global-error-listener.test.tsx -v`

Expected: ALL tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/global-error-listener.tsx tests/ui/global-error-listener.test.tsx
git commit -m "feat(errors): add GlobalErrorListener for unhandled promise rejections

Logs via structured logger and shows toast.error to the user.
Throttles rapid successive rejections to avoid flooding the UI."
```

---

### Task 5: Mount `GlobalErrorListener` in layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add import and mount component**

Add import at the top of `app/layout.tsx` (after the `PwaUpdateToast` import):

```typescript
import { GlobalErrorListener } from "@/components/global-error-listener";
```

Add `<GlobalErrorListener />` inside the `<body>` element, after `<PwaUpdateToast />` and before the closing `<Toaster>`:

```tsx
                <PwaUpdateToast />
                <GlobalErrorListener />
                <Toaster richColors position="top-center" />
```

- [ ] **Step 2: Run full test suite + typecheck**

Run: `bun run test && bun typecheck && bun lint`

Expected: All green.

- [ ] **Step 3: Commit and create PR**

```bash
git add app/layout.tsx
git commit -m "feat(errors): mount GlobalErrorListener in root layout"
git push -u origin HEAD
gh pr create --title "feat(errors): add global unhandledrejection listener" --body "$(cat <<'EOF'
## Summary
- New `GlobalErrorListener` component catches unhandled promise rejections
- Logs via structured logger (`GLOBAL_ERROR` context) and shows `toast.error()` to user
- Throttles rapid successive rejections (2s window) to avoid flooding the UI
- Handles non-Error rejection values (strings, objects, undefined)
- Mounted in root layout alongside other global components
- Closes codebase analysis report item: "No global unhandledrejection listener"

## Test plan
- [ ] `bun run test` — all tests pass
- [ ] `bun typecheck` — zero errors
- [ ] Manual: open browser console, run `Promise.reject(new Error('test'))`, verify toast appears
EOF
)"
```

---

## PR 3: Sentry Integration

### Task 6: Create Sentry wrapper module

**Files:**
- Create: `lib/sentry.ts`
- Create: `tests/data/sentry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/data/sentry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must be hoisted before the mock
const mockInit = vi.hoisted(() => vi.fn());
const mockCaptureException = vi.hoisted(() => vi.fn());

vi.mock("@sentry/browser", () => ({
  init: mockInit,
  captureException: mockCaptureException,
}));

describe("Sentry wrapper", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    }
  });

  it("should initialize Sentry when DSN is provided", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://key@sentry.io/123",
        enabled: true,
      })
    );
  });

  it("should not initialize Sentry when DSN is empty", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("should call Sentry.captureException when initialized", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    const error = new Error("test error");
    captureException(error, { action: "test" });

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      contexts: { gsd: { action: "test" } },
    });
  });

  it("should not call Sentry.captureException when not initialized", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    captureException(new Error("test"), { action: "test" });

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("should report initialization state via isInitialized()", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const mod1 = await import("@/lib/sentry");
    mod1.initSentry();
    expect(mod1.isInitialized()).toBe(false);

    vi.resetModules();
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const mod2 = await import("@/lib/sentry");
    mod2.initSentry();
    expect(mod2.isInitialized()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/data/sentry.test.ts -v`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Install `@sentry/browser`**

Run: `bun add @sentry/browser`

- [ ] **Step 4: Implement `lib/sentry.ts`**

Create `lib/sentry.ts`:

```typescript
import * as Sentry from "@sentry/browser";
import { ENV_CONFIG } from "@/lib/env-config";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: ENV_CONFIG.environment,
    tracesSampleRate: 0.1,
    enabled: true,
  });

  initialized = true;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!initialized) return;

  Sentry.captureException(error, context ? { contexts: { gsd: context } } : undefined);
}

export function isInitialized(): boolean {
  return initialized;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- tests/data/sentry.test.ts -v`

Expected: ALL tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/sentry.ts tests/data/sentry.test.ts
git commit -m "feat(sentry): add browser SDK wrapper with graceful no-op

initSentry() only calls Sentry.init when NEXT_PUBLIC_SENTRY_DSN is set.
captureException() is a no-op when not initialized."
```

---

### Task 7: Wire Sentry into error-logger, error-boundary, and global-error-listener

**Files:**
- Modify: `lib/error-logger.ts:46-48`
- Modify: `components/error-boundary.tsx:28-33`
- Modify: `components/global-error-listener.tsx`
- Modify: `tests/data/error-logger.test.ts` (add test)
- Modify: `tests/ui/error-boundary.test.tsx` (add test)

- [ ] **Step 1: Write failing test for Sentry in error-logger production path**

Add this test inside the `describe("logError", ...)` block in `tests/data/error-logger.test.ts`, after the "should log minimal info in production mode" test:

```typescript
		it("should call Sentry.captureException in production mode", async () => {
			vi.stubEnv('NODE_ENV', 'production');

			const mockCaptureException = vi.fn();
			vi.doMock("@/lib/sentry", () => ({
				captureException: mockCaptureException,
			}));

			vi.resetModules();
			const { logError } = await import("@/lib/error-logger");

			const error = new Error("Prod error for Sentry");
			const context: import("@/lib/error-logger").ErrorContext = {
				action: "test_action",
				timestamp: "2025-01-15T12:00:00Z",
				userMessage: "Test message",
			};

			logError(error, context);

			expect(mockCaptureException).toHaveBeenCalledWith(
				error,
				expect.objectContaining({ action: "test_action" })
			);
		});
```

- [ ] **Step 2: Write failing test for Sentry in ErrorBoundary**

Add this test inside the `describe("ErrorBoundary", ...)` block in `tests/ui/error-boundary.test.tsx`:

```typescript
  it("should call captureException when error is caught", async () => {
    const mockCaptureException = vi.fn();
    vi.doMock("@/lib/sentry", () => ({
      captureException: mockCaptureException,
    }));

    vi.resetModules();
    const { ErrorBoundary } = await import("@/components/error-boundary");

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const ThrowError = () => {
      throw new Error("Sentry test error");
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );

    consoleError.mockRestore();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun run test -- tests/data/error-logger.test.ts tests/ui/error-boundary.test.tsx -v`

Expected: FAIL — `@/lib/sentry` not imported in those modules yet.

- [ ] **Step 4: Wire Sentry into `lib/error-logger.ts`**

Add import at the top of `lib/error-logger.ts`:

```typescript
import { captureException } from "@/lib/sentry";
```

In the `logError` function, add `captureException` call after the production console.error (around line 54, after the closing `}` of the else block):

```typescript
  // After the if/else console.error blocks, add:
  captureException(error, loggedError);
```

- [ ] **Step 5: Wire Sentry into `components/error-boundary.tsx`**

Add import at the top:

```typescript
import { captureException } from "@/lib/sentry";
```

In `componentDidCatch`, add after the `logger.error(...)` call:

```typescript
    captureException(error, {
      componentStack: info?.componentStack ?? undefined,
    });
```

- [ ] **Step 6: Wire Sentry into `components/global-error-listener.tsx`**

Add import at the top:

```typescript
import { captureException } from "@/lib/sentry";
```

In the `handleRejection` function, add after the `logger.error(...)` call:

```typescript
      captureException(error, {
        type: event.reason instanceof Error ? event.reason.name : typeof event.reason,
      });
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun run test -- tests/data/error-logger.test.ts tests/ui/error-boundary.test.tsx tests/ui/global-error-listener.test.tsx tests/data/sentry.test.ts -v`

Expected: ALL tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/error-logger.ts components/error-boundary.tsx components/global-error-listener.tsx tests/data/error-logger.test.ts tests/ui/error-boundary.test.tsx
git commit -m "feat(sentry): wire captureException into error paths

Calls captureException in error-logger (production), ErrorBoundary
componentDidCatch, and GlobalErrorListener rejection handler."
```

---

### Task 8: Initialize Sentry in the app and finalize

**Files:**
- Modify: `app/layout.tsx`
- Modify: `.env.example`

- [ ] **Step 1: Add Sentry initialization to layout**

Add at the top of `app/layout.tsx`, after the other imports:

```typescript
import { initSentry } from "@/lib/sentry";

initSentry();
```

- [ ] **Step 2: Update `.env.example`**

Add to `.env.example`:

```
# Sentry error tracking (optional — leave empty to disable)
NEXT_PUBLIC_SENTRY_DSN=
```

- [ ] **Step 3: Run full test suite + typecheck + lint**

Run: `bun run test && bun typecheck && bun lint`

Expected: All green.

- [ ] **Step 4: Commit and create PR**

```bash
git add app/layout.tsx .env.example
git commit -m "feat(sentry): initialize SDK in root layout

Sentry is a no-op when NEXT_PUBLIC_SENTRY_DSN is not set."
git push -u origin HEAD
gh pr create --title "feat(sentry): integrate @sentry/browser for production error tracking" --body "$(cat <<'EOF'
## Summary
- Adds `@sentry/browser` with a thin wrapper at `lib/sentry.ts`
- Graceful no-op when `NEXT_PUBLIC_SENTRY_DSN` is not set (local dev, self-hosted)
- Wires `captureException` into three error paths:
  - `lib/error-logger.ts` — production `logError()` calls
  - `components/error-boundary.tsx` — React `componentDidCatch`
  - `components/global-error-listener.tsx` — unhandled promise rejections
- No session replay (privacy-first), 10% trace sample rate
- Closes codebase analysis report item: "No server-side error tracking service"

## Test plan
- [ ] `bun run test` — all tests pass
- [ ] `bun typecheck` — zero errors
- [ ] App starts normally without `NEXT_PUBLIC_SENTRY_DSN` set (no console errors)
- [ ] With DSN set, errors appear in Sentry dashboard
EOF
)"
```
