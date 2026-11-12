# Doc refresh: L1-core, round 5

Status: resolved
Clean round: no

One unsettled Major (L1-core-5-8). The round 4 edits passed review: Reviewer A confirmed every clause of the PocketBase harness paragraph, and Reviewer B confirmed every clause of the night-shift candidate list and output paragraph.

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A (egm-codebase-details) | README.md (outside Repository blueprint), CONTRIBUTING.md, ARCHITECTURE.md | ran |
| Accuracy B (egm-codebase-details) | CLAUDE.md, AGENTS.md, docs/agents: README.md, domain.md, issue-tracker.md, night-shift.md, triage-labels.md | ran |
| Accuracy C (egm-codebase-details) | .claude/README.md | ran |

## Findings

### L1-core-5-1 [Accuracy A] Severity: Nit
* Target: README.md line 85
* Finding: "`bun run` executes package scripts on Node" is general. `package.json:35` (`smoke`) runs a file on Bun, and `typecheck` goes through `bunx`.
* Decision: DECLINE
* Reason: Small. The second clause names tests, lint, and builds, and those scripts match.
* Edit: none

### L1-core-5-2 [Accuracy A] Severity: Nit
* Target: README.md lines 125-126; CONTRIBUTING.md lines 73-74
* Finding: The tool list omits `awk` and `bash`.
* Decision: DECLINE
* Reason: Both exist on every supported platform. The reviewer says no reader is misled.
* Edit: none

### L1-core-5-3 [Accuracy A] Severity: Nit
* Target: ARCHITECTURE.md line 18
* Finding: The service-worker row cites `lib/sw-cache-logic.ts` and two ADRs, not `public/sw.js`.
* Decision: DECLINE
* Reason: The page says it is a map and not exhaustive.
* Edit: none

### L1-core-5-4 [Accuracy B] Severity: Major
* Target: CLAUDE.md line 93
* Finding: "root URL redirects to the about page on first load" sits under E2E Testing. The shared fixture seeds `gsd-has-launched` by default (`tests/e2e/fixtures/test-fixtures.ts:60,102-107`), so a spec lands on the matrix unless it sets `firstTimeVisitor: true`.
* Decision: DECLINE
* Reason: Settled in round 1 as L1-core-1-17, which recorded that the fixture seeds the launch flag. The reviewer flagged it as next to that item. Not re-opened. The owner may want the line reworded, so it is repeated in the batch summary.
* Edit: none

### L1-core-5-5 [Accuracy B] Severity: Nit
* Target: CLAUDE.md lines 124-125
* Finding: The direction is right. `.strip()` sits on the stored row schemas (`lib/schema.ts:160,177,186`), not on `importPayloadSchema`. No schema is named "export schema". Export validates rows with the `.strict()` record schemas.
* Decision: DECLINE
* Reason: Small. The claim's direction holds, and CLAUDE.md is facts only.
* Edit: none

### L1-core-5-6 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 158
* Finding: No per-file coverage threshold exists. `vitest.config.ts:61-66` sets global thresholds only.
* Decision: ESCALATE
* Reason: The line states a working rule for changed files. Whether tooling should enforce it is the owner's call.
* Edit: none

### L1-core-5-7 [Accuracy B] Severity: Nit
* Target: CLAUDE.md lines 81 and 84
* Finding: The test layout line omits `tests/sync/` and `tests/pb/`. The cache line omits the 60-entry cap (`public/sw.js:6`).
* Decision: DECLINE
* Reason: Small omissions. The path-scoped rule files own the detail.
* Edit: none

### L1-core-5-8 [Accuracy C] Severity: Major
* Target: .claude/README.md lines 75 and 77
* Finding: The second Stop command lints "the changed and untracked" files. `.claude/settings.json:44` builds the list from `git diff --name-only --diff-filter=ACMR HEAD` plus untracked files. A file committed in the session is not linted, and a clean tree exits 0 with no ESLint run.
* Decision: PROPOSE FIX
* Reason: Confirmed in `settings.json:44`. A fact about what the hook runs.
* Edit: Now "on the uncommitted and untracked ... files. It compares against `HEAD`, so it skips files you already committed."

### L1-core-5-9 [Accuracy C] Severity: Nit
* Target: .claude/README.md line 204
* Finding: "walks through all 10 layers". `.claude/skills/pb-collection/SKILL.md:36-92` has 10 steps. Seven are code layers and three are tests, verification, and commit.
* Decision: PROPOSE FIX
* Reason: Confirmed by the step headings. Line 142 of the same file already says "10 ordered steps".
* Edit: "layers" became "steps".

### L1-core-5-10 [Accuracy C] Severity: Nit
* Target: .claude/README.md line 64
* Finding: The hook reads the branch from the payload's `cwd` (`.claude/hooks/no-main-commits.sh:18-23`). `git -C <other> commit` is judged against the wrong checkout, and a detached HEAD passes.
* Decision: DECLINE
* Reason: Small edge. Listed as a possible code defect.
* Edit: none

### L1-core-5-11 [Accuracy C] Severity: Nit
* Target: .claude/README.md lines 95, 120, 128
* Finding: "Radix dialogs" belongs to the modal-focus check. `/tdd` also pauses before the refactor step. The `/qcheck` summary omits three of its nine checks.
* Decision: DECLINE
* Reason: Small. The agent and command files own the full lists.
* Edit: none

### L1-core-5-12 [Accuracy C] Severity: Nit
* Target: .claude/README.md line 77
* Finding: "Run `bun run test` manually before pushing" names one of the six pre-commit commands in `CLAUDE.md`.
* Decision: DECLINE
* Reason: Advice, and CLAUDE.md holds the full list.
* Edit: none

## Outside this batch (reported by a reviewer, not edited)

* README.md line 310, inside `## Repository blueprint`: "Run: `bun run build`, then `bun run test:e2e:export`". README lines 138-141 and `ci.yml:165` say the export suite needs `bun run build:e2e`.
