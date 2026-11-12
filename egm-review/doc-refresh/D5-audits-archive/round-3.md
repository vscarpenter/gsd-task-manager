# Doc refresh: D5-audits-archive, round 3

Status: resolved
Clean round: yes

Ids are `D5-audits-archive-3-<n>`, shortened to `3-<n>` below. Round 3 covered the FIX file and the one status note that had a Major in round 2. No style reviewer runs after round 2.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/formal-findings-backlog.md | ran |
| egm-codebase-details | status note in docs/archive/tasks-security-review-2026-05-12.md | ran, no differences |

## Findings

### 3-1 [codebase-details] Severity: Nit
* Target: tasks/formal-findings-backlog.md lines 62, 64
* Finding: The stated fix ("each of those three functions reads the row inside its own transaction") leaves out that the archive's `restoreTask` transaction does not scope `syncMetadata` (`lib/archive.ts:163-165`), and that code comments say the early read is deliberate.
* Decision: DECLINE
* Reason: This is fix design. `tasks/todo.md` already records the scope change under #735.
* Edit: none

### 3-2 [codebase-details] Severity: Nit
* Target: tasks/formal-findings-backlog.md line 62
* Finding: The harm was given only for the restore case. For the delete case, resurrect on sight brings the task back (`NoComeback` in `docs/formal/task-tombstones/check.sh:26`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `.claude/skills/verify-task-tombstones/SKILL.md` finding 6 and `check.sh`.
* Edit: Sentence split so each case has its harm.

### 3-3 [codebase-details] Severity: Nit
* Target: tasks/formal-findings-backlog.md line 7
* Finding: The task-tombstones summary omits three more steps the skill lists for a fixed finding.
* Decision: DECLINE
* Reason: Line 7 already sends the reader to the skill's `SKILL.md`. Copying the steps would drift.
* Edit: none

### 3-4 [codebase-details] Severity: Nit
* Target: tasks/formal-findings-backlog.md lines 7, 76
* Finding: A fourth `check.sh` exists at `docs/diagrams/reminder-model/check.sh` and line 7 did not mention it.
* Decision: PROPOSE FIX
* Reason: Confirmed the file exists.
* Edit: One sentence added to line 7.
