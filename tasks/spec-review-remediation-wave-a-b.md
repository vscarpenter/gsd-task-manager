# Spec — Review Remediation, Waves A & B

**Status:** Approved 2026-08-12
**Source:** `action-checklist.md`, derived from the external review of web app v11.2.1
**Tier:** Non-trivial (coordinated changes across four subsystems)

Claims in the source checklist were verified against the code before this spec was
written. Six were wrong or stale and are excluded — see "Rejected claims" at the end.

---

## Goal

Close four defects where the app either **shows the user something false** (Wave A) or
where a **core interaction is broken** (Wave B). Every item is a bug fix against existing
behaviour. No new features, no new public contracts.

---

## W-A1 · Blocking badge counts completed dependents

**Problem.** `isBlocked` filters out completed blockers via `getUncompletedBlockingTasks`,
but `isBlocking` uses `getBlockedTasks`, which has no completion filter
(`lib/dependencies.ts:97`). A blocker keeps its `Blocking N` badge after every dependent
task is completed.

**Inputs/Outputs.** New pure helper `getUncompletedBlockedTasks(taskId, allTasks):
TaskRecord[]` in `lib/dependencies.ts`, mirroring the existing
`getUncompletedBlockingTasks`. `components/task-card/index.tsx` uses it for `isBlocking`
and passes its result as `blockedTasks`.

**Constraints.**
- `getBlockedTasks` keeps its current semantics — it is exported and separately tested.
  Add the filtered variant; do not change the base.
- The `title` tooltip must list the same tasks the count reports.

**Edge cases.** No dependents → no badge. All dependents completed → no badge. Mixed →
count only the open ones. A completed task shows no badge at all (existing `!task.completed`
guard at `task-card-metadata.tsx:86`).

**Acceptance criteria.**
1. A blocker with one dependent, that dependent completed, renders no `Blocking` badge.
2. A blocker with two dependents, one completed, renders `Blocking 1`.
3. `getReadyTasks` behaviour is unchanged (it already filters correctly via `isTaskBlocked`).

---

## W-A2 · Storage figure excludes archived tasks

**Problem.** `components/settings-page/settings-body.tsx:59-63` derives its counts from
`tasks` only. The figure sits two rows above "Reset everything" and understates the real
footprint roughly fourfold on a live dataset.

**Inputs/Outputs.** The Local-storage row reports `tasks.length + archivedCount`. The
"Tasks breakdown" row keeps reporting active/done for live tasks; archived is surfaced
separately so the two rows do not contradict each other.

**Constraints.**
- Read the archived count through the existing `getArchivedCount` in `lib/archive.ts`.
  Do not add a second counting path.
- `estimatedSize` must account for archived records too, or it contradicts the count
  directly beside it.

**Edge cases.** Zero archived tasks → row reads exactly as today.

*Amended during implementation:* the original spec required withholding the figure until
the archive query resolved, "so it does not flash a wrong number." Dropped. The live-task
figure already renders as `0 tasks` while `tasks` loads, so a placeholder would fix half a
flash while leaving the other half — and `ArchiveSettings` sets the established precedent
with `useLiveQuery(...) ?? 0`. Consistency beats a partial fix. Revisit only if the whole
settings surface gets a loading treatment.

**Acceptance criteria.**
1. With 59 live and 232 archived, the storage row reports 291 tasks.
2. With 0 archived, the row reports the live count unchanged.
3. The breakdown row still separates active from done.

---

## W-A3 · About, Help, and smart views claim unshipped features

**Problem.** `components/about/features-section.tsx:58,70` advertises Recurring Tasks and
Subtasks. Both are **display-only**: rendered in `task-detail-sheet.tsx:170,199` and on the
card, modelled in `lib/schema.ts`, but with no authoring UI anywhere in
`components/matrix-simplified/edit-drawer.tsx`. The built-in "Recurring Tasks" smart view
(`lib/smart-views/built-in.ts:84`) can only be populated by import or MCP, never by the UI.

**Inputs/Outputs.** Badge both About cards as not-yet-available rather than deleting them —
the features are real and are scheduled for Wave G. Hide the Recurring Tasks smart view from
the strip. Correct the Help drawer's claim that recurring tasks spawn next instances.

**Constraints.**
- **Do not touch the `Shift+N` help text.** It is accurate — `capture-bar.tsx:80` does open
  the full composer. (Its scope is limited to capture-bar focus; that is a separate concern,
  out of scope here.)
- Hiding the smart view must not delete it or its data — Wave G restores it.
- Copy follows the `vinny-voice` skill.

**Edge cases.** A user who already has recurring tasks from import/MCP still sees the
recurrence badge on the card and the row in the detail sheet — hiding the smart view must
not hide their data.

