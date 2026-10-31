# Spec: top three

**Status:** draft, 2026-10-31. Not implemented on any client. Sprint 2 builds it.
**Decisions:** D-13 (up to three picks for today, chosen by the user with computed suggestions; `focus_date` and `focus_rank`; one contract change at pull contract 4). It reads the escalation rule from D-11 and D-12. Section 15 lists what this spec decides by reading and Vinny still has to confirm.
**Contract:** `tests/fixtures/cross-platform/top-three-corpus.json` (123 cases, version 1). This repo is the authority; iOS and Android copy it byte-identical.
**Matrix row:** F2.
**Evidence:** code paths come from reading web `main` at `ed72ca3`, iOS `main`, and Android `feat/saved-parity` at `432e1d9`. Client sync behavior here is read, not run. Server behavior in section 10 was run.

## 1. Why

The matrix says what kind of work each task is. It doesn't say what you're doing today. People who use it end up holding that list in their head, and Do First can run far past what fits in a day. Top three lets the user name up to three tasks for today and see them first, on every device.

## 2. What it does, and what it doesn't

- The user chooses up to three tasks for today, from any quadrant. GSD suggests; it never picks.
- A pick counts only on its date. Nothing rolls over by itself, and nothing writes at midnight.
- A pick changes two fields on the task, through the ordinary edit path. It changes nothing else: not the quadrant, the flags, the due date, or the reminder.
- Analytics, badges, reminders, smart views, and the escalation rule keep reading what they read today.
- No streaks, scores, completion counts, or celebration beyond the existing completion moment. `PRODUCT.md` rules out the gamified version.

## 3. The rules

Pure functions, the same on every client. The corpus pins each one. "Today" is the local date of `now` in the device's current zone, as `YYYY-MM-DD`. A field left out of a corpus task takes the model's default.

**Eligible** means the row is in the active store, isn't completed, and has no `savedAt`. Archived and trashed rows live in their own stores, so no selector reads them.

### 3.1 Today's picks

```
todaysPicks(tasks, now, zone) -> { picks: [id], overflow: [id], needsTidy: boolean }
```

1. A task is a pick when it's eligible, `focusDate` equals today as text, and `focusRank` is an integer from 1 to 3.
2. Order: lowest rank, then newest `updatedAt`, then `id` ascending. This is the two-device conflict rule.
3. `picks` is the first three and `overflow` is the rest.
4. `needsTidy` is true when there are more than three picks or two share a rank. A gap in ranks is fine and offers nothing.

Eligibility is checked when the list is read, and completing a task clears nothing. So completing a pick frees its slot, and Undo restores it. The same goes for Save and Return, Archive and Restore, and Trash and Restore on the same day.

### 3.2 Writes

These are the only writes top three makes. Each one is an ordinary edit that bumps `updatedAt` and queues a push.

| Action | Write |
|---|---|
| Add to today | `focusDate` = today, `focusRank` = `nextRank`. Refused when `nextRank` is null |
| Remove from today | Both fields cleared |
| Move up or down | The two rows swap ranks |
| Tidy (only when the user accepts the offer) | The first three get ranks 1, 2, and 3. Overflow rows get both fields cleared. Rows already correct aren't written |

`nextRank` is the lowest rank from 1 to 3 that no current pick uses, or null when none is free.

Recurring spawns and duplicates start with neither field. On web and Android this needs an explicit clear, because both spread the source row (`lib/tasks/crud/toggle.ts` `buildRecurringInstance`, `lib/tasks/crud/duplicate.ts`, Android `RecurrenceEngine.kt:26`).

### 3.3 Suggestions

```
suggest(tasks, now, windowDays, zone) -> [id]
```

Eligible tasks that aren't today's picks, in four groups:

1. **Overdue Q1**: urgent, important, and `daysUntilDue < 0`.
2. **Escalating**: what `evaluateEscalation` marks as escalating (`tasks/spec-escalation.md` section 3). This covers Schedule and Eliminate tasks. With escalation Off, the group is empty.
3. **Q1 with a due date** that isn't overdue.
4. **The rest of Q1**: no due date.

