# Doc refresh: D4-plans, round 1

Status: resolved
Clean round: no

All 13 files are mode NOTE. Reviewers answered three questions per plan: did it ship, was it later removed or replaced, and would a reader be misled today. The reviewers cannot run git, so the resolver took every PR number, date, and commit from `git log` and `git show`.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A | codex-adversarial-review-fixes, github-ci-deploy-pipeline, close-analysis-open-items | ran |
| egm-codebase-details B | server-side-encryption, edit-drawer-dependencies, stagehand-verification, editorial-restore-ship | ran |
| egm-codebase-details C | the-contract, builder-gate1, night-shift | ran |
| egm-codebase-details D | review-gate2, telemetry, tokens-per-pr | ran |

## Findings

### D4-plans-1-1 [A] Severity: Major
* Target: 2026-05-18-codex-adversarial-review-fixes.md, whole plan
* Finding: all five PRs shipped (`recordSyncPartial` in `lib/sync-history.ts`, delete queueing in `lib/tasks/import-export.ts`, cursor overlap in `lib/sync/pb-pull.ts`, stale-push skip in `lib/sync/pb-push.ts`, `ConflictError` and `fetchSinglePBTaskFresh` in the MCP server). The plan reads as open work. The push guard now does the per-item lookup the plan ruled out (`fetchRemoteTaskEntry`, `lib/sync/pb-push.ts:267`).
* Decision: PROPOSE FIX
* Reason: confirmed in the code. `git log` gives merges #282, #283, #284, #285 and squash #286, all dated 2026-05-18. `PULL_CURSOR_VERSION` in `lib/constants/sync.ts:64` confirms ADRs 0019 and 0020 built on the cursor.
* Edit: status note added under the title.

### D4-plans-1-2 [A] Severity: Blocker
* Target: 2026-05-18-github-ci-deploy-pipeline.md lines 6, 14-41, 109-110, 173-183
* Finding: the plan says "Proposed, awaiting review" and describes no CI and a dev deploy. `ci.yml`, `deploy-cloudfront-infra.yml`, `scripts/deploy-app.sh`, and `scripts/smoke-test.sh` exist. `deploy-dev.yml`, `scripts/deploy-dev.sh`, and `deploy-prod.yml` are absent. `deploy-production-release.yml` replaced the prod workflow.
* Decision: PROPOSE FIX
* Reason: `git log --diff-filter=AD` shows #289 to #293 added the pieces on 2026-05-19, #540 deleted the dev deploy, and #527 deleted `deploy-prod.yml` and added `deploy-production-release.yml`.
* Edit: status note added under the title. The plan's own status field is left as written.

### D4-plans-1-3 [A] Severity: Blocker
* Target: 2026-05-25-close-analysis-open-items.md, PR 3 (lines 32-42, 615-987)
* Finding: the plan tells the reader to add `@sentry/browser` and `lib/sentry.ts`. ADR 0017 removed Sentry. PR 1 and PR 2 are live (`lib/tasks/crud/update.ts:63`, `lib/notifications/settings.ts:36,72`, `components/global-error-listener.tsx`).
* Decision: PROPOSE FIX
* Reason: `git log` shows #302, #303, #304 on 2026-05-25 and `d969e745` (#566) deleting `lib/sentry.ts`. ADR 0017 lines 45-46 put replacement telemetry out of scope.
* Edit: status note added under the title.

### D4-plans-1-4 [B] Severity: Major
* Target: 2026-06-20-server-side-encryption.md lines 9, 15, Task 6
* Finding: all planned files exist at the planned paths. The image pins PocketBase 0.40.4 (`docker/Dockerfile:47`), not 0.26.6. ADR 0016 keeps the hosted service without the hooks, so the gated at-rest copy in Task 6 stays unapplied.
* Decision: PROPOSE FIX
* Reason: confirmed in `docker/Dockerfile`, `docker/pb_hooks/`, and ADR 0016. The work landed as direct commits on 2026-06-20 with release commit `b9b94c48` (v9.12.0). No PR number exists for it.
* Edit: status note added under the title.

### D4-plans-1-5 [B] Severity: Nit
* Target: 2026-07-05-edit-drawer-dependencies.md
* Finding: shipped at the planned paths. The cycle guard call moved to `use-drawer-save.ts`, and line anchors are stale.
* Decision: PROPOSE FIX
* Reason: the task brief asks for a note on every plan that shipped. `b759a84d` is #416. `7b2a3ea0` is #483.
* Edit: status note added under the title.

