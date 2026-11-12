# Doc refresh: L1-core, round 4

Status: resolved
Clean round: no

A second driver continues the batch from round 4 (2026-11-12). Accuracy reviewers only, at most 3 at a time. Each reviewer got the list of findings settled in rounds 1 to 3. The driver opened the cited code for every fix before editing.

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A (egm-codebase-details) | README.md (outside Repository blueprint), CONTRIBUTING.md, ARCHITECTURE.md | ran |
| Accuracy B (egm-codebase-details) | CLAUDE.md, AGENTS.md, docs/agents: README.md, domain.md, issue-tracker.md, night-shift.md, triage-labels.md | ran |
| Accuracy C (egm-codebase-details) | .claude/README.md | ran |

## Checks on the round 3 edits

* `bun run test:system:pocketbase` (README.md, CONTRIBUTING.md): Reviewer A checked each clause and found every one true. The driver confirmed the same in `scripts/run-pocketbase-system-test.sh:70-76` and `packages/mcp-server/src/__tests__/system/pocketbase-system.test.ts:12,703,757-767,786`. Two omissions follow as L1-core-4-1 and 4-2.
* "milestone B" and "milestone D" (docs/agents/README.md): confirmed in `docs/pipeline-summary.html:349-354`. The heading is "How it was built" and the list marks the builder B and the night shift D.
* Script-outputs paragraph (docs/agents/night-shift.md): every clause confirmed in `scripts/triage-run.sh:29-68`. One omission follows as L1-core-4-8.
* `gh --json` fields (docs/agents/issue-tracker.md): see L1-core-4-14.

## Findings

### L1-core-4-1 [Accuracy A] Severity: Major
* Target: README.md lines 121-124; CONTRIBUTING.md lines 69-72
* Finding: The text names Playwright's Chromium as the only need. The harness also needs `curl` and `unzip` (`scripts/run-pocketbase-system-test.sh:51,66`), `python3` (`scripts/setup-pocketbase-feedback-collection.sh:32`, which `pocketbase-system.test.ts:399-401` always runs), network access to GitHub (script line 52), and one of four platforms (script lines 18-43).
* Decision: PROPOSE FIX
* Reason: Confirmed at each cited line. Not churn: the round 3 text is true, and reverting it would not add the prerequisites.
* Edit: Both files gained two sentences on the tools, the download, and the supported platforms.

### L1-core-4-2 [Accuracy A] Severity: Major
* Target: README.md lines 121-124; CONTRIBUTING.md lines 69-72
* Finding: The browser test spawns `bun run dev:e2e` in the repository root (`pocketbase-system.test.ts:757-768`). `package.json:12` defines it as `rimraf .next && next dev --webpack`. The harness deletes the checkout's `.next`.
* Decision: PROPOSE FIX
* Reason: Confirmed in both files. The effect on a dev server that is already running is not verified, so the text states only the deletion.
* Edit: Both files now say the test starts the app with `bun run dev:e2e`, which deletes `.next` first.

### L1-core-4-3 [Accuracy A] Severity: Nit
* Target: README.md line 122; CONTRIBUTING.md line 70
* Finding: "a disposable instance" is singular. The upgrade suite starts three servers in sequence.
* Decision: DECLINE
* Reason: Small. Same ground as the settled two-versions item (L1-core-3-3).
* Edit: none

### L1-core-4-4 [Accuracy A] Severity: Nit
* Target: CONTRIBUTING.md lines 48-54
* Finding: Without `POCKETBASE_BIN` the system suites skip (`pocketbase-system.test.ts:21`). `test:coverage` in the MCP workspace reports them as skipped.
* Decision: DECLINE
* Reason: Small. The document does not claim that `test:coverage` runs them.
* Edit: none

### L1-core-4-5 [Accuracy A] Severity: Nit
* Target: CONTRIBUTING.md lines 56-57
* Finding: The sentence gives CI's order as `test:csp` then `test:pwa`. `.github/workflows/ci.yml:164-172` runs `test:pwa` first.
* Decision: PROPOSE FIX
* Reason: Confirmed. The sentence states what CI does, unlike the README block declined as L1-core-1-3.
* Edit: Swapped the two commands.

### L1-core-4-6 [Accuracy A] Severity: Nit
* Target: README.md lines 74-75
* Finding: The Saved exclusion list differs in wording from the in-app help. The reviewer confirmed the matrix and reminder exclusions and did not trace "due badges" or "active task counts".
* Decision: DECLINE
* Reason: No difference shown.
* Edit: none

