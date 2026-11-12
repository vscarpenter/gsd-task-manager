# Constants

## Overview

This package holds three files of `as const` configuration objects: schema limits, sync settings, and UI timings. Each file exports plain values with no logic.

## Interface

- `schema.ts:SCHEMA_LIMITS`. Validation limits for tasks, time entries, and custom smart views. Zod schemas and forms read them.
- `sync.ts:SYNC_CONFIG`. Sync intervals, retry settings, clock skew tolerance, pull contract versions, and remote scan bounds.
- `sync.ts:SYNC_TOAST_DURATION`. Toast durations: `SHORT` 3000 ms, `MEDIUM` 5000 ms, `LONG` 7000 ms.
- `ui.ts:UI_TIMING`. Poll intervals, reset timeouts, and focus and scroll delays for the UI.
- `ui.ts:SEARCH_CONFIG`. `MAX_COMMAND_PALETTE_RESULTS` is 10.

## Invariants

- `schema.ts:SCHEMA_LIMITS` sets task title 80, description 600, tag 30, subtask title 100, and time entry notes 200 characters.
- `schema.ts:SCHEMA_LIMITS` sets at most 20 tags, 50 subtasks, 50 dependencies, and 1000 time entries per task. `ID_MIN_LENGTH` is 4.
- `schema.ts:SCHEMA_LIMITS.MAX_SMART_VIEW_FILTER_TAGS` (200) is deliberately not `MAX_TAGS`. A view filters over the whole workspace vocabulary, so the two limits are unrelated.
- `schema.ts:SCHEMA_LIMITS` bounds smart view imports: 100 views, depth 6, 10,000 input nodes, and 256 KiB of string bytes. At most 5 views are pinned.
- `sync.ts:SYNC_CONFIG.PULL_CURSOR_VERSION` is 4. Bump it when a build is the first to read a newly synced field (ADR 0019). Version 2 made `client_updated_at` the only cursor, 3 added `saved_at`, 4 added `focus_date` and `focus_rank` (ADR 0020).
- `sync.ts:SYNC_CONFIG.SAVED_AT_CONTRACT_VERSION` is 3. Rows stored under an older contract must not send their empty `savedAt` to the server as `""`.
- `sync.ts:SYNC_CONFIG.FOCUS_CONTRACT_VERSION` is 4, the first contract that read `focus_date` and `focus_rank`.
- `sync.ts:SYNC_CONFIG.MAX_CLIENT_CLOCK_SKEW_MS` is 5 minutes. A `client_updated_at` beyond now plus this value is untrusted, so a far-future stamp cannot win last-write-wins for good.
- `sync.ts:SYNC_CONFIG.MAX_RETRY_AFTER_MS` caps a server `Retry-After` at 5 minutes, so a bogus header cannot freeze sync.
- `sync.ts:SYNC_CONFIG.MAX_RETRIES` is 5, with `RETRY_DELAYS` of 5 s, 10 s, 30 s, 60 s, and 300 s.
- `sync.ts:SYNC_CONFIG.MAX_REMOTE_TASKS` is 10,000 and `REMOTE_TASK_PAGE_SIZE` is 200 for any authoritative remote task scan.

## Side Effects

- None

## Verification

- Run: `bun run test`
