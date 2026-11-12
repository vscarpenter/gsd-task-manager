# Doc refresh: S4-engineering-specs, round 1

Status: resolved
Clean round: no

Mode for this batch: each spec is a dated record. A valid finding is resolved by one status block under the title. The body changes only where it names a path that does not exist. Every status claim was checked against the code or `git log` before it was written.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A | spec-vitest-5-migration, spec-bundle-budget, spec-type-system, e2e-testing-spec | ran |
| egm-codebase-details B | spec-phase1-pin-copies, spec-phase2-security, spec-phase3-defects, spec-phase5-restructure | ran |
| egm-codebase-details C | spec-pre-rescan-hardening, spec-rescan-high-medium-remediation, spec-audit-findings-remediation | ran |
| egm-codebase-details D | spec-review-remediation-wave-a-b, spec-top-five-audit-risks | ran |

## Findings

### S4-1-1 [A] Severity: Blocker
* Target: spec-vitest-5-migration.md lines 77-78, 138
* Finding: MCP "stays on Vitest 4.1.11, pinned by `security-hardening-scripts.test.ts:358-359`". The pin is 4.1.12 at `tests/data/security-hardening-scripts.test.ts:399-401`; lines 358-359 now hold migration assertions.
* Decision: PROPOSE FIX
* Reason: Confirmed in the test file and `packages/mcp-server/package.json:85,89`.
* Edit: Status block names the live pins and says to find the test by name.

### S4-1-2 [A] Severity: Major
* Target: spec-vitest-5-migration.md lines 8, 16, 84, 126
* Finding: Root pins 5.0.2 and MCP coverage 4.1.11. Code: 5.0.5 (`package.json:81,95`) and 4.1.12.
* Decision: PROPOSE FIX
* Reason: Later dependency updates, not a defect.
* Edit: Covered by the status block.

### S4-1-3 [A] Severity: Major
* Target: spec-vitest-5-migration.md line 93
* Finding: Both test files "stay under 837 and 141 lines". Today they are 971 and 146.
* Decision: ESCALATE
* Reason: At the merge commit `aca6a90a` the files were 834 and 146 lines (`git show`). The first met the constraint. `badge.test.ts` went from 141 to 146 in that PR, so it shipped 5 lines over. The growth to 971 came later and is outside this spec. Listed as a small unmet constraint, not a doc fix.
* Edit: none

### S4-1-4 [A] Severity: Major
* Target: spec-vitest-5-migration.md lines 4, 106, 118, 153-155, 160
* Finding: Line numbers and the "241 test files" count have drifted.
* Decision: PROPOSE FIX
* Reason: Confirmed for `vitest.config.ts:71` and the notifications tests.
* Edit: Status block says the line numbers and counts are from 2026-09-27.

### S4-1-5 [A] Severity: Nit
* Target: spec-vitest-5-migration.md lines 120, 167
* Finding: jsdom still 30.0.1 (consistent); the test name is a prefix of the real name.
* Decision: DECLINE
* Reason: No reader is misled.
* Edit: none

### S4-1-6 [A] Severity: Major
* Target: spec-bundle-budget.md lines 11, 15-18, 20, 77, 96
* Finding: "Six routes", Sentry in the shared bytes, 438.4 KB. Code: nine routes in `scripts/bundle-budget.json`; no Sentry (`security-hardening-scripts.test.ts:407-408`, ADR 0017).
* Decision: PROPOSE FIX
* Reason: Confirmed. PR #566 removed Sentry and PR #682 refreshed the baseline.
* Edit: Status block.

