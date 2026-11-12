# Doc refresh: L4-rules-ops, round 5

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A1 | the five `.claude/rules/*.md` files | ran |
| egm-codebase-details A2 | `docs/ops/gate2.md`, `github-actions-iam.md`, `pipeline-audit.md` | ran |
| egm-codebase-details A3 | `tests/e2e/README.md`, `tests/fixtures/README.md` | ran |

The ops documents and both READMEs had no Blocker or Major. Not clean because of 5-1 alone. This is the last round the brief allows, so the batch stops at the cap.

## Findings

### L4-rules-ops-5-1 [A1] Severity: Major
* Target: .claude/rules/pocketbase-sync.md line 25 (with line 29)
* Finding: "Only a 401 counts: a 403 more likely comes from something in front of the server." This holds for `confirmSessionIdentity` (`lib/sync/pb-sync-helpers.ts:217-229`). It does not hold for the token refresh at the start of `fullSync`: `refreshAuthOutcome` (`lib/sync/pb-auth.ts:369-392`) returns `rejected` for a 403 too, `ensureValidAuth` returns false, and the sync ends with the sign-in prompt. Only the token-forgetting step is 401-only.
* Decision: ESCALATE
* Reason: the rule states a principle, and one code path departs from it. The document may be right and `refreshAuthOutcome` wrong, or the rule may need a narrower scope. Listed under possible code defects.
* Edit: none

### L4-rules-ops-5-2 [A1] Severity: Nit
* Target: .claude/rules/pocketbase-sync.md lines 24, 59; .claude/rules/archive-tombstone.md lines 44, 68; .claude/rules/mcp-server.md line 38; .claude/rules/testing.md lines 14, 25, 29, 39
* Finding: nine nits. The "current row" fallback for `notify_before` sits in `resolveNotifyBefore` (`pb-push.ts:106-116`), not in the mapper. The `?? default` on reads is applied by consumers, not the pull mapper. `resurrectOnSight` runs after any authenticated pull, including one that skipped records. Archiving queues a remote delete, which the push may drop as stale. Migration v15 also truncates long titles. The Claude Desktop path is macOS only. `clearIndexedDB` does more than delete the database. `bun run test` excludes the MCP suites. Playwright specs sit in neither type-check program.
* Decision: DECLINE
* Reason: nits in facts-only files. None sends a reader to something that does not exist. Recorded for the owner.
* Edit: none

### L4-rules-ops-5-3 [A2] Severity: Nit
* Target: docs/ops/pipeline-audit.md lines 5, 30-31; docs/ops/github-actions-iam.md lines 314-316; docs/ops/gate2.md lines 12-13
* Finding: `triage-run.sh` also appends to a log on a `gh` failure. My line 30 said the standard deletes the ledger while line 31 says "clear the ledger entry". The policy script's attachment check runs after the create or update. The trigger glob `v*.*.*` is looser than the evidence job's strict tag check. Neither runbook mentions the `cancel-in-progress: false` queues.
* Decision: PROPOSE FIX (two), DECLINE (rest)
* Reason: the two fixed sentences were mine. The rest hold as written.
* Edit: line 30 now says the file "is absent between uses". The policy sentence now starts "After the create or update".

### L4-rules-ops-5-4 [A3] Severity: Nit
* Target: tests/e2e/README.md lines 10, 135, 149-152; tests/fixtures/README.md lines 33-44
* Finding: two tests skip unless the base URL has `:3100`, so the dev-server run never runs them (`share-target.spec.ts:12`, `saved-tasks.spec.ts:134`). Some tests skip outside Chromium. `createMockTask({ urgent: false })` leaves `quadrant` at its default. `createMockTasks(3, { urgent: true })` repeats the default.
* Decision: DECLINE
* Reason: no stated sentence is false. Recorded for the owner.
* Edit: none
