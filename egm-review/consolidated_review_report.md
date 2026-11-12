# Consolidated Review Report

**Target:** `docs/uml-diagrams.md` (690 lines, eleven Mermaid diagrams)
**Mode:** consolidated, no checkpoints, no edits applied to the target
**Date:** 2026-11-11

## Read this first

1. **This is a review of one document, not of the application.** The request was "this entire application". EGM reviews a design document, and no single file describes the whole app. `docs/uml-diagrams.md` was picked as the closest fit without the owner naming it. If a different file was meant, the stage reports do not transfer.
2. **The main result:** the document is wrong about the shipped system in enough places that a reader who trusts it leaves with a false picture of sync, the data model, and the MCP server. Nothing in the repo links to it.
3. **The recommended fix is deletion, not repair.** Stages 6 and 7 together ask for roughly thirty additions. Stage 8 judged that applying them would create a fourth hand-maintained architecture description in a repo where two others (`docs/architecture.html`, `docs/cloud-sync-explainer.html`) have already drifted.
4. **Stage 9 did not run.** The document has no implementation plan section, so the Implementation Readiness reviewers had nothing to audit. This is "not run", not "no findings".

## Stage results

| Stage | Reviewers | Status | Blocker | Major | Nit | Report |
| --- | --- | --- | --- | --- | --- | --- |
| 5 Initial Zoom Out | zoom-out, inventive-catalyst | completed | 3 | 6 | 5 | `zoom_out_report.md` |
| 6 Comprehension Test | comprehension | completed | 0 | 11 | 6 | `comprehension_report.md` |
| 7 Critic Review | design, structural, style | completed | 5 | 15 | 9 | `critic_report.md` |
| 8 Intermediate Zoom Out | zoom-out | completed | 2 | 8 | 2 | `intermediate_zoom_out_report.md` |
| 9 Implementation Readiness | implementation-readiness, codebase-details, style | not run | n/a | n/a | n/a | none |

Stage 7 counts are after merging three reviewers. The Stage 8 Blockers are about the remediation plan, not new defects in the document. Eight distinct Blockers concern the document itself: Z-B1, Z-B2, Z-B3, K-B1 to K-B5.

## What is wrong with the document

In order of how much damage a reader takes:

* **Sync is misdescribed where it matters for data loss** (K-B4, Z-M2). The diagrams show failed queue items being cleared (they are kept as `failed`), push as unconditional (it skips when the remote is newer), a `lastSyncAt` cursor (the code never advances it; the cursor is `lastClientUpdatedAt`), a realtime delete that always deletes (a pending local write suppresses it), and no tombstone guard. The drawn order `isRunning = false` then drain is the overlap race the code closed.
* **The first diagram contradicts the product's main rule** (Z-B2, K-B3). Sync and MCP are drawn as unconditional peers of the core. Nothing shows that sync is off by default, and no edge connects a local write to the sync queue.
* **The class diagrams no longer match the code** (Z-B3, K-M4, K-M5). `AppPreferences` shares no field with `lib/types.ts`. `PBSyncConfig` is drawn holding `authToken`, which it does not. Six of the seven "classes" in the sync layer are modules of functions.
* **The MCP diagram lists tools that do not exist** (K-B5, Z-M3). It says 19 hyphenated tools; the schemas define 20 in snake_case. Six drawn names have no match and seven shipped tools are missing.
* **The task lifecycle has no Trash and no Saved state** (Z-M1, K-M7).
* **The document does not say what it is for** (Z-B1, C-1), and nothing links to it (Z-M4, K-M12).

## Where the reviewers disagree

| Topic | One side | Other side | Resolution taken here |
| --- | --- | --- | --- |
| Class diagrams | Stage 5: delete | Stage 7: regenerate or cut; Stage 6: add enums and units | Delete. Hand regeneration is how they drifted. |
| Sync diagrams | Stage 5: keep one, simplify | Stage 7: redraw with ten more behaviors | Delete, or keep one short sequence with a prose invariant list. |
| MCP diagram | Stage 5: categories only, no counts | Stage 7: regenerate from schemas, pin the count with a test | Delete. The package README owns the tool list. |
| Missing spec sections | Stage 7: Blocker (alternatives, risks) | Stage 8: artifact of applying a spec standard to a diagram file | Links, not sections. Checked: all 20 ADRs have an Alternatives section. |
| Section 1 | Stage 6: remove orphan nodes | Stages 5 and 7: add native clients, service worker, trust zones, internal modules | Redraw as a container view of eight to ten boxes. |

## The case against deleting it

Stage 8's recommendation should not be accepted without the counter-argument.

* **Diagrams teach faster than ADRs.** Twenty ADRs plus two security files are accurate but take an hour to read. A new contributor, or an agent session starting cold in the iOS or Android repo, gets oriented faster from one correct picture. Deleting everything removes that.
* **One fact would have no written home.** A spot check after Stage 8 searched `ARCHITECTURE.md`, `SECURITY.md`, `docs/security-trust-boundaries.md`, the ADRs, and `.claude/rules/` for the rule that an ordinary task write and its sync-queue row share one transaction. It is written only for archive and trash moves (ADR 0013, `archive-tombstone.md`). For create, update, and complete it lives only in code. The current document does not state it either, so deletion loses nothing that exists today, but the gap is real.
* **"It drifted" is an argument about process, not about diagrams.** The two security documents stay accurate because a test asserts them. The same could be done for a small diagram file.