### D4-plans-1-6 [B] Severity: Major
* Target: 2026-08-11-stagehand-verification.md Tasks 1 and 2
* Finding: shipped as planned. The Task 2 source folder `.claude/skills/verify-frontend-change/scripts/` is gone because the move is done. `package.json:68` pins Stagehand to 4.4.0 exactly.
* Decision: PROPOSE FIX
* Reason: `324eaeb5` (#471) shows the two renames into `tools/stagehand/page-scripts/`.
* Edit: status note added under the title.

### D4-plans-1-7 [B] Severity: Major
* Target: 2026-08-15-editorial-restore-ship.md Tasks 1, 2, 8, 9 and Global Constraints
* Finding: shipped in #502. `tests/e2e/zz-probe.spec.ts`, `tests/data/violet-frost-theme.test.ts`, `app/design-lab/`, and `components/design-lab/` no longer exist. Newsreader loads through `next/font/local`.
* Decision: PROPOSE FIX
* Reason: `9768f7ef` (#502) holds the rename to `tests/data/editorial-theme.test.ts`. `37cb2842` (2026-08-23) removed the design lab. `app/layout.tsx:3` imports `next/font/local`.
* Edit: status note added under the title.

### D4-plans-1-8 [C] Severity: Major
* Target: 2026-07-07-the-contract.md lines 13, 26, 450
* Finding: every artifact exists and works as planned. The parser test is at `tests/parse-risk-tier.test.ts`, not `scripts/`. Nothing reads the `risk:*` labels now that the builder is retired.
* Decision: PROPOSE FIX
* Reason: confirmed in `.github/workflows/apply-risk-label.yml:31` and `tests/parse-risk-tier.test.ts`. `a2918d5b` is #421.
* Edit: status note added under the title.

### D4-plans-1-9 [C] Severity: Blocker
* Target: 2026-07-07-builder-gate1.md, goal and Tasks 2 to 5, rollout
* Finding: the plan builds a launchd job that runs `claude -p "/build-next"`. `scripts/builder-run.sh` is now a disabled notice, `.claude/commands/build-next.md` refuses, and `docs/agents/builder.md` lists the controls needed before any return.
* Decision: PROPOSE FIX
* Reason: `git show dbc968b5` (#527, 2026-09-04) removes the `claude -p "/build-next"` call and adds the DISABLED line. `54f1aceb` is #424.
* Edit: status note added under the title.

### D4-plans-1-10 [C] Severity: Blocker
* Target: 2026-07-08-night-shift.md, goal, constraint line 13, Task 2, rollout
* Finding: the plan has the wrapper run `claude -p "/triage-prs"` in a worktree and trusts the `claude/` prefix. `scripts/triage-run.sh` now exits unless `GSD_TRIAGE_BOT_LOGIN` is set, and then only prints a count. `.claude/commands/triage-prs.md` refuses.
* Decision: PROPOSE FIX
* Reason: `git show dbc968b5` removes the worktree and the `claude -p` call from `triage-run.sh`. `22507e2e` (#448) changed `failing-agent-prs.cjs` for provenance. `07cd5378` is #427.
* Edit: status note added under the title.

### D4-plans-1-11 [D] Severity: Blocker
* Target: 2026-07-08-review-gate2.md Tasks 2 to 5, rollout
* Finding: `deploy-prod.yml` and `release-ready.yml` are absent, and `scripts/setup-labels.sh` no longer creates `release-ready`. `deploy-production-release.yml` has an evidence job that finds the prior tag with inline `git tag` (lines 86-90). Only `tests/prev-release-tag.test.ts` uses `scripts/prev-release-tag.cjs`.
* Decision: PROPOSE FIX
* Reason: `da36233d` (#426) added the pieces. `e4d441d7` (#449, 2026-07-23) deleted `release-ready.yml` and the label line. `dbc968b5` (#527) swapped the prod workflow.
* Edit: status note added under the title.

### D4-plans-1-12 [D] Severity: Blocker
* Target: 2026-07-08-telemetry.md Task 2, rollout
* Finding: `.github/workflows/telemetry.yml` is absent. `docs/ops/pipeline-audit.md:17-18` says manual samples replaced it. `scripts/telemetry-metrics.cjs` has no caller outside its test.
* Decision: PROPOSE FIX
* Reason: `54984b68` (#429) added the workflow and helper. `e4d441d7` (#449) deleted the workflow.
* Edit: status note added under the title.

### D4-plans-1-13 [D] Severity: Blocker
* Target: 2026-07-08-tokens-per-pr.md Tasks 2 and 3
* Finding: the builder no longer writes the `gsd-tokens` marker and no workflow reads it. `scripts/extract-run-tokens.cjs` has no caller outside its test.
* Decision: PROPOSE FIX
* Reason: `git show 54984b68 -- scripts/builder-run.sh` adds the marker comment and the helper call, so the work shipped in #429. #527 removed the builder body and #449 removed `telemetry.yml`.
* Edit: status note added under the title.

### D4-plans-1-14 [A] Severity: Nit
* Target: code, not a plan: `lib/sync/types.ts:90`
* Finding: the comment says `fetchRemoteTaskIndex` serves the push LWW guard. Push now calls `fetchRemoteTaskEntry`.
* Decision: DECLINE
* Reason: outside this batch. Reported to the caller.
* Edit: none

### D4-plans-1-15 [B, C, D] Severity: Nit
* Target: files outside this batch
* Finding: `scripts/verify-pb-encryption.sh:16` names PocketBase 0.39.10. `.agents/skills/source-command-build-next/SKILL.md` and `.agents/skills/source-command-triage-prs/SKILL.md` still describe the live builder and night shift. `docs/pipeline-summary.html` lines 136-137 call both agents live.
* Decision: DECLINE
* Reason: outside this batch. Reported to the caller.
* Edit: none