Groups 1 to 3 sort by `dueDate` ascending, then important first, then `id`. Group 4 sorts by `createdAt` ascending, then `id`. `daysUntilDue` counts calendar days, as the escalation rule does, so a task due earlier today isn't overdue.

Delegate tasks are never suggested, even overdue, and non-escalating Schedule tasks aren't either. Both can still be picked by hand. Dependencies, snooze, tags, and recurrence don't change the order.

The surface shows the first three after removing anything shown as carry-over.

### 3.4 Carry-over

```
carryOver(tasks, now, zone) -> { fromDate: date | null, ids: [id] }
```

Carry-over is an offer, never a write.

1. Look at eligible tasks with a valid rank and a `focusDate` before today, at most seven local days back.
2. `fromDate` is the latest such date. Earlier dates aren't offered.
3. `ids` is that date's tasks in conflict-rule order, capped at three.
4. One tap re-picks a task through "Add to today". Ignoring the offer writes nothing.

An automatic roll-forward would write to every unfinished pick on every device each morning. That bumps `updatedAt`, wins or loses last-write-wins against real edits, and creates the conflicts section 3.1 exists to settle.

### 3.5 Field validity

Unset is `null` on the client and `focus_date: ""` with `focus_rank: 0` on the wire, because PocketBase never stores a null number. Clients write those two values and never write null.

On pull, the pair counts only when `focus_date` is a real calendar date in `YYYY-MM-DD` form and `focus_rank` is an integer from 1 to 3. Anything else becomes unset, both fields together, and the record is still accepted. A bad pick must not cost the user the task.

## 4. Surfaces

Keep it quiet: a short list above the matrix, not a new page. The matrix stays the argument.

| | |
|---|---|
| Section | "Today" above the matrix on web, and at the top of the Matrix screen on Apple and Android |
| With picks | Rows in rank order, using the existing card's title, due chip, and complete control |
| With no picks | One line: "Pick up to three for today", which opens the suggestions |
| Suggestions | The first three from section 3.3, each with "Add to today" |
| Carry-over | "From yesterday" or "From Friday" above the suggestions, only while a slot is free |
| Conflict | "Two devices picked for today. Tidy up?" with Tidy and Not now. Not now writes nothing, and the offer returns next launch |
| Card action | "Add to today" or "Remove from today", in the card menu. When today is full it reads "Today is full" and is disabled |
| Order | Move up and Move down in the row's menu, plus drag on web using the existing `dnd-kit` setup |
| Accessible name | "Today, 2 of 3" on the section. Each row: its title, then "first", "second", or "third" |

Copy never says missed, overdue from yesterday, unfinished, or failed, and shows no progress meter. The word on the offer is "From", because the task isn't late for being unpicked.

Web's card menu is `components/task-card/*`, and the Matrix screen and card are hotspots on every client. Land them through the sprint 2 hotspot table.

## 5. Data model

| | Client | Wire | Backup |
|---|---|---|---|
| Date | `focusDate: string or null`, local `YYYY-MM-DD` | `focus_date`, text, `""` when unset | `focusDate`, omitted when unset |
| Rank | `focusRank: integer or null`, 1 to 3 | `focus_rank`, number, `0` when unset | `focusRank`, omitted when unset |

These are the only new synced fields. `focusDate` is plain text on purpose. It isn't an instant, and no client should parse it through a time zone. The same row can be today in Tokyo and tomorrow in Chicago, and the corpus pins that.

Neither field is indexed. Web needs no Dexie version bump, because selectors filter the rows `useTasks` already holds. iOS adds a GRDB migration and Android moves Room from 3 to 4, each with nullable columns and no backfill.

The two fields aren't task content, so self-hosted encryption doesn't cover them. They stay outside the five encrypted fields (`docker/pb_hooks/tasks_encryption.pb.js`), like `due_date`.

