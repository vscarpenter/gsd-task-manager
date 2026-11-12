# Doc refresh: D5-audits-archive, round 2

Status: resolved
Clean round: no

Ids are `D5-audits-archive-2-<n>`, shortened to `2-<n>` below. The NOTE reviewers checked only the new status notes.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/formal-findings-backlog.md | ran |
| egm-style | tasks/formal-findings-backlog.md | ran (it read the file while two round 2 accuracy fixes went in; line count did not change) |
| egm-codebase-details | status notes in docs/audits/ (2), tasks/audit-2026-11-10.md, docs/design-compliance-review.md, docs/design-exploration/ (2), docs/prompts/codebase-quality-review-v2.md | ran |
| egm-codebase-details | status notes in docs/archive/ (6) | ran |

## Findings: tasks/formal-findings-backlog.md (FIX)

### 2-1 [codebase-details] Severity: Major
* Target: line 19 (`WEB-STALE-DELETE-RESTORE`)
* Finding: The row's step order and its 429 example do not reach the loss. `getPending` sorts by timestamp (`lib/sync/queue.ts:103-107`), the push loop is sequential, and a 429 breaks the loop before the create (`lib/sync/pb-push.ts:453-463`). The restore must come before the failing push, as `.claude/skills/verify-task-tombstones/SKILL.md:36` has it.
* Decision: PROPOSE FIX
* Reason: Confirmed in `queue.ts`, `pb-push.ts`, and the skill's finding 5 and its 429 warning.
* Edit: Steps reordered to match the skill; the 429 example replaced by a sentence that says why a 429 does not do it.

### 2-2 [codebase-details] Severity: Major
* Target: line 35 (`WEB-RETRIED-EDIT-RECREATES`)
* Finding: The round 1 sentence overstates the per-row check. `assertSyncSessionCurrent` compares only `enabled` and `userId` (`lib/sync/sync-session.ts:26-41`), so a sign-out and a same-account sign-in between two row checks pass.
* Decision: PROPOSE FIX
* Reason: Confirmed in `sync-session.ts`. Not churn: the pre-round-1 text was also wrong, so a revert would not resolve it.
* Edit: Sentence now says what stops the push and what still passes.

### 2-3 [codebase-details] Severity: Nit
* Target: lines 62, 64
* Finding: Three more writers read `sync_config` before their transaction: `archiveOldTasks` (`lib/archive.ts:82-86`), `archiveTaskNow` (`:201-205`), and import's `resolveSyncDeps` (`lib/tasks/import-export.ts:216-228`).
* Decision: PROPOSE FIX
* Reason: Confirmed. `tasks/todo.md` scopes #735 to `archive.ts` and `import-export.ts` too.
* Edit: One sentence added; it says the model does not cover them.

### 2-4 [codebase-details] Severity: Nit
* Target: line 76
* Finding: `settleRowOffset` writes on `undefined`, not a literal `null`.
* Decision: DECLINE
* Reason: Same as 1-12.
* Edit: none

### 2-5 [codebase-details] Severity: Nit
* Target: line 7
* Finding: The skills still record sync commit `dd32e08c`, and `verify-task-tombstones/SKILL.md:101` still says Undo throws while signed in.
* Decision: DECLINE
* Reason: The stale side is the skills, which are outside this batch. Reported in the return summary.
* Edit: none

### 2-6 [style] Severity: Major
* Target: lines 3, 13, 15
* Finding: "Each one was replayed in Vitest" sits beside a row whose evidence is a Chrome probe.
* Decision: ESCALATE
* Reason: The replays are not committed, so the code cannot settle which rows had one. The skill's finding 7 says the failure "showed first under fake-indexeddb".
* Edit: none

### 2-7 [style] Severity: Major
* Target: lines 3, 7, 76
* Finding: The fourth skill is never named.
* Decision: PROPOSE FIX
* Reason: `.claude/skills/` holds four: `verify-task-tombstones`, `verify-sync-convergence`, `verify-sync-session`, `verify-reminders`.
* Edit: Intro names the four.

### 2-8 [style] Severity: Major
* Target: lines 29, 31
* Finding: The `WEB-LATE-AUTH-REFRESH` row is "Fixed" yet half the planned fix did not ship, with no tracking.
* Decision: ESCALATE
* Reason: Same as 1-22 (a). The code confirms the gap (`refreshAuthOutcome` in `lib/sync/pb-auth.ts` has no session check). Whether it needs a row is the owner's call.
* Edit: none

### 2-9 [style] Severity: Major
* Target: lines 3, 35
* Finding: "The replay predates that check" has an unclear referent, and the row does not tie the second path to its harm.
* Decision: PROPOSE FIX for the referent; DECLINE for the harm
* Reason: The second path is the model's shortest trace (`SKILL.md:35`); explaining it means restating the model.
* Edit: "This row's replays predate that check."

