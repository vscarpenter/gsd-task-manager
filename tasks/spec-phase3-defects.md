# Spec: modernization Phase 3, fix the defects the owner ticked

Date: 2026-10-06. Tier: non-trivial. The approved design is
`../gsd-modernize/analysis/gsd-taskmanager/MODERNIZATION_BRIEF.md` §3 Phase 3,
with the owner's §7 decisions of 2026-10-06. Where this spec and the brief
differ, the brief wins.

## Goal

Fix the 15 items Vinny ticked in §7, each with a test that fails on today's
code, and leave every unticked item behaving exactly as before.

## Owner decisions (2026-10-06)

- Production stays on the bare PocketBase binary. Hook-only fixes stay in the
  self-host image.
- Extract-rules is skipped. All 11 proposed revisions are accepted.
- Fix: RULE-099, RULE-192, RULE-194, RULE-198, RULE-265, RULE-273, streaks and
  metrics, the three reminder items, agent skills and OpenAPI, `list_devices`
  (remove the tool), the About snippet, fresh self-host migrations, and the
  three MCP limits.
- Keep: RULE-089, RULE-094, RULE-264, and the duplicate-task title.
- Phase 4: RULE-002, the `notify_before` default, and SEC-003.

## Bundles

One branch per bundle, cut from `main` at `53418f1`, test first.

### A. Completion metrics (`fix/completion-date-metrics`)

- The completion instant is `completedAt`, falling back to `updatedAt` when
  `completedAt` is missing or empty (legacy imports and pulls), the same rule
  `lib/feedback/nudge-eligibility.ts` uses.
- Streaks, counts, and trends bucket by the local calendar day, in both copies.
  The current-streak walk steps local days, so DST can't skip one.
- The MCP longest streak drops its `uniqueDates.length <= 1` guard, so one
  completion day reports 1, like the web.
- Today, this week, and this month counts include a completion at the exact
  start (`>=`). Trend days are half-open, `[start, next start)`.
- The completion chart parses its day keys as local dates.
- `completion-metrics.json`: the two `encodesDefect` scenarios get their fixed
  expectations, and the longest-streak divergence goes away. New scenarios pin
  the `updatedAt` fallback and a DST week.
- The seed scripts and the verify skill stop saying analytics bucket by
  `updatedAt`; the seeder stamps `completedAt`.
- Out of scope: the "closed in 7 days" label over a since-Sunday count.

### B. Reminders (`fix/app-level-reminders`)

- `useNotificationChecker` and `useAutoArchive` move from `MatrixSimplified`
  to one app-level mount inside `ResetLockGate`, beside `SyncProvider` in
  `components/client-layout.tsx`. A test shows each runs once per interval
  and on every route.
- `markNotificationSent` runs in one `rw` transaction, re-reads the task, and
  skips the mark if the task is gone, completed, already marked, or its
  `dueDate` or `notifyBefore` changed since the check. It writes only
  `notificationSent` and `lastNotificationAt` with `db.tasks.update`, so a
  concurrent edit survives. No outbox entry: the pull keeps these fields
  device-local (`lib/sync/task-mapper.ts`).
- `showTaskNotification` returns whether it showed the notification. The
  checker marks a task sent only on `true`. Display treats a missing
  `notificationEnabled` as enabled (`!== false`), matching the schema default
  and the checker's own filter.
- The badge clears when reminders are off: the checker clears it when
  `settings.enabled` is false, and turning reminders off clears it at once.
- Out of scope: `navigator.serviceWorker.ready` can hang with no service
  worker; the unused reset and snooze helpers.

### C. MCP correctness (`fix/mcp-write-correctness`)

- RULE-099: the delete check compares like with like, so a record with a blank
  `client_updated_at` deletes when unchanged and is still refused when another
  device changed it.
- RULE-198: the bulk dry-run message says to set `dryRun` to false, which is
  right for every operation, delete included.
- SEC-020: `create_task` rejects a description that passes 600 characters
  once title URLs are merged in, before any write.
- SEC-031: bulk `add_tags` refuses, before any write, a merge that would leave
  a task with more than 20 tags, and names the tasks.
- SEC-032: the MCP server gains `ID_MIN_LENGTH = 4` for subtask ids, and
  `field-limits.json` moves it from a known gap to the shared limits.
- `list_devices` is removed: the tool, its schema, handler, dispatch, input
  schema, CLI access check, and help text. Living docs and tool-count tests go
  from 20 tools to 19. Dated history (CHANGELOG entries, ADRs, dated specs)
  stays as written. The help text stops advertising a `status` filter that
  `list_tasks` rejects.

### D. Sync (`fix/sync-realtime-and-deletion`)

- RULE-194: a realtime `create` for a task that exists locally follows the
  same strictly-newer rule as `update`. Archive and trash guards are unchanged.
- RULE-192: account deletion reports `authRejected` only when the session is
  gone (no token, or the refresh was refused). A refresh that fails for a
  transient reason (offline, 429, 5xx) reports a connection failure, so the
  dialog says to check the connection.

### E. Agent-facing docs (`fix/agent-facing-docs`)

- `quick-capture` and `triage-inbox` use `dueDate`; `triage-inbox` lists with
  `completed: false` and no sort argument. The digests in `index.json` follow.
- `openapi/pocketbase.json` names `description`, `completed` (boolean), and
  `due_date`.
- The About page snippet matches the server card: command `gsd-mcp-server`,
  `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN`, with a pointer to `--setup`. A
  test ties the snippet's env keys to the server's required ones.

### F. Self-host migrations (`fix/self-host-fresh-migrations`)

- A fresh install runs every migration in `/pb_migrations`, with
  `/pb_fresh_migrations` overriding same-named files. No hard-coded list.
- The probe fails closed: no `data.db` means fresh; an existing database that
  sqlite3 can't read stops startup with a clear error instead of being treated
  as fresh.
- The system test and `scripts/verify-pb-encryption.sh` build their fresh
  migration folder the same way, so `1781200000` runs.

### G. Export and trash (`fix/export-and-trash-hardening`)

- RULE-265: dropped smart views count toward the skipped total, and the
  message says "records", not "tasks". One shared message function serves
  `lib/backup-download.ts` and `settings-body.tsx`.
- RULE-273: the trash purge compares parsed times; an unparseable `deletedAt`
  is kept. A real exact-boundary test replaces the 29-day one.
- Out of scope: the same string comparison in `lib/archive.ts` and the v15
  migration.

## Constraints

- No production infrastructure change. No push or PR without Vinny's go-ahead.
- Every P0 rule that changes gets its new expectation, the date, and its §7
  item in `RULE_REVIEWS.md` (through `RULE_REVIEWS.json` notes) and an updated
  `CONTRACT_MAP.md` row.
- Builds run scrubbed (`env -i HOME="$HOME" PATH="$PATH"`), and their rewrites
  of `public/sw.js`, `package.json`, and `bun.lock` are discarded.
- No new dependencies. No version bump; a release PR follows the phase.
- Grow no function past its `quality:shape` baseline; extract instead.

## Acceptance criteria (brief Phase 3 exit criteria)

1. Each ticked item has a test that fails on the pre-fix code and passes after.
2. Each P0 rule whose behavior changed is recorded in `RULE_REVIEWS.md`.
3. Every unticked item behaves as before, so its Phase 1 pins pass unchanged.
4. The web dashboard and the MCP server report the same streaks and
   completion counts for the shared metrics fixture.
