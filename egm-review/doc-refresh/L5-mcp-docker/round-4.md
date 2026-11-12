# Doc refresh: L5-mcp-docker, round 4

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| accuracy A1 (egm-codebase-details) | packages/mcp-server/README.md lines 1-612 | ran |
| accuracy A2 (egm-codebase-details) | packages/mcp-server/README.md lines 590-965 | ran, no Blocker or Major |
| accuracy A3 (egm-codebase-details) | docker/README.md, docs/diagrams/reminder-model/README.md, docs/diagrams/task-lifecycle-model/README.md | ran, no Blocker or Major |
| accuracy A4 (egm-codebase-details) | packages/mcp-server/QUICKSTART.md, packages/mcp-server/QUICK_TEST.md, packages/mcp-server/TESTING.md, packages/mcp-server/TEST_PLAN.md | ran, no Blocker or Major |

## Findings

### L5-mcp-docker-4-1 [accuracy A1] Severity: Major
* Target: packages/mcp-server/README.md lines 608-610
* Finding: "the tool returns a one-word code" is too broad. Auth-refresh failures, a 404 on a task lookup, and a failed next-instance create return sentences (`handlers/index.ts:113-138`, `pocketbase-client.ts:86-128`, `helpers.ts:105-109`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Reviewer A2 raised the same point as a Nit. The sentence was mine from round 3; narrowing it settles the point, and reverting would bring back the round 3 finding.
* Edit: Both sentences now say "some failed requests" and point to the other messages.

### L5-mcp-docker-4-2 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 603-604
* Finding: A bulk complete also clears the cache on each spawned instance.
* Decision: PROPOSE FIX
* Reason: Confirmed (`bulk-operations.ts:141`, `helpers.ts:63`).
* Edit: "once, at the end" is now "at the end of the batch".

### L5-mcp-docker-4-3 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md line 550
* Finding: The no-token branch of `invalid` cannot be reached through the tool.
* Decision: DECLINE
* Reason: Harmless.
* Edit: none

### L5-mcp-docker-4-4 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 303-318
* Finding: get_task_stats field names suggest creation dates.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-4-5 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 281-284
* Finding: A revoked token goes unnoticed for up to 30 seconds of cached reads.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-4-6 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 608-611, 818
* Finding: Not every failed request returns a code.
* Decision: PROPOSE FIX
* Reason: Same as finding 1.
* Edit: See finding 1.

### L5-mcp-docker-4-7 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 610
* Finding: Bulk errors have other shapes too.
* Decision: PROPOSE FIX
* Reason: Confirmed (`bulk-operations.ts:201-315`).
* Edit: Now "beside a task whose write failed".

### L5-mcp-docker-4-8 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 603-604
* Finding: Bulk clears on each spawn too.
* Decision: PROPOSE FIX
* Reason: Same as finding 2.
* Edit: See finding 2.

### L5-mcp-docker-4-9 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 30
* Finding: The arrow count holds only if the statechart tool drops self-loops.
* Decision: DECLINE
* Reason: Cannot be checked without the tool.
* Edit: none

### L5-mcp-docker-4-10 [accuracy A3] Severity: Nit
* Target: docs/diagrams/task-lifecycle-model/README.md line 20
* Finding: Unchecking also clears completedAt and bumps updatedAt.
* Decision: DECLINE
* Reason: The README's point stands.
* Edit: none

### L5-mcp-docker-4-11 [accuracy A3] Severity: Nit
* Target: docs/diagrams/task-lifecycle-model/README.md line 48
* Finding: Java 21 is the skill's need, not tlc.sh's.
* Decision: DECLINE
* Reason: Declined in rounds 1 and 2.
* Edit: none

### L5-mcp-docker-4-12 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md line 84
* Finding: Trailing-space bullet belongs under the sign-in error.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-4-13 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md line 85
* Finding: URL rule also rejects credentials, a query, or a fragment.
* Decision: DECLINE
* Reason: The README states the full rule.
* Edit: none

### L5-mcp-docker-4-14 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 139-142
* Finding: PowerShell command in a bash fence.
* Decision: DECLINE
* Reason: Formatting.
* Edit: none

### L5-mcp-docker-4-15 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 111-115
* Finding: Other soft-failing tools not named in the expired-token test.
* Decision: DECLINE
* Reason: Placement only.
* Edit: none

### L5-mcp-docker-4-16 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TEST_PLAN.md lines 124-126
* Finding: Task Stats has no soft-failure pass rule.
* Decision: DECLINE
* Reason: Part of the escalated pass-condition question (L5-mcp-docker-2-50).
* Edit: none

## Notes

* docker/README.md and the two diagram READMEs have two clean rounds in a row (3 and 4). They are converged and leave the loop.
* The four small MCP files had their first clean round.
* The README had one Major, in the lines both README reviewers read.
