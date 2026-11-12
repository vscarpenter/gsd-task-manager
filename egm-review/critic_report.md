# Goldfish Review Report: Stage 7 Critic Review

**Target:** `docs/uml-diagrams.md` (lines 1-690, full file)
**Standard:** `feature-spec-standard.md` (design, structural). Style used its persona only.
**Round:** 1 of 1. The consolidated mode applies no fixes, so no second round ran.

## Reviewer Status

| Reviewer | Status | Raw counts | Notes |
| --- | --- | --- | --- |
| `egm-design` | completed | 5 Blocker, 9 Major, 5 Nit | Read `lib/types.ts` and four `lib/sync` files in full; the rest by search. Read only ADR 0016. Did not check section 4 function names, the bulk module, or snooze semantics in code. |
| `egm-structural` | completed | 2 Blocker, 5 Major, 6 Nit | Did not render the Mermaid or open the ADRs. |
| `egm-style` | completed | 0 Blocker, 8 Major, 10 Nit | Did not read source code or render diagrams. |

**Verdict:** fails the feature-spec standard for two separate reasons. First, it is a diagram catalogue: four of the five required areas (problem, goals and non-goals, alternatives, risks) are absent. Second, the one area it covers has drifted from the shipped code, worst in the sync and MCP diagrams.

**After deduplication:** 5 Blockers, 15 Majors, 9 Nits.

A caution on the first reason: this file was never written as a feature spec. Holding a diagram reference to a spec standard produces K-B1, K-B2, K-M1, and K-M2 almost by construction. They are real gaps only if this file is meant to be the single design description of the app. If `ARCHITECTURE.md` plus the ADRs hold that role, the cheaper answer is links, not new sections.

## Prioritized Findings (Blockers -> Major -> Nits)

### K-B1. No Alternatives Considered. Severity: Blocker
* **Reviewer Lens:** `egm-design`, `egm-structural`
* **Affected Scope:** whole file
* **Discrepancy Description:** IndexedDB as source of truth, PocketBase, last-write-wins, SSE realtime, the push-then-pull queue, BFS cycle detection, and the stdio MCP server are each presented as the only path. No rejected option or trade-off appears.
* **Rationale & Recommendation:** The standard treats a single-path spec as a fail. The decisions exist in ADRs 0001, 0002, 0003, 0005, and 0008. Add a section that gives each rejection in one or two lines and links the ADR.

### K-B2. No Risks and Mitigations. Severity: Blocker
* **Reviewer Lens:** `egm-design`, `egm-structural`
* **Affected Scope:** whole file; the only failure content is state names at lines 620-637
* **Discrepancy Description:** No failure modes, security implications, or scale limits are stated. Risks that are real in the code and invisible here:
  * Last-write-wins depends on client clocks. The code has a skew ceiling (now + 5 min), a cursor clamp with a 30-second overlap, and a far-future hold-off for pending writes.
  * Last-write-wins is whole-record, so concurrent edits to different fields lose one side with no notice.
  * A refused token looks like an empty account (200 with no items). The code guards this with `confirmSessionIdentity`.
  * Push is throttled at 100 ms per operation (`THROTTLE_MS`), so a 1,000-item offline backlog takes 100+ seconds.
  * Queue rows retire at `MAX_RETRIES` and nothing re-arms them on web.
  * Cross-account replay, guarded by `assertSyncSessionCurrent`.
* **Rationale & Recommendation:** Add a table: risk, trigger, mitigation in code, remaining exposure. Link `SECURITY.md` and `docs/security-trust-boundaries.md`.

