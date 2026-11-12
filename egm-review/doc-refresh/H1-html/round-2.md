# Doc refresh: H1-html, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | docs/architecture.html | ran, 0 Blocker, 2 Major, 5 Nit |
| egm-codebase-details | docs/cloud-sync-explainer.html | ran, 0 Blocker, 0 Major, 6 Nit |
| egm-style | docs/architecture.html | ran, 7 Major |
| egm-style | docs/cloud-sync-explainer.html | ran, 8 Major |

Abbreviations: ARCH is `docs/architecture.html`, SYNC is `docs/cloud-sync-explainer.html`. Line numbers are from the files as the reviewers saw them.

## Findings: docs/architecture.html, accuracy

### H1-html-2-1 [codebase-details] Severity: Major
* Target: ARCH line 415
* Finding: `smartViews` "Built-in and custom smart views". Built-ins are derived at read time and never stored (`lib/schema.ts:231-238`).
* Decision: PROPOSE FIX
* Reason: Confirmed. My round 1 wording was wrong.
* Edit: "Custom smart views for the opt-in strip above the matrix. Built-in views are derived at read time".

### H1-html-2-2 [codebase-details] Severity: Major
* Target: ARCH line 615
* Finding: ADR-0010 card says "Exposing task data to AI agents via structured tools". The ADR covers static discovery metadata (`docs/adr/0010-agent-discovery-surface.md:8-30`).
* Decision: PROPOSE FIX
* Reason: Read the ADR context.
* Edit: Card now names `/.well-known` files, `Link` headers, and the in-page WebMCP tool.

### H1-html-2-3 [codebase-details] Severity: Nit
* Target: ARCH line 235
* Finding: Shift+N does nothing while a text field has focus (`capture-bar.tsx:166-176`).
* Decision: PROPOSE FIX
* Reason: Confirmed the early return.
* Edit: "Outside a text field, Shift+N opens the full drawer."

### H1-html-2-4 [codebase-details] Severity: Nit
* Target: ARCH line 252
* Finding: `not-found.tsx` has no AppShell either.
* Decision: PROPOSE FIX
* Reason: It is not a route page.
* Edit: "Every route page except the OAuth callback".

### H1-html-2-5 [codebase-details] Severity: Nit
* Target: ARCH lines 411-415
* Finding: "Key Indexes" shows a dash for tables that have indexes.
* Decision: DECLINE
* Reason: The column lists key indexes, and a full list would drift.
* Edit: none

### H1-html-2-6 [codebase-details] Severity: Nit
* Target: ARCH line 354
* Finding: Build row omits `externalize-inline-assets.cjs`.
* Decision: PROPOSE FIX
* Reason: `scripts/build-static-export.sh:26-29`.
* Edit: Added "move inline scripts to same-origin files".

### H1-html-2-7 [codebase-details] Severity: Nit
* Target: ARCH line 443
* Finding: "strictly newer" has the backfill exception.
* Decision: PROPOSE FIX
* Reason: `pb-pull.ts:73-77`.
* Edit: Added the exception with an ADR-0019 pointer.

## Findings: docs/architecture.html, style

### H1-html-2-8 [style] Severity: Major
* Target: ARCH lines 297, 495-496, 511, 558
* Finding: "26 source files plus a config/ folder" beside "30 files".
* Decision: PROPOSE FIX
* Reason: Both are right, the wording hid it.
* Edit: "30 source files: 26 at the top level and 4 in config/".

### H1-html-2-9 [style] Severity: Major
* Target: ARCH lines 137, 482, 487-488
* Finding: "documentation drift" is a key risk and also closed. "Both gaps" has no referent.
* Decision: PROPOSE FIX
* Reason: The two drift items were the only evidence for that risk, and both are closed (round 1).
* Edit: Removed "documentation drift from reality" from the TL;DR risks. The alert now states what each gap was.

### H1-html-2-10 [style] Severity: Major
* Target: ARCH line 511
* Finding: "passes the ceiling" reads two ways.
* Decision: PROPOSE FIX
* Reason: The file complies (`scripts/code-shape-debt.json`, `max-lines` 0).
* Edit: "That is within the project's 400-line ceiling, which counts neither blank lines nor comments."

### H1-html-2-11 [style] Severity: Major
* Target: ARCH lines 126, 134, 402, 519, 544, 583, 639
* Finding: "self-hosted" and "hosted" used without a distinction. "The Docker hooks" has no referent.
* Decision: PROPOSE FIX
* Reason: SECURITY.md separates the hosted service from a self-hosted Docker server.
* Edit: Line 544 names the hosted service as the project's PocketBase at `api.vinny.io`. The ADR-0016 card says "the PocketBase hooks in the self-host Docker image".

### H1-html-2-12 [style] Severity: Major
* Target: ARCH lines 443, 647, 651, 655
* Finding: ADR cards use undefined terms (pull contract, top three, Saved).
* Decision: PROPOSE FIX
* Reason: ADR 0019 and 0020 text, `lib/routes.ts` comment on Saved.
* Edit: Reworded the 0018, 0019, and 0020 cards and the LWW exception.