These points support Option B below (one container diagram), not keeping the current file. No reviewer and no check found a reason to keep sections 2 to 10 as drawn.

## Action items

### Blockers

| # | Action | Closes |
| --- | --- | --- |
| A1 | **Owner decision:** retire `docs/uml-diagrams.md` entirely (Option A) or cut it to one container diagram (Option B). Items A2 to A5 apply only under Option B. | I-12 |
| A2 | Delete sections 2, 3, and 4 (class diagrams). | Z-B3, K-M4, K-M5, C-8, C-10, C-12, C-13 |
| A3 | Delete sections 5 to 10 and the Rendering section. Optionally keep one sync sequence of about ten messages with a three-line invariant list. | K-B4, K-B5, Z-M2, Z-M3, K-M6, K-M8, K-M13, K-M14, C-3 to C-6, C-11, C-14, C-15, C-17 |
| A4 | Replace section 1 with a container view: browser app with IndexedDB; a dashed "opt-in, off by default" boundary around sync; an explicit `task write -> syncQueue (same transaction) -> push` edge; PocketBase labelled "hosted or self-hosted"; Google, GitHub, and Apple; the MCP host with edge labels (stdio, talks to PocketBase and not IndexedDB, needs sync on, bearer token); native clients as one box. | Z-B2, K-B3, K-M15, C-2, C-7 |
| A5 | Add a preamble of about six lines: what the app is, the local-first rule, sync and MCP are opt-in, offline means full function minus sync. Link `PRODUCT.md`, `docs/adr/`, `SECURITY.md`, `docs/security-trust-boundaries.md`. | Z-B1, K-B1, K-B2, K-M1, K-M2, C-1 |

### Majors

| # | Action | Closes |
| --- | --- | --- |
| A6 | Give the surviving diagram a home: one row in the `ARCHITECTURE.md` table, or move the diagram into `ARCHITECTURE.md` and delete this file. | Z-M4, K-M12 |
| A7 | Write the same-transaction enqueue rule for ordinary task writes into a maintained source (ADR 0002 or `.claude/rules/pocketbase-sync.md`). Applies under Option A too. | Gap found by the post-Stage 8 check; C-2 |
| A8 | Decide `docs/architecture.html` and `docs/cloud-sync-explainer.html` in the same pass. Both have the same drift and are already tracked as DOC-1 and DOC-20 in `tasks/audit-2026-11-10.md`. | I-13 |
| A9 | File the system-level findings as issues, separate from this cleanup. Z-M5 first: on web a queue row that exhausts its retries is never re-armed, and the task ends in Trash through remote-absence reconcile. Android re-arms on launch. Then Z-M6: last-write-wins discards the losing version, including never-pushed offline edits. | Z-M5, Z-M6, I-10 |
| A10 | Trace what clears the automatic-sync retry cap besides a success. The Stage 7 design reviewer could not find it and no later stage checked. | K-M6 (open question) |
| A11 | Optional: a five-state lifecycle diagram (Active, Saved, Completed, Archived, Trash) with a note that the quadrant is derived, or a link to ADRs 0013, 0015, 0018. | Z-M1, K-M7, C-9 |

### Nits

| # | Action | Closes |
| --- | --- | --- |
| A12 | In whatever survives: expand "PB" once, use one name per component, use `<br/>` for line breaks, say "MCP client (e.g. Claude Desktop)". | K-N2 to K-N9, C-16, Z-N3 to Z-N5 |
| A13 | Optional system cleanups, lowest priority: one seam for sync enqueueing (Z-N1); a shared module for the mirrored MCP logic (Z-N2). The pinned-copy tests already cover the second. | Z-N1, Z-N2 |

### Rejected

| Recommendation | Reason |
| --- | --- |
| Alternatives and Risks sections in this file (K-B1, K-B2) | The ADRs and the two security files already hold this and are tested. A copy here would be untested. |
| Metadata block with owner and last-verified date; a test pinning the tool count (K-M12, K-B5) | One maintainer; a string-match test cannot verify a diagram. |
| Scale limits and the replicated-server assumption (K-M9) | Speculative for a single-node deployment. |
| An OAuth sequence diagram (K-B3) | `SECURITY.md` lines 124-148 describe it; the existing drawn version is the one that went wrong. |
| Regrouping by subsystem and nine captions (K-M10, K-M11) | Moot once one or two diagrams remain. |

## Traceability matrix

