# Spec: Cycle C — Review + Gate 2 (packaging)

- **Date:** 2026-07-08
- **Status:** Accepted (design approved 2026-07-08; proceeding to plan + implementation per standing correction)
- **Deciders:** Vinny Carpenter
- **Related:** cycles A (`2026-07-07-the-contract-design.md`) + B (`2026-07-07-builder-gate1-design.md`), `.github/workflows/deploy-prod.yml`, `.github/workflows/deploy-dev.yml`, `.github/workflows/claude-code-review.yml`, blog "Two Gates and a Night Shift"

## Goal

Turn a reviewed, green PR into an evidence-backed production release: a deterministic `release-ready` signal, and a **Gate 2** approval enriched with the preview link, review context, and a real rollback command — reusing the machinery already in the repo.

This is **cycle C** of five. It is mostly packaging: Gate 2 (the `production` Environment reviewer gate), post-deploy verification (`smoke-test.sh`), the reviewer agent (`claude-code-review.yml`), and a preview surface (dev env via `deploy-dev.yml` on merge) all already exist.

## Scope & non-goals

**In scope:**
- `release-ready.yml` — a deterministic workflow that marks a PR `release-ready` when CI is green, the reviewer has run, and there are zero unresolved review threads; posts/refreshes a summary comment.
- A `release-ready` label.
- An **evidence** job prepended to `deploy-prod.yml` that surfaces the version, compare range, dev link, and the exact rollback command to the Gate 2 approver — **without changing any existing deploy step**.
- `scripts/prev-release-tag.cjs` (+ test) — semver-aware "previous release" computation for the rollback command.
- `docs/ops/gate2.md` — the Gate 2 runbook.

**Explicit non-goals (deferred / out):**
- **No automated back-to-builder loop.** Unresolved reviewer threads already block `release-ready` and merge, so work is held. The builder proactively fixing review comments on its own PRs is a separate cycle-B follow-up.
- **No ephemeral previews** — the dev environment is the preview (per the standing decision).
- **No reviewer self-labeling** — `release-ready` is set by a separate deterministic workflow, not the reviewer (separation of duties).
- **No change to Gate 2's mechanism** — it stays the `production` Environment required-reviewer gate; we only enrich the evidence the approver sees.
- **No collapse of the merge/deploy split** — merge→dev, tag→prod stays.

## Background — current state

- **Reviewer:** `claude-code-review.yml` runs the code-review plugin on PRs and posts advisory findings. It gates nothing today.
- **Merge → dev:** `deploy-dev.yml` auto-deploys `main` to the dev environment after CI. This is the "test the running software" surface.
- **Gate 2:** `deploy-prod.yml` is tag-triggered (`v*.*.*`), pauses at the `production` Environment reviewer gate before any step, verifies the ref is on `main` and the tag matches `package.json`, deploys to S3 + CloudFront, and runs `smoke-test.sh`.
- **Merge gate:** the `main-protection` ruleset requires passing CI (`lint`/`typecheck`/`test`/`build`) and `required_review_thread_resolution` — so unresolved reviewer threads already block merge.

The gap vs. the blog: no `release-ready` state, and Gate 2 is a bare "approve deployment" with no pre-staged rollback or evidence.

## Decision

- **`release-ready` is thread-based and computed by a workflow.** "Review clean" = the reviewer ran and left no unresolved threads (reusing `required_review_thread_resolution`); no formal APPROVE verdict is required from the plugin.
- **Gate 2 stays the `production` Environment gate**, enriched by an ungated evidence job.
- **Rollback = redeploy the previous release tag** through the same gated `deploy-prod` path (`gh workflow run deploy-prod.yml --ref vPrev`) — deterministic rebuild, no new infra, still gated.

## Design

### 1. `scripts/prev-release-tag.cjs` (+ `tests/prev-release-tag.test.ts`)

