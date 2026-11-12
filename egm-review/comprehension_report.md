**What this proposes**

Nothing: this is a descriptive reference, not a proposal. It is eleven Mermaid diagrams (components, three class diagrams, four sequence diagrams, an MCP component diagram, two state diagrams) plus a rendering note. Apart from one-line captions on sections 1 and 2, there is no prose, so every meaning has to be inferred from node names and edge labels.

**How the existing system works, per this document**

- **App:** A browser PWA stores tasks in IndexedDB through Dexie. UI components call a core library (task CRUD, quadrant logic, dependency graph, filters, Zod validation), and live queries re-render the UI when the database changes.
- **Tasks:** Each task carries `urgent` and `important` flags that resolve to one of four quadrants (Do First, Schedule, Delegate, Eliminate). Tasks can also have subtasks, time entries, dependencies on other tasks, recurrence, snooze and archive.
- **Sync:** A Sync Coordinator serialises sync requests and drives a PocketBase sync engine. The engine pushes a local queue of changes, then pulls remote records newer than a cursor and resolves conflicts by last-write-wins. A server-sent-events subscription applies changes from other devices and discards echoes of this device's own writes.
- **AI integration:** A separate MCP server lets Claude Desktop read and write the same PocketBase data through 19 tools over stdio.
- **Completion:** Completing a recurring task creates the next instance with a shifted due date.

---

# Stage 6: Comprehension Test Report

**Target:** `docs/uml-diagrams.md` (lines 1-690). No implementation plan range exists.
**Reviewer:** `egm-comprehension`, status completed. It read the persona and the target only. No standard, no context files, and no other repository file, so nothing below is checked against the code.

**Result:** 0 Blockers, 11 Majors, 6 Nits. No section was impossible to paraphrase. Note that the paraphrase above is a faithful reading of the document and is wrong about the shipped system in several places (19 tools, "Claude Desktop" only, push always before pull); Stage 5 records those as drift. A reader who trusts this file leaves with a wrong picture.

## Findings

### C-1. The product and its core concept are never introduced. Severity: Major
* **Affected Scope:** lines 1-9, 17, 34, 121, 668-671
* **Discrepancy Description:** "GSD", "Matrix Grid", "Quadrant Logic", and `QuadrantId` appear with no statement that this is an Eisenhower-matrix task manager. The four quadrant names appear only as state names at lines 668-671, and the mapping from (`urgent`, `important`) to a quadrant is never given.
* **Rationale & Recommendation:** Add a short intro: what the app is, the four quadrants, the flag-to-quadrant mapping, and what "GSD" stands for.

### C-2. Nothing shows how local changes enter the sync queue. Severity: Major
* **Affected Scope:** lines 392, 485-556
* **Discrepancy Description:** The full sync reads "syncQueue (pending items)", but task creation and completion only write `db.tasks`. No diagram shows who creates a `SyncQueueItem`. A reader cannot tell whether enqueueing happens in `createTask()`, in a Dexie hook, or elsewhere.
* **Rationale & Recommendation:** Add the enqueue step to sections 7 and 8, or state the mechanism.

### C-3. Four names for the sync cursor. Severity: Major
* **Affected Scope:** lines 254, 264-265, 405-407, 423, 472
* **Discrepancy Description:** The pull reads a "versioned lastClientUpdatedAt cursor" (405) and filters on `client_updated_at` (407), but the flow ends with "Update lastSyncAt cursor" (423). `pullRemoteChanges(lastSyncAt)` (254) uses another name, and `PBSyncConfig` has both `lastSyncAt` and `lastSuccessfulSyncAt` (264-265). `lastClientUpdatedAt` is in no class. "Versioned" is undefined, as is the relationship between `client_updated_at` and the `updatedAt` compared at line 472.
* **Rationale & Recommendation:** State which cursors exist, which one the pull uses, and which field last-write-wins compares.

### C-4. Remote deletions are missing from the pull phase. Severity: Major
* **Affected Scope:** lines 404-421 vs 458-459
* **Discrepancy Description:** The realtime path handles `delete`. The full-sync pull only upserts or skips. A reader cannot tell how a deletion made while this device was offline arrives.
* **Rationale & Recommendation:** Add the delete branch to section 5 or explain the mechanism.

### C-5. What starts a sync besides a click is unstated. Severity: Major
* **Affected Scope:** lines 244, 251, 266-267, 383, 389, 633-637
* **Discrepancy Description:** `autoSyncEnabled`, `syncIntervalMs`, and the "auto-sync" label imply a background trigger that no diagram shows. `requestSync(priority)` and `fullSync(triggeredBy)` both receive `'user'`; whether priority and trigger are one concept, and what other values exist, is not said. `RetryManager` (242) is never defined, the maximum retry count is not given, and it is unclear who issues the `requestSync` on "backoff elapsed + requestSync" (637).
* **Rationale & Recommendation:** List the triggers and define the retry policy in one place.

### C-6. Failure handling differs between the sequence and state views. Severity: Major
* **Affected Scope:** lines 385-431 vs 613-637
* **Discrepancy Description:** The sequence diagram shows only the success path. "Clear processed queue items" (402) does not say what happens to failed items, although `SyncQueueItem` has `retryCount`, `status`, `lastError`, and `failedAt`. In the state diagram `PartialFailure` is reachable only from `Pulling` (620), yet per-item failure is shown in the push loop (399). "Queue request (dedup)" (386) does not say what is deduplicated or which request wins.
* **Rationale & Recommendation:** Show one failure path and make both diagrams agree on it.