## 6. Pull contract 4

Every client bumps to 4 in the change that first reads these fields: `SYNC_CONFIG.PULL_CURSOR_VERSION` on web, `SyncCursor.contractVersion` on iOS, and `SyncEngine.PULL_CONTRACT_VERSION` on Android.

Saved showed that a same-version merge alone isn't enough (`S-AND-01`, `OWNER-DECISIONS.md` item 7). A user can edit a task on the older build, or have an edit queued, when they upgrade. Without the rules below, the first push after the upgrade sends `focus_date: ""` with a newer stamp and clears the pick on every client.

**The sequence that must hold:** the upgraded build completes a full pull, then pushes. Any field it sends comes from a row that pull already repaired.

### Requirements

**C4-1. The stored version alone decides whether a backfill is due.** A backfill is due when the stored version is missing or below 4. A nil cursor doesn't exempt a device.
- *Why:* iOS and Android require a cursor today. On iOS, sign-out clears the cursor and the version (`SyncCoordinator.swift:84-87`), and the first sync after sign-in seeds every local row into the queue (`SyncEngine.swift:247`). The pull then runs with no same-version merge, and each row pushes empty fields.
- *iOS:* drop `load() != nil` from `needsBackfill()`, and stop `clear()` from forgetting the version, so an ordinary sign-out on a current build isn't treated as an older build.
- *Android:* drop `stored != null`. Android is narrower: its spec says only an owner change or a local erase clears the cursor (`gsd-android-spec.md` section 9.4), and sign-out does neither, so sign-out, upgrade, and sign-in don't reach this. Read, not run.
- *Web:* `resolvePullCursor` already checks only the version. But `buildSyncConfig` writes a literal `pullCursorVersion: 2` at sign-in (`components/sync/use-sync-auth-dialog.ts:214`). Under C4-4 that would read as "older than Saved" after every sign-in, so it must keep `existingConfig?.pullCursorVersion`.
- A fresh install has no rows, so the backfill changes nothing there.

**C4-2. While a backfill is due, no push runs before the pull completes.** If the pull fails, nothing pushes and nothing stamps.
- *Web:* `fullSync` pushes first (`lib/sync/pb-sync-engine.ts:187-189`). When `mergeSameVersion` is true it must pull, then push. Ordinary syncs keep today's order. A pull that comes back unauthenticated returns rather than throws (`pb-pull.ts`), so the reorder must skip the push in that case too.
- *Web, reconcile moves too:* `reconcileDeletedTasks` runs inside `pullRemoteChanges` (`pb-pull.ts:172`), so on that one sync it runs before the push and sees tasks whose create hasn't gone out. That's safe by reading: a pending queue row protects a task from reconcile (`classifyRemoteDeletion`, `lib/sync/queue.ts:65-67`), and `pushLocalChanges` only sends pending rows, so a failed-only row gets the same verdict in either order. The named test below proves the create case.
- *iOS:* `pushNow` drains with no pull (`SyncEngine.swift:281`, called from `SyncCoordinator.swift:249`). While a backfill is due it must run `sync()` instead. `sync()` itself pulls first, and the seed only enqueues.
- *Android:* `runSync` already pulls first and skips push when pull throws, and it has no push-only path. Add the test anyway, so it stays that way.

**C4-3. Stamp the version only after a completed pull.** All three do this today. Keep it, and test it.