### S4-1-7 [A] Severity: Major
* Target: spec-bundle-budget.md line 78
* Finding: The out-of-scope `SyncProvider` poll has since been fixed.
* Decision: PROPOSE FIX
* Reason: `cb9bc591` (#558) "stop polling coordinator status while sync is idle".
* Edit: Status block names PR #558.

### S4-1-8 [A] Severity: Nit
* Target: spec-bundle-budget.md lines 21-22, 25, 115-120
* Finding: Confetti is lazy now (the spec's own outcome); `MatrixSimplified` size drifted; a fifth confetti test exists.
* Decision: DECLINE
* Reason: Background measurements of a dated record.
* Edit: none

### S4-1-9 [A] Severity: Major
* Target: spec-type-system.md lines 66, 75, 76
* Finding: The two e2e stubs shipped only in part. No e2e test covers badges, `kbd`, settings, the edit drawer, or the help drawer at 150%. The pane-title serif check is a unit test (`tests/ui/task-card-anatomy.test.tsx:251`).
* Decision: ESCALATE
* Reason: An acceptance criterion the repo does not show as tested. Listed as unfinished work. The status block states what exists.
* Edit: Status block.

### S4-1-10 [A] Severity: Major
* Target: spec-type-system.md lines 15, 19, 64
* Finding: `.t-display` and `.t-h1` to `.t-h3` in `app/css/inkwell-components.css:44-57` are still weight 500, and px literals remain at lines 315-316. No `.tsx` file uses those classes.
* Decision: ESCALATE
* Reason: AC4 says the serif renders at 600 everywhere. The rendered app may meet it, but the CSS does not. Possible code defect, not a doc fix.
* Edit: none

### S4-1-11 [A] Severity: Nit
* Target: spec-type-system.md lines 36, 40, 62, 73-74
* Finding: `app/global-error.tsx` hand-sets rem strings; `kbd` weight; fixed heights; unnamed unit stubs.
* Decision: DECLINE (unit stub names are in the status block)
* Reason: Small.
* Edit: none

### S4-1-12 [A] Severity: Blocker
* Target: e2e-testing-spec.md lines 95-101 and AC7
* Finding: `tests/e2e/smart-views.spec.ts` does not exist and no e2e test covers smart views.
* Decision: ESCALATE
* Reason: Unmet acceptance criterion. `tests/e2e/README.md` already lists the gap. The status block points there.
* Edit: Status block.

### S4-1-13 [A] Severity: Blocker
* Target: e2e-testing-spec.md line 103
* Finding: `tests/e2e/settings.spec.ts` does not exist. PR #269 added `settings-navigation.spec.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed with `git log --diff-filter=A`.
* Edit: Stub comment path changed to `tests/e2e/settings-navigation.spec.ts`.

### S4-1-14 [A] Severity: Major
* Target: e2e-testing-spec.md lines 20, 23, 34-42, 64-92, 107-109, 119
* Finding: CI runs the export suite, not the dev server. Search by subtask and archive navigation have no test. Test names differ. Sync, PWA, and touch specs now exist.
* Decision: PROPOSE FIX for the drift; ESCALATE the two missing tests
* Reason: Confirmed in `ci.yml:164-172` and the spec files.
* Edit: Status block.

### S4-1-15 [A] Severity: Nit
* Target: e2e-testing-spec.md lines 8-9, 117, 122
* Finding: No login page object; cleanup is a fixture.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### S4-1-16 [B] Severity: Major
* Target: spec-phase1-pin-copies.md lines 22, 45-46, 53, 55, 64, 71, 93-94
* Finding: `ID_MIN_LENGTH` is now in both copies; the longest-streak divergence and the `encodesDefect` scenarios are gone; `public/sw-cache-logic.js` is generated.
* Decision: PROPOSE FIX
* Reason: Confirmed in both constants files, `completion-metrics.json:71,143`, and `scripts/generate-sw-cache-logic.cjs`. All are later planned phases.
* Edit: Status block.

### S4-1-17 [B] Severity: Nit
* Target: spec-phase1-pin-copies.md lines 54, 61-62
* Finding: `notify_before` divergence changed; estimate literals unchanged.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### S4-1-18 [resolver] Severity: Blocker
* Target: spec-phase1, phase2, phase3, phase5: every `../gsd-modernize/...` path
* Finding: The folder is not on this machine and the repo holds no copy of the brief, `CONTRACT_MAP.md`, `RULE_REVIEWS.md`, `SECURITY_FINDINGS.md`, or `BASELINE.md`. Each spec says "the brief wins".
* Decision: PROPOSE FIX (note) and ESCALATE (the missing workspace)
* Reason: No replacement path exists, so the body stays. Each status block says the folder was absent on 2026-11-12.
* Edit: Status blocks.

### S4-1-19 [B] Severity: Major
* Target: spec-phase2-security.md lines 23-24, 61
* Finding: `audit` as a required check in `main-protection` cannot be seen from the repo.
* Decision: ESCALATE
* Reason: A GitHub setting. `tasks/todo.md` records it as done.
* Edit: Status block says the repo can't show it.

### S4-1-20 [B] Severity: Nit
* Target: spec-phase2-security.md lines 33-34
* Finding: Guard floor is now 16.4.1; `.dockerignore` uses one `.*` pattern.
* Decision: PROPOSE FIX for the version (status block); DECLINE the rest
* Reason: Small.
* Edit: Status block.

### S4-1-21 [B] Severity: Blocker
* Target: spec-phase3-defects.md lines 83-84
* Finding: "20 tools to 19". The server exposes 20 again (`schemas.test.ts:31`, `packages/mcp-server/CHANGELOG.md:12`).
* Decision: PROPOSE FIX
* Reason: `get_top_three` was added later.
* Edit: Status block.

### S4-1-22 [B] Severity: Blocker
* Target: spec-phase3-defects.md lines 100-101
* Finding: `openapi/pocketbase.json` and a bare `index.json`. The files are `public/.well-known/openapi/pocketbase.json` and `public/.well-known/agent-skills/index.json`.
* Decision: PROPOSE FIX
* Reason: `git show --stat bbdbd882` shows the PR edited those two paths.
* Edit: Both paths fixed in place.

### S4-1-23 [B] Severity: Major
* Target: spec-phase3-defects.md lines 103-105
* Finding: The About snippet command is now `/path/to/node` (`components/about/mcp-section.tsx:14-15`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status block.

### S4-1-24 [B] Severity: Major
* Target: spec-phase3-defects.md lines 31-33
* Finding: The completion rule is not the same as `lib/feedback/nudge-eligibility.ts`, which buckets by UTC day and has no empty-string fallback. Its comment at line 43 still says streaks bucket by UTC.
* Decision: ESCALATE
* Reason: The spec states a rule and the two modules differ. Possible code defect or stale comment.
* Edit: none

### S4-1-25 [B] Severity: Major
* Target: spec-phase3-defects.md lines 114-115
* Finding: The system test builds its fresh migration folder with its own loop, not the shared shell function.
* Decision: DECLINE
* Reason: Same result, and a guard test pins it (`security-hardening-scripts.test.ts`). Severity kept as reported.
* Edit: none

### S4-1-26 [B] Severity: Nit
* Target: spec-phase3-defects.md lines 44-45, 81, 123
* Finding: Skill snapshot copies still say `updatedAt`; both trash boundary tests exist.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### S4-1-27 [B] Severity: Blocker
* Target: spec-phase5-restructure.md lines 115-122
* Finding: Bundle F did not ship. None of `useMatrixOverlay`, `buildCreateInitial`, `createFromDraft`, `deleteWithUndo`, `useIntroBriefing`, `useQuadrantFocus` exist.
* Decision: ESCALATE
* Reason: Unfinished work. `tasks/todo.md` leaves F, G, and H unticked.
* Edit: Status block.

### S4-1-28 [B] Severity: Major
* Target: spec-phase5-restructure.md lines 13-14, 24-26, 135-136
* Finding: Target at most 118. Ceilings total 125 (`scripts/code-shape-debt.json`).
* Decision: ESCALATE
* Reason: Unmet target. Unfinished work.
* Edit: Status block.

### S4-1-29 [B] Severity: Major
* Target: spec-phase5-restructure.md lines 93-96
* Finding: The `knip` script is `knip --production --files --dependencies` (`package.json:22`), so CI does not check exports.
* Decision: PROPOSE FIX
* Reason: Confirmed. `tasks/todo.md` records it as the owner's open default.
* Edit: Status block.

### S4-1-30 [B] Severity: Major
* Target: spec-phase5-restructure.md lines 19-20
* Finding: The "Synced" tooltip exists (`components/sync/use-sync-status.ts:161`).
* Decision: CONTEST
* Reason: `git log -S` shows that string in the file since `c2f2392f` (2026-04-20), before the spec. The spec's item must mean something narrower. Not written into the document.
* Edit: none

### S4-1-31 [B] Severity: Major
* Target: spec-phase5-restructure.md lines 110-111
* Finding: `lib/hooks/use-sync-status.ts` still has one 30-second re-render interval.
* Decision: DECLINE
* Reason: The spec says four duplicate status timers go. A display tick is not one.
* Edit: none

### S4-1-32 [B] Severity: Nit
* Target: spec-phase5-restructure.md lines 43-45, 80-81, 127, 129
* Finding: Stamp script exit conditions; short file names in bundle G.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### S4-1-33 [C] Severity: Major
* Target: spec-pre-rescan-hardening.md lines 26-27
* Finding: Violet Frost is retired (`tests/data/editorial-theme.test.ts:90`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status block.

### S4-1-34 [C] Severity: Major
* Target: spec-pre-rescan-hardening.md lines 14-16
* Finding: Branch `codex/resolve-pre-rescan-issues` does not exist locally.
* Decision: DECLINE
* Reason: Merged branches get deleted. The status block names the PR.
* Edit: none

### S4-1-35 [C] Severity: Major
* Target: spec-pre-rescan-hardening.md lines 24-25, 58-59
* Finding: `handleSaveForLater` passes `error.message` as the user message (`components/matrix-simplified/task-actions.ts:140`), so raw error text can reach the toast and the log context. The spec requires generic toasts.
* Decision: ESCALATE
* Reason: The spec states a rule and later code does something else. Possible code defect.
* Edit: none

### S4-1-36 [C] Severity: Nit
* Target: spec-pre-rescan-hardening.md lines 40-41, 60, 66, 67, 71-79
* Finding: Lint script prefix; more composite groups; unnamed test files.
* Decision: PROPOSE FIX for the trust-boundary path (status block); DECLINE the rest
* Reason: Small.
* Edit: Status block.

### S4-1-37 [C] Severity: Blocker
* Target: spec-rescan-high-medium-remediation.md lines 13, 24, 26-27, 66, 88-89, 101
* Finding: PocketBase 0.39.10. The repo pins 0.40.4 (`docker/Dockerfile:47`, `scripts/run-pocketbase-system-test.sh:6`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Phase 2 moved it.
* Edit: Status block.

### S4-1-38 [C] Severity: Blocker
* Target: spec-rescan-high-medium-remediation.md lines 28-29, 90-91
* Finding: No "Show Schedule" string exists. The button reads "Schedule" (`components/matrix-simplified/matrix-intro.tsx:15-18`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Status block.

### S4-1-39 [C] Severity: Major
* Target: spec-rescan lines 11; spec-audit-findings lines 5-6, 12, 36, 124; spec-top-five line 5
* Finding: `docs/codebase-analysis-report.html` now holds the 2026-09-20 review.
* Decision: PROPOSE FIX
* Reason: Confirmed by the file's title and `git log` (`5c16b839`).
* Edit: Status blocks in all three files.

### S4-1-40 [C] Severity: Major
* Target: spec-rescan lines 30-31, 103-104
* Finding: CI runs `test:e2e:export`, not the webpack dev server.
* Decision: PROPOSE FIX
* Reason: `ci.yml:164-172`.
* Edit: Status block.

### S4-1-41 [C] Severity: Nit
* Target: spec-rescan lines 19-22, 33-34, 71-72, 100, 121-129
* Finding: Gitleaks lives in `security-audit.yml`; unnamed tests; the ledger; no dedicated cache-isolation assertion.
* Decision: PROPOSE FIX for the Gitleaks location (status block); DECLINE the rest
* Reason: Small.
* Edit: Status block.

### S4-1-42 [C] Severity: Major
* Target: spec-audit-findings-remediation.md lines 118-119
* Finding: "v11.2.1 product". The app is 14.8.7.
* Decision: PROPOSE FIX
* Reason: `package.json:3`.
* Edit: Status block.

### S4-1-43 [C] Severity: Major
* Target: spec-audit-findings lines 29-30, 120-121; spec-top-five lines 44-45, 48 [also D]
* Finding: "audit-clean installed graph". The checker accepts one High advisory, `braces`, until 2027-01-05 (`scripts/check-audit-results.cjs:10-18`), and `SECURITY.md:500-501` says the audit reports it.
* Decision: ESCALATE, and note in the status blocks
* Reason: An acceptance criterion the repo no longer meets, by a dated owner exception.
* Edit: Status blocks.

### S4-1-44 [C] Severity: Major
* Target: spec-audit-findings line 121
* Finding: "shell/YAML checks pass". The repo holds no shellcheck, actionlint, or yamllint command.
* Decision: ESCALATE
* Reason: An acceptance criterion with nothing in the repo to run. The status block states the fact.
* Edit: Status block.

### S4-1-45 [C] Severity: Major
* Target: spec-audit-findings lines 26, 108-109
* Finding: No scheduled browser lane. All three browsers block in one matrix.
* Decision: PROPOSE FIX
* Reason: The criterion allowed either. `ci.yml:141-147`.
* Edit: Status block.

### S4-1-46 [C] Severity: Nit
* Target: spec-audit-findings lines 28, 52, 59, 67-68, 106-107, 112-116, 130
* Finding: Inline styles still allowed in CSP; `.oss-scanner/Dockerfile` unpinned; no browser-data freshness check; Vite version; ledger deadline 2026-12-31.
* Decision: DECLINE in the document; the three gaps are in the final report
* Reason: Reported as Nits. Not doc fixes.
* Edit: none

### S4-1-47 [D] Severity: Blocker
* Target: spec-review-remediation-wave-a-b.md lines 201, 250, 258
* Finding: Three test files do not exist: `tests/data/import-export.test.ts`, `tests/ui/task-card-blocking-badge.test.tsx`, `tests/ui/about-features.test.tsx`. The tests are in `tests/data/backup-envelope.test.ts`, `tests/ui/task-card-states.test.tsx:156,173`, and `tests/ui/about-copy.test.tsx`.
* Decision: PROPOSE FIX
* Reason: Confirmed each file.
* Edit: Three paths fixed in place.

### S4-1-48 [D] Severity: Blocker
* Target: spec-review-remediation-wave-a-b.md lines 50-52, 93-94, 235, 239
* Finding: Dead line references and `SnoozeDropdown` (now `SnoozeSubmenu`, `components/task-card/task-card-actions.tsx:210`).
* Decision: PROPOSE FIX
* Reason: Confirmed. All files still exist, so the status block says the references are from 2026-08-12.
* Edit: Status block.

### S4-1-49 [D] Severity: Major
* Target: spec-review-remediation-wave-a-b.md W-A3 (lines 82-106)
* Finding: W-A3 is not in the code. PR #493 reversed it after recurrence and subtasks got an editor.
* Decision: PROPOSE FIX
* Reason: `bb2ad590` and `tests/ui/about-copy.test.tsx:20-36`. The spec planned this restore for Wave G.
* Edit: Status block.

### S4-1-50 [D] Severity: Major
* Target: spec-review-remediation-wave-a-b.md lines 54-60, 113-130, 154-164, 203-265, 222-238, title
* Finding: Storage counts Trash and uses `getArchivedStorageStats`; resolver in `lib/dnd-drop-target.ts`; envelope 2.2.0; test names differ; the title says Waves A and B but holds W-C1.
* Decision: PROPOSE FIX for where things live now (status block); DECLINE test-name and title edits
* Reason: Confirmed in `use-storage-summary.ts:41-53` and `import-export.ts:25`. Test names are a record.
* Edit: Status block.

### S4-1-51 [D] Severity: Major
* Target: spec-review-remediation-wave-a-b.md W-C1 AC6
* Finding: "reports one dropped record". The count is only logged; `importTasks` returns `Promise<void>` (`lib/tasks/import-export.ts:440`).
* Decision: ESCALATE
* Reason: Acceptance criterion the code may not meet. Possible code defect.
* Edit: none

### S4-1-52 [D] Severity: Major
* Target: spec-review-remediation-wave-a-b.md W-B1 AC2
* Finding: No test covers a keyboard drop in all four directions.
* Decision: ESCALATE
* Reason: Unmet test coverage for an acceptance criterion.
* Edit: none

### S4-1-53 [D] Severity: Nit
* Target: spec-review-remediation-wave-a-b.md lines 82, 83, 95, 114, 115, 133, 234
* Finding: Line drift.
* Decision: DECLINE
* Reason: Covered by the status block's drift sentence.
* Edit: none

### S4-1-54 [D] Severity: Major
* Target: spec-top-five-audit-risks.md lines 24-25, 39, 46
* Finding: All three browsers now block CI, on the export suite.
* Decision: PROPOSE FIX
* Reason: `ci.yml:147,172`.
* Edit: Status block.

### S4-1-55 [D] Severity: Nit
* Target: spec-top-five-audit-risks.md lines 39, 47, 53-54
* Finding: Stricter write-ops threshold; missing-path test; a PocketBase system job exists.
* Decision: DECLINE
* Reason: Small.
* Edit: none