Pure function: `prevReleaseTag(currentVersion: string, tags: string[]): string | null` — given the version being deployed and the repo's `v*` tags, return the highest `v` tag strictly less than `currentVersion` by semver (ignoring malformed tags). `null` if there is no earlier release (first deploy). CommonJS `.cjs` (repo convention) so the workflow can `require` it and Vitest can test it. TDD, like `parse-risk-tier.cjs`.

### 2. Evidence job in `deploy-prod.yml`

Prepend an **ungated** `evidence` job; make the existing `deploy` job `needs: evidence`. The `evidence` job:
- Determines the version being deployed (tag on `push`, `package.json` on dispatch).
- Fetches tags, computes the previous release via `prev-release-tag.cjs`.
- Writes to `$GITHUB_STEP_SUMMARY`: **Deploying** `vCurrent`; **Compare** `vPrev…vCurrent` link; **Preview** the dev URL (already tested pre-release); **Rollback** the exact command `gh workflow run deploy-prod.yml --ref vPrev` (or "no prior release" on first deploy).
- Permissions: `contents: read` only. No secrets, no deploy powers — it only reads and summarizes.

The `deploy` job is unchanged except for the added `needs: evidence`; all its steps (OIDC, verify-on-main, tag/version check, build, S3+CloudFront, invalidation wait, smoke test) stay byte-for-byte. The Environment gate still pauses `deploy` before its steps; the approver reads the completed `evidence` summary, then approves.

### 3. `release-ready.yml`

- **Triggers:** `workflow_run` completed for `CI` and `Claude Code Review`; `pull_request` (`synchronize`, `ready_for_review`, `reopened`); `pull_request_review` (`submitted`, `dismissed`).
- **Logic (via `github-script`):** resolve the target PR(s) for the event. For each open PR:
  - required CI checks (`lint`/`typecheck`/`test`/`build`) all `success`?
  - the `Claude Code Review` check completed?
  - unresolved review threads == 0 (GraphQL)?
  - If all → add `release-ready`; post or update a single marked summary comment (reviewed + green; next steps: merge → test dev `<url>` → `/release`; rollback after deploy: redeploy previous tag). Else → remove `release-ready` if present.
- **Permissions:** `pull-requests: write`, `contents: read`, `checks: read`. Single-purpose.
- **Known limitation (documented):** GitHub emits no event when a review thread is *resolved*, so after resolving the final thread, `release-ready` re-evaluates on the next `push`/review/CI event. In practice threads are resolved by pushing a fix (a `synchronize`), which retriggers.

### 4. `release-ready` label

Add to `scripts/setup-labels.sh`: `create "release-ready" "1d76db" "Reviewed + CI green + no open threads — ready to merge, test, and release"`. Distinct blue so it reads as a milestone, not a `plan:*`/`risk:*` state. Documented in the taxonomy.

### 5. `docs/ops/gate2.md`

The runbook: the release path (release-ready → merge → dev test → `/release` → Gate 2 approve → prod → smoke test), what the evidence fields mean, and the rollback command with an example. Ends the blog's "no rollback path, no approval" as written policy.

## Verification approach

- **`prev-release-tag.cjs`:** Vitest unit tests — normal previous, first release (`null`), non-adjacent versions, malformed/non-`v` tags ignored, current-not-in-list, pre-release/patch ordering. This is the one logic unit; it gets real coverage.
- **`deploy-prod.yml`:** YAML parses; the `deploy` job's existing steps are unchanged (diff shows only the added `evidence` job + `needs:`); `evidence` job has no secret/deploy permissions.
- **`release-ready.yml`:** YAML parses; permissions minimal; `github-script` logic reviewed for the three conditions.
- **`setup-labels.sh`:** idempotent; `release-ready` created.
- **End-to-end (rollout):** on a real PR, confirm `release-ready` appears once green+reviewed; cut a release and confirm the evidence job shows the correct previous version + rollback command before the Environment gate.

## Rollback (of this change)

Additive except for the `evidence` job + `needs:` line in `deploy-prod.yml`. Rollback = revert the PR and `gh label delete release-ready`. Reverting restores `deploy-prod.yml` exactly (the `deploy` job was never modified). No prod-deploy behavior is altered by this cycle.