### K-B3. Trust boundaries are not shown, and the omission contradicts the product's privacy position. Severity: Blocker
* **Reviewer Lens:** `egm-design`, `egm-style` (M1)
* **Affected Scope:** lines 62-70, 98-99, 103-104, 302-306, 588-590
* **Discrepancy Description:**
  * Task data flows to "PocketBase Server (api.vinny.io)" with no mark that sync is opt-in and off by default. `PRODUCT.md` and the marketing page ("Off by default. Your matrix stays on this device") make that the foundation.
  * Nothing says what the server can read. ADR 0016 records that the hosted service stores task content as plaintext and the operator has technical access, while the self-hosted image encrypts five fields at rest.
  * The MCP path shows no credential. The server needs `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` (`packages/mcp-server/src/server/config.ts:97-98`): a long-lived bearer token in a local config file that gives an LLM client write and delete access to every task.
  * `PBAuth` is drawn as `signInWithOAuth(provider)` to "Google / GitHub". The code also allows Apple (`lib/sync/pb-auth.ts:21`) and uses a manual code flow with PKCE and a hosted callback, chosen because the SDK's realtime OAuth form allows code theft. That mitigation is absent.
* **Rationale & Recommendation:** Add a trust-boundary overlay to section 1 (device, hosted or self-hosted PocketBase, OAuth providers, MCP host process). Label the sync edge "opt-in". State the plaintext versus encrypted split per deployment and link ADR 0016. Show the token on the MCP edge. Add or link an OAuth sequence.

### K-B4. Sync diagrams misdescribe conflict resolution and deletion. Severity: Blocker
* **Reviewer Lens:** `egm-design`, `egm-style` (M2, M3)
* **Affected Scope:** lines 392-423, 449-477, 615-637
* **Discrepancy Description:** An engineer debugging from these diagrams would get data-loss behavior wrong.
  * Line 402 "Clear processed queue items": failed items move to `status: 'failed'` and are kept.
  * Lines 395-400 show push as unconditional. Push fetches a remote index and skips when the remote is newer (`lib/sync/pb-push.ts:265`).
  * Line 423 "Update lastSyncAt cursor" contradicts line 405 and the code. `lastSyncAt` is deliberately never advanced (`pb-sync-engine.ts:329-330`); the cursor is `lastClientUpdatedAt`, stamped with a pull contract version. Across the file one cursor has three names (254, 264-265, 405, 423).
  * Push-then-pull is not fixed. The engine pulls first when a contract backfill is owed (`pb-sync-engine.ts:190-209`; ADRs 0019, 0020).
  * Line 459 "Delete task by id" on a realtime delete: a pending local write suppresses the delete, and retry-exhausted edits go to Trash.
  * Lines 460-465 say a realtime create means "not found, add". A create can name an existing task and then follows the strictly-newer rule.
  * The archive and trash tombstone guard is missing from both pull and realtime (ADRs 0013, 0015). Without it the diagram describes the bug that produced 167 duplicate tasks on one device.
  * Remote deletions found during pull (`reconcileDeletedTasks`) and resurrect-on-sight are absent.
  * Line 451 shows only the echo filter. The handler also validates the record and drops events for another owner (`pb-realtime.ts:90-109`).
  * No auth step: `fullSync` starts with `ensureValidAuth` and a session-owner check and can return `cancelled`.
* **Rationale & Recommendation:** Redraw sections 5 and 6 from `pb-sync-engine.ts`, `pb-push.ts`, and `pb-pull.ts`. If full detail is too large for a diagram, state the invariants in prose under each one and link ADRs 0003, 0013, 0015, 0019, 0020.

### K-B5. The MCP diagram does not match the shipped tool surface. Severity: Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** lines 572-604
* **Discrepancy Description:** "Tools (19)" sums 6 + 5 + 5 + 3; the schemas define 20. Names are snake_case in code. Drawn but not found: `filter-tasks`, `get-dependencies`, `health-check`, `get-config`, `completion-trends`, `streaks`. Shipped but not drawn: `get_top_three`, `get_token_status`, `get_upcoming_deadlines`, `get_task_insights`, `validate_config`, `get_help`, `get_cache_stats`. `Types --> API` (603) makes a type-conversion file the network client; the real client has a retry layer, a cache, and a write rate limiter. "Claude Desktop" is the only client shown.
* **Rationale & Recommendation:** Regenerate from `packages/mcp-server/src/tools/schemas/`. Drop the count or pin it with a test. Show that MCP writes bypass the browser's sync queue and reach other devices through realtime or the next pull.

