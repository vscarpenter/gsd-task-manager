# Doc refresh: D5-audits-archive, round 1

Status: resolved
Clean round: no

Ids are `D5-audits-archive-1-<n>`, shortened to `1-<n>` below. Reviewers ran two at a time. For NOTE files, a finding that the record no longer matches the code resolves as PROPOSE FIX when the status note covers it. The record's body is unchanged in every NOTE file.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/formal-findings-backlog.md | ran |
| egm-style | tasks/formal-findings-backlog.md | ran |
| egm-codebase-details | docs/audits/AUDIT-2026-07-10.md, docs/audits/ACTION-CHECKLIST-2026-08-12.md, tasks/audit-2026-11-10.md | ran |
| egm-codebase-details | docs/archive/security-review.md, security-review-may2026.md, codebase-analysis-prompt.md | ran |
| egm-codebase-details | docs/archive/tasks-coding-standards-audit.md, tasks-code-review-2026-04-28.md | ran |
| egm-codebase-details | docs/archive/tasks-security-review-2026-05-12.md, docs/design-compliance-review.md, docs/prompts/codebase-quality-review-v2.md | ran |
| egm-codebase-details | docs/design-exploration/current-state-audit.md, design-directions.md | ran (design-directions.md lines 61-617 searched, not read in full) |

## Findings: tasks/formal-findings-backlog.md (FIX)