| Raw finding | Stage | Severity | Action |
| --- | --- | --- | --- |
| Z-B1 no objective | 5 | Blocker | A5 |
| Z-B2 top diagram hides local-first and the enqueue edge | 5 | Blocker | A4 |
| Z-B3 class diagrams drifted | 5 | Blocker | A2 |
| Z-M1 lifecycle lacks Trash, Saved | 5 | Major | A11 |
| Z-M2 sync flow misstated | 5 | Major | A3 |
| Z-M3 MCP inventory wrong | 5 | Major | A3 |
| Z-M4 orphaned document | 5 | Major | A6, A8 |
| Z-M5 retry-exhausted rows terminal | 5 | Major | A9 |
| Z-M6 LWW discards loser | 5 | Major | A9 |
| Z-N1 enqueue hand-rolled per writer | 5 | Nit | A13 |
| Z-N2 MCP mirrored logic | 5 | Nit | A13 |
| Z-N3 to Z-N5 detail in sequences, version pin, function lifelines | 5 | Nit | A3, A12 |
| C-1 product never introduced | 6 | Major | A5 |
| C-2 enqueue not shown | 6 | Major | A4, A7 |
| C-3 cursor names | 6 | Major | A3 |
| C-4 offline deletions | 6 | Major | A3 |
| C-5 sync triggers | 6 | Major | A3, A10 |
| C-6 failure handling inconsistent | 6 | Major | A3 |
| C-7 orphan nodes | 6 | Major | A4 |
| C-8 TaskMapper contract | 6 | Major | A2 |
| C-9 lifecycle contradictions | 6 | Major | A11 |
| C-10 `parentTaskId`, dependency direction | 6 | Major | A2 |
| C-11 MCP data path | 6 | Major | A3, A4 |
| C-12, C-13 enums, duplicate method | 6 | Nit | A2 |
| C-14, C-15 recurrence and realtime edge cases | 6 | Nit | A3 |
| C-16 terminology | 6 | Nit | A12 |
| C-17 render command | 6 | Nit | A3 |
| K-B1 no alternatives | 7 | Blocker | A5 (by link) |
| K-B2 no risks | 7 | Blocker | A5 (by link) |
| K-B3 trust boundaries | 7 | Blocker | A4 (labels only) |
| K-B4 sync conflict and deletion wrong | 7 | Blocker | A3 |
| K-B5 MCP tool surface wrong | 7 | Blocker | A3 |
| K-M1, K-M2 problem, goals | 7 | Major | A5 |
| K-M3 bulk ops and smart views drawn | 7 | Major | A4 (boxes removed) |
| K-M4, K-M5 data and sync class drift | 7 | Major | A2 |
| K-M6 coordinator retry | 7 | Major | A3, A10 |
| K-M7 lifecycle | 7 | Major | A11 |
| K-M8 create and recurrence sequences | 7 | Major | A3, A7 |
| K-M9 scale limits | 7 | Major | rejected; one sentence in A5 |
| K-M10, K-M11 grouping, captions | 7 | Major | rejected |
| K-M12 unlinked, no status | 7 | Major | A6; metadata rejected |
| K-M13 conflict rule three ways | 7 | Major | A3 |
| K-M14 rendering claims | 7 | Major | A3 |
| K-M15 hard-coded host | 7 | Major | A4 |
| K-N1 to K-N9 | 7 | Nit | A4, A12 |
| I-1, I-2 union of fixes overbuilds; class diagram conflict | 8 | Blocker | A1, A2 |
| I-3 to I-10 | 8 | Major | A3, A4, A5, A9, rejections |
| I-11, I-13 | 8 | Nit | A11, A8 |
| I-12 smallest change set | 8 | Blocker (resolution) | A1 to A6 |

## What was and was not verified

* **Verified after the stages, by direct check:** no file outside `egm-review/` and `.dashboard/` references `uml-diagrams` except the file's own line 690. All 20 ADRs contain an Alternatives section. DOC-1 and DOC-20 exist in `tasks/audit-2026-11-10.md` at lines 147 and 153. The same-transaction rule for ordinary writes is not in any maintained prose source.
* **Corrected:** the Stage 8 reviewer wrote "23 ADRs". There are 20.
* **Verified by reviewers against code:** the drift in `lib/types.ts`, `lib/sync/types.ts`, `sync-coordinator.ts`, `pb-sync-engine.ts`, `pb-realtime.ts`, `pb-auth.ts`, `lib/dependencies.ts`, `toggle.ts`, and the MCP tool schemas. Two independent reviewers (Stage 5 zoom-out, Stage 7 design) reached the same drift list, which raises confidence.
* **Not verified by anyone:** whether a bulk-operations module still exists in `lib/`; whether snooze removes a task from the matrix; `SmartView` and `FilterCriteria` fields; UI component names in section 1; the render command on line 690 (no one ran it); the contents of ADRs other than 0003, 0015, and 0016 beyond their headings.
* **Context limits:** every reviewer searched the saved marketing page instead of reading it whole, because of its size. The mermaid.live link in the target was not given to reviewers.
* **Process limits:** each stage ran once. Fresh reviewers sample differently, so a second round would likely surface further Nits. The Blockers were each raised by at least two reviewers except K-B3 and K-B5 in their full form.

## Files

All in `egm-review/` at the repo root, untracked:

* `zoom_out_report.md`
* `comprehension_report.md`
* `critic_report.md`
* `intermediate_zoom_out_report.md`
* `consolidated_review_report.md` (this file)
* `gsdtaskmanager-com-home.html` (saved reviewer context; safe to delete)
