# Doc refresh: L4-rules-ops, round 3

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A1 | the five `.claude/rules/*.md` files | ran |
| egm-codebase-details A2 | `docs/ops/gate2.md`, `github-actions-iam.md`, `pipeline-audit.md` | ran |
| egm-codebase-details A3 | `tests/e2e/README.md`, `tests/fixtures/README.md` | ran |

No style reviewer: the brief limits it to rounds 1 and 2. The rules files had no Blocker or Major. Not clean because of 3-4, 3-5, and 3-8.

## Findings

### L4-rules-ops-3-1 [A1] Severity: Nit
* Target: .claude/rules/pocketbase-sync.md lines 16, 22, 25
* Finding: "Only the deletion reconcile batch-fetches" is loose, since `resurrectOnSight` also lists the account (`resurrect-on-sight.ts:71-79`). "Only a completed pull stamps the version" misses `lib/reset-local-data.ts:40` and the v7 and v13 upgrades (`lib/db-migrations.ts:82, 152`). A push can charge creates after its one session confirmation (`pb-push.ts:190-210`).
* Decision: PROPOSE FIX
* Reason: the first sentence was mine from round 1, so I dropped "Only". The other two are existing rule text and are recorded for the owner.
* Edit: one word removed on line 16.

### L4-rules-ops-3-2 [A1] Severity: Nit
* Target: .claude/rules/mcp-server.md line 33
* Finding: the TTL cache covers the task-list path (`list-tasks.ts:27`), not `getSyncStatus` or `getTaskStats`.
* Decision: DECLINE
* Reason: a small imprecision in a convention line. Recorded for the owner.
* Edit: none

### L4-rules-ops-3-3 [A1] Severity: Nit
* Target: .claude/rules/testing.md lines 22, 39
* Finding: the `tests/sync/` list omits two files. Specs that use `clearIndexedDB` do not see the first-load redirect unless they set `firstTimeVisitor`.
* Decision: PROPOSE FIX
* Reason: the `tests/sync/` line was mine. The redirect sentence is true of the app and stays.
* Edit: added "error categorizer" to the list.

### L4-rules-ops-3-4 [A2] Severity: Major
* Target: docs/ops/github-actions-iam.md lines 284-297, 314-316
* Finding: Step 3d sets no deployment-branch rule for `cloudfront-infra`, and the workflow has `workflow_dispatch` with a checkout of the dispatched ref (`deploy-cloudfront-infra.yml:15, 59-65`). A dispatch from any branch could run that branch's deploy scripts with the infra role once approved. `.github/REPOSITORY_SETTINGS.md:91-97` lists no `cloudfront-infra` environment.
* Decision: ESCALATE
* Reason: the right branch rule is a security policy choice, and the live setting is GitHub state. The runbook should not gain a rule the owner has not chosen.
* Edit: none

### L4-rules-ops-3-5 [A2] Severity: Major
* Target: docs/ops/github-actions-iam.md lines 301-312
* Finding: the first-run policy test fails unless the policy already exists and is attached. `scripts/deploy-cloudfront-response-headers-policy.sh:58-63` creates a missing policy, and lines 88-95 exit 1 when the distribution does not reference it. Nothing attaches it.
* Decision: PROPOSE FIX
* Reason: confirmed in the script.
* Edit: added a three-sentence precondition after the steps.

### L4-rules-ops-3-6 [A2] Severity: Nit
* Target: docs/ops/github-actions-iam.md lines 168, 310
* Finding: the rollback command prints only when an earlier tag exists. The visible text is the step summary, not the `deploy_policy=true` outputs.
* Decision: PROPOSE FIX
* Reason: confirmed (`deploy-production-release.yml:103-112`, `deploy-cloudfront-infra.yml:117-122`).
* Edit: corrected both lines.

### L4-rules-ops-3-7 [A2] Severity: Nit
* Target: docs/ops/gate2.md lines 7, 27, 41; docs/ops/github-actions-iam.md lines 318-321; docs/ops/pipeline-audit.md line 5
* Finding: the workflow does not validate the rollback tag; the function script republishes both functions and invalidates `/*`; `triage-run.sh` also stops on a `triage:paused` issue and reports a count. The release artifact is kept 14 days (`deploy-production-release.yml:152`), so a later approval would fail at download.
* Decision: DECLINE
* Reason: raised before as nits and declined (2-14). The 14-day limit is new and is recorded for the owner.
* Edit: none

### L4-rules-ops-3-8 [A3] Severity: Major
* Target: tests/e2e/README.md lines 114-116
* Finding: "covering it requires seeding" holds only for the settings link. The command palette action `view-archive` opens `/archive` with no condition (`lib/command-actions.ts:214-223`, `lib/use-shell-command-handlers.ts:101`).
* Decision: PROPOSE FIX
* Reason: confirmed, including the handler's `router.push("/archive")`.
* Edit: rewrote the end of the bullet.

### L4-rules-ops-3-9 [A3] Severity: Nit
* Target: tests/e2e/README.md lines 16-17, 82-98, 104-105; tests/fixtures/README.md lines 132-145, 160-198, 225-243
* Finding: nine nits: unstated fixture options and exemptions; a `settings.spec.ts` stub in the old spec document is also unimplemented under that name; the reused `bun dev` server uses a different bundler; the Dexie example asserts on an empty table; `const fetchMock` twice; `mockConsole` and `mockDateNow` limits.
* Decision: PROPOSE FIX (one), DECLINE (rest)
* Reason: the Dexie assertion read as wrong, so its comment now says rows were added first. The rest hold as written.
* Edit: one comment in the Database Mocking example.