### C-7. Many nodes in section 1 connect to nothing. Severity: Major
* **Affected Scope:** lines 11-105
* **Discrepancy Description:** No edges at all: `useViewTransition()`, Settings Page, Task Card, Streaks, Trends, Notification Display, Notification Permissions. The Sync Coordinator has no incoming edge, so nothing in the diagram invokes sync. PB Realtime has no edge to the sync engine, although section 6 shows it calling `applyRemoteChange`. Metrics has no data source. Task Card has no edge to Task CRUD, although section 8 shows it calling `toggleCompleted()`.
* **Rationale & Recommendation:** Connect or remove the orphans. As drawn, the notification subsystem's role cannot be paraphrased.

### C-8. The TaskMapper and PBTask contract is not defined. Severity: Major
* **Affected Scope:** lines 291-292, 329, 397, 414
* **Discrepancy Description:** `PBTask` is used as a type but defined only by the aside "(snake_case)". "Preserves device-local fields" does not list which fields are device-local. "TaskMapper ..> DeviceInfo : reads device" gives no reason; it presumably stamps `device_id` for the echo filter at line 451, but that is not stated.
* **Rationale & Recommendation:** Name the device-local fields and say why the mapper reads the device id, or link the wire-model spec.

### C-9. The lifecycle contradicts itself and the data model. Severity: Major
* **Affected Scope:** lines 644-679
* **Discrepancy Description:** "Active --> Archived : auto-archive (N days completed)" (653) describes an Active task that has been completed for N days, and duplicates line 659. N is not tied to `autoArchiveDays` (203). "Completed --> RecurrenceSpawn --> Active" (660-662) reads as the completed task returning to Active, whereas section 8 says a new task is created. Quadrant transitions are partial with no indication whether the missing ones are forbidden. `snoozeTask`, `clearSnooze`, `restoreTask`, `moveQuadrant`, and `updateTask` appear nowhere else. "Draft" as a state implies persistence, while `TaskDraft` (143) looks like a transient input type.
* **Rationale & Recommendation:** Redraw the lifecycle so each transition matches a flow shown elsewhere in the file.

### C-10. `parentTaskId` and dependency direction are ambiguous. Severity: Major
* **Affected Scope:** lines 130-131, 226-227, 343-348
* **Discrepancy Description:** `parentTaskId` could mean the previous instance of a recurring task or a parent in a hierarchy. `dependencies` does not say whether it holds the tasks that block this one or the tasks this one blocks. "Blocking", "blocked", and "ready" are undefined.
* **Rationale & Recommendation:** Define each term in one sentence.

### C-11. The MCP data path and its interaction with sync are unclear. Severity: Major
* **Affected Scope:** lines 562-605
* **Discrepancy Description:** "Types --> API" has a type-conversion file calling the REST API. `bulk-operations.ts` has no edge to the API while `task-operations.ts` does. Analytics and System tools have no data source. "Dry-Run Mode" is undefined. How the server authenticates to PocketBase is unstated. Whether MCP writes carry a `device_id` is unstated, so their effect on the echo filter and on last-write-wins timestamps is unknown.
* **Rationale & Recommendation:** Show one client edge to PocketBase, state the auth method, and say how MCP writes look to the browser's sync.

### Nits

* **C-12. Enum values and units are missing (lines 113-231).** `RecurrenceType` values can only be inferred from lines 542-546; `QuadrantId` values are never listed. String fields without allowed values: `FilterCriteria.status`, `dueDate`, `dateRange`, `dependencyFilter`; `SyncQueueItem.operation` and `status`; `SyncHistoryRecord.type` and `status`. `notifyBefore`, `defaultLeadTime`, and `timeSpent` have no units. Four settings classes have no relationships, and the writer of `SyncHistoryRecord` is not shown.
* **C-13. Duplicated cycle-detection method (lines 338-364).** `wouldCreateCircularDependency` appears on both `DependencyModule` (async, `taskId`/`depId`) and `BFSCycleDetection` (sync, `source`/`target`). Nothing says when the check runs; section 7 does not show it.
* **C-14. Recurrence edge cases are unspecified (lines 526-556).** No `dueDate`; "+1 month" at month end; which fields the next instance copies or resets; whether `toggleCompleted(false)` (658) undoes the spawned instance.
* **C-15. The realtime create branch shows only the not-found case (lines 460-462).**
* **C-16. Terminology and links (lines 54-58, 63, 416).** "PB" is never expanded, "LWW" is not spelled out, PocketBase has no link. OAuth sign-in and notification flows have no diagram, although line 3 promises "key flows".
* **C-17. Rendering command (line 690).** `npx @mermaid-js/mermaid-cli mmdc -i ...` passes `mmdc` as an argument to the package's own binary; the usual form is `npx -p @mermaid-js/mermaid-cli mmdc -i ...`. Markdown input likely produces one numbered SVG per diagram, not one `docs/uml-diagrams.svg`. The reviewer did not run either; verify and correct.
