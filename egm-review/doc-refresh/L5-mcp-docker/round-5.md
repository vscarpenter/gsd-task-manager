# Doc refresh: L5-mcp-docker, round 5

Status: resolved
Clean round: no

Written 2026-11-12 by a continuation driver. The earlier driver was cut off in round 5 before it wrote a report. This round ran four fresh accuracy reviewers, 2 at a time. Each got the list of findings settled in rounds 1 to 4.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| accuracy A1 (egm-codebase-details) | packages/mcp-server/README.md lines 1-612 | ran, no Blocker or Major |
| accuracy A2 (egm-codebase-details) | packages/mcp-server/README.md lines 585-965 | ran, no Blocker or Major |
| accuracy A3 (egm-codebase-details) | docker/README.md lines 1-284, docs/diagrams/reminder-model/README.md lines 1-43, docs/diagrams/task-lifecycle-model/README.md lines 1-57 | ran, 2 Major |
| accuracy A4 (egm-codebase-details) | packages/mcp-server/QUICKSTART.md, QUICK_TEST.md, TESTING.md, TEST_PLAN.md | ran, no Blocker or Major |

## Findings

### L5-mcp-docker-5-1 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 608-609, 817
* Finding: "One-word code" is loose. The codes are snake_case names such as `rate_limited` and `authentication_failed` (`src/write-ops/write-rate-limiter.ts:15-26`).
* Decision: PROPOSE FIX
* Reason: Confirmed in write-rate-limiter.ts. No other file links the old heading text.
* Edit: "one-word code" is now "short code". The troubleshooting heading now ends "and other short error codes".

### L5-mcp-docker-5-2 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 608-609
* Finding: The section does not say that a write tool's failed reads also come back as a code (`src/tools/list-tasks.ts:89-100`).
* Decision: DECLINE
* Reason: "Some failed PocketBase requests" covers reads, and the troubleshooting entry says "reads included".
* Edit: none

### L5-mcp-docker-5-3 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 503-504
* Finding: `validate_config` reports "Token validation failed" for any unhealthy sync status, a network failure included (`src/tools/handlers/system-handlers.ts:20-33`, `src/tools/sync-status.ts:23-30`).
* Decision: PROPOSE FIX
* Reason: Confirmed in both files.
* Edit: Added "A network failure reports the same text."

### L5-mcp-docker-5-4 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 289-301
* Finding: `authenticated` in `get_sync_status` is `pb.authStore.isValid`, a local expiry check (`src/tools/handlers/read-handlers.ts:24`). A revoked, unexpired token can show `authenticated: true` beside `healthy: false`.
* Decision: PROPOSE FIX
* Reason: Confirmed in read-handlers.ts and in the SDK's `isValid` getter, which only reads the token's `exp`.
* Edit: Added one line: `authenticated` checks the expiry date locally, and `healthy` says whether the request to PocketBase succeeded.

### L5-mcp-docker-5-5 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md line 474
* Finding: `get_task_insights` lists its contents as if always present. Only the overview and completion rate are unconditional (`src/analytics/aggregator.ts:32-100`).
* Decision: PROPOSE FIX
* Reason: Confirmed in aggregator.ts.
* Edit: Added two sentences: the counts and rate always appear, and each other line appears only when its value is above zero.