**C4-4. A locally newer row gets only the fields it never knew about.** During the backfill, when the local row is strictly newer than the remote:
- Copy `focusDate` and `focusRank` if the local pair is unset, the remote's is set, and the stored version is below 4.
- Copy `savedAt` if the local value is null, the remote's is set, and the stored version is below 3.
- Keep `updatedAt` and every other field. Queue nothing. Don't count a conflict. Run this after the tombstone check, so archived and trashed rows stay untouched.
- *Why the version gate matters:* a null field means "this build never heard of it" only on a build older than the field. On a contract 3 device, a null `savedAt` on a newer row is a real Return that may not have pushed yet. Android's current `backfill && lacksNewerPlacement` (`SyncEngine.kt`, `feat/saved-parity`) is right at contract 3, and at contract 4 it would un-return that task. Contract 4 replaces it with this gate.
- *What this doesn't fix:* a contract 3 web or iOS device can't repair `saved_at` this way. That's item 7, and it needs its own change.
- *Accepted edge, early un-pick:* a pick and an un-pick on this device before the first sync finishes can come back as picked if another client has a pick for that task. Nothing is lost, and the user can remove it.
- *Accepted edge, no stored version:* a missing version reads as older than every field, so `savedAt` is copied too. Two shipped paths give a build that knew Saved a missing or low version. A contract 3 iOS build forgets the version on sign-out (`SyncCursor.clear()`). Web's literal `pullCursorVersion: 2` (`use-sync-auth-dialog.ts:214`) stands on a shipped build until its first completed pull stamps the real value. So on those paths a Return that hasn't pushed, then an upgrade, comes back Saved. On iOS that also takes a sign-out and sign-in first. The copy still runs, because a missing version usually does mean an older build, and skipping it would clear `saved_at` for everyone. Nothing is lost, and the user can return the task again. C4-1's changes close both paths for later contracts.

**C4-5. A same-version row takes the remote through the existing merge.** No change. It isn't a conflict, and device-local fields survive through the mapper.

**C4-6. Push takes the focus fields from the current row, not the queued payload.** When the row is gone from the active store, both keys stay off the wire, so the server keeps its value. This holds on every push, not only during a backfill, because a queued payload can be older than the row.
- *Web:* `upsertRemoteTask` sends the payload as is (`lib/sync/pb-push.ts:60`). Read the row at drain time.
- *iOS:* `toWire(payload)` at `SyncEngine.swift:162` does the same. The new wire fields must be optional, so they can be omitted.
- *Android:* extend what `push` already does for `savedAt` (`SyncEngine.kt:222-227`, `sendSavedAt`).
- This is scoped to the focus fields. Leave `saved_at` for item 7.

**C4-7. Ordinary pulls don't change.** Strictly newer wins and a same-version record is a no-op, so a local un-pick stays un-picked. Realtime keeps the same rule.

**C4-8. Older builds can't clear a pick.** They don't send the keys, and PocketBase keeps a stored value when a key is omitted. Section 10 shows that on 0.40.4 for these two fields, using a `PATCH` shaped like an older build's. That older builds send exactly that shape is read, not run. The real-server run below closes the gap. So no client is forced to upgrade, though an older build shows no picks and can't honor them.

### Named tests

Each client writes the test where it fits its suite. The name stays the same, so the three can be compared. Web tests sit under `tests/data/sync/`, iOS under `GSDSyncTests/`, and Android under `core/sync/src/test/`. "n/a" says why a client has no such path.

| Test | Requirement | Web | iOS | Android |
|---|---|---|---|---|
| `backfill runs with a null cursor` | C4-1 | yes | yes | yes |
| `sign-out, upgrade, and sign-in keep the server pick` | C4-1 | yes | yes | n/a: sign-out keeps the cursor |
| `sign-out on the current build doesn't trigger a backfill` | C4-1 | yes | yes | n/a: sign-out keeps the cursor |
| `sign-in keeps the stored contract` | C4-1 | yes | n/a: no such write | n/a: no such write |
| `backfill pulls before it pushes` | C4-2 | yes | yes | yes |
| `a pending create survives a pull-first backfill` | C4-2 | yes | n/a: order unchanged | n/a: order unchanged |
| `a push-only drain runs a full sync while a backfill is due` | C4-2 | n/a: no such path | yes | n/a: no such path |
| `a failed backfill pull pushes nothing and stamps nothing` | C4-2, C4-3 | yes | yes | yes |
| `a locally newer row gets the server pick through the backfill` | C4-4 | yes | yes | yes |
| `a real return survives the contract 4 backfill` | C4-4 | yes | yes | yes |
| `an ordinary pull leaves a local un-pick alone` | C4-4, C4-7 | yes | yes | yes |
| `a queued payload from an older build keeps the server pick` | C4-6 | yes | yes | yes |
| `a same-version row with a queued change keeps the server pick` | C4-5, C4-6 | yes | yes | yes |
| `a queued item for a row that's gone omits both keys` | C4-6 | yes | yes | yes |
| `the backfill leaves the queue empty when nothing changed` | C4-4 | yes | yes | yes |

