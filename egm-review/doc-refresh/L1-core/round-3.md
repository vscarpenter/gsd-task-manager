# Doc refresh: L1-core, round 3

Status: resolved
Clean round: no

The loop stops here on churn. L1-core-3-1 and 3-2 sit at the scope of the round 2 fix for L1-core-2-2, and reverting that fix resolves them. The text now states the verified behavior.

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A (egm-codebase-details) | README.md (outside Repository blueprint), ARCHITECTURE.md, CONTRIBUTING.md | ran |
| Accuracy B (egm-codebase-details) | PRODUCT.md, AGENTS.md, CLAUDE.md | ran |
| Accuracy C (egm-codebase-details) | coding-standards.md, docs/agents/*.md | ran |
| Accuracy D (egm-codebase-details) | .claude/README.md | ran |

No style reviewers run after round 2.

## Findings

### L1-core-3-1 [Accuracy A] Severity: Blocker
* Target: README.md lines 121-122
* Finding: My round 2 sentence said the PocketBase harness "does not exercise the web app's `lib/sync` code". `packages/mcp-server/src/__tests__/system/pocketbase-system.test.ts:703-830` starts the web app with `dev:e2e`, launches Chromium, and drives push, pull, and realtime. `ci.yml:134-137` installs Chromium for it.
* Decision: PROPOSE FIX
* Reason: Confirmed at lines 12, 703, 761, 772, 786, 817. The round 2 reviewer's claim was wrong, and my check (a search for `lib/sync` imports) missed a browser-driven test. Churn: this finding exists only because of the round 2 fix.
* Edit: Replaced the sentence. README now says one test starts the web app in Chromium and drives its sync paths, so it needs Playwright's Chromium.

### L1-core-3-2 [Accuracy A] Severity: Major
* Target: CONTRIBUTING.md lines 69-71
* Finding: Same wrong claim, plus a pointer to `tests/data/sync/` as the `lib/sync` coverage.
* Decision: PROPOSE FIX
* Reason: Same evidence as L1-core-3-1.
* Edit: Same replacement as the README. Removed the `tests/data/sync/` sentence. This withdraws the premise of L1-core-2-22: the harness does test sync, so "require" in CONTRIBUTING.md is coherent. README still calls the harness "optional".

### L1-core-3-3 [Accuracy A] Severity: Nit
* Target: README.md line 121; CONTRIBUTING.md lines 56-57, 69-71
* Finding: The harness downloads two PocketBase versions. `tests/sync/` also holds sync suites. CI runs `test:csp` on Chromium only and passes a browser to the other commands.
* Decision: DECLINE
* Reason: Small. The `tests/data/sync/` pointer is gone.
* Edit: none

### L1-core-3-4 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 129
* Finding: The delete path calls `removeDependencyReferencesInTransaction` (`lib/tasks/crud/delete.ts:28`), not `removeDependencyReferences`.
* Decision: PROPOSE FIX
* Reason: Confirmed. Both functions exist in `lib/tasks/dependencies.ts:50,74`.
* Edit: The bullet now names both and says which one runs inside a transaction.

### L1-core-3-5 [Accuracy B] Severity: Nit
* Target: AGENTS.md lines 26-27, 46-47; CLAUDE.md lines 48-50; PRODUCT.md lines 17, 34
* Finding: The CI `e2e` job builds without the two Next variables. `deploy-cloudfront-function.sh` publishes two functions. The loopback default applies over HTTP only. The UI calls the dashboard "Review".
* Decision: DECLINE
* Reason: Small. The dashboard and Review naming is already with the owner as L1-core-2-31.
* Edit: none

### L1-core-3-6 [Accuracy C] Severity: Major
* Target: docs/agents/README.md lines 6-7
* Finding: My round 2 wording said "cycle B in the pipeline page". The page never says "cycle B". It marks the builder as B and the night shift as D in its "How it was built" timeline (`docs/pipeline-summary.html:349-354`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now "milestone B in the pipeline page's timeline" and "milestone D in the pipeline page's timeline".

### L1-core-3-7 [Accuracy C] Severity: Major
* Target: docs/agents/night-shift.md lines 18-22
* Finding: The round 2 paragraph listed output lines incompletely. `DISABLED` also ends every enabled run (`triage-run.sh:67`). `PAUSED` was not named. The `triage:paused` lookup fails open (`triage-run.sh:34-39`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Listing status lines in the document invites this drift, so the paragraph now states behavior and names the script as the owner of the exact lines.
* Edit: Paragraph rewritten: count only, exit before lookup when the login is unset, the pause, the fail-open pause lookup, the failed `gh pr list` case, and a pointer to `scripts/triage-run.sh`.

### L1-core-3-8 [Accuracy C] Severity: Nit
* Target: docs/agents/night-shift.md, builder.md, triage-labels.md; coding-standards.md line 33
* Finding: Malformed helper input reports no work. A whitespace-only login passes as configured. The launchd templates under `scripts/launchd/` are not named. `plan:*` is three labels, and the issue template applies `needs-triage`. The read order lists a ledger file that may be absent.
* Decision: DECLINE
* Reason: Small. The first two are listed as possible code defects.
* Edit: none

### L1-core-3-9 [Accuracy D] Severity: Major
* Target: .claude/README.md lines 220-222
* Finding: "`/qcheck` runs the full skeptical review against the diff" after `gh pr checkout`. `.claude/commands/qcheck.md:5-7` reviews files changed in the session through `git status` and `git diff`. A fresh checkout has none.
* Decision: ESCALATE
* Reason: Either the command or the workflow should change. That is the owner's call in a `.claude/` file.
* Edit: none

### L1-core-3-10 [Accuracy D] Severity: Nit
* Target: .claude/README.md line 178
* Finding: "(two forms each)" read as applying to all seven commands.
* Decision: PROPOSE FIX
* Reason: `settings.json:52-61`.
* Edit: Now "six entries for `bun run test`, `bun run test:e2e`, and `bun run build` (two forms each)".

### L1-core-3-11 [Accuracy D] Severity: Nit
* Target: .claude/README.md line 101
* Finding: The agent names two spec files. The README named one.
* Decision: PROPOSE FIX
* Reason: `.claude/agents/pb-sync-reviewer.md:8`.
* Edit: Added `.claude/rules/archive-tombstone.md`.

### L1-core-3-12 [Accuracy D] Severity: Nit
* Target: .claude/README.md line 97
* Finding: The `a11y-reviewer` output format is a per-file list, not `file:line`.
* Decision: DECLINE
* Reason: Small.
* Edit: none
