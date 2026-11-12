# Doc refresh: D4-plans, round 2

Status: resolved
Clean round: yes

Two fresh reviewers checked only the 13 status notes. They ran as `Explore` agents with the `codebase_details.md` persona, because the notes cite PR numbers and dates and the `egm:egm-codebase-details` type cannot run `git log`. Neither found a Blocker or Major, so the loop stops here.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| Explore (accuracy persona) A | notes in codex-adversarial-review-fixes, github-ci-deploy-pipeline, close-analysis-open-items, server-side-encryption, edit-drawer-dependencies, stagehand-verification, editorial-restore-ship | ran |
| Explore (accuracy persona) B | notes in the-contract, builder-gate1, night-shift, review-gate2, telemetry, tokens-per-pr | ran |

## Findings

### D4-plans-2-1 [A] Severity: Nit
* Target: 2026-05-18-codex-adversarial-review-fixes.md line 3
* Finding: the note placed `fetchRemoteTaskEntry` in `lib/sync/pb-push.ts`. The function is defined at `lib/sync/pb-sync-helpers.ts:231`, and `pushSingleItem` in `pb-push.ts` calls it.
* Decision: PROPOSE FIX
* Reason: confirmed with `rg`.
* Edit: the note now says `pushSingleItem` in `lib/sync/pb-push.ts` calls `fetchRemoteTaskEntry`.

### D4-plans-2-2 [A] Severity: Nit
* Target: 2026-05-18-codex-adversarial-review-fixes.md line 3
* Finding: the note said ADRs 0019 and 0020 both added the pull contract version. Commit `310e3636` (#632, ADR 0019) added `PULL_CURSOR_VERSION`. ADR 0020 raised it to 4.
* Decision: PROPOSE FIX
* Reason: confirmed with `git log -S'PULL_CURSOR_VERSION'` and `lib/constants/sync.ts:64`.
* Edit: the note now says ADR 0019 added the version and ADR 0020 raised it to 4.

### D4-plans-2-3 [A] Severity: Nit
* Target: 2026-05-18-github-ci-deploy-pipeline.md line 3
* Finding: the note does not cover the optional Phase 6. PR #540 already removed the `deploy:dev` script, and `bun run deploy` remains.
* Decision: DECLINE
* Reason: the note already has four sentences and points to the two runbooks that hold the current state.
* Edit: none

### D4-plans-2-4 [B] Severity: Nit
* Target: 2026-07-08-tokens-per-pr.md line 3
* Finding: "remain with no caller" was loose, because the test is a caller.
* Decision: PROPOSE FIX
* Reason: `rg` shows `tests/extract-run-tokens.test.ts` as the only importer.
* Edit: the note now says the helper remains, with no caller outside its test.
