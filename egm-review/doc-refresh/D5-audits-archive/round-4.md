# Doc refresh: D5-audits-archive, round 4

Status: resolved
Clean round: yes

Ids are `D5-audits-archive-4-<n>`, shortened to `4-<n>` below. Rounds 3 and 4 were both clean, so the batch converged. No edits this round.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/formal-findings-backlog.md | ran |

## Findings

### 4-1 [codebase-details] Severity: Nit
* Target: tasks/formal-findings-backlog.md line 19
* Finding: The row calls `isStaleDelete` "web's half of B-47 (SPEC-4)". The comment on `isStaleDelete` tags it B-46 (`lib/sync/pb-push.ts:248`), and `.claude/skills/verify-task-tombstones/SKILL.md:158` uses B-47 for the conditional-delete race.
* Decision: ESCALATE
* Reason: The ids belong to the parity backlog, which is outside this repo. The code cannot say whether the document or the comment has the right id.
* Edit: none

### 4-2 [codebase-details] Severity: Nit
* Target: tasks/formal-findings-backlog.md line 13
* Finding: The test file does not contain the quoted error text.
* Decision: DECLINE
* Reason: Same as 1-11.
* Edit: none

### 4-3 [codebase-details] Severity: Nit
* Target: tasks/formal-findings-backlog.md line 35
* Finding: `.claude/skills/verify-task-tombstones/SKILL.md:35` still describes the second path in the present tense; the document is the accurate one.
* Decision: DECLINE
* Reason: The stale text is in the skill, outside this batch. Reported in the return summary.
* Edit: none