**Acceptance criteria.**
1. Both About cards render an unavailable affordance.
2. The Recurring Tasks smart view is absent from the strip.
3. The Help drawer no longer claims recurrence spawns next instances.
4. `Shift+N` help text is byte-identical to before.

---

## W-B1 · Drag-and-drop resolves the wrong drop target

**Problem.** `lib/use-drag-and-drop.ts:68` casts `over.id` straight to a `QuadrantId`. Task
cards are registered as droppables through `useSortable` (`task-card/index.tsx:49`), and
`DndContext` declares no `collisionDetection` (`matrix-simplified/index.tsx:368`), so it
defaults to `rectIntersection` across *all* droppables. Arrow-key movement therefore resolves
`over` to a neighbouring **card id**, which is passed to `moveTaskToQuadrant` as a quadrant
and throws. Reproducible in every direction; also explains unreliable pointer drops.

The existing test suite covers dropping on *self* (early return) but never dropping on a
*different card* — the exact untested path where the defect lives.

**Inputs/Outputs.** `handleDragEnd` resolves a drop target to a quadrant before writing:
- `over.id` is a valid `QuadrantId` → use it.
- `over.id` is a sortable card → derive the quadrant from its sortable container.
- Neither → return without writing and without reporting an error (not a failure, just not
  a drop target).

`DndContext` gains an explicit `collisionDetection`. The dnd-kit success announcement is
gated on the write resolving.

**Constraints.**
- Validate the resolved id against `quadrantOrder`/`resolveQuadrantId` in `lib/quadrants.ts`.
  No string casts.
- A genuinely failed write must still reach `onError` — do not swallow it.
- Screen-reader announcements must not claim success for a move that threw.

**Edge cases.** Drop on self (unchanged early return). Drop on empty space (`over === null`,
unchanged). Drop on a card already in the source quadrant → resolves to the same quadrant;
no-op rather than error. Drop on a blocked task's card → resolution is independent of
blocked state.

**Acceptance criteria.**
1. Keyboard drop onto a card in another quadrant moves the task to **that card's quadrant**.
2. Keyboard drop works in all four directions.
3. Dropping on an unresolvable target neither writes nor reports an error.
4. A rejected `moveTaskToQuadrant` still calls `onError` with the existing context shape.
5. The a11y announcement reports success only after the write resolves.

---

## Out of scope

- Toast lanes / sync-toast preemption — could not be reproduced from code; the undo closure
  is faithful (`matrix-simplified/index.tsx:237-241`, hardened in `438d811`). Wave E's trash
  makes the failure class moot. No speculative fix.
- Everything in Waves C–G.
- Making `Shift+N` a global shortcut.
- Pointer-drag manual verification on trackpad/touch (belongs with Wave B's live check, not
  the unit suite).

## Rejected claims (verified false or stale)

| Checklist claim | Finding |
|---|---|
| Version misalignment 11.2.1 vs 11.3.0 | `package.json` and README are both 11.3.0; the deployed build was behind. No code change. |
| Help drawer's `Shift+N` is wrong | It is correct — `capture-bar.tsx:80`. |
| Estimate + timer controls missing | `TaskTimer` is wired at `task-card-metadata.tsx:114`. Only the estimate input is absent. |
| Stale badge skews "Ready to Work" | False. `getReadyTasks` routes through `isTaskBlocked`, which filters correctly. |
| `[object Object]` logging | `logger.ts:89-98` passes a structured object as console's second argument — correct browser practice. Artifact of the reviewer's console capture. |
| Snooze UI missing | Fully shipped — `SnoozeDropdown` at `task-card-actions.tsx:126`. |

## Test stubs

```
tests/data/dependencies.test.ts
  getUncompletedBlockedTasks
    should_exclude_completed_dependents
    should_count_only_open_dependents_when_mixed
    should_return_empty_when_no_dependents

tests/ui/task-card-blocking-badge.test.tsx
    should_hide_blocking_badge_when_all_dependents_completed
    should_show_open_dependent_count_when_some_completed

tests/ui/settings-body.test.tsx
    should_include_archived_tasks_in_storage_count
    should_report_live_count_when_no_archived_tasks

tests/ui/about-features.test.tsx
    should_mark_recurring_and_subtasks_as_unavailable

tests/data/use-drag-and-drop.test.ts
    should_resolve_quadrant_from_sortable_card_drop_target
    should_move_task_when_dropped_on_card_in_another_quadrant
    should_ignore_unresolvable_drop_target_without_error
    should_report_error_when_move_rejects
```

## Verification

`bun run test` · `bun typecheck` · `bun lint` · `bun run quality:shape` (ratchet: `max-lines`
budget is 0 and one-way) before every commit. `/verify-frontend-change` for W-A2, W-A3, W-B1
before their PRs open, since all three change rendered surfaces.