### 1-1 [codebase-details] Severity: Major
* Target: line 3
* Finding: "`WEB-UNDO-SIGNED-IN` is fixed; the rest are open" contradicts the rows for `WEB-LATE-AUTH-REFRESH` and `WEB-SESSION-STALE-READ`, whose fixes are in `lib/sync/pb-push.ts:67`, `lib/sync/config/disable.ts`, `lib/sync/config/get-set.ts`, and `components/sync/use-sync-auth-dialog.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `pb-push.ts:67-73` and the `sync_config` readers.
* Edit: Intro now lists the three rows that carry fixes and dates the statement.

### 1-2 [codebase-details] Severity: Major
* Target: line 3
* Finding: "Production serves 14.8.0 ... every row is live" is stale. `package.json:3` is 14.8.7.
* Decision: PROPOSE FIX
* Reason: Confirmed in `package.json`. What production serves was not checked.
* Edit: Sentence put in the past tense with its date; current repo version added.

### 1-3 [codebase-details] Severity: Major
* Target: line 7
* Finding: "A fix flips the config's `check.sh` line from breaks to holds" is true only for sync-convergence. The scripts are under `docs/formal/`, and task-tombstones and sync-session handle a fix differently (`.claude/skills/verify-*/SKILL.md`). The task lifecycle model has no `check.sh`.
* Decision: PROPOSE FIX
* Reason: Confirmed in the three `check.sh` files and the three SKILL.md update sections.
* Edit: Line 7 now states the three conventions and where the scripts live.

### 1-4 [codebase-details] Severity: Major
* Target: lines 3, 7
* Finding: Two rows come from the task lifecycle model, which has no skill, and two rows name no config.
* Decision: PROPOSE FIX
* Reason: `docs/diagrams/task-lifecycle-model/README.md:5` says it has no verify skill.
* Edit: Intro names the model; line 7 says "skill or model" and "the config when one exists".

### 1-5 [codebase-details] Severity: Major
* Target: line 35
* Finding: The "second way in" (a push that outlives a sign-out) is narrower now. `pushSingleItem` calls `assertPushSessionCurrent` before each row (`lib/sync/pb-push.ts:266`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `pb-push.ts:92-97, 266` and `lib/sync/sync-session.ts:36-41`. The same-account case was not replayed, and the text says the replay predates the check.
* Edit: Sentence put in the past tense, with the current check added. Line reference fixed (169 to 265).

### 1-6 [codebase-details] Severity: Major
* Target: line 23
* Finding: `updateSyncCursor` is at line 324 and does not subtract the overlap. `CURSOR_OVERLAP_MS` in `lib/sync/pb-pull.ts` does, and only applied records count, capped at now.
* Decision: PROPOSE FIX
* Reason: Confirmed in `pb-pull.ts:24, 56-66, 251-254` and `pb-sync-engine.ts:324-333`.
* Edit: Sentence corrected.

### 1-7 [codebase-details] Severity: Major
* Target: lines 19, 35, 72, 76
* Finding: Four stale line references into `lib/sync/pb-push.ts` (154, 169, 258, 78; now 250, 265, 364, 126).
* Decision: PROPOSE FIX
* Reason: Confirmed by search.
* Edit: Four references updated.

### 1-8 [codebase-details] Severity: Major
* Target: line 47
* Finding: `applyTasks` is at `import-export.ts:373`, `applyArchivedTasks` at `:244`.
* Decision: PROPOSE FIX
* Reason: Confirmed by search.
* Edit: Both references updated.

### 1-9 [codebase-details] Severity: Nit
* Target: lines 19, 35
* Finding: `pushSingleItem` now dispatches to `pushDelete` and `pushUpsert`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `pb-push.ts:265-353`.
* Edit: Both rows name the function a fix would land in.

### 1-10 [codebase-details] Severity: Nit
* Target: line 31
* Finding: "checked the SDK's principal once" is history; the principal check is still once per push.
* Decision: PROPOSE FIX
* Reason: Small clarity gain in line 29.
* Edit: Line 29 says "that session check".

### 1-11 [codebase-details] Severity: Nit
* Target: line 13
* Finding: The test file does not contain the error string the row quotes.
* Decision: DECLINE
* Reason: The row says what the failure was before the fix. The test asserts the restore resolves, which is the same fact.
* Edit: none

### 1-12 [codebase-details] Severity: Nit
* Target: line 76
* Finding: `settleRowOffset` writes when the row's `notifyBefore` is `undefined`, not literally `null`.
* Decision: DECLINE
* Reason: The repo uses "legacy null" for an unset offset (`pb-push.ts:103`).
* Edit: none (line reference fixed under 1-7)

### 1-13 [style] Severity: Major
* Target: lines 3, 13, 29, 57
* Finding: The status summary contradicts the rows.
* Decision: PROPOSE FIX
* Reason: Same as 1-1 and 1-2. `git log` shows the Undo fix reached `main` in #714.
* Edit: Covered by 1-1; line 13 adds "merged in #714".

### 1-14 [style] Severity: Major
* Target: lines 13-15
* Finding: The fixed row describes the bug in the present tense with no marker.
* Decision: PROPOSE FIX
* Reason: Line 29 already uses a marker sentence.
* Edit: Added "The rest of this entry describes the code before the fix."

### 1-15 [style] Severity: Major
* Target: lines 3, 7, 15, 51, 76, 80
* Finding: Claims about four skills and "each row names the skill and config" do not match the rows.
* Decision: PROPOSE FIX
* Reason: Same as 1-4. The fourth skill is `verify-reminders`.
* Edit: Covered by 1-4.

### 1-16 [style] Severity: Major
* Target: line 7 vs line 29
* Finding: The config convention is stated two ways.
* Decision: PROPOSE FIX
* Reason: Same as 1-3.
* Edit: Covered by 1-3.

### 1-17 [style] Severity: Major
* Target: lines 29, 51, 64
* Finding: "the rule" and "both rules" have no referent.
* Decision: PROPOSE FIX
* Reason: The rule names are in `docs/formal/sync-session/SyncSession.cfg` and `docs/diagrams/task-lifecycle-model/TaskLifecycleRecurringBoard.cfg`.
* Edit: Named `NoRecordInAnotherAccount`, `DeviceHoldsOnlyTheSignedInAccount`, `OneOpenCopy`, and `TrashHoldsOnlyYourDeletes`.

### 1-18 [style] Severity: Major
* Target: lines 55-64
* Finding: "writer" means a bullet in one place and a function in another, and line 62 gives the sign-in as the actor.
* Decision: PROPOSE FIX
* Reason: `lib/tasks/crud/helpers.ts:66`, `lib/trash.ts:49`, and `lib/archive.ts:152` read the config before the transaction, so the writer acts on the signed-out read.
* Edit: Line 62 and line 64 reworded.

### 1-19 [style] Severity: Major
* Target: lines 15, 62, 68
* Finding: `restoreTask` names two functions.
* Decision: PROPOSE FIX
* Reason: `lib/archive.ts:144` and `lib/tasks/crud/restore.ts:21` are different functions.
* Edit: Line 62 says which one it means.

### 1-20 [style] Severity: Major
* Target: line 5 vs lines 17, 55-61
* Finding: The priority definitions do not match some classifications.
* Decision: ESCALATE
* Reason: Priorities are the owner's judgment, not a fact about the code.
* Edit: none

### 1-21 [style] Severity: Major
* Target: lines 41-43
* Finding: The `CONDITIONAL-UPDATE` row and other external ids (`HOLDOFF-FAILED-ROWS`, `PUSH-IDENTITY`, `B-47`, `D-10`) point at a parity backlog that is not in this repo.
* Decision: ESCALATE
* Reason: `parity/backlog.md` does not exist in this repo or the workspace root. The owner knows where those rows live.
* Edit: none

### 1-22 [style] Severity: Major
* Target: lines 29-35, 70-72
* Finding: (a) The "Fixed" row leaves half the planned fix unshipped with no tracking. (b) Line 35 seems to conflict with line 29. (c) Lines 70-72 cannot be parsed.
* Decision: PROPOSE FIX for (b) and (c); ESCALATE for (a)
* Reason: (b) is 1-5. (c) `isRemoteNewer` returns false for a stamp past the skew ceiling (`pb-push.ts:368`). (a) Whether the late refresh save needs its own row is the owner's call.
* Edit: Line 35 per 1-5; line 72 reworded.

## Findings: NOTE files

Each file got one status note under its title. The note covers every PROPOSE FIX row below. Before each note, the cited code was opened and confirmed.

### 1-23 [codebase-details] Severity: Blocker
* Target: docs/audits/AUDIT-2026-07-10.md lines 20, 22, 225, 229, 259
* Finding: Sentry is described as present. ADR 0017 removed it, and neither `package.json` names it.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status note.

### 1-24 [codebase-details] Severity: Major
* Target: docs/audits/AUDIT-2026-07-10.md lines 5-213, 265-267
* Finding: The ten findings read as open in the body; the code has the fixes (`onboarding-gate.tsx`, `onboarding.tsx`, `read-handlers.ts:25`, `config.ts:38`, `helpers.ts:62`, `toggle.ts`, `app-shell.tsx:160`, `matrix-grid.tsx:73`). `/install` no longer exists.
* Decision: PROPOSE FIX
* Reason: Confirmed for the High and Medium findings. The Low finding (lockfile advisories) was not rechecked.
* Edit: Status note, limited to High and Medium.

### 1-25 [codebase-details] Severity: Major
* Target: docs/audits/AUDIT-2026-07-10.md line 16 vs line 153
* Finding: "Complete. All 10 resolved" sits beside a later status that leaves half of one fix open. Nothing re-arms a failed queue row (`lib/sync/queue.ts`, `lib/sync/health-monitor.ts:104`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Line 153 is accurate.
* Edit: Status note points at line 153's status and `WEB-FAILED-PUSH-STRANDED`.

### 1-26 [codebase-details] Severity: Nit
* Target: docs/audits/AUDIT-2026-07-10.md lines 16, 101, 139, 153, 223-225
* Finding: Old test counts, branch names, the unadopted "deterministic recurrence key", and old dependency versions.
* Decision: DECLINE
* Reason: Record of the time. The note says line references have drifted.
* Edit: none

### 1-27 [codebase-details] Severity: Blocker
* Target: docs/audits/ACTION-CHECKLIST-2026-08-12.md lines 14-15, 17, 19, 60, 72-73
* Finding: Unticked items that shipped: full-store backup (`lib/tasks/import-export.ts`, ADR 0014), Trash (`lib/trash.ts`, ADR 0015), recurrence and subtasks in the edit drawer. Acting on lines 17 and 19 would undo shipped work.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status note.

### 1-28 [codebase-details] Severity: Blocker
* Target: docs/audits/ACTION-CHECKLIST-2026-08-12.md line 3
* Finding: The findings file is a path on the reviewer's machine and is not in the repo.
* Decision: PROPOSE FIX
* Reason: No match for `gsd-review` outside this line.
* Edit: Status note says so.

### 1-29 [codebase-details] Severity: Major
* Target: docs/audits/ACTION-CHECKLIST-2026-08-12.md lines 13, 16, 18, 20, 31, 35, 74-77, 100
* Finding: More shipped items (storage figure, complete-undo, filtered-empty, estimate, due time, snooze, reminder fields, weekly sweep). `tasks/spec-review-remediation-wave-a-b.md` lists six checklist claims as false at the time.
* Decision: PROPOSE FIX
* Reason: Confirmed for complete-undo and the edit-drawer fields. The note names only those and points at the wave spec.
* Edit: Status note.

### 1-30 [codebase-details] Severity: Blocker
* Target: tasks/audit-2026-11-10.md lines 3, 37-41, 51
* Finding: "None pushed" is stale. P1 items 1, 2, and 12 are fixed (`app/layout.tsx:3`, `docker/Dockerfile:15`, `publish-docker.yml:39`, `confirmSessionIdentity` at `pb-pull.ts:333`, `confirmUsersPrincipal` in the MCP package, `typecheck:tests` in `ci.yml:38`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status note.

### 1-31 [codebase-details] Severity: Major
* Target: tasks/audit-2026-11-10.md lines 54, 78
* Finding: Web version bump done; MCP 1.4.2 still unreleased (package at 1.4.1). UI-9 changed (10-minute limit, inline wait).
* Decision: PROPOSE FIX for line 54; DECLINE for UI-9
* Reason: `packages/mcp-server/package.json:3` confirmed. UI-9 was not opened, and the note says P2 and P3 were not rechecked.
* Edit: Status note.

### 1-32 [codebase-details] Severity: Major
* Target: docs/archive/security-review.md lines 17-29, 61-63, 82-83, 103-108
* Finding: All five findings are fixed (`lib/env-config.ts:76-78`, `import-export.ts:391-394, 485`, `task-mapper.ts:214-223, 273`, `duplicate.ts:31`, `Dockerfile:41`, `Caddyfile:39-53`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status note.

### 1-33 [codebase-details] Severity: Blocker
* Target: docs/archive/security-review-may2026.md lines 115, 145, 154, 189
* Finding: `components/settings/settings-dialog.tsx` and `taskRecordImportSchema` do not exist. Current: `components/settings-page/settings-body.tsx`, `storedTaskRecordSchema`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status note.

### 1-34 [codebase-details] Severity: Major
* Target: docs/archive/security-review-may2026.md lines 13, 15, 76-99, 201, 223, 354-363, 381, 399-413
* Finding: Prior findings #1 and #3 marked "Still open" are fixed. The quoted CSP and the PocketBase version advice are out of date (`docker/Caddyfile:53`, `docker/Dockerfile:47`).
* Decision: PROPOSE FIX
* Reason: Confirmed for P1-1, P1-2, P2-1, P2-3. The note names only those four as checked.
* Edit: Status note.

### 1-35 [codebase-details] Severity: Major
* Target: docs/archive/codebase-analysis-prompt.md lines 10-12, 23-39
* Finding: The prompt omits gates that exist now and the `docker/` files. `docs/prompts/codebase-quality-review-v2.md` is the later version.
* Decision: PROPOSE FIX
* Reason: Scripts confirmed in `package.json:18-36`.
* Edit: Status note at the top of the file (it has no title).

### 1-36 [codebase-details] Severity: Blocker
* Target: docs/archive/tasks-coding-standards-audit.md lines 47-72, 220-241, 266-274
* Finding: Five files it wants tested or fixed are gone (`matrix-board.tsx`, `app-header.tsx`, `settings-dialog.tsx`, `lib/pwa-detection.ts`, `lib/use-matrix-dialogs.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed absent.
* Edit: Status note.