### L1-core-4-7 [Accuracy B] Severity: Major
* Target: docs/agents/README.md line 6; docs/agents/night-shift.md line 27; docs/agents/triage-labels.md line 17
* Finding: The documents say `/build-next` and `/triage-prs` refuse to run and that no agent acts on `ready-for-agent`. That holds for `.claude/commands/`. The tracked files `.agents/skills/source-command-build-next/SKILL.md` and `.agents/skills/source-command-triage-prs/SKILL.md` still hold the full live instructions, including checking out a pull-request head and running its build.
* Decision: ESCALATE
* Reason: The documents are correct about the files they name. The stale side is the `.agents/skills` mirrors, outside this batch. Round 1 recorded them as L1-core-1-43. Whether to retire the mirrors is the owner's security call. Listed under possible defects.
* Edit: none

### L1-core-4-8 [Accuracy B] Severity: Major
* Target: docs/agents/night-shift.md lines 18-22
* Finding: The paragraph says the script "reports only a count". When the helper cannot run, `scripts/triage-run.sh:62-64` reports that the count is unavailable.
* Decision: PROPOSE FIX
* Reason: Confirmed at lines 55-65. This passage has changed in each of rounds 1 to 3. The round 2 text named this outcome and the round 3 rewrite dropped it. The fix adds the behavior back as one sentence and still leaves the exact status lines to the script, so it keeps the round 3 fix for L1-core-3-7.
* Edit: Now "It reports that no candidate exists, or how many do. If the counting helper cannot run, it reports the count as unavailable."

### L1-core-4-9 [Accuracy B] Severity: Nit
* Target: docs/agents/night-shift.md lines 18-19
* Finding: A zero result prints no number, and enabled runs end with two fixed lines.
* Decision: PROPOSE FIX
* Reason: The zero case is confirmed at `triage-run.sh:57-58`. The fixed lines stay out, because the script owns the exact lines.
* Edit: Covered by the L1-core-4-8 edit.

### L1-core-4-10 [Accuracy B] Severity: Nit
* Target: docs/agents/night-shift.md lines 8-14
* Finding: Only open pull requests are considered (`triage-run.sh:46`, `--state open`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: The list intro now starts "An open pull request".

### L1-core-4-11 [Accuracy B] Severity: Nit
* Target: docs/agents/night-shift.md lines 19-21
* Finding: A pause lookup that succeeds with empty output counts as paused (`triage-run.sh:40`).
* Decision: DECLINE
* Reason: Small edge. Listed as a possible code defect.
* Edit: none

### L1-core-4-12 [Accuracy B] Severity: Nit
* Target: docs/agents/README.md lines 6-7
* Finding: The pipeline page's banner and `scripts/setup-labels.sh:6,27` say "cycle". The timeline says "milestone".
* Decision: DECLINE
* Reason: The document names the timeline, and the timeline says milestone.
* Edit: none

### L1-core-4-13 [Accuracy B] Severity: Nit
* Target: docs/agents/README.md line 3
* Finding: "Neither ... executes code unattended" is broader than the code. A scheduled `triage-run.sh` still runs `gh` and the helper. It runs no branch code.
* Decision: DECLINE
* Reason: Small. Line 7 of the same file gives the precise form.
* Edit: none

### L1-core-4-14 [Accuracy B] Severity: Nit
* Target: docs/agents/issue-tracker.md lines 8-9
* Finding: Scripts in this repo confirm only the `number` field and the `--label`, `--state`, `--json`, `--jq` flag shape for `gh issue list` (`scripts/triage-run.sh:35`). The fields `title`, `body`, `labels`, and `comments` on `gh issue list` appear only in the template `.agents/skills/setup-matt-pocock-skills/issue-tracker-github.md:9`. The same fields on `gh issue view`, added in round 1, appear nowhere in the repo.
* Decision: ESCALATE
* Reason: The repo cannot confirm the field names or how `--comments` combines with `--json`. This run makes no network calls and does not run `gh`. The owner can check with `gh issue view --help`.
* Edit: none

### L1-core-4-15 [Accuracy C] Severity: Nit
* Target: .claude/README.md lines 73-77, 245-246
* Finding: The Stop hook's ESLint run has no warning ceiling (`.claude/settings.json:44`). `bun lint` uses `--max-warnings=0` (`package.json:18`). A warning-only change passes the hook and fails CI.
* Decision: DECLINE
* Reason: Small. The document does not claim the hook equals CI lint.
* Edit: none

## Outside this batch (reported by reviewers, not edited)

* `.claude/skills/pb-collection/SKILL.md:44` names `mapToRemote()` and `mapFromRemote()`. The mapper exports `taskRecordToPocketBase` and `pocketBaseToTaskRecord` (`lib/sync/task-mapper.ts:123,237`).
* `.claude/skills/pb-collection/SKILL.md:45` names `tests/data/task-mapper.test.ts`. The file is `tests/data/sync/task-mapper.test.ts`.
* `.claude/hooks/no-main-commits.sh:2` has a header comment that describes an `if` matcher. `.claude/settings.json:25` has only `"matcher": "Bash"`.
