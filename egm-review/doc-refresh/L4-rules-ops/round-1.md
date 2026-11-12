# Doc refresh: L4-rules-ops, round 1

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A1 | the five `.claude/rules/*.md` files | ran |
| egm-codebase-details A2 | `docs/ops/gate2.md`, `github-actions-iam.md`, `pipeline-audit.md` | ran |
| egm-codebase-details A3 | `tests/e2e/README.md`, `tests/fixtures/README.md` | ran |
| egm-style S1 | all ten files | ran |

## Findings

### .claude/rules/archive-tombstone.md

### L4-rules-ops-1-1 [A1] Severity: Major
* Target: .claude/rules/archive-tombstone.md lines 34-55
* Finding: the writer table omits `settleRowOffset`, the push's only `tasks` write (`lib/sync/pb-push.ts:126-143`, transaction over tasks+syncMetadata, `assertSyncSessionCurrent` first).
* Decision: PROPOSE FIX
* Reason: confirmed in `lib/sync/pb-push.ts:settleRowOffset`.
* Edit: added a `settleRowOffset` row.

### L4-rules-ops-1-2 [A1] Severity: Major
* Target: .claude/rules/archive-tombstone.md lines 34-55
* Finding: three writers that delete tombstone rows are missing: `deleteArchivedTask` (`lib/archive.ts:230`), `deleteFromTrashForever` (`lib/trash.ts:83`), `emptyTrash` (`lib/trash.ts:93`).
* Decision: PROPOSE FIX
* Reason: confirmed in both files.
* Edit: added three rows.

### L4-rules-ops-1-3 [A1] Severity: Major
* Target: .claude/rules/archive-tombstone.md lines 28, 45-50
* Finding: the live-table half of import, `applyTasks` (`lib/tasks/import-export.ts:373-395`), is missing. It uses `bulkAdd` inside the import transaction.
* Decision: PROPOSE FIX
* Reason: confirmed. The row states what the code does. Whether the Traps section should say why `bulkAdd` is safe there is the owner's call.
* Edit: added an `applyTasks` row.

### L4-rules-ops-1-4 [A1] Severity: Major
* Target: .claude/rules/archive-tombstone.md (omission)
* Finding: sign-in (`persistSyncConfig`) scopes the three lifecycle tables and queues local tasks in one transaction. Sign-out (`resetSyncConfigState`) reads `sync_config` inside its transaction. The rule mentions neither, and `components/sync/**` is outside its `paths`.
* Decision: ESCALATE
* Reason: neither function writes `tasks`, `archivedTasks`, or `deletedTasks`, so no table row is wrong. Whether the rule should cover them, or its `paths` should widen, is a scope choice. The facts now sit in `pocketbase-sync.md` (finding 1-13).
* Edit: none

### L4-rules-ops-1-5 [A1] Severity: Nit
* Target: .claude/rules/archive-tombstone.md lines 20, 55
* Finding: other `tasks` writers are unlisted (`clearTasks`, `clearTables` in `lib/reset-local-data.ts`, `lib/notification-checker.ts`, the CRUD modules, migration v13).
* Decision: DECLINE
* Reason: a full list of every `tasks` writer would drift. Noted for the owner.
* Edit: none

### L4-rules-ops-1-6 [A1] Severity: Nit
* Target: .claude/rules/archive-tombstone.md lines 24, 42, 44, 45, 50, 51, 52
* Finding: seven detail gaps (A1 nits 6 to 11): `applyRemoteRecords` also scopes `syncQueue`; `resurrectOnSight` may overwrite a live row with a strictly newer copy; the retry-exhausted wording; import merge and replace details; far-future stamps are never newer; v15 also truncates long titles.
* Decision: DECLINE
* Reason: none makes a row wrong. Facts-only file.
* Edit: none