### K-M1. No Problem Statement. Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-structural`
* **Affected Scope:** lines 1-5
* **Discrepancy Description:** Line 3 describes the document, not the user problem.
* **Rationale & Recommendation:** Add three or four sentences drawn from `PRODUCT.md` lines 9-19, or link it.

### K-M2. No Goals and Non-Goals. Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-structural`
* **Affected Scope:** whole file
* **Discrepancy Description:** Non-goals that shape the design are absent: no server-side source of truth, no team or shared tasks, no telemetry (ADR 0017), no bulk multi-select or custom smart-view creation on web.
* **Rationale & Recommendation:** Add the section.

### K-M3. Diagram shows capabilities `PRODUCT.md` says are absent on web. Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-style`
* **Affected Scope:** lines 33, 36, 88, 171-180
* **Discrepancy Description:** "Bulk Operations" and "Filters & Smart Views" are drawn as core modules without qualification, and `SmartView.isBuiltIn` implies user-created views. No reviewer confirmed whether the bulk module still exists in `lib/`.
* **Rationale & Recommendation:** Check `lib/`, then remove the boxes or label them with their real caller ("library only; no web UI").

### K-M4. Data model (section 2) has drifted from `lib/types.ts`. Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** lines 115-221
* **Discrepancy Description:** Same drift as Stage 5 finding Z-B3 (`TaskRecord`, `NotificationSettings`, `ArchiveSettings`, `AppPreferences`, `SyncHistoryRecord`). New here: `TaskDraft` marks `recurrence`, `tags`, `subtasks`, `dependencies`, and `notificationEnabled` as required when all are optional. The model omits the stores `archivedTasks`, `deletedTasks`, `syncQueue`, and `syncMetadata`.
* **Rationale & Recommendation:** Regenerate from `lib/types.ts` and `lib/schema.ts`, or cut the field lists as Z-B3 recommends. Add the stores either way, since the one-table-at-a-time rule depends on them.

### K-M5. Sync class diagram (section 3) has drifted, with one security-relevant misstatement. Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** lines 239-329
* **Discrepancy Description:** `PBSyncConfig` is drawn holding `authToken`. The token lives in the SDK auth store in localStorage, not in the IndexedDB config. Missing from the type as drawn: `enabled`, `userId`, `email`, `provider`, `lastClientUpdatedAt`, `pullCursorVersion`, retry fields, `localTaskOwnerUserId`. `applyRemoteChange` takes a third `ownerId` argument the diagram omits; that argument is the cross-account guard. `SyncCoordinator` has `drainQueue`, `onPulled`, and `cancelPending`, not `processQueue`.
* **Rationale & Recommendation:** Regenerate or cut. Keep `ownerId` visible because it is a safety property.

### K-M6. Coordinator state machine describes retry behavior the code does not have. Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** lines 613-637
* **Discrepancy Description:** "RetryBackoff --> Running : backoff elapsed" implies a timed retry. The coordinator has none; an automatic request during backoff is dropped (`canRunAutoSync`, lines 113-131) and something else must ask again. "max retries exceeded" hides that automatic sync then stays blocked with no drawn exit; the reviewer did not trace what resets the count besides a success. Failure states go straight to Idle, but the code drains the queue after every outcome. `PartialFailure` is drawn from Pulling but is caused by push failures. "401/403": only 401 counts. `cancelled` is missing.
* **Rationale & Recommendation:** Redraw from `sync-coordinator.ts` and `retry-manager.ts`. State who re-triggers after backoff and what clears the retry cap.

