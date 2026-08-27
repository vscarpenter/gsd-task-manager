# Security trust boundaries

This map identifies where untrusted or sensitive data crosses a system
boundary and the controls that must remain intact. It complements
[`SECURITY.md`](../SECURITY.md), which documents deployment posture and
operator guidance.

| Boundary | Entry points | Required controls | Verification |
| --- | --- | --- | --- |
| Browser input to IndexedDB | `lib/tasks/`, `lib/schema.ts` | Validate task operations with Zod before persistence; derive quadrant state rather than trusting duplicate input | `tests/data/tasks/` |
| JSON import/export | `lib/tasks/import-export.ts`, `lib/schema.ts` | Bound file and task counts; use `safeParse`; strip legacy fields on import and require strict clean records on export; keep replace writes transactional | `tests/data/tasks/import-export.test.ts` |
| Capture URL to task draft | `lib/share-capture.ts`, `public/sw.js`, `lib/sw-cache-logic.ts` | Accept capture content only from the URL fragment; require explicit creation; remove retired query payloads before network or cache use | `tests/data/share-capture.test.ts`, `tests/data/sw-cache-logic.test.ts` |
| Browser to PocketBase sync | `lib/sync/`, `scripts/setup-pocketbase-collections.sh` | Require authentication and owner-scoped collection rules; make owner immutable; validate remote records; use `client_updated_at` for LWW and applied-only versioned pull cursors; clamp future values to +5m and retain the 30s `>=` overlap; preserve archive tombstones | `tests/data/sync/`, `tests/sync/`, `tests/data/security-hardening-scripts.test.ts` |
| Browser to feedback collection | `lib/feedback/`, `components/settings/use-feedback-form.ts`, `scripts/setup-pocketbase-feedback-collection.sh` | Send only on an explicit user action; use bare `fetch` with `credentials: "omit"` so no token or cookie attaches; keep the payload free of owner, device, and task fields; clamp persisted drafts before building the payload; keep log retention short because request logs record client IPs | `tests/data/feedback-payload.test.ts`, `tests/data/feedback-store.test.ts`, `tests/data/submit-feedback.test.ts`, `tests/e2e/feedback.spec.ts` |
| PocketBase API to SQLite | `docker/pb_hooks/tasks_encryption.pb.js`, `docker/pb_hooks/encryption-core.js`, `docker/pb_migrations/1781000000_encrypt_existing_tasks.js`, `docker/pb_migrations/1781100000_harden_task_encryption_cleanup.js` | Require `GSD_TASKS_ENC_KEY`; encrypt selected content fields before create/update and decrypt after reads; keep both the legacy backfill and immutable cleanup/vacuum migration idempotent | `tests/pb/`, `scripts/verify-pb-encryption.sh`, `packages/mcp-server/src/__tests__/system/pocketbase-upgrade-system.test.ts` |
| MCP client to task writes | `packages/mcp-server/src/tools/handlers/input-schemas.ts`, `packages/mcp-server/src/write-ops/` | Validate tool inputs; scope requests with the configured auth token; support dry-run; preflight fresh timestamps before writes; cap bulk operations and throttle sequential requests | `packages/mcp-server/src/__tests__/write-ops/` |
| Configured backend to MCP transcript | `packages/mcp-server/src/tools/handlers/system-handlers.ts`, `packages/mcp-server/src/api/client.ts` | Redact private PocketBase hosts and never echo auth tokens, credentialed URLs, or raw backend errors | `packages/mcp-server/src/__tests__/tools/system-handlers.test.ts`, `packages/mcp-server/src/__tests__/api/client.test.ts` |
| Runtime errors to telemetry | `lib/error-logger.ts`, `lib/logger.ts`, `lib/sentry.ts` | Sentry remains opt-in; sanitize exceptions and use allowlisted structural context; strip capture data, credentials, query values, and task content | `tests/data/error-logger.test.ts`, `tests/data/logger.test.ts`, `tests/data/sentry.test.ts` |
| Requests to the PWA cache | `public/sw.js`, `lib/sw-cache-logic.ts` | Pass through cross-origin, authenticated, non-GET, API, admin, and no-store requests; never persist capture fragments; rotate page/runtime caches by release | `tests/data/sw-cache-logic.test.ts`, `tests/data/security-headers-policy.test.ts` |

## Change rule

When adding an entry point to any boundary above, update this map and add a
negative test proving that malformed, cross-owner, sensitive, or stale data is
rejected or redacted. A successful happy-path test alone is not sufficient for
a trust-boundary change.
