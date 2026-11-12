# Doc refresh: S1-spec, round 1

Status: resolved
Clean round: no

Target: `tasks/spec.md` (mode FIX). The file holds 11 dated specs. The resolver kept each spec's decision text and added dated (2026-11-12) status blocks and "shipped differently" lines. Every edit was confirmed against the code first.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A | lines 1-512 | ran |
| egm-codebase-details B | lines 513-996 | ran |
| egm-codebase-details C | lines 997-1482 | ran |
| egm-style D | lines 1-699 | ran |
| egm-style E | lines 700-1482 | ran |

## Findings

Line numbers are the pre-edit ones.

### S1-spec-1-1 [accuracy A] Severity: Blocker
* Target: lines 183, 193-194, 243-244
* Finding: `/design-lab` routes do not exist. `app/` has no `design-lab` directory. `git log` shows `37cb2842` (2026-08-23) removed it.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls app` and `git log -- app/design-lab`.
* Edit: status block under the "five visual directions" heading.

### S1-spec-1-2 [accuracy A] Severity: Blocker
* Target: lines 262-270
* Finding: the four design-lab test files are gone. `git show --stat 37cb2842` lists all four as deleted.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: covered by the same status block.

### S1-spec-1-3 [accuracy A] Severity: Blocker
* Target: line 351
* Finding: `tests/data/violet-frost-theme.test.ts` does not exist. `tests/data/editorial-theme.test.ts` replaced it in PR #502.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls tests/data` and `git log`.
* Edit: named in the Violet Frost status block.

