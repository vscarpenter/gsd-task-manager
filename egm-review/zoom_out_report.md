# Stage 5: Initial Zoom Out Report

**Target:** `docs/uml-diagrams.md` (lines 1-690, full file)
**Standard:** `zoom-out-standard.md`
**Context given to reviewers:** `ARCHITECTURE.md`, `PRODUCT.md`, saved copy of https://gsdtaskmanager.com/

## Reviewer Status

| Reviewer | Status | Notes |
| --- | --- | --- |
| `egm-zoom-out` | completed | Read the marketing page by targeted search only (too large to read whole). Did not check `SmartView` / `FilterCriteria` fields, UI component names, or the Analytics and Notifications subgraph. |
| `egm-inventive-catalyst` | completed | Read the first part of the marketing page and searched the rest. Persona caps its severity at Major. |

**Verdict:** the document does not pass the Zoom Out standard. 3 Blockers, 6 Majors, 5 Nits after merging the two reports.

## Blockers

### Z-B1. No objective or motivation. Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst` (rated Nit there)
* **Affected Scope:** lines 1-10
* **Discrepancy Description:** The only framing is one sentence at line 3. Nothing says what the product is, who it serves, or what constraint governs the design. The local-first rule ("IndexedDB is the local source of truth; sync and MCP are optional") is in `ARCHITECTURE.md` and `PRODUCT.md` but not here.
* **Rationale & Recommendation:** A reader with only this file cannot tell why the system has this shape. Add a short preamble: purpose (single-user Eisenhower matrix), the local-first invariant, the two opt-in integrations, the document's scope and audience, and links to `ARCHITECTURE.md`, `PRODUCT.md`, and ADRs 0002, 0003, 0005, 0013, 0015.

### Z-B2. The top-level diagram does not show the local-first, opt-in-sync architecture. Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst` (Finding 3)
* **Affected Scope:** lines 7-105, 485-556
* **Discrepancy Description:**
  * Sync, External Services, and AI Integration are drawn as unconditional peers of the core. Nothing marks them optional.
  * No edge connects a local write to sync. `Tasks --> Dexie` (line 85) and `SyncEngine --> Dexie` (line 100) are disconnected, and sections 7 and 8 never mention the sync queue. In code every task write enqueues inside the same transaction (`lib/tasks/crud/toggle.ts:62-74`); enqueue calls appear at about 30 sites across 15 domain files.
  * No edge from `PBRealtime` into the engine.
  * `OAuth Providers (Google / GitHub)` (line 64) omits Apple (`lib/sync/pb-auth.ts:21`; the marketing page lists all three).
  * `api.vinny.io` is hardcoded (lines 63, 589) though self-hosting is documented and the URL comes from `lib/env-config.ts`.
  * The native iPhone, iPad, and Mac clients that share the same backend are absent.
  * The service worker and JSON export/import are absent, though both are headline product claims.
  * The rule "MCP needs sync turned on" is not stated. A Node process cannot read browser IndexedDB, so this is a platform boundary worth one sentence.
* **Rationale & Recommendation:** The first diagram a reader sees contradicts the product's main design rule and hides the one coupling that explains how sync works. A reader would conclude that sync observes Dexie and could add a writer that never syncs. Redraw section 1 as a container view: a local core that is complete alone, a dashed opt-in boundary around sync, an explicit `task write -> syncQueue (same transaction) -> push` edge, PocketBase labelled "hosted or self-hosted", three OAuth providers, and native and MCP clients as other consumers of PocketBase.