### H1-html-2-13 [style] Severity: Major
* Target: ARCH lines 528-530
* Finding: The service worker row says hand-written and generated.
* Decision: PROPOSE FIX
* Reason: `public/sw.js` is hand-written. `public/sw-cache-logic.js` is generated from `lib/sw-cache-logic.ts`.
* Edit: The cell names each file.

### H1-html-2-14 [style] Severity: Major
* Target: ARCH line 453
* Finding: "Retry-exhausted edits move to Trash" cannot be followed.
* Decision: PROPOSE FIX
* Reason: `pb-pull.ts` `planRemoteAbsence` trashes the task.
* Edit: "A task whose queue rows are all retry-exhausted goes to Trash, not deleted outright".

## Findings: docs/cloud-sync-explainer.html, accuracy

### H1-html-2-15 [codebase-details] Severity: Nit
* Target: SYNC lines 780, 870
* Finding: "Every remote filter and sort uses client_updated_at" is too broad. The index and entry lookups filter on `owner` and `task_id` (`pb-sync-helpers.ts:166-170`).
* Decision: PROPOSE FIX
* Reason: Confirmed. My round 1 wording overreached.
* Edit: Both sentences now speak of timestamps only.

### H1-html-2-16 [codebase-details] Severity: Nit
* Target: SYNC lines 382, 748-750
* Finding: Archive and Trash writers enqueue without scheduling a sync.
* Decision: PROPOSE FIX
* Reason: `scheduleSyncAfterChange(` appears only in `lib/tasks/crud/helpers.ts` and `lib/tasks/import-export.ts`.
* Edit: The card says "A task edit". The table row already names `tasks/crud/helpers.ts`.

### H1-html-2-17 [codebase-details] Severity: Nit
* Target: SYNC lines 382, 725-726, 743
* Finding: Trigger lists omit the start-up sync (`background-sync.ts:61-65`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added "start-up" in all three places.

### H1-html-2-18 [codebase-details] Severity: Nit
* Target: SYNC line 745
* Finding: Auto sync has more gates than backoff.
* Decision: DECLINE
* Reason: Same as H1-html-1-79.
* Edit: none

### H1-html-2-19 [codebase-details] Severity: Nit
* Target: SYNC line 654
* Finding: Wire field names also appear outside the mapper.
* Decision: DECLINE
* Reason: The record mapping is only in `task-mapper.ts`, which is the sentence's point.
* Edit: none

### H1-html-2-20 [codebase-details] Severity: Nit
* Target: SYNC line 523
* Finding: The sample shortens the error string.
* Decision: DECLINE
* Reason: The sample is marked simplified.
* Edit: none

## Findings: docs/cloud-sync-explainer.html, style

### H1-html-2-21 [style] Severity: Major
* Target: SYNC line 444
* Finding: `resurrectOnSight()` in the diagram has no referent.
* Decision: PROPOSE FIX
* Reason: `lib/sync/README.md`, `.claude/rules/pocketbase-sync.md`.
* Edit: One sentence in the pull section explains it.

### H1-html-2-22 [style] Severity: Major
* Target: SYNC lines 619-621
* Finding: "pull-contract backfill is owed" is undefined and "pulls everything first" reads two ways.
* Decision: PROPOSE FIX
* Reason: `pb-sync-engine.ts` `resolvePullCursor`, `runSyncPasses`.
* Edit: Defined the backfill sync: runs once, pulls before it pushes, ignores the cursor, accepts ties.

### H1-html-2-23 [style] Severity: Major
* Target: SYNC lines 510-512
* Finding: The prohibition does not state the harm.
* Decision: PROPOSE FIX
* Reason: `.claude/rules/pocketbase-sync.md`: "a crafted link can hand a victim's code to an attacker".
* Edit: Added that clause.

### H1-html-2-24 [style] Severity: Major
* Target: SYNC line 815
* Finding: "A tied remote record is the version this device already holds" is contradicted by the exception.
* Decision: PROPOSE FIX
* Reason: `pb-pull.ts:69-72` comment.
* Edit: "is normally the version".

### H1-html-2-25 [style] Severity: Major
* Target: SYNC lines 654-655, 821-822
* Finding: "device-local fields" has two memberships.
* Decision: PROPOSE FIX
* Reason: `task-mapper.ts` `LocalReminderState` holds three fields. `parentTaskId` is a separate rule.
* Edit: The gotcha lists the three fields and treats `parentTaskId` as a separate case.

### H1-html-2-26 [style] Severity: Major
* Target: SYNC line 836
* Finding: The pronoun changes referent. "Instead" and "the remote index" are unclear.
* Decision: PROPOSE FIX
* Reason: Wording only.
* Edit: Rewrote the paragraph with the function as the subject.

### H1-html-2-27 [style] Severity: Major
* Target: SYNC lines 378, 869, 836
* Finding: "Source of truth is local" beside remote edits and deletions that apply locally. A second reviewer raised what H1-html-1-81 contested.
* Decision: PROPOSE FIX
* Reason: The claim stays, since `lib/sync/README.md` makes it. A qualifier is fact: `pb-pull.ts` applies newer remote edits and remote deletions.
* Edit: Added one sentence to the first card.

### H1-html-2-28 [style] Severity: Major
* Target: SYNC line 591
* Finding: "charge no queue row" cannot be parsed.
* Decision: PROPOSE FIX
* Reason: Wording only.
* Edit: "count no retry against any row".