### S1-spec-1-4 [accuracy A] Severity: Blocker
* Target: lines 274-357, 71-72, 86
* Finding: GSD Editorial superseded the Violet Frost palette (`DESIGN.md:211`, `app/css/inkwell-tokens.css:40`, PR #502). Albert Sans is gone from `app/`, `components/`, and `lib/`.
* Decision: PROPOSE FIX
* Reason: Confirmed. The whole spec is superseded, so it gets a status line and stays.
* Edit: "Superseded" status block under the Violet Frost heading, and a sentence in the Refined Evolution status block.

### S1-spec-1-5 [accuracy A] Severity: Blocker
* Target: lines 455-481
* Finding: `doctor.config.jsonc` has no file-level ignore list. It has seven rule-scoped overrides, and its header says other false positives use inline comments. `install-pwa-prompt` is gone (PR #514).
* Decision: PROPOSE FIX
* Reason: Confirmed by reading `doctor.config.jsonc`.
* Edit: status block under the react-doctor heading.

### S1-spec-1-6 [accuracy A] Severity: Major
* Target: lines 75-76, 112-113, 143-144, 166-167
* Finding: the detail sheet has a "Mark done" / "Mark not done" button that persists (`task-detail-sheet.tsx:283`, test at `tests/ui/task-detail-sheet.test.tsx:211`). It is also a right-hand inspector at `md` and up.
* Decision: PROPOSE FIX
* Reason: PR #633 added the button on purpose and tests pin it. Opening the sheet still mutates nothing, so the spec's rule holds for inspection.
* Edit: "Shipped differently" line under Inputs / outputs. The stale "Read-only task context" code comment is listed in the final report.

### S1-spec-1-7 [accuracy A] Severity: Major
* Target: lines 289-291
* Finding: the route list names "install", and no `/install` route exists today.
* Decision: DECLINE (settled by S1-spec-1-4)
* Reason: The list is the 2026-07-31 scope of a superseded spec. The status block says the spec is superseded.
* Edit: none

### S1-spec-1-8 [accuracy A] Severity: Major
* Target: lines 30-31
* Finding: "remove stable identifiers from external telemetry" has no subject now. ADR 0017 removed Sentry.
* Decision: PROPOSE FIX
* Reason: Confirmed in `docs/adr/0017-remove-sentry-telemetry.md`.
* Edit: sentence in the security-review status block.

### S1-spec-1-9 [accuracy A] Severity: Major
* Target: lines 395-396, 412
* Finding: failed queue rows give a third outcome, `abandon`, that moves the task to Trash (`lib/sync/queue.ts:39-74`, `lib/sync/pb-pull.ts:310`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The code is stricter than the spec, not in conflict with it.
* Edit: "Shipped" line under Edge cases in the audit spec.

### S1-spec-1-10 [accuracy A] Severity: Major
* Target: lines 502-504
* Finding: the Sonar coverage exclusions do not mirror Vitest's. `sonar-project.properties:37-44` still has `**/index.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed against `vitest.config.ts:46-58`.
* Edit: dated sentence added to that bullet.

### S1-spec-1-11 [accuracy A] Severity: Major
* Target: lines 153-171, 260-270, 349-357, 420-428
* Finding: test-stub lists carry no Create / Modify / Delete marks.
* Decision: ESCALATE
* Reason: This is a format preference for the record, not a difference from the code.
* Edit: none

### S1-spec-1-12 [accuracy A] Severity: Nit
* Target: lines 416, 427
* Finding: the matrix uses a container query (`matrix-grid.tsx:73`), not breakpoint classes.
* Decision: PROPOSE FIX
* Edit: folded into the "Shipped" line of S1-spec-1-9.

### S1-spec-1-13 [accuracy A] Severity: Nit
* Target: lines 108-109, 426-427, 505-506
* Finding: example `event.key` values differ from a code comment; two test references name no path; `use-shell-command-handlers` lives under `lib/`.
* Decision: DECLINE
* Reason: None misleads a reader.
* Edit: none

### S1-spec-1-14 [accuracy B] Severity: Major
* Target: lines 539-541
* Finding: the candidate pool is `taskContext(stored, all)`, which includes Saved tasks (`index.tsx:132`, `task-actions.ts:127`, `lib/use-tasks.ts:54-55`).
* Decision: PROPOSE FIX
* Reason: Confirmed. PR #630 made the change with Saved tasks.
* Edit: "Shipped differently" list under Inputs / Outputs.

### S1-spec-1-15 [accuracy B] Severity: Major
* Target: lines 562-565
* Finding: the submit guard runs in `use-drawer-save.ts:39`.
* Decision: PROPOSE FIX
* Edit: same list.

### S1-spec-1-16 [accuracy B] Severity: Major
* Target: lines 614-615
* Finding: the first Escape closes only the popup (`use-suggestion-combobox.ts:74-80`). The drawer's Escape runs the discard guard (`edit-drawer.tsx:102-112`).
* Decision: PROPOSE FIX
* Edit: "Changes since this spec" list under Edge Cases.

### S1-spec-1-17 [accuracy B] Severity: Major
* Target: lines 593-594, 654-655
* Finding: the empty state has a second message when cycle filtering removed candidates (`edit-drawer-dependencies.tsx:247-250`).
* Decision: PROPOSE FIX
* Edit: same list.

### S1-spec-1-18 [accuracy B] Severity: Major
* Target: lines 577-579
* Finding: `edit-drawer-fields.tsx` is 468 lines. The enforced limits are 400 and 40 (`scripts/check-code-shape.cjs:37-42`).
* Decision: PROPOSE FIX
* Edit: dated parenthesis on that constraint.

### S1-spec-1-19 [accuracy B] Severity: Major
* Target: lines 616-617
* Finding: Dexie is at version 17 (`lib/db-migrations.ts:236`).
* Decision: PROPOSE FIX
* Edit: "Changes since this spec" list.

### S1-spec-1-20 [accuracy B] Severity: Major
* Target: lines 621-628
* Finding: subtask editing (PR #491) and the command palette (`app-shell.tsx:9`) now exist. `tasks/todo.md` no longer lists the `restoreTask` item.
* Decision: PROPOSE FIX
* Edit: dated paragraph under Out of Scope.

### S1-spec-1-21 [accuracy B] Severity: Nit
* Target: lines 528-537, 546, 660-696
* Finding: three stale line references; `EditDraft` lives in `edit-draft.ts`; `DependenciesField` has an `error` prop; three test names or locations differ.
* Decision: PROPOSE FIX
* Edit: corrected the three line references and "nanoid strings" in place; the rest went into the dated lists.

### S1-spec-1-22 [accuracy B] Severity: Major
* Target: lines 793-799, 893-895 (AC12)
* Finding: a `local-data` failure does not always mean tasks survived. `wipeLocalData` reports an error when `resetWeeklySweepState()` throws after IndexedDB is verified empty (`lib/reset-local-data.ts:126-138`). The dialog then says "Your tasks were not deleted." (`reset-everything-dialog.tsx:68-72`).
* Decision: ESCALATE
* Reason: The spec states the rule and two code comments repeat it. The code may be wrong. Listed under "Possible code defects".
* Edit: none

### S1-spec-1-23 [accuracy B] Severity: Major
* Target: lines 846-848, 859
* Finding: the push side is fenced now (`lib/sync/pb-push.ts:67-130`, added by `88e6d006`).
* Decision: PROPOSE FIX
* Reason: Confirmed with `git log -S`. The reviewer guessed PR #734; the pickaxe points to `88e6d006`.
* Edit: status block and a dated paragraph under Out of Scope.

### S1-spec-1-24 [accuracy B] Severity: Major
* Target: lines 746-748, 757-759
* Finding: `pullRemoteChanges` takes no owner from `fullSync`. It reads the SDK user (`lib/sync/pb-pull.ts:218`) and fences on that.
* Decision: ESCALATE
* Reason: The design names the start-of-sync owner as the session owner. The code differs, and the resolver cannot tell which is intended. Listed under "Possible code defects".
* Edit: none

### S1-spec-1-25 [accuracy B] Severity: Major
* Target: lines 762-764
* Finding: retry and history writers kept their signatures. `writeSyncOutcome` wraps them (`pb-sync-engine.ts:274-280`).
* Decision: PROPOSE FIX
* Edit: "Shipped differently" line under Design.

### S1-spec-1-26 [accuracy B] Severity: Major
* Target: lines 711-738
* Finding: the Background line references describe pre-fix code.
* Decision: PROPOSE FIX
* Reason: The section is a record of the code before PR #538. Rewriting its line numbers would falsify it.
* Edit: one sentence in the status block.

### S1-spec-1-27 [accuracy B] Severity: Major
* Target: lines 784-787
* Finding: `PBSyncResult.status` is at `types.ts:128`. `sync-provider.tsx:294` does not exist; `dispatchSyncResult` handles `cancelled` at line 44.
* Decision: PROPOSE FIX
* Edit: corrected both references in place.

### S1-spec-1-28 [accuracy B] Severity: Nit
* Target: lines 793, 816, 796-799, 926-958
* Finding: `ResetResult` is at line 34; the dialog is 305 lines; the copy is a toast; the AC9 test moved files; two realtime tests sit outside the describe.
* Decision: PROPOSE FIX for the `ResetResult` line and the AC9 file; DECLINE the rest.
* Edit: line number corrected; dated line under Test Stubs.

### S1-spec-1-29 [accuracy C] Severity: Blocker
* Target: lines 1019, 1091
* Finding: `SentryInit` does not exist. `app/layout.tsx:225-228` and the guard test list four components outside the gate.
* Decision: PROPOSE FIX
* Edit: dated parentheses on Design item 4 and AC17.

### S1-spec-1-30 [accuracy C] Severity: Major
* Target: line 1020
* Finding: the shipped body says "stored", not "saved" (`components/reset-lock-gate.tsx:152`).
* Decision: PROPOSE FIX
* Edit: parenthesis after the quoted copy.

### S1-spec-1-31 [accuracy C] Severity: Major
* Target: lines 1018, 1051, 1079
* Finding: same root as S1-spec-1-22. A weekly-sweep cleanup failure fails the `local-data` step and locks the app with IndexedDB already empty.
* Decision: ESCALATE
* Reason: Possible code defect. Not edited.
* Edit: none

### S1-spec-1-32 [accuracy C] Severity: Major
* Target: line 1070 against 1187
* Finding: a Playwright spec shipped (`tests/e2e/reset-lock.spec.ts`, three tests).
* Decision: PROPOSE FIX
* Edit: dated parenthesis under Out of Scope and a paragraph after the AC map.

### S1-spec-1-33 [accuracy C] Severity: Major
* Target: line 1040
* Finding: enforced limits are 400 and 40; `lib/reset-everything.ts` is 231 lines.
* Decision: PROPOSE FIX
* Edit: dated parenthesis.

### S1-spec-1-34 [accuracy C] Severity: Nit
* Target: lines 1039, 1043/1108, 1050, 1052, 1005-1012
* Finding: Dexie is 4.4.6; "pair" against "trio"; the sync config row is written only with a device ID; blocked delete rejects at once; Background is pre-change.
* Decision: PROPOSE FIX for the first three and the Background sentence; DECLINE the blocked-delete nit.
* Edit: dated parentheses, one reworded clause, and the status block.

### S1-spec-1-35 [accuracy C] Severity: Major
* Target: lines 1215-1216, 1271, 1372-1373, 1392-1393
* Finding: the fixture has a `serviceWorkerEnabled` option, and two export-only specs turn the worker on (`saved-tasks.spec.ts:132`, `share-target.spec.ts:7`).
* Decision: PROPOSE FIX
* Edit: E2E-1 status block; "Changes since this spec" list in the full-suite spec.

### S1-spec-1-36 [accuracy C] Severity: Major
* Target: lines 1217-1218
* Finding: Sentry is gone, so "keeps Sentry off" has no subject.
* Decision: PROPOSE FIX
* Edit: E2E-1 status block.

### S1-spec-1-37 [accuracy C] Severity: Major
* Target: lines 1237, 1256, 1288, 1423-1424
* Finding: CI and the export config build with `bun run build:e2e` (`ci.yml:165`, `playwright.export.config.ts:4`, guard at `tests/data/export-journeys.test.ts:38`).
* Decision: PROPOSE FIX
* Edit: both status and change lists.

### S1-spec-1-38 [accuracy C] Severity: Superseded content
* Target: lines 1233, 1252, 1265, 1270, 1286-1287, 1305-1306
* Finding: the journey subset, its list file, and two guard tests are gone.
* Decision: PROPOSE FIX
* Edit: E2E-1 status block.

### S1-spec-1-39 [accuracy C] Severity: Nit
* Target: line 1245
* Finding: `resolveExportFile` calls `decodeURIComponent` unguarded, so a malformed escape throws and no response goes out.
* Decision: ESCALATE
* Reason: Possible defect in a test-only script. Not edited.
* Edit: none

### S1-spec-1-40 [accuracy C] Severity: Major
* Target: lines 1367-1370
* Finding: the install command moved into `.github/actions/install-playwright`, and the guard asserts that form. A second composite action exists.
* Decision: PROPOSE FIX
* Edit: "Changes since this spec" list under Constraints.

### S1-spec-1-41 [accuracy C] Severity: Nit
* Target: lines 1200, 1270, 1448, 1209-1210, 1360
* Finding: journey counts are dated; "118 specs" means tests; Background is pre-change.
* Decision: PROPOSE FIX for "118 specs" (now "118 tests"); DECLINE the rest as dated measurements.
* Edit: one word.

### S1-spec-1-42 [style D] Severity: Major
* Target: lines 494, 499
* Finding: "v8" means the coverage provider in one place and an app generation in another.
* Decision: PROPOSE FIX
* Reason: `vitest.config.ts:26` sets `provider: "v8"`.
* Edit: "Vitest's V8 coverage provider".

### S1-spec-1-43 [style D] Severity: Major
* Target: lines 455, 465, 432
* Finding: two names for one config file; the spec has no date.
* Decision: PROPOSE FIX
* Edit: the react-doctor status block names the file and the ship date (PR #407, 2026-06-30).

### S1-spec-1-44 [style D] Severity: Major
* Target: lines 67-70, 124-128
* Finding: the four concept names are never defined.
* Decision: PROPOSE FIX
* Edit: one sentence in the Refined Evolution status block points to `docs/design-exploration/design-directions.md`.

### S1-spec-1-45 [style D] Severity: Major
* Target: findings 1, 3, 4, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18 of the style report (react-doctor success condition, oxlint claim, coverage figure, Violet Frost single-source claim, "raw" color wording, "ten requested sections", "matrix" used twice, Q2 terms, "legacy shortcuts", blur against tabbable buttons, "already holds", MCP URL handling, "21 findings" with no link, undefined security terms)
* Decision: ESCALATE
* Reason: Each asks to reword the original decision text. The code cannot settle what the author meant, and the record stays as written.
* Edit: none

### S1-spec-1-46 [style E] Severity: Major
* Target: lines 851-852 against 796-799
* Finding: "the `local-data` wording wins" is false when `local-data` is not among the failed steps.
* Decision: PROPOSE FIX
* Reason: `resetFailureMessage` tests `failedSteps.includes("local-data")`.
* Edit: added "when `local-data` is among them".

### S1-spec-1-47 [style E] Severity: Major
* Target: line 1023
* Finding: "ends the lock in a `finally` block" contradicts the next sentence.
* Decision: PROPOSE FIX
* Reason: `lib/reset-everything.ts:211-215` ends the run and can leave the app locked.
* Edit: "ends the run".

### S1-spec-1-48 [style E] Severity: Major
* Target: lines 1183-1186, 1043 against 1108, 1210
* Finding: AC20 to AC23 tests have no stub or file; "pair" against "trio"; a tautology about the third copy.
* Decision: PROPOSE FIX
* Edit: paragraph after the AC map naming the five test files; dated parentheses on both release lines; the DRY rule named.

### S1-spec-1-49 [style E] Severity: Major
* Target: lines 1365 against 1421
* Finding: Constraints list five required checks and AC6 lists four.
* Decision: CONTEST
* Reason: AC6 says "in `ci.yml`". The `audit` job lives in `.github/workflows/security-audit.yml:19`, so four is right for that file.
* Edit: none

### S1-spec-1-50 [style E] Severity: Major
* Target: style findings 1, 4, 7, 10, 12, 13b (open questions heading, two reload rules, implementation order stops at AC16, the #538 sentence, failure-to-cause mapping, 5 to 6 minutes against under 9)
* Decision: ESCALATE
* Reason: Each asks to reword the original record or to settle intent. Not editable from the code.
* Edit: none

## Could not verify
* The "21 findings" count and whether PR #527 closed every one.
* Whether the e2e matrix is advisory. The ruleset is not in the repo, and a guard test title calls the matrix "blocking".