The corpus's `pullMerge` and `pushFocus` ops pin the decisions as pure functions, so each client should factor them out that way. These named tests prove the engine calls them in the right order.

**One real-server run per client,** on a bare PocketBase 0.40.4 with no hooks directory, because that's what hosted runs (section 10). Take the `pocketbase` lock and never use `api.vinny.io`. It must show an older build's edit keeping the pick (C4-8) and the upgrade path keeping it (C4-4, C4-6). Show the failure first, as `S-AND-01` did.

## 7. Backup envelope 2.2.0

`BACKUP_ENVELOPE_VERSION` on web (`lib/tasks/import-export.ts:24`), `TaskExport.currentVersion` on iOS, and Android's `Backup.kt` all move to `2.2.0`.

- Tasks gain optional `focusDate` and `focusRank`, omitted when unset. Archived and trashed rows carry them too, so Restore is honest.
- Export schemas add both fields. Web's export is `.strict()`, so it fails loudly without them (`lib/schema.ts`).
- On import, an invalid pair becomes unset and the task is kept, as in section 3.5. A bad pick must not refuse a whole backup.
- An older client importing 2.2.0 drops the fields. Web's import uses `.strip()`, and iOS and Android ignore unknown keys. Confirm each with a test against the new fixture.
- A restored old date is harmless, since it isn't today. A restored date of today can produce a conflict, and section 3.1 handles that.
- Don't edit a frozen fixture. Add `web-top-three-<version>.json` from a real export, byte-identical in all three repos, like `web-saved-14.2.0.json`. The workspace's fixture rules apply.

## 8. MCP

MCP has no queue, no cursor, and no stored rows, so section 6 doesn't apply to it. It reads the record and writes in one call.

- **Round trip:** `packages/mcp-server/src/types.ts` maps both fields in both directions, as it does `saved_at` (`:178`, `:200`). A test proves `update_task` and the bulk ops keep a pick. MCP 1.4.0 doesn't send the keys, so it can't clear one either. Read, not run.
- **Spawn:** the recurring instance from `complete_task` (MCP-10) starts with neither field.
- **`get_top_three` (optional, read-only):** returns `picks`, `needsTidy`, and `suggestions`. It takes an optional IANA `timeZone`, defaulting to the system's. It's the twentieth tool, so update `.claude/rules/mcp-server.md` and the tool count in `CLAUDE.md`. The server keeps its own copy of the rules, pinned by this corpus, as with the capture parser. Sonar will flag the duplication, and that's the known design.
- **No write tool in v1.** An agent can't pick for the user. The feature's point is the user's own choice.

## 9. Widgets

**The trap:** neither widget redraws at midnight. iOS uses one entry with `.never` (`Widgets/TodaysFocusProvider.swift`), and Android sets `updatePeriodMillis="0"` (`gsd_widget_info.xml:10`). A snapshot written today would show today's picks tomorrow, which breaks "counts only while `focus_date` is today".

The rule on both: **the widget compares the snapshot's date with the local date when it draws.** With a match, it shows the picks in rank order. Otherwise it shows the existing list, unchanged.