### Z-B3. Class diagrams sit at code level and no longer match the code. Severity: Blocker
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst` (rated Major there)
* **Affected Scope:** lines 109-366 (sections 2, 3, 4)
* **Discrepancy Description:** Checked against source:

| Lines | Document says | Code says |
| --- | --- | --- |
| 206-211 | `AppPreferences`: `theme`, `defaultQuadrant`, `compactMode` | `pinnedSmartViewIds`, `maxPinnedViews`, `smartViewsEnabled` (`lib/types.ts:149-154`). No field overlaps. |
| 200-204 | `ArchiveSettings`: `autoArchiveEnabled`, `autoArchiveDays` | `enabled`, `archiveAfterDays: 30 \| 60 \| 90` |
| 193-198 | `NotificationSettings`: `defaultLeadTime` | `defaultReminder`, quiet hours, `permissionAsked`, `updatedAt` |
| 213-221 | `SyncHistoryRecord`: `type`, `pushed`, `pulled`, `error` | `pushedCount`, `pulledCount`, `conflictsResolved`, `failedCount`, `errorMessage`, `duration`, `deviceId`, `triggeredBy` |
| 115-141 | `TaskRecord` | missing `savedAt`, `focusDate`, `focusRank`, `deletedAt` |
| 282-288 | `PBSyncResult`: `success: Boolean`, `errors[]`, `completedAt` | `status` union of `success`, `error`, `partial`, `already_running`, `cancelled`, plus counts (`lib/sync/types.ts:123-135`) |
| 260-268 | `PBSyncConfig`: `pocketBaseUrl`, `authToken`, `syncIntervalMs` | none of these exist; tokens live in the PocketBase SDK auth store |
| 270-280 | `SyncQueueItem.timestamp`, `failedAt` as strings | numbers |
| 313-318 | `DeviceInfo.lastActiveAt` | `createdAt` |
| 235-366 | `PBSyncEngine`, `TaskMapper`, `PBRealtime`, `PBAuth`, `PocketBaseClient`, `DependencyModule` as classes | modules of exported functions; only `SyncCoordinator` is a class |
| various | `BFSCycleDetection`, `buildAdjacencyList`, `filterEchos`, `signInWithOAuth`, `processQueue`, `handleRecurrence` | zero occurrences in `lib/`, `components/`, `app/` (actual: `drainQueue`, `createAndQueueRecurringInstance`) |
| 338-349 | dependency functions return `Promise` and take `taskId` | `lib/dependencies.ts` is synchronous and pure, taking `(task, allTasks)` |

* **Rationale & Recommendation:** Field-level copies of `lib/types.ts` cannot be kept true by hand, and a reader now gets a wrong data model. `ARCHITECTURE.md` already says to prefer linked source over duplicated detail. Delete sections 2, 3, and 4. Replace them with one conceptual entity diagram (Task, Subtask, TimeEntry, SmartView, and the three task stores) with no field lists, and one sync module diagram showing responsibilities and dependency direction only. Link `lib/types.ts`, `lib/sync/types.ts`, and `lib/db.ts` for shapes. Cost: readers lose the at-a-glance field list.

## Majors

### Z-M1. Task lifecycle omits Trash and Saved and misstates deletion. Severity: Major
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** lines 642-679
* **Discrepancy Description:** No Trash state, though ADR 0015 defines three stores (`tasks`, `archivedTasks`, `deletedTasks`) with each id in exactly one. No Saved state (`savedAt`). `Active --> Archived : auto-archive (N days completed)` (line 653) contradicts itself, since only completed tasks archive. `RecurrenceSpawn` is drawn as a state after `Completed`, but the next instance is created in the same transaction as the completion (`toggle.ts:62-75`). The quadrant sub-states (667-678) list 6 of the 12 possible moves.
* **Rationale & Recommendation:** The one-store-at-a-time rule is the most important fact about task state, and it is the part that is missing. Reduce to Active / Saved / Completed / Archived / Trash with the transitions between stores. Replace the quadrant sub-states with a note that the quadrant is derived from `urgent` x `important`.

### Z-M2. Sync flow and coordinator state diagrams misstate the contract. Severity: Major
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** lines 370-432, 436-480, 609-638
* **Discrepancy Description:**
  * "Clear processed queue items" (402): rows that exhaust retries are kept as `status: 'failed'` (`lib/sync/types.ts:78-86`).
  * "Update lastSyncAt cursor" (423): the pull cursor is `lastClientUpdatedAt`, which line 405 itself names.
  * Push-then-pull is drawn as fixed. The engine pulls first when a backfill is owed (`pb-sync-engine.ts:216-218`).
  * `AuthFailure : 401/403` (621-622): only a 401 counts.
  * No `cancelled` or `already_running` outcome.
  * The coordinator is given Pushing / Pulling / RetryBackoff states. In code it holds only `isRunning` plus a deduplicated queue; backoff is a gate on automatic requests (`canRunAutoSync`).
  * `Set isRunning = false` then `processQueue()` (425-430): the flag is deliberately held across the drain (`sync-coordinator.ts:96-106`). The drawn order is the overlap race the code comments say was closed.
  * Realtime apply (472) is drawn as a timestamp comparison only. Archive and Trash tombstone guards and the far-future hold-off also apply. Deletion reconciliation and session-ownership checks are absent from section 5.
* **Rationale & Recommendation:** These diagrams are at the right altitude and are the most useful part of the document, so readers will trust them. Keep one sync sequence and fix the points above. Drop section 10 or collapse it to Idle / Running (queue) with outcome labels. Link ADRs 0002 and 0003.

### Z-M3. MCP server diagram is wrong on inventory and too narrow on clients. Severity: Major
* **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
* **Affected Scope:** lines 560-605
* **Discrepancy Description:** "Tools (19)" with hyphenated names. The schemas define 20 snake_case tools: 7 read, 5 write, 5 analytics, 3 system. Listed but nonexistent: `filter-tasks`, `get-dependencies`, `health-check`, `get-config`, `completion-trends`, `streaks`. Shipped but unlisted: `get_top_three`, `get_token_status`, `get_upcoming_deadlines`, `get_task_insights`, `get_help`, `get_cache_stats`, `validate_config`. `Types --> API` (603) makes a type-conversion module the network caller; the package has `pocketbase-client.ts`, `api/client.ts`, `cache.ts`, and a write rate limiter. The only client shown is "Claude Desktop".
* **Rationale & Recommendation:** A per-tool list is too detailed for this document and is already stale. Show four tool categories without counts or names, one PocketBase client edge, and "any MCP client". State the architectural facts: stdio transport, reads and writes go to PocketBase and not the browser's IndexedDB, writes support dry-run, sync must be on. Link `packages/mcp-server/README.md` and ADR 0005.

### Z-M4. The document is orphaned and overlaps other architecture docs. Severity: Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** whole file
* **Discrepancy Description:** A repo search for `uml-diagrams` finds only the file's own line 690. `ARCHITECTURE.md` does not link to it. `docs/architecture.html`, `docs/cloud-sync-explainer.html`, `docs/security-trust-boundaries.md`, and ADRs 0002 to 0005 cover overlapping topics (contents not read by the reviewer). Inside the file, section 4 re-declares `TaskRecord` from section 2, and section 6 repeats the last-write-wins branch from section 5.
* **Rationale & Recommendation:** An unlinked parallel description with no owner is how Z-B3 happened. Either cut it to three or four high-altitude diagrams and add it to the `ARCHITECTURE.md` table, or retire it and move the surviving diagrams into the ADRs they illustrate.

### Z-M5. Retry-exhausted changes reach a terminal state with no way out. Severity: Major (advisory, about the system)
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** lines 632-637 (section 10), 270-280 (`SyncQueueItem`)
* **Discrepancy Description:** The diagram ends failure in `Idle` with "notify user". `lib/sync/queue.ts:29-30` says of an exhausted row that nothing re-arms it, so it can neither reach the server nor be retried. The eventual outcome is that a remote-absence reconcile moves the task to Trash, which purges on a retention window. Android re-arms failed rows on every launch and manual sync, so the web behavior is a choice. The diagram also hides the queue-row state machine (pending, failed, protect/abandon).
* **Rationale & Recommendation:** Re-arm failed rows on an explicit user sync and on launch, so the retry cap bounds each automatic burst but does not retire the row. Add a queue-row state diagram. Costs: a permanently failing row is retried every launch, so re-arming needs the transient/permanent split from `error-categorizer.ts`; more 429 pressure; `holdsOffFarFutureRemote` must then count failed rows; and a row that can retry forever needs a visible "N changes not synced" indicator, which `PRODUCT.md`'s calm principle resists.

### Z-M6. Last-write-wins discards the losing version though a recovery buffer exists. Severity: Major (advisory, about the system)
* **Reviewer Lens:** `egm-inventive-catalyst`
* **Affected Scope:** lines 416-420, 472-476
* **Discrepancy Description:** Both diagrams show "Upsert" or "Skip". `applyPreparedRecord` overwrites the local row; `pushUpsert` dequeues a stale local edit. The losing content is gone, including an offline edit that was never pushed. ADR 0003 accepts this after rejecting CRDT, per-field merge, and a conflict prompt. A fourth option was not examined: keep last-write-wins as the resolver and write the losing snapshot to the existing per-device recovery buffer.
* **Rationale & Recommendation:** Write the loser to `deletedTasks` with a "superseded" reason, or to a sibling table on the same retention window. Costs: a superseded snapshot shares its id with the live row, so it needs its own keying or table and a Dexie migration under the one-id-one-table rule; local storage until purge; a new "earlier version" concept in Trash. The benefit covers only concurrent offline edits, which the ADR judges rare. If no user has reported loss, deferring is defensible, and the document should then state the loss in words instead of drawing "Skip".

## Nits

* **Z-N1. Sync enqueueing is hand-rolled in every domain writer.** (`egm-inventive-catalyst`, system-level.) One `commitTaskMutation` helper or Dexie hooks could own transaction scope and enqueue. `lib/tasks/crud/helpers.ts` already holds five call sites. Costs: hooks fire for sync-origin writes and need an origin flag; delete and archive carry bespoke payload rules a generic seam must not flatten. The documentation half of this finding is in Z-B2.
* **Z-N2. MCP server keeps mirrored copies of domain logic.** (`egm-inventive-catalyst`, lines 568-604.) Capture parser, recurrence, dependency cleanup, and constants are copies guarded by pinned-copy tests. A shared dependency-free module is possible; the tests already cover the risk.
* **Z-N3. Implementation detail in sequence diagrams.** (`egm-zoom-out`, lines 427, 509-514, 546, 555.) Toast strings, `nanoid`, `db.tasks.add(taskRecord)`, and "Animation + confetti" are presentation and library choices. Remove them.
* **Z-N4. Version pin in a node label.** (`egm-zoom-out`, line 49.) "Dexie v4" duplicates `package.json` and will go stale.
* **Z-N5. Function-named participants.** (`egm-zoom-out`, lines 492-493, 530-532.) `createTask()`, `resolveQuadrantId()`, `toggleCompleted()`, `handleRecurrence()` as lifelines put the diagram at call-graph level. Use component-level participants.

Also noted: lines 33 and 36 list Bulk Operations and Smart Views as web core, while `PRODUCT.md` says bulk multi-select and custom smart-view creation are deliberately absent on web.

## YAGNI and reuse

No finding. The target describes a shipped system and proposes nothing new.