### 1-37 [codebase-details] Severity: Major
* Target: docs/archive/tasks-coding-standards-audit.md lines 4, 183-197, 205-211, 283-284
* Finding: Baseline v13 is now v18.0. P0-1, P0-2, and two health-monitor catches are fixed. Still open: four hooks without return types, three silent catches in `packages/mcp-server/src/cli/validation.ts`, no `toError`.
* Decision: PROPOSE FIX
* Reason: Confirmed each.
* Edit: Status note.

### 1-38 [codebase-details] Severity: Blocker
* Target: docs/archive/tasks-code-review-2026-04-28.md lines 36-102, 189, 196
* Finding: Files listed as dead are live (command palette, `components/share-task-dialog/`, `lib/confetti.ts`, `task-timer.tsx`, `task-description.tsx`), so `cmdk` and `canvas-confetti` are not removable. About 40 other listed files are gone.
* Decision: PROPOSE FIX
* Reason: Imports confirmed in `app-shell.tsx:9`, `matrix-simplified/index.tsx:18`, `task-actions.ts:7`.
* Edit: Status note.

### 1-39 [codebase-details] Severity: Major
* Target: docs/archive/tasks-code-review-2026-04-28.md lines 5, 23, 106-112, 122-145, 156-157, 204-223
* Finding: ADR 0011 exists, the baseline is v18.0, `lib/db-migrations.ts` exists, and the test gaps are filled.
* Decision: PROPOSE FIX
* Reason: Confirmed ADR 0011, v18.0, and `lib/db-migrations.ts`. Test coverage was not measured, so the note does not claim it.
* Edit: Status note.