### K-M7. Task lifecycle omits Trash and Saved and misstates archive and delete. Severity: Major
* **Reviewer Lens:** `egm-design`, `egm-style` (M4, M5), `egm-structural` (11)
* **Affected Scope:** lines 646-678
* **Discrepancy Description:** No Trash state; delete moves a task to `deletedTasks` with a retention window (ADR 0015). The only drawn exit is "Archived --> [*] : permanent delete". No Saved state (ADR 0018); a saved task cannot be completed (`toggle.ts:191`). Line 653 archives an Active task for being "N days completed" and duplicates line 659. No manual archive, though `archiveTaskNow` exists. Snoozed is drawn as a state separate from Active; no reviewer confirmed that snooze removes a task from the matrix. Six of twelve quadrant moves are drawn.
* **Rationale & Recommendation:** Redraw with the three stores as top-level states and note that archive and trash rows are not synced. Replace the quadrant edges with one note.

### K-M8. Creation and recurrence sequences omit the sync enqueue and misname internals. Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** lines 498-519, 535-555
* **Discrepancy Description:** Neither flow shows a write to `syncQueue`. Every task mutation runs in one transaction over `tasks`, `deletedTasks`, `syncQueue`, and `syncMetadata` (`lib/tasks/crud/helpers.ts:79-83`). Line 509 "nanoid": create uses `generateId` from `lib/id-generator`. Line 548: the recurrence path builds the next record inline and does not call `createTask`. The completion update and next-instance insert are drawn as separate writes; the document should say whether they share a transaction. A recurring task with no `dueDate` produces no next due date (`toggle.ts:166`), and that branch is not drawn.
* **Rationale & Recommendation:** Add the enqueue step and the debounced `requestSync('auto')` to both flows, and fix the names.

### K-M9. Scale and availability limits are unstated. Severity: Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** lines 48-50, 62-65, 357-361, 407
* **Discrepancy Description:** No bound on local data size, pull size, or realtime fan-out. Cycle detection builds an adjacency list on each check, which implies a full table read per dependency add. The hosted PocketBase is one binary on one EC2 instance (ADR 0016), a single point of failure for sync and sign-in. Deletion reconciliation relies on a full listing being consistent on a single node (`lib/sync/pb-pull.ts:267`); that assumption breaks if the server is ever replicated.
* **Rationale & Recommendation:** State the limits and the degraded behavior: offline means full function minus sync. That is the main mitigation and the document never says it.

### K-M10. Architecture content is grouped by diagram type, not by subsystem. Severity: Major
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** lines 7-679
* **Discrepancy Description:** Eleven sibling H2 sections with no parent and no narrative. Sync is spread across sections 1, 3, 5, 6, and 10.
* **Rationale & Recommendation:** Group under core/data, sync, and MCP, with the diagrams as H3 beneath each.

### K-M11. Nine of eleven diagrams have no lead-in. Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-style` (N3)
* **Affected Scope:** lines 235-679
* **Discrepancy Description:** Sections 3 to 11 go straight from heading to code fence.
* **Rationale & Recommendation:** Give each diagram one sentence saying what it shows and what it leaves out.

### K-M12. The document is unlinked and carries no status. Severity: Major
* **Reviewer Lens:** `egm-structural`, `egm-design` (N3)
* **Affected Scope:** whole file
* **Discrepancy Description:** `ARCHITECTURE.md` does not list it. Its only outbound link is mermaid.live. It has no owner, version, or last-verified date, so a reader cannot tell whether it matches the shipped app.
* **Rationale & Recommendation:** Add a metadata block and links from each section to its source directory and ADR, and add a row in `ARCHITECTURE.md`. Or retire the file in favor of the ADRs. ADR 0016 added a pinned check for `SECURITY.md`; the same pattern fits here.

### K-M13. The conflict rule is stated three ways. Severity: Major
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** lines 407, 416, 419, 472, 474
* **Discrepancy Description:** "Remote is newer (LWW)" (416), "Remote updatedAt > Local updatedAt" (472), and a pull filter on `client_updated_at` (407). The compared field and the tie behavior (`>` or `>=`) are unclear. "LWW" is never expanded.
* **Rationale & Recommendation:** State the comparison once as a field expression and reuse it. Reference ADR 0003.