### L5-mcp-docker-5-6 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 818
* Finding: "Other failures return one of the sentences above" is too narrow. Some sentences are not listed above, for example "Task not found" (`src/write-ops/task-operations.ts:254, 407`). The reviewer also noted that a bulk per-task failure with no HTTP status shows as `write_failed` (`src/write-ops/bulk-operations.ts:178-186`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The `write_failed` detail does not make a stated claim wrong, so it gets no text.
* Edit: Now "Other failures return a sentence."

### L5-mcp-docker-5-7 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 766
* Finding: "Clear error messages for each failed task": a failed write is listed as `Task <id>: <code>` (`src/write-ops/bulk-operations.ts:209`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `summarizeOutcomes`.
* Edit: Now "An error code or message for each failed task".

### L5-mcp-docker-5-8 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 674-676
* Finding: The `update_task` example says "Add tags", but `tags` replaces the whole list (`src/write-ops/task-operations.ts:214-222`). The parameter list on the same page says "Replace all tags".
* Decision: PROPOSE FIX
* Reason: Confirmed. The example contradicted its own parameter list.
* Edit: "Add tags" is now "Set tags".

### L5-mcp-docker-5-9 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 785
* Finding: The API rule is shown as `owner = @request.auth.id`. The shipped rules add an auth check and an owner-immutability clause (`scripts/setup-pocketbase-collections.sh:86-90`).
* Decision: DECLINE
* Reason: A shortening, not wrong.
* Edit: none

### L5-mcp-docker-5-10 [accuracy A3] Severity: Major
* Target: docker/README.md lines 217-219
* Finding: "Settings → Cloud Sync → Sign out of all devices" does not exist. The button lives in the sync dialog (`components/sync/sync-auth-dialog-sections.tsx:139, 219-241`), opened by the header's sync button (`components/sync/sync-button.tsx:165`). Settings has only a plain "Sign out" (`components/settings/sync-account-row.tsx:64-67`).
* Decision: PROPOSE FIX
* Reason: Confirmed by search: the only hits for the button are the sync dialog files.
* Edit: The sentence now names the web app's sync dialog and drops the Settings path.

### L5-mcp-docker-5-11 [accuracy A3] Severity: Major
* Target: docker/README.md lines 130-134
* Finding: Setting `NEXT_PUBLIC_POCKETBASE_URL` in the Dockerfile is not enough for a different origin. The Caddyfile sends `connect-src 'self'` (`docker/Caddyfile:53`), and the production export carries no policy of its own (`app/layout.tsx:20-24`).
* Decision: PROPOSE FIX
* Reason: Confirmed by reading the header and the layout. Not tried in a browser.
* Edit: Added one sentence: the Caddyfile's Content-Security-Policy needs the other origin too.

### L5-mcp-docker-5-12 [accuracy A3] Severity: Nit
* Target: docs/diagrams/task-lifecycle-model/README.md line 52
* Finding: The toast reads "Task deleted. It's in Trash." (`components/matrix-simplified/index.tsx:214`); the README quotes "Task deleted".
* Decision: DECLINE
* Reason: The README matches `view.mjs:51` in its own folder, and the short form identifies the toast.
* Edit: none

### L5-mcp-docker-5-13 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 185-186
* Finding: `npm install` in a Bun workspace member.
* Decision: DECLINE
* Reason: Same point as L5-mcp-docker-1-70, declined for QUICKSTART. Install advice is the owner's call.
* Edit: none

### L5-mcp-docker-5-14 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md lines 72-78
* Finding: A rejected token gives null counts on the third test prompt, and the page names only `"healthy": false` as the broken-setup sign (`src/tools/sync-status.ts:64-74`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `getTaskStats`. TESTING.md already states the rule.
* Edit: Added "Task counts that come back null also mean the read failed."

### L5-mcp-docker-5-15 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICK_TEST.md line 81
* Finding: "Get help with analytics tools": the `analytics` help topic lists capabilities, not tools (`src/tools/handlers/system-handlers.ts:196-210`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `buildAnalyticsHelpSection`.
* Edit: The prompt is now "Get help with analytics".

## Notes

* Cap reached. This was the fifth round.
* The round was not clean: reviewer A3 raised two Majors in docker/README.md. Both are fixed. Neither sits in a passage an earlier round changed, so this is not churn.
* The MCP README, the four small MCP files, and the two diagram READMEs had no Blocker or Major this round.
* The passages changed in round 4 ("Pacing and the cache" and the error-code troubleshooting entry) were checked sentence by sentence by both README reviewers. They found wording Nits only.
* Asserted text kept: `tests/data/security-hardening-scripts.test.ts` needs `TLS_MODE=public` in docker/README.md and no `POCKETBASE_VERSION=0.26.`. Both still hold. No test reads the other seven files.
* Reviewer A1 noted that the header comment and `BULK_WRITE_CONCURRENCY = 4` in `src/write-ops/bulk-operations.ts` suggest parallel writes, while one limiter serializes them. The README is right; the code comment misleads.

## Could not check

* State and arrow counts in both diagram READMEs (need a TLC or statechart run).
* TEST_PLAN.md line 246: that `version:patch` changes only the package's `package.json` (needs a run).
* Web and mobile behavior behind MCP claims: the token menu path, Trash on iOS and Android, the hosted server's token lifetime.
* Claude Desktop log paths and UI labels, npm registry facts, and live server responses.
