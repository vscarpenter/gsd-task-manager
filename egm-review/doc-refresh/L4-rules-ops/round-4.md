# Doc refresh: L4-rules-ops, round 4

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A1 | the five `.claude/rules/*.md` files | ran |
| egm-codebase-details A2 | `docs/ops/gate2.md`, `github-actions-iam.md`, `pipeline-audit.md` | ran |
| egm-codebase-details A3 | `tests/e2e/README.md`, `tests/fixtures/README.md` | ran |

The rules files and both READMEs had no Blocker or Major. Not clean because of 4-1 alone. Earlier rounds saw the same point as a Nit, but no round had recorded a decision on it.

## Findings

### L4-rules-ops-4-1 [A2] Severity: Major
* Target: docs/ops/pipeline-audit.md lines 30, 39
* Finding: `tasks/implementation-notes.md` does not exist. The document names it as the deviations ledger.
* Decision: PROPOSE FIX
* Reason: `coding-standards.md:96` deletes the ledger after each distillation, so absence is its resting state. The document did not say so.
* Edit: added two short sentences: create the file when needed, and the standard deletes it after distillation.

### L4-rules-ops-4-2 [A2] Severity: Nit
* Target: docs/ops/github-actions-iam.md lines 318-320
* Finding: a manual run does not skip the "Detect what changed" step. It skips only the git diff, and still writes the plan summary (`deploy-cloudfront-infra.yml:67-122`).
* Decision: PROPOSE FIX
* Reason: confirmed. The sentence was mine from round 1.
* Edit: reworded the sentence.

### L4-rules-ops-4-3 [A2] Severity: Nit
* Target: docs/ops/gate2.md lines 61-67, 72-73; docs/ops/github-actions-iam.md lines 158-159; docs/ops/pipeline-audit.md line 5
* Finding: `.github/REPOSITORY_SETTINGS.md:93` words the production deployment rule differently; `triage-run.sh` prints a count; the rollback run does not audit the tag's own dependencies, and the full-history secret scan can block it too; the rollback build uses the build action from the tag's tree.
* Decision: DECLINE
* Reason: GitHub settings and rollback limits are for the owner. Recorded in the summary.
* Edit: none

### L4-rules-ops-4-4 [A1] Severity: Nit
* Target: .claude/rules/archive-tombstone.md lines 18, 22, 46
* Finding: merge-mode import regenerates ids only against `tasks` (`lib/tasks/import-export.ts:389-394`). An imported id that matches an archive or Trash row goes live as it is, so one id can sit in two tables.
* Decision: PROPOSE FIX (row wording), ESCALATE (the behavior)
* Reason: my round 1 row said "conflicting ids" without the limit. The row now states it. Whether merge import breaks rule 1 is listed under possible code defects.
* Edit: the `applyTasks` row now says "ids that clash with live tasks only".

### L4-rules-ops-4-5 [A1] Severity: Nit
* Target: .claude/rules/archive-tombstone.md lines 24, 28, 54, 57; .claude/rules/pocketbase-sync.md line 29; .claude/rules/mcp-server.md lines 24, 33; .claude/rules/sw-cache.md lines 20, 31
* Finding: eight nits. `restoreTask` no longer leaves a shared id. Far-future and unparseable stamps never beat the tombstone. `applyTrashedTasks` also skips ids already in Trash. "Same guard" for `applyRemoteDeletion` is the queue classifier, not the archive guard. The refresh window is seven days. `delete_task` and bulk delete default to a dry run. The runtime cache takes four fixed paths, not "other static". The stamp also rejects a version that does not start with a digit.
* Decision: DECLINE
* Reason: nits in facts-only files, and most were recorded in rounds 1 to 3. The dry-run default and the runtime cache scope are new, and both are recorded in the summary.
* Edit: none

### L4-rules-ops-4-6 [A1] Severity: Nit
* Target: .claude/rules/testing.md line 22
* Finding: the `tests/sync/` list still omits `utils.test.ts`.
* Decision: PROPOSE FIX
* Reason: a list of six files would keep drifting.
* Edit: the line now gives two examples in place of a list.

### L4-rules-ops-4-7 [A3] Severity: Nit
* Target: tests/e2e/README.md lines 44, 46, 68-76, 102-105; tests/fixtures/README.md lines 18-23
* Finding: five nits. Two of the three "stubs" are single test cases, not files. The capture-parser column says "Suffix" but tokens match anywhere. Two spec descriptions are narrow. `example-usage.test.ts` imports from `./index`.
* Decision: PROPOSE FIX (one), DECLINE (rest)
* Reason: "as test files" was mine from round 2 and was wrong for two items.
* Edit: removed "as test files" from the known-gaps lead.