| | iOS and iPadOS | Android |
|---|---|---|
| Snapshot | `WidgetSnapshot` adds `focusDate: String?` and `focusTasks: [WidgetTask]`, both optional so an old snapshot still decodes. `WidgetSnapshotBuilder` fills them | `WidgetSnapshot` adds the same two, with defaults. `WidgetSnapshot.build` fills them |
| Fallback list | `today-focus` criteria, as today | `DO_FIRST` by due date, as today |
| Midnight | `getTimeline` returns entries for now and the next local midnight, with `.atEnd` | One inexact alarm at the next local midnight calls `GsdWidget().updateAll`, rescheduled by `BootReceiver` and on each refresh |
| Title | "Today's Focus" stays | Unchanged |
| Tests | `WidgetSnapshotBuilderTests`: picks first, yesterday's picks fall back, at most three | `WidgetSnapshot` unit test with the same three cases |

The widget doesn't add or remove picks in v1.

**Mac (D-6):** open, and Vinny needs to answer before sprint 2 builds this. The snapshot and provider code above are shared, so a yes adds a target and doesn't change this design.

## 10. Server

### Nothing relies on a hook

The hosted service at `api.vinny.io` runs a bare PocketBase binary with no hooks directory (ADR 0016). Top three uses no hook: selection, validity, conflict handling, carry-over, and tidy all run on the client, and the only server-side checks are the collection's own field validators. Client tests and the real-server runs use a hookless server, so a hook can't make them pass by accident. The Docker image's hooks don't touch these two fields.

### Fields