### 1-40 [codebase-details] Severity: Major
* Target: docs/archive/tasks-security-review-2026-05-12.md lines 79-96, 192-198, 231-237, 347, 351
* Finding: The P1 findings are fixed. The P1-7 snippet would drop Apple and uses the call the code now forbids. P2-13's policy file is in the repo. P2-10 is half open (`sync-coordinator.ts:120`). P3-13 and P3-14 still match `public/sw.js:163, 184`.
* Decision: PROPOSE FIX
* Reason: Confirmed each.
* Edit: Status note.

### 1-41 [codebase-details] Severity: Blocker
* Target: docs/archive/tasks-security-review-2026-05-12.md lines 6, 263
* Finding: `lib/task-description.tsx` does not exist (it is `components/task-description.tsx`), and the prior review is named without a path.
* Decision: DECLINE
* Reason: The note already says line references have drifted, and the prior review sits in the same folder. Kept the note short.
* Edit: none

### 1-42 [codebase-details] Severity: Major
* Target: docs/archive/tasks-security-review-2026-05-12.md lines 335, 375-384
* Finding: The record expects `bun audit` to show zero high; `SECURITY.md` now documents one accepted dev-only advisory.
* Decision: DECLINE
* Reason: Nothing was run, and the note must not add advisory detail. The note points at `SECURITY.md`.
* Edit: none