### 2-10 [style] Severity: Major
* Target: lines 29, 35
* Finding: One check has two names.
* Decision: PROPOSE FIX
* Reason: `assertPushSessionCurrent` wraps `assertSyncSessionCurrent` (`pb-push.ts:92-97`).
* Edit: Line 29 names `assertPushSessionCurrent`.

### 2-11 [style] Severity: Major
* Target: lines 55, 57, 62, 64
* Finding: "four writers" in the heading counts bullets; the body counts functions.
* Decision: PROPOSE FIX
* Reason: The bullets cover more than four functions.
* Edit: Heading drops "four"; line 57 says "bullets".

### 2-12 [style] Severity: Major
* Target: lines 35, 76
* Finding: "checker" means TLC in one row and the notification checker in another.
* Decision: PROPOSE FIX
* Reason: `lib/notification-checker.ts` is the second one.
* Edit: Line 76 says "The notification checker".

### 2-13 [style] Severity: Major
* Target: line 51
* Finding: The evidence cites two rule breaks; the row describes one.
* Decision: CONTEST
* Reason: `docs/diagrams/task-lifecycle-model/README.md:13` says both rules break in three steps under `TaskLifecycleRecurringBoard.cfg`. The row cites the config, and `WEB-UNDO-COMPLETE-TRASH` covers the Trash harm.
* Edit: none

### 2-14 [style] Severity: Major
* Target: lines 3, 7, 15, 70, 76
* Finding: Undefined terms: "the Project session", "sync commit", "no config flips", "split a device".
* Decision: PROPOSE FIX for "sync commit" and "no config flips"; DECLINE for the other two
* Reason: "Sync commit" is the skills' term (`SKILL.md` "Move the sync commit"). "The Project session" is the owner's working term, and "split" is a row title.
* Edit: Line 7 defines the sync commit; lines 15 and 76 say "no config changes".

## Findings: status notes (NOTE)

### 2-15 [codebase-details] Severity: Major
* Target: docs/archive/tasks-security-review-2026-05-12.md, status note
* Finding: The note listed P2-10 as still matching the code. A 429 now aborts the push loop and `Retry-After` is honored (`lib/sync/pb-push.ts:450-464`, `lib/sync/retry-manager.ts:62-67`). Only the user-triggered half is open (`lib/sync/sync-coordinator.ts:113-131`).
* Decision: PROPOSE FIX
* Reason: Confirmed in all three files.
* Edit: Note now says P2-10 is half fixed and which half.

### 2-16 [codebase-details] Severity: Nit
* Target: docs/archive/security-review-may2026.md, status note
* Finding: "Two names below no longer exist" did not name them, so a reader could think `components/settings-page/index.tsx` is gone.
* Decision: PROPOSE FIX
* Reason: The two gone names are `components/settings/settings-dialog.tsx` and `taskRecordImportSchema`.
* Edit: Note names both.

### 2-17 [codebase-details] Severity: Nit
* Target: docs/archive/tasks-coding-standards-audit.md, status note
* Finding: "(ADR 0011)" lists only three of the five gone files.
* Decision: PROPOSE FIX
* Reason: `docs/adr/0011-v9-single-matrix-refactor.md:21-32`.
* Edit: Citation reworded to "ADR 0011 records the v9 change."

### 2-18 [codebase-details] Severity: Nit
* Target: docs/audits/ACTION-CHECKLIST-2026-08-12.md, status note
* Finding: "every store" overstates; sync bookkeeping stores stay out of the backup on purpose (ADR 0014).
* Decision: PROPOSE FIX
* Reason: `lib/tasks/import-export.ts:98-102`.
* Edit: "every user-owned store".

### 2-19 [codebase-details] Severity: Nit
* Target: tasks/audit-2026-11-10.md, status note
* Finding: The note gave no status for P1 items 3 and 13.
* Decision: PROPOSE FIX
* Reason: Item 3 was not traced, and item 13 needs the GitHub API.
* Edit: Note says both were not rechecked.

### 2-20 [codebase-details] Severity: Nit
* Target: docs/design-compliance-review.md, status note
* Finding: The tag comment pointer needed one more hop.
* Decision: PROPOSE FIX
* Reason: The reason is at `components/task-card/task-card-metadata.tsx:37-41`.
* Edit: Pointer changed.

### 2-21 [codebase-details] Severity: Nit
* Target: docs/design-exploration/current-state-audit.md, status note
* Finding: "four Critical findings" listed three.
* Decision: PROPOSE FIX
* Reason: The fourth is the switch touch target (`components/ui/switch.tsx:16-19`).
* Edit: List now has four.

No differences: the notes in docs/audits/AUDIT-2026-07-10.md, docs/design-exploration/design-directions.md, docs/prompts/codebase-quality-review-v2.md, docs/archive/security-review.md, docs/archive/tasks-code-review-2026-04-28.md, and docs/archive/codebase-analysis-prompt.md.