| Field | Type | Validators |
|---|---|---|
| `focus_date` | text | `max` 10, `pattern` `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, not required |
| `focus_rank` | number | `min` 0, `max` 3, `onlyInt`, not required |

A client's write must fail these only if the client is wrong. The clients normalize first (section 3.5), so these validators are a backstop. They don't catch everything: the server accepts `2026-02-30`, which fits the pattern, and stores a null `focus_rank` as `0`. So section 3.5's checks stay on the client.

### Checked on a real server

On 2026-10-31 I ran these on a throwaway PocketBase 0.40.4 with an empty hooks directory and a schema from `scripts/setup-pocketbase-collections.sh`. No client code was involved, so this proves the server's side only.

| Check | Result |
|---|---|
| Writing both keys before the fields exist | 200, and the keys are silently dropped |
| The draft, copied in as `.js`, then `migrate up` | Applied. Both fields stored with their validators. A second run applies nothing |
| A row from before the fields | Reads as `""` and `0` |
| A create that omits both keys | Stores `""` and `0` |
| A `PATCH` that omits both keys, as an older build sends | The pick stays |
| `focus_rank` of 4, -1, or 1.5 | 400 |
| `focus_date` of `2026-11-4` or `2026-11-04T00:00` | 400 |
| `""` and `0` | 200, and the pick clears |
| `migrate down`, with the file removed | Both fields and their data are gone |
| The hosted path: merging both fields into the fetched collection | 200. Validators stored, record count unchanged, 4 rejected, a valid pick stored |

### Self-hosted Docker

The draft is `docker/pb_migration_drafts/1794844800_top_three.js.draft`. It isn't wired in: the Dockerfile copies only `pb_migrations` and `pb_fresh_migrations`, and the suffix keeps it from loading. It can't live in `pb_fresh_migrations`, because `tests/docker-migrations.test.ts:114-118` rejects a fresh-only file and `gsd_build_fresh_migrations` would ship any `.js` file there to new installs.

Sprint 2 moves it to `docker/pb_migrations/` as a `.js` file with a then-current timestamp. It runs at container boot and needs no copy in `pb_fresh_migrations`. It also adds both fields to `scripts/setup-pocketbase-collections.sh`, with top-level validators rather than that script's `options` shape, and to `tests/fixtures/pinned-copies/pb-record-shape.json`.

### Hosted: a manual step for Vinny

Hosted doesn't run `docker/pb_migrations`, so moving the draft does nothing there. **Never point the hosted binary at that folder, or copy files from it into a migrations directory the hosted binary reads.** It also holds the encryption backfill, and hosted has no key. `serve` applies whatever is pending in its migrations directory each time it starts: in the check above, a reverted migration came straight back on restart. So this wouldn't wait for a deliberate step.

No agent does this: sprint rules bar `api.vinny.io`. It has to happen **before any client that reads these fields ships**.

1. Confirm the server version with `/opt/pocketbase/pocketbase --version`. Everything here was checked against 0.40.4.
2. Back up `pb_data` from the host.
3. In sprint 2, add both fields to `scripts/update-pocketbase-tasks-schema.sh`, in its `ensure_field` list and its verification list. It merges into the fetched collection, so it can't drop a field. Write the validators at the top level of each field. Don't copy the script's `options` blocks: 0.40.4 ignores them without an error, and a field sent with `options: { max: 3 }` stored `max: 0` and accepted a longer value. Read the fields back to check.
4. Dry-run against a local bare 0.40.4 holding a copy of the hosted schema, with `PB_URL` set. **That script defaults to production, so an engineer must never run it without `PB_URL`.**
5. Run it against hosted with admin credentials from the environment. The admin UI at `/_/` works too: add the two fields with the validators above.
6. Verify: `GET /api/collections/tasks` lists both fields with their validators. The record count hasn't changed. With a test account, a pick round-trips, a `PATCH` that omits both keys keeps it, and a `focus_rank` of 4 gets a 400.

**Rollback:** leave the fields in place. Old clients ignore them, and clients treat a missing or empty value as unset. Removing a field deletes its data, so only do that if nothing has shipped.

## 11. Implementation by client

| | Web | Apple | Android |
|---|---|---|---|
| Rules | `lib/top-three.ts` | `GSDKit/Sources/GSDModel/TopThree.swift` | `core/model/.../TopThree.kt` |
| Corpus test | `tests/data/top-three-corpus.test.ts` | `GSDModelTests/TopThreeCorpusTests.swift` | `TopThreeCorpusTest.kt` |
| Model | `lib/types.ts`, `lib/schema.ts` | `GSDModel/Task.swift` | `core/model/.../Task.kt` |
| Storage | No Dexie change | `GSDStore/Migrations.swift` | `core/store/.../TaskEntity.kt`, `GsdDatabase.kt` 3 to 4, `MigrationTest.kt` |
| Wire | `lib/sync/task-mapper.ts` | `GSDWire/PocketBaseTaskRecord.swift`, `TaskWireMapper.swift` | `core/sync/.../WireTask.kt`, `WireMapper.kt` |
| Contract | `lib/constants/sync.ts`, `components/sync/use-sync-auth-dialog.ts` | `GSDSync/SyncCursor.swift`, `App/Sync/SyncCoordinator.swift` | `core/sync/.../SyncEngine.kt` |
| Pull and push | `lib/sync/pb-sync-engine.ts`, `pb-pull.ts`, `pb-push.ts` | `GSDSync/SyncEngine.swift` | `core/sync/.../SyncEngine.kt` |
| Backup | `lib/tasks/import-export.ts`, `lib/schema.ts` | `GSDModel/TaskExport.swift` | `core/model/.../Backup.kt`, `core/store/.../BackupAssembler.kt` |
| Spawn and duplicate | `lib/tasks/crud/toggle.ts`, `duplicate.ts` | `GSDModel/RecurrenceEngine.swift`, `GSDStore/TaskStore.swift` (`duplicate`) | `core/model/.../RecurrenceEngine.kt`, `core/store/.../TaskStore.kt` |
| Surface | New `components/matrix-simplified/` section, `components/task-card/*` | `App/Matrix/` | `app/.../matrix/` |
| Widget | None | `GSDSnapshot/WidgetSnapshot.swift`, `WidgetSnapshotBuilder.swift`, `Widgets/TodaysFocusProvider.swift` | `app/.../widget/WidgetSnapshot.kt`, `GsdWidget.kt`, `notifications/BootReceiver.kt` |
| Docs | ADR for contract 4, `.claude/rules/pocketbase-sync.md` | `docs/` dated note | `docs/` spec amendment |

**MCP:** `packages/mcp-server/src/types.ts`, `write-ops/`, `tools/handlers/read-handlers.ts`, `tools/schemas/read-tools.ts`.
**Server:** `docker/pb_migration_drafts/` to `docker/pb_migrations/`, `scripts/setup-pocketbase-collections.sh`, `scripts/update-pocketbase-tasks-schema.sh`.
**Workspace:** the owner adds a top-three corpus row, contract 4, and the Android mechanism to the workspace `CLAUDE.md` contracts table. That file isn't in any repo.

## 12. Tests (TDD, red first)

1. The corpus test on each client, failing until the rules exist. Each test keeps only `location: active` rows before calling the function, and asserts every output.
2. The section 6 named tests, and the real-server run.
3. Unit: spawn and duplicate carry neither field; Add to today is refused when full; each write in section 3.2 goes through the normal edit path and queues a push; a pick changes no other field.
4. Round trip: backup and restore keep a pick; the new fixture imports on every client; an invalid pair becomes unset and keeps the task.
5. UI: the section with and without picks; carry-over only while a slot is free; Not now writes nothing; the accessible names in section 4.
6. Widgets: section 9.
7. MCP: the round trip, and `get_top_three` against the corpus.
8. E2E on web: add a pick, reload, see it first; move the clock past midnight, see the offer and no pick.
9. `verify-frontend-change` on web, and a simulator and emulator run on native, in two time zones.

## 13. Rollout

1. Vinny answers section 15 and D-6.
2. Vinny applies the fields to hosted (section 10). This comes first: a server without the fields returns 200 and drops both keys, so a client would lose the pick with no error.
3. Build on all three clients in parallel from the frozen corpus. Each client ships its own contract 4 bump with its own build.
4. MCP ships after the hosted fields exist. Its older versions stay safe (C4-8).
5. Vinny updates the Project's `parity/feature-matrix.md` row F2 and `contracts-and-decisions.md`.

A mixed fleet is fine. An older build ignores picks and can't clear them. The surface can ship on one client before the others, but the contract work can't be skipped on any of them.

## 14. Acceptance criteria

- All 123 corpus cases pass on web, iOS, and Android, from byte-identical copies, and MCP runs the cases that apply to it.
- Every section 6 named test passes, and the real-server run shows the failure and the fix on a hookless PocketBase 0.40.4.
- No upgrade path clears a pick on the server: queued payload, locally newer row, same-version row, sign-out and sign-in, or push-only drain.
- A real Return made before an upgrade survives that upgrade's contract 4 backfill, apart from the no-stored-version edge accepted in C4-4.
- Opening the app at midnight, or on a new day, writes nothing and pushes nothing.
- A widget never shows a pick dated other than the local today.
- With no picks, the matrix looks as it does today, apart from the one line in section 4.
- The section passes WCAG AA in light and dark, with the names in section 4.
- Hosted has both fields, verified as in section 10, before any client ships.

## 15. Decisions for Vinny

These are working defaults, written into the corpus. The Lead has read them and finds them reasonable, and they're all Vinny's to decide. Changing one changes the corpus, which doesn't freeze until he answers.

1. **Carry-over.** D-13 names it without defining it. This spec makes it an offer, never a write, showing the latest earlier date within seven days. If you want automatic roll-forward, section 3.4 explains the conflicts it brings.
2. **A completed pick frees its slot.** The alternative keeps it in the list, crossed off, holding the slot for the day. That's a real product difference: freeing lets someone keep adding, and holding keeps "three" meaning three.
3. **Eliminate tasks appear in suggestions when escalating.** The brief's order includes anything the escalation rule marks. Suggesting Q4 for today may feel odd. Dropping it is one line and a few corpus cases.
4. **No setting to hide the section in v1.** With no picks it's one line. Escalation has a setting, and D-13 doesn't mention one here.
5. **"From" copy, and "Today" as the section name.** Copy in section 4 is a first draft.
6. **D-6, the Mac widget.** Still open.