### 1-43 [codebase-details] Severity: Blocker
* Target: docs/design-compliance-review.md lines 34-35, 71-72, 78-95, 124, 185, 195-198, 236, 249-250
* Finding: `.rd-serif`, `.redesign-scope`, and `public/css/` are gone. An onboarding flow exists. The card knows its quadrant and has the spine. Tag chips stay neutral on purpose.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status note.

### 1-44 [codebase-details] Severity: Major
* Target: docs/design-compliance-review.md lines 31-33, 39-40, 59-72, 170-173, 213-228, 257-261
* Finding: Bucket 1 is closed, swipe shipped, and the docs no longer describe the old palette. Still open: 2.5 (blocked dim), 3.1 (`gap-4`), 7.2 (switch color), and part of 4.1.
* Decision: PROPOSE FIX
* Reason: Confirmed 2.5, 3.1, 7.2, the logo, the manifest, and the swipe component. 4.1 was not opened, so the note leaves it out.
* Edit: Status note.

### 1-45 [codebase-details] Severity: Major
* Target: docs/prompts/codebase-quality-review-v2.md lines 13, 17-23, 35-43, 90, 106
* Finding: The toolchain block omits newer gates, CI runs `test:e2e:export`, and the report file already exists.
* Decision: PROPOSE FIX
* Reason: Confirmed in `package.json` and `.github/workflows/ci.yml:172`.
* Edit: Status note. The prompt body is unchanged.

