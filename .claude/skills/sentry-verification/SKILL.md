---
name: sentry-verification
description: Verify Sentry error capture is working after a DSN change or deploy. Use when testing Sentry, confirming error reporting works, or debugging why errors aren't showing up in the Sentry dashboard.
---

## Sentry verification (recurring debugging task)

**Development never sends events.** `initSentry()` in `lib/sentry.ts` returns
early when `ENV_CONFIG.isDevelopment` (localhost/127.0.0.1/*.local), so a dev
server will not report to Sentry no matter what you trigger. Verify capture one
of two ways:

- **Staging (preferred):** deploy to `gsd-dev.vinny.dev` and trigger the test
  error there.
- **Local, gate lifted:** temporarily remove `|| ENV_CONFIG.isDevelopment` from
  the `initSentry` guard, verify, then restore it before commit.

Then:

1. Confirm DSN is loaded: `console.log` in `lib/sentry.ts` where `Sentry.init`
   runs and grep the console for it.
2. Trigger a test error: `captureException(new Error("manual-test-from-claude"))`
   in a dev-only handler, OR throw from a component error boundary.
3. Verify in the Sentry dashboard within ~30s. Expect the message to read
   "Error details redacted" — that's the privacy sanitizer working, not a
   failure. Check the event's type, stack frames, and `gsd` context instead.
4. Remove the test trigger (and restore the dev gate if lifted) before commit.
