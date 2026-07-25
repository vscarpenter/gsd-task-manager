---
name: sentry-verification
description: Verify Sentry error capture is working after a DSN change or deploy. Use when testing Sentry, confirming error reporting works, or debugging why errors aren't showing up in the Sentry dashboard.
---

## Sentry verification (recurring debugging task)

When testing Sentry capture after a DSN change or deploy:

1. Confirm DSN is loaded: `console.log` in `lib/sentry/init.ts` (or wherever Sentry.init runs) and grep dev console for "Sentry initialized".
2. Trigger a test error: `Sentry.captureException(new Error("manual-test-from-claude"))` in a dev-only handler, OR throw from a component error boundary.
3. Verify in Sentry dashboard within ~30s.
4. Remove the test trigger before commit (it's not a regression — leave it out of source).