### 1-46 [codebase-details] Severity: Major
* Target: docs/prompts/codebase-quality-review-v2.md lines 22, 40
* Finding: A bare `bun audit` now exits 1 on an accepted advisory.
* Decision: DECLINE
* Reason: Not run, and the note adds no advisory detail.
* Edit: none

### 1-47 [codebase-details] Severity: Blocker
* Target: docs/design-exploration/current-state-audit.md lines 7, 64, 112, 242, 304-332
* Finding: `/design-lab` is gone, and `tests/data/violet-frost-theme.test.ts` is now `tests/data/editorial-theme.test.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status note.

### 1-48 [codebase-details] Severity: Major
* Target: docs/design-exploration/current-state-audit.md lines 62, 79, 103-112, 172-187, 262-291, 297
* Finding: The Violet Frost baseline is gone (Inkwell 1.4.0 GSD Editorial ships). The four Critical findings are fixed. High findings H7 and H9 still match the code. Others are mixed.
* Decision: PROPOSE FIX
* Reason: Confirmed the four Criticals, H7 (`first-time-redirect.tsx:47`), and H9 (`use-settings-data.ts:78-83`). The note names only those.
* Edit: Status note.

### 1-49 [codebase-details] Severity: Blocker
* Target: docs/design-exploration/design-directions.md lines 5, 34-40, 46, 159, 275, 396, 507
* Finding: All `/design-lab` links are dead and the lab's tests are gone. The 30 screenshots exist.
* Decision: PROPOSE FIX
* Reason: Confirmed `app/design-lab` is absent and the artifact folders exist. `tasks/spec.md` records the removal.
* Edit: Status note.

### 1-50 [codebase-details] Severity: Major
* Target: docs/design-exploration/design-directions.md lines 57-59, 157-195, 648, 699-708
* Finding: Refined Evolution shipped, then GSD Editorial replaced its tokens. The shipped "GSD Editorial" is not the "Editorial Planner" direction.
* Decision: PROPOSE FIX
* Reason: Confirmed in `tasks/spec.md:56-60`, `tasks/editorial-restore-handoff.md`, and `app/css/inkwell-tokens.css:1-8`.
* Edit: Status note.

## Possible code defects seen this round

None new. The open rows in `tasks/formal-findings-backlog.md` still match the code. Two older audit items also still match it: `components/settings-page/use-settings-data.ts:78-83` (a failed load leaves the spinner) and `lib/sync/queue.ts:150` with `lib/sync/health-monitor.ts:104` (a failed row is never sent again, and the hint points at sync history).