### L4-rules-ops-1-7 [S1] Severity: Major
* Target: .claude/rules/archive-tombstone.md lines 18-28, 42-53, 62-63
* Finding: six style findings (S1 1 to 6): rule scope names two tables where the text says three; `restoreTask` names two functions; "shared id" and "Cleanup" lack a referent; "resurrection" has two senses; undefined table terms; a non sequitur in the "never synced" trap.
* Decision: ESCALATE
* Reason: wording of rules under `.claude/`. The brief allows fact fixes only.
* Edit: none

### .claude/rules/pocketbase-sync.md

### L4-rules-ops-1-8 [A1] Severity: Major
* Target: .claude/rules/pocketbase-sync.md line 33
* Finding: `pb-sync-engine.ts` is no longer the push/pull engine. Push is `pb-push.ts`, pull is `pb-pull.ts`, and the engine re-exports them (`pb-sync-engine.ts:28-31`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: rewrote the Key Locations line and added `pb-push.ts`, `pb-pull.ts`, `sync-session.ts`.

### L4-rules-ops-1-9 [A1] Severity: Major
* Target: .claude/rules/pocketbase-sync.md line 16
* Finding: "batch-fetch remote IDs" no longer describes the push. It looks up each row with `fetchRemoteTaskEntry` (`pb-push.ts:267`). `fetchRemoteTaskIndex` serves only `reconcileDeletedTasks` (`pb-pull.ts:319`).
* Decision: PROPOSE FIX
* Reason: confirmed by `rg`.
* Edit: rewrote the rate-limiting bullet.

### L4-rules-ops-1-10 [A1] Severity: Major
* Target: .claude/rules/pocketbase-sync.md line 35
* Finding: `pb-auth.ts` has no logout. Sign-out is `disableSync` in `lib/sync/config/disable.ts`.
* Decision: PROPOSE FIX
* Reason: confirmed from the exports of `pb-auth.ts`.
* Edit: corrected the line.

### L4-rules-ops-1-11 [A1] Severity: Major
* Target: .claude/rules/pocketbase-sync.md line 28
* Finding: the SDK does not auto-refresh. `ensureValidAuth` (`pb-auth.ts:412`) refreshes a token near expiry at the start of `fullSync`.
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: rewrote the Auth bullet.

### L4-rules-ops-1-12 [A1] Severity: Nit
* Target: .claude/rules/pocketbase-sync.md lines 22, 24, 25, 41-42, frontmatter
* Finding: five nits (A1 6 to 10): creates confirm the session once per push, so a later failure can charge a create; three Trash exits do not forget the resurrect id (`pb-pull.ts:168`, `pb-sync-engine.ts:134`, `import-export.ts:284`); "completed pull" means `authenticated`, and Reset Everything also stamps the version; Apple is a third provider; `paths` gaps.
* Decision: DECLINE
* Reason: nits in a facts-only file. The Trash-exit one is listed under possible code defects in the summary, because the document states "every way out".
* Edit: none

### L4-rules-ops-1-13 [A1] Severity: Major
* Target: .claude/rules/pocketbase-sync.md (omission)
* Finding: the session fence is not described: `assertSyncSessionCurrent`, `StaleSyncSessionError`, the push checkpoints, sign-in and sign-out transactions.
* Decision: PROPOSE FIX
* Reason: confirmed in `lib/sync/sync-session.ts`, `pb-push.ts`, `use-sync-auth-dialog.ts:persistSyncConfig`, `config/disable.ts`. The task brief named these facts.
* Edit: added one "Session fence" bullet under Sync Architecture.

### L4-rules-ops-1-14 [S1] Severity: Major
* Target: .claude/rules/pocketbase-sync.md lines 22-25, 41-42, 53-55
* Finding: six style findings (S1 7 to 12): "clamp" and "ceiling" cover two mechanisms each; three sentences in line 22 are hard to follow; `S-AND-02`, `WEB-HOLDOFF`, `D-10` have no referent; "charging queue rows" is undefined; Google and GitHub lines differ without a stated reason; the null statement in the `notify_before` section.
* Decision: ESCALATE
* Reason: wording under `.claude/`.
* Edit: none

### .claude/rules/mcp-server.md

### L4-rules-ops-1-15 [A1] Severity: Major
* Target: .claude/rules/mcp-server.md line 18
* Finding: there is no per-tool file. `src/tools/` holds four read-function files and `prompts.ts`; the dispatcher is in `src/tools/handlers/`.
* Decision: PROPOSE FIX
* Reason: confirmed by listing `packages/mcp-server/src/tools/` and its README.
* Edit: rewrote the "Tool files" bullet.

### L4-rules-ops-1-16 [A1] Severity: Nit
* Target: .claude/rules/mcp-server.md lines 16-19, 30
* Finding: `src/api/client.ts` still exports `redactPocketBaseHost`, which is in use; the layout omits `src/server/`, `src/cli/`, `src/auth/`.
* Decision: DECLINE
* Reason: the sentence about `fetchWithRetry` holds as worded.
* Edit: none

### .claude/rules/sw-cache.md

### L4-rules-ops-1-17 [A1] Severity: Nit
* Target: .claude/rules/sw-cache.md
* Finding: no factual difference. Unmentioned behavior (passthrough rules, share target, offline fallbacks) and `paths` gaps.
* Decision: DECLINE
* Reason: omissions, not errors.
* Edit: none

### L4-rules-ops-1-18 [S1] Severity: Major
* Target: .claude/rules/sw-cache.md line 25
* Finding: "Edit only this file" reads as forbidding edits to `public/sw.js`.
* Decision: ESCALATE
* Reason: wording under `.claude/`.
* Edit: none

### .claude/rules/testing.md

### L4-rules-ops-1-19 [A1] Severity: Major
* Target: .claude/rules/testing.md line 36
* Finding: `localStorage.clear()` works. `vitest.setup.ts:8-21` installs an `InMemoryStorage` with `clear()`, and four test files call it.
* Decision: PROPOSE FIX
* Reason: confirmed in `vitest.setup.ts`. `CLAUDE.md` repeats the stale claim; it is outside this batch.
* Edit: rewrote the bullet.

### L4-rules-ops-1-20 [A1] Severity: Major
* Target: .claude/rules/testing.md line 37
* Finding: one test file uses `vi.mock('pocketbase')`. 29 mock `@/lib/sync/pocketbase-client`.
* Decision: PROPOSE FIX
* Reason: confirmed by `rg`.
* Edit: rewrote the bullet.

### L4-rules-ops-1-21 [A1] Severity: Major
* Target: .claude/rules/testing.md lines 20-24
* Finding: the layout omits `tests/sync/`, and `tests/pb/` holds more than encryption tests.
* Decision: PROPOSE FIX
* Reason: confirmed by listing both directories.
* Edit: added `tests/sync/` and widened the `tests/pb/` line. `tests/tools/`, `tests/utils/`, and the root script tests stay unlisted.

### L4-rules-ops-1-22 [A1, S1] Severity: Major (S1), Nit (A1)
* Target: .claude/rules/testing.md line 38
* Finding: `clearIndexedDB` is opt-in, not automatic. Isolation comes from per-test browser contexts.
* Decision: PROPOSE FIX
* Reason: confirmed in `tests/e2e/fixtures/test-fixtures.ts` (no `auto` flag on `clearIndexedDB`).
* Edit: rewrote the E2E bullet.

### L4-rules-ops-1-23 [A1] Severity: Nit
* Target: .claude/rules/testing.md lines 23-24, frontmatter
* Finding: the dev server command is `bun run dev:e2e`; the export config is unmentioned; `bun run test` excludes the MCP package; `paths` gaps.
* Decision: DECLINE
* Reason: omissions in a facts-only file.
* Edit: none

### docs/ops/gate2.md

### L4-rules-ops-1-24 [A2] Severity: Major
* Target: docs/ops/gate2.md lines 23-28, 55-57
* Finding: the workflow has six jobs. `audit` runs first and `evidence` needs it (`deploy-production-release.yml:18-25`). On a dispatch the audit checks out the default branch (`security-audit.yml` checkout has no `ref`).
* Decision: PROPOSE FIX
* Reason: confirmed in both workflow files.
* Edit: added the audit step to the release path and a paragraph to Rollback.

### L4-rules-ops-1-25 [A2] Severity: Major
* Target: docs/ops/gate2.md lines 3-5, 13-15
* Finding: `bun run deploy` (`package.json:28`, `scripts/deploy-prod.sh`) builds locally and deploys to production with no Gate 2, attestation, or audit.
* Decision: ESCALATE
* Reason: the document states a policy ("only the production environment reviewer can release"). The code offers a second path. The owner decides which is right.
* Edit: none

### L4-rules-ops-1-26 [A2] Severity: Major
* Target: docs/ops/gate2.md line 22
* Finding: `/release` step 8 (`.claude/commands/release.md:26`) runs `git fetch origin main` then `git tag vX.Y.Z` with no checkout of `main`. It tags local HEAD, which may be the release branch commit. After a squash merge the workflow rejects that tag.
* Decision: ESCALATE
* Reason: the document states the intended result. The command text may be the defect.
* Edit: none

### L4-rules-ops-1-27 [A2, S1] Severity: Nit (A2), Major (S1)
* Target: docs/ops/gate2.md lines 10-11
* Finding: "no manual trigger" conflicts with the manual repository-dispatch rollback.
* Decision: PROPOSE FIX
* Reason: the workflow has no `workflow_dispatch` but does take `repository_dispatch`.
* Edit: narrowed the sentence and named both triggers.

### L4-rules-ops-1-28 [A2] Severity: Nit
* Target: docs/ops/gate2.md line 52
* Finding: the example tag `v9.3.2` is stale (no such tag locally; version is 14.8.7).
* Decision: PROPOSE FIX
* Reason: `git tag --list` shows no `v9.3.2`.
* Edit: replaced with `vX.Y.Z` and pointed at the evidence summary, which prints the command.

### L4-rules-ops-1-29 [A2] Severity: Nit
* Target: docs/ops/gate2.md lines 21, 33-40
* Finding: `/release` lets the agent merge; the evidence list omits the audit result and second attestation; the workflow does not fail when no prior tag exists.
* Decision: DECLINE
* Reason: these lines state human policy.
* Edit: none

### L4-rules-ops-1-30 [S1] Severity: Major
* Target: docs/ops/gate2.md line 24
* Finding: "print rollback" has no object.
* Decision: PROPOSE FIX
* Reason: the evidence job prints the rollback command (`deploy-production-release.yml:106-109`).
* Edit: "print the rollback command".

### L4-rules-ops-1-31 [S1] Severity: Major
* Target: docs/ops/gate2.md lines 20-21, 65-66 against pipeline-audit.md
* Finding: the two ops documents disagree on human review and on whether the builder is active.
* Decision: PROPOSE FIX
* Reason: the code shows the builder and night shift are retired (finding 1-41). gate2.md is right.
* Edit: none in gate2.md. The status block in pipeline-audit.md settles it.

### docs/ops/github-actions-iam.md

### L4-rules-ops-1-32 [A2, S1] Severity: Major
* Target: docs/ops/github-actions-iam.md lines 11-21
* Finding: the "before merging the rename" step reads as current, but the rename has merged and `deploy-prod.yml` is absent.
* Decision: PROPOSE FIX
* Reason: confirmed by listing `.github/workflows/`.
* Edit: rewrote the paragraph in the past tense. The command stays.

### L4-rules-ops-1-33 [A2] Severity: Major
* Target: docs/ops/github-actions-iam.md lines 300-305
* Finding: "Detect what changed" is a step in the gated `deploy` job (`deploy-cloudfront-infra.yml:43-68`), so it cannot run before approval. An audit job runs first.
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: swapped steps 4 and 5 and named the audit job.

### L4-rules-ops-1-34 [A2] Severity: Major
* Target: docs/ops/github-actions-iam.md Step 3
* Finding: the `workflow_dispatch` trigger with its `deploy` input is undocumented (`deploy-cloudfront-infra.yml:15-25`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: added one paragraph after the first-run steps.

### L4-rules-ops-1-35 [A2] Severity: Major
* Target: docs/ops/github-actions-iam.md lines 152, 292
* Finding: no workflow reads `vars.ENV_LABEL`. The workflow hard-codes `ENV_LABEL: Production` (`deploy-production-release.yml:308`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: removed the `ENV_LABEL` row and its mention at line 292. Added the HTTPS rule for `SITE_URL`.

### L4-rules-ops-1-36 [A2] Severity: Major
* Target: docs/ops/github-actions-iam.md lines 164-169
* Finding: the first-run test omits the audit and evidence jobs, the second attestation, the predicate match, and the archive validation.
* Decision: PROPOSE FIX
* Reason: confirmed in the workflow.
* Edit: rewrote the numbered steps (now nine).

### L4-rules-ops-1-37 [A2, S1] Severity: Nit (A2), Major (S1)
* Target: docs/ops/github-actions-iam.md lines 162-163
* Finding: stale version examples; "commit to main, merge via PR" contradicts itself; hand tagging differs from gate2.md's `/release`.
* Decision: PROPOSE FIX
* Reason: branch protection and the `no-main-commits` hook rule out a commit on main.
* Edit: steps 1 and 2 now use placeholders and one action each.

### L4-rules-ops-1-38 [A2, S1] Severity: Nit (A2), Major (S1)
* Target: docs/ops/github-actions-iam.md line 143
* Finding: "locked decision §7.5" has no referent in the repo.
* Decision: ESCALATE
* Reason: only the owner knows the source document.
* Edit: none

### L4-rules-ops-1-39 [A2, S1] Severity: Nit (A2), Major (S1)
* Target: docs/ops/github-actions-iam.md lines 179, 263, 297
* Finding: "app deploy roles" is plural; "the safer of the two scripts" names no scripts; "Update if you add staging".
* Decision: PROPOSE FIX
* Reason: one app deploy role remains. The workflow runs two named scripts.
* Edit: "role" singular; named both scripts. The staging remark stays.

### L4-rules-ops-1-40 [A2] Severity: Nit
* Target: docs/ops/github-actions-iam.md lines 90, 100-101, 297-311
* Finding: `s3:PutObjectAcl` and `s3:GetBucketLocation` have no caller in repo scripts; the function test names one of two functions.
* Decision: DECLINE
* Reason: IAM needs are AWS-side and not checkable here.
* Edit: none

### docs/ops/pipeline-audit.md

### L4-rules-ops-1-41 [A2] Severity: Blocker
* Target: docs/ops/pipeline-audit.md lines 7, 9, 11, 20, 32, 38
* Finding: the document treats the builder and night shift as active. `scripts/builder-run.sh:18-19` prints a disabled notice; `build-next` and `triage-prs` refuse to run; `scripts/triage-run.sh` is discovery-only.
* Decision: PROPOSE FIX
* Reason: confirmed in the scripts. The audit policy itself is the owner's, so the fix is a factual status block, not a rewrite.
* Edit: added a status block dated 2026-11-11 under the intro. The policy rewrite is escalated (finding 1-42).

### L4-rules-ops-1-42 [A2, S1] Severity: Major
* Target: docs/ops/pipeline-audit.md lines 7-20, 36
* Finding: "fast-lane" merges have no implementation; "the builder", "night shift", "Gate 1", "each agent" are undefined; the autonomy trigger has no threshold; "plan-revision rate" has no source; "the manual spot-check record" has no location.
* Decision: ESCALATE
* Reason: process policy. The document may be obsolete in large part.
* Edit: none beyond the status block.

### L4-rules-ops-1-43 [A2, S1] Severity: Nit (A2), Major (S1)
* Target: docs/ops/pipeline-audit.md lines 28, 37
* Finding: "`coding-standards.md §4`" does not resolve. The ledger is Part 1, Phase 2, item 4.
* Decision: PROPOSE FIX
* Reason: confirmed in `coding-standards.md`.
* Edit: corrected both references.

### L4-rules-ops-1-44 [A2] Severity: Nit
* Target: docs/ops/pipeline-audit.md line 29
* Finding: "clear the ledger entry" against the standard's "delete the ledger".
* Decision: DECLINE
* Reason: small wording difference.
* Edit: none

### tests/e2e/README.md

### L4-rules-ops-1-45 [A3] Severity: Blocker
* Target: tests/e2e/README.md lines 96-98
* Finding: smart views have a UI: `SmartViewStrip` (`components/matrix-simplified/smart-view-strip.tsx:70`), mounted from `app-shell.tsx:175`, plus a command palette group.
* Decision: PROPOSE FIX
* Reason: confirmed. No e2e spec mentions smart views.
* Edit: rewrote the bullet.

### L4-rules-ops-1-46 [A3] Severity: Blocker
* Target: tests/e2e/README.md lines 99-100
* Finding: the edit drawer has a subtask editor (`SubtasksField`, `edit-drawer-fields.tsx:323`, used in `edit-drawer.tsx:403`).
* Decision: PROPOSE FIX
* Reason: confirmed. The comment in `tests/e2e/search.spec.ts:121-124` is stale too, outside this batch.
* Edit: rewrote the bullet.

### L4-rules-ops-1-47 [A3, S1] Severity: Blocker
* Target: tests/e2e/README.md lines 105-106
* Finding: `tasks/todo.md` has no "E2E test gaps" section.
* Decision: PROPOSE FIX
* Reason: confirmed by `rg`.
* Edit: replaced the sentence.

### L4-rules-ops-1-48 [A3] Severity: Blocker
* Target: tests/e2e/README.md lines 121-124
* Finding: CI runs `bun run build:e2e`, not `bun run build` (`ci.yml:165`), and runs `bun run test:pwa` before the e2e step.
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: corrected the command and named the PWA check.

### L4-rules-ops-1-49 [A3, S1] Severity: Major
* Target: tests/e2e/README.md lines 29-45
* Finding: the tree lists 10 of 46 specs and omits `global-setup.ts`.
* Decision: PROPOSE FIX
* Reason: confirmed by `ls`. A full list would drift.
* Edit: added `global-setup.ts`, a `*.spec.ts` line, and a sentence that the tree is partial.

### L4-rules-ops-1-50 [A3] Severity: Major
* Target: tests/e2e/README.md (omission)
* Finding: `global-setup.ts` warms every route on the dev server and throws on a failed one.
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: one sentence in Running.

### L4-rules-ops-1-51 [A3] Severity: Major
* Target: tests/e2e/README.md lines 76-88
* Finding: the fixture file also has the auto `runtimeErrors` fixture and options; `clearIndexedDB` does more than delete the database.
* Decision: PROPOSE FIX
* Reason: confirmed in `tests/e2e/fixtures/test-fixtures.ts`.
* Edit: corrected the `clearIndexedDB` sentence and added a short `runtimeErrors` paragraph.

### L4-rules-ops-1-52 [A3] Severity: Major
* Target: tests/e2e/README.md line 33
* Finding: the helpers file exports 12 functions and the README lists none.
* Decision: CONTEST
* Reason: "shared utility functions" is accurate for `tests/e2e/helpers/test-helpers.ts`. The brief rules out inventories that drift.
* Edit: none

### L4-rules-ops-1-53 [A3] Severity: Major
* Target: tests/e2e/README.md lines 54-56
* Finding: no `waitForTimeout` or `setTimeout` exists under `tests/e2e/`.
* Decision: PROPOSE FIX
* Reason: confirmed by `rg`.
* Edit: replaced the sentence.

### L4-rules-ops-1-54 [A3] Severity: Major
* Target: tests/e2e/README.md lines 15-16
* Finding: the web server command is `bun run dev:e2e` (`playwright.config.ts:33`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: named the command.

### L4-rules-ops-1-55 [A3] Severity: Nit
* Target: tests/e2e/README.md lines 78, 127-131
* Finding: `lib/db.ts:31` is now line 28; the trace records on the first retry; `workers: 2` means two tests; local workers use Playwright's default.
* Decision: PROPOSE FIX
* Reason: confirmed in `lib/db.ts` and `playwright.export.config.ts`.
* Edit: four small corrections.

### L4-rules-ops-1-56 [A3] Severity: Nit
* Target: tests/e2e/README.md lines 34, 40, 44, 63-71
* Finding: the page object, two spec descriptions, and the capture-parser table are narrower than the code.
* Decision: DECLINE
* Reason: the stated rules are correct.
* Edit: none

### L4-rules-ops-1-57 [S1] Severity: Major
* Target: tests/e2e/README.md lines 90-103, 133-135
* Finding: the "known gaps" lead says v9 removed surfaces, but two items exist; "to see them" does not say how.
* Decision: PROPOSE FIX
* Reason: `runtimeErrors` fails a test on `console.error`, which is how React's dev warnings show.
* Edit: adjusted the lead sentence and the last paragraph.

### tests/fixtures/README.md

### L4-rules-ops-1-58 [A3] Severity: Blocker
* Target: tests/fixtures/README.md lines 63-66
* Finding: `PBSyncConfig` has no `token` field (`lib/sync/types.ts:14-51`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: the example now overrides `email`.

### L4-rules-ops-1-59 [A3, S1] Severity: Blocker
* Target: tests/fixtures/README.md lines 214-242
* Finding: the example test calls `syncTask`, which does not exist, and reads `result.timestamp`, which `PBSyncResult` lacks.
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: rewrote the example to use only fixtures, and linked `example-usage.test.ts`.

### L4-rules-ops-1-60 [A3, S1] Severity: Major
* Target: tests/fixtures/README.md lines 162-174
* Finding: the `mockConsole` example asserts after `restore()`.
* Decision: PROPOSE FIX
* Reason: `restore` puts back the original `console.log` (`tests/fixtures/index.ts:377-382`).
* Edit: moved the assertion before the restore.

### L4-rules-ops-1-61 [A3] Severity: Major
* Target: tests/fixtures/README.md lines 196-201
* Finding: `expectToReject` swallows its own "expected to reject" error (`tests/fixtures/index.ts:424-436`). Without a message, a resolving promise passes.
* Decision: ESCALATE
* Reason: the document states the intent. The helper is the likely defect.
* Edit: none

### L4-rules-ops-1-62 [A3] Severity: Major
* Target: tests/fixtures/README.md (omission)
* Finding: `createMockSyncHistoryRecord` is exported but not shown.
* Decision: PROPOSE FIX
* Reason: confirmed (`index.ts:205`).
* Edit: added a three-line example.

### L4-rules-ops-1-63 [A3] Severity: Major
* Target: tests/fixtures/README.md (omission)
* Finding: the README omits `cross-platform/`, `pinned-copies/`, `inkwell-token-contract.json`, and `example-usage.test.ts`.
* Decision: PROPOSE FIX
* Reason: confirmed by `ls` and by the tests that read them.
* Edit: added a short "Data Fixtures" section that names the directories, not each file.

### L4-rules-ops-1-64 [A3] Severity: Nit
* Target: tests/fixtures/README.md lines 41, 84-98, 128, 154-157, 251
* Finding: five nits on unstated defaults and limits (`createMockDexieTable` `where()` returns all rows; `mockDateNow` leaves `new Date()` alone; override order in `createMockTasks`).
* Decision: DECLINE
* Reason: the examples are valid as written.
* Edit: none
