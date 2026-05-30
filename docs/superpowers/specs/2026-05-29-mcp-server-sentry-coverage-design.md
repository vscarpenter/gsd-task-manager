# MCP Server — Opt-in Sentry Coverage

**Date:** 2026-05-29
**Status:** Approved
**Author:** Vinny Carpenter (with Claude)

## Goal

Make every `logger.error` in the `gsd-mcp-server` package optionally report to Sentry, so self-hosters can get error tracking for their MCP server — mirroring the browser app's `logger.error → Sentry` forwarding, adapted for the Node stdio runtime.

## Context

`gsd-mcp-server` is a **published npm package** users install into Claude Desktop. Its `createMcpLogger().error()` currently writes only to **stderr** (stdout is reserved for the JSON-RPC stdio transport). The browser app gained centralized `logger.error → Sentry` forwarding in a separate PR; this brings the MCP server to parity, but with a telemetry model appropriate for distributed, privacy-first software.

## Inputs / Outputs

- **Input:** an error logged via `createMcpLogger(module).error(message, error?, context?)`.
- **Output:** the existing stderr JSON line (unchanged) **plus**, when `GSD_SENTRY_DSN` is set, a Sentry event (`captureException` for errors, `captureMessage` for message-only) with secrets masked.
- **Config:** `process.env.GSD_SENTRY_DSN` — opt-in, the user's **own** DSN. Absent → fully inert.

## Constraints

- **Privacy:** opt-in only. No maintainer DSN. Default behavior egresses nothing.
- **Secrets:** the PocketBase auth token travels as `Authorization: Bearer <token>`; it must never reach Sentry. Mask `Bearer …`, `token=`, `apikey=`, `authorization=` from the error message and stack before forwarding.
- **stdio safety:** Sentry init/transport must never write to stdout (would corrupt JSON-RPC). `debug: false`, `tracesSampleRate: 0`.
- **Resilience:** the forward must never throw on the server's error path (try/catch).
- **Footprint:** one new pinned dependency, `@sentry/node@10.54.0` (matches the app's `@sentry/browser`).
- **File/function limits:** ≤350 lines/file, ≤30 lines/function (coding-standards).

## Edge Cases

- No DSN → `initSentry()` and all capture calls are no-ops (guarded on `Sentry.getClient()`).
- `error()` with no `Error` object → `captureMessage(maskSecrets(message))`.
- Sentry transport throws / misconfigured DSN → swallowed by try/catch; stderr line still written.
- Fatal error in `main().catch()` → capture + `await flush()` before `process.exit` (Node drops in-flight events on a bare exit).
- Custom error subclasses → masked copy preserves `.name` for Sentry grouping.

## Out of Scope

- Maintainer/hardcoded DSN or cross-user telemetry.
- Content allowlist (the browser PR's `SENTRY_SAFE_METADATA_KEYS`) — MCP error sites pass minimal context, and data goes to the user's own Sentry; secret-masking is sufficient.
- Masking the existing stderr output (local diagnostic; unchanged).
- Performance tracing / spans.
- Changing the 4 call sites — coverage is centralized in the logger.

## Acceptance Criteria

1. `initSentry()` calls `Sentry.init` with the DSN when `GSD_SENTRY_DSN` is set; is a no-op when it is absent.
2. `captureException`/`captureMessage` no-op when Sentry is uninitialized; forward (with `gsd` context) when initialized; `captureMessage` uses `level: "error"`.
3. `logger.error(msg, error, ctx)` forwards a **masked** Error copy (Bearer/token scrubbed from message+stack, `.name` preserved) via `captureException`, with `{ module, ...ctx }` context.
4. `logger.error(msg)` (no Error) forwards `maskSecrets(msg)` via `captureMessage`.
5. A thrown Sentry call does not propagate out of `logger.error`; the stderr line is still written.
6. `index.ts` calls `initSentry()` before serving and captures+flushes fatal errors before exit.
7. `@sentry/node@10.54.0` is pinned in `dependencies`; README documents `GSD_SENTRY_DSN` as opt-in.

## Test Stubs (vitest, `src/__tests__/utils/`)

```
// sentry.test.ts
should_init_sentry_when_dsn_present
should_noop_init_when_dsn_absent
should_capture_exception_only_when_initialized
should_capture_message_at_error_level_when_initialized
should_mask_bearer_and_token_in_maskSecrets

// logger.test.ts
should_forward_error_to_sentry_as_masked_exception
should_preserve_error_type_name_when_forwarding
should_forward_message_only_error_via_captureMessage
should_not_forward_info_warn_debug_to_sentry
should_not_throw_when_sentry_forward_fails
should_still_write_stderr_when_sentry_throws
```

## Components

| File | Change |
|---|---|
| `src/utils/sentry.ts` *(new)* | `initSentry`, `captureException`, `captureMessage`, `flush`, `maskSecrets`, `maskError` |
| `src/utils/logger.ts` | `error()` forwards to Sentry after stderr write (try/catch wrapped) |
| `src/index.ts` | `initSentry()` at `main()` start; capture + flush in fatal `.catch()` |
| `package.json` | add `"@sentry/node": "10.54.0"` |
| `README.md` | document `GSD_SENTRY_DSN` (opt-in) |
| `src/__tests__/utils/*.test.ts` | new tests per stubs above |