### K-M14. Rendering claims are untested. Severity: Major
* **Reviewer Lens:** `egm-style`, `egm-structural` (12), `egm-design` (N4)
* **Affected Scope:** lines 685-690
* **Discrepancy Description:** "Render natively" (685) is followed by "with Mermaid extension" (687). The command on line 690 passes `mmdc` as an argument to the package's own binary; the usual form is `npx -p @mermaid-js/mermaid-cli mmdc -i ... -o ...`. With Markdown input the CLI likely writes one numbered SVG per diagram, not one `docs/uml-diagrams.svg`. No reviewer ran the command.
* **Rationale & Recommendation:** Run the command, then write down the form that works and the files it produces.

### K-M15. A specific host is presented as the PocketBase server. Severity: Major
* **Reviewer Lens:** `egm-style`, `egm-design` (N1)
* **Affected Scope:** lines 63, 589
* **Discrepancy Description:** Both labels hard-code `api.vinny.io`. A reader cannot tell whether this is the default, an example, or a requirement.
* **Rationale & Recommendation:** Label it "PocketBase (hosted default or self-hosted)".

### Nits

* **K-N1. Shipped subsystems missing from section 1** (`egm-design`): service worker and caches (ADRs 0004, 0012), import/export backup (ADR 0014), background sync, health monitor, retry manager. "Dexie v4" is a version pin that will go stale.
* **K-N2. Heading and ordering conventions** (`egm-structural`, `egm-style`): line 7 breaks the "Type, then Subject" pattern; section 9 sits between the sequence and state groups; "Rendering" is an unnumbered sibling of numbered sections.
* **K-N3. "PB" is never expanded and components have several names** (`egm-style`): "PB Sync Engine" / `PBSyncEngine`; "PB Realtime SSE" / "PB Realtime (SSE)"; "IndexedDB via Dexie v4" / "IndexedDB (Dexie)"; `useLiveQuery()` / "LiveQuery" / "Live query"; "Write Tools" / "Write Ops"; "Dependency Graph" / `DependencyModule`.
* **K-N4. Assistant naming** (`egm-style`, lines 67-69, 564-565): "Claude Desktop" in section 1, "Claude AI" inside a "Claude Desktop" subgraph in section 9. Use "MCP client (e.g. Claude Desktop)".
* **K-N5. Signature and notation inconsistencies** (`egm-style`, `egm-structural`): `toggleCompleted(taskId)` (536) against `toggleCompleted(true)` (651); `!==` (542) against `!=` (660); `-client: PocketBase` (310) uses a different attribute form from every other class; line 648 puts `createTask()` before validation while section 7 validates first.
* **K-N6. Shorthand and sample values** (`egm-style`, `egm-design`): "dedup" (386); literal toast text "Synced: 3↑ 2↓" (427), which the code shows only when something moved; "✓ Animation + confetti" (555).
* **K-N7. Mixed line-break markup and misleading comments** (`egm-style`, `egm-structural`): `\n` in most labels, `<br/>` on 546; `\n` renders literally in some Mermaid versions. Comments "Hooks → Core" (79) and "UI → Hooks" (72) head edges that go elsewhere.
* **K-N8. Vague qualifiers** (`egm-style`, lines 3, 9, 111): "high-level", "major subsystems", "key flows", "core domain types". "UML" overstates: sections 1 and 9 are Mermaid flowcharts.
* **K-N9. Whitespace-only lines inside code fences** (`egm-structural`): lines 384, 390, 394, 401, 450, 452, 500, 541, 545, 547, 571, 616, 628, 635, 657.

## Checks that passed

Heading levels are H1 to H2 with none skipped. All eleven code fences are closed and language-tagged. Sections number 1 to 11 without gaps. Quadrant names match `PRODUCT.md`. The prose contains no promotional language.
