# Doc refresh: L5-mcp-docker, round 3

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| accuracy A1 (egm-codebase-details) | packages/mcp-server/README.md lines 1-610 | ran |
| accuracy A2 (egm-codebase-details) | packages/mcp-server/README.md lines 590-964 | ran |
| accuracy A3 (egm-codebase-details) | docker/README.md, docs/diagrams/reminder-model/README.md, docs/diagrams/task-lifecycle-model/README.md | ran, no Blocker or Major |
| accuracy A4 (egm-codebase-details) | packages/mcp-server/QUICKSTART.md, packages/mcp-server/QUICK_TEST.md, packages/mcp-server/TESTING.md, packages/mcp-server/TEST_PLAN.md | ran |

## Findings

### L5-mcp-docker-3-1 [accuracy A1] Severity: Major
* Target: packages/mcp-server/README.md lines 552-553
* Finding: "The MCP server never renews its token": `refreshPrincipal` calls `authRefresh` (`src/pocketbase-client.ts:120-128`), and the PocketBase SDK saves the returned token in memory. The configured token and get_token_status keep the original expiry.
* Decision: ESCALATE
* Reason: CHANGELOG.md line 61 records "no renewal" as a stated decision (#663). The document may state the intended rule and the code may differ. Listed under possible code defects.
* Edit: none

### L5-mcp-docker-3-2 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 96-116
* Finding: `--validate` reads only the two environment variables.
* Decision: DECLINE
* Reason: The list says "Checks environment variables".
* Edit: none

### L5-mcp-docker-3-3 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 20-22
* Finding: Owner-only holds on macOS and Linux only.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-3-4 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 272-277
* Finding: A Saved item can still be deleted by ID.
* Decision: DECLINE
* Reason: Omission. Worth a line if the owner wants one.
* Edit: none

### L5-mcp-docker-3-5 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 607-609
* Finding: Codes also come from failed reads inside a write tool (`handlers/index.ts:135-138`, `list-tasks.ts:98-99`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Same as finding 6.
* Edit: Reworded both sentences.

### L5-mcp-docker-3-6 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md lines 816-818, 607-609
* Finding: A URL that answers 404 gives `not_found` on delete_task and bulk previews; the "instead" sentence holds for only three tools.
* Decision: PROPOSE FIX
* Reason: Confirmed (`task-operations.ts:403`, `list-tasks.ts:98-99`). The sentence was mine from round 2.
* Edit: `not_found` bullet now gives both causes and drops the "instead" sentence.

### L5-mcp-docker-3-7 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md lines 864-866
* Finding: Version list leaves out the root `bun.lock` (`bun.lock:67-69`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The sentence was mine from round 2.
* Edit: Added bun.lock here and in TEST_PLAN.md.

### L5-mcp-docker-3-8 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 594
* Finding: Two bulk writes can share one limiter slot.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-3-9 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 790
* Finding: Heading joins two log lines.
* Decision: DECLINE
* Reason: Declined in rounds 1 and 2.
* Edit: none

### L5-mcp-docker-3-10 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 810-811
* Finding: Bulk Saved message differs.
* Decision: DECLINE
* Reason: Declined in rounds 1 and 2.
* Edit: none

### L5-mcp-docker-3-11 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 804-805
* Finding: HTTPS message has a second cause.
* Decision: DECLINE
* Reason: Line 184 of the README states the full URL rule.
* Edit: none

### L5-mcp-docker-3-12 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 603
* Finding: Bulk clears the cache once, at the end (`bulk-operations.ts:366`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Reworded.

### L5-mcp-docker-3-13 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 31-32
* Finding: `sha-<short>` is published only for main.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-3-14 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 28-29
* Finding: Docker Hub publish depends on a secret.
* Decision: DECLINE
* Reason: Not visible to a reader.
* Edit: none

### L5-mcp-docker-3-15 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 216-217
* Finding: Token migration only raises the value.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-3-16 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 26
* Finding: Two of the variables exist only in RemindersFixed.tla.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-3-17 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 30
* Finding: check.sh prints more than pass or break.
* Decision: PROPOSE FIX
* Reason: Sentence was mine from round 2.
* Edit: Reworded.

### L5-mcp-docker-3-18 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 42
* Finding: The checker also skips runs in quiet hours.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-3-19 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 246-249
* Finding: Version list omits bun.lock.
* Decision: PROPOSE FIX
* Reason: Same as finding 7. Fixed while this reviewer was reading.
* Edit: See finding 7.

### L5-mcp-docker-3-20 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TEST_PLAN.md line 178
* Finding: `#test` comes back as `test`.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-3-21 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 150-151
* Finding: NODE_ENV=development also enables debug.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-3-22 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 151-153
* Finding: handlers/index.ts has no logger to call.
* Decision: PROPOSE FIX
* Reason: Confirmed. Sentence was mine from round 2.
* Edit: Now says to create the logger first.

### L5-mcp-docker-3-23 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 180-182
* Finding: Two bullets sit oddly beside the null-stats bullet.
* Decision: DECLINE
* Reason: Not wrong.
* Edit: none

## Notes

* No style reviewers this round, as the brief sets.
* docker/README.md and the two diagram READMEs had a clean round. The four MCP files did not.
