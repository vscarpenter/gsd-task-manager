# Plan: GitHub Actions CI/CD Deploy Pipeline

| Field | Value |
|---|---|
| Date | 2026-05-18 |
| Status | **Proposed — awaiting review** |
| Owner | vscarpenter |
| Branch | `claude/github-ci-deploy-plan-Sbd9P` |

---

## 1. Context: What "deploy" looks like today

There is **no `deploy.sh` at the repo root**. The current deployment surface is fragmented across four scripts and one `package.json` chain. Any CI design has to account for all of them:

| Surface | Where | Targets | Trigger today |
|---|---|---|---|
| **Prod app deploy** | `package.json` → `deploy` (chains `deploy:s3` + `deploy:cf`) | `s3://gsd.vinny.dev`, CF `E1T6GDX0TQEP94`, `https://gsd.vinny.dev` | Manual `bun run deploy` from a dev's laptop |
| **Dev app deploy** | `scripts/deploy-dev.sh` | `s3://gsd-dev.vinny.dev`, CF `E1HY1IKF5GT513`, `https://gsd-dev.vinny.dev` | Manual `bun run deploy:dev` |
| **CloudFront Function** (URL rewrite + agent-discovery response headers) | `scripts/deploy-cloudfront-function.sh` | Two CF Functions attached to the prod distribution | Manual, only when `cloudfront-function-*.cjs` changes |
| **Response Headers Policy** (CSP/HSTS/COOP/Permissions-Policy) | `scripts/deploy-cloudfront-response-headers-policy.sh` | `gsd-security-headers` policy referenced by the distribution | Manual, only when `cloudfront/response-headers-policy.json` changes |
| **Discovery file content-types** | `scripts/fix-discovery-content-types.sh` | Called by both app deploys; rewrites S3 metadata on `.well-known/*` and markdown renditions | (Sub-step of app deploys) |

**Shared shape of the two app deploys.** Both do the same five things in the same order:

1. Clean (`rimraf .next out`) and build (`next build` → static export in `out/`).
2. Sync non-HTML / non-`sw.js` assets with `Cache-Control: public,max-age=31536000,immutable`.
3. Sync HTML and `sw.js` with `max-age=0,must-revalidate`.
4. Force `no-cache,no-store,must-revalidate` on `index.html` (with explicit `Content-Type: text/html`).
5. Run `fix-discovery-content-types.sh` to fix `.well-known/*` and markdown renditions, then create a `/*` CloudFront invalidation.

**Important asymmetry.** The prod deploy is an inline bash one-liner inside `package.json` (`deploy:s3`). The dev deploy is a proper script (`scripts/deploy-dev.sh`). This is the first refactor any CI plan has to do, because CI needs to call the *same* logic for both environments.

**Existing CI today.** No build/test/deploy CI. Five workflows exist:

- `security-audit.yml` — `bun audit` on push/PR + nightly cron
- `sonarcloud.yml` — coverage upload on push/PR to main
- `claude-code-review.yml` / `claude.yml` — Claude automation
- `publish-mcp-server.yml` — npm publish triggered by `mcp-v*.*.*` tags (uses OIDC `id-token: write` — useful reference pattern)

**`.github/REPOSITORY_SETTINGS.md`** already declares the *intent* to require `typecheck`, `lint`, `test`, `build` as PR status checks, but no workflow currently produces them. That gap is in scope for this plan.

---

## 2. Goals & non-goals

### Goals
- Move prod and dev deploys off developer laptops into GitHub Actions.
- Wire the four PR status checks declared in `REPOSITORY_SETTINGS.md` (`typecheck`, `lint`, `test`, `build`).
- Use OIDC (no long-lived AWS keys in GitHub secrets) — same pattern as `publish-mcp-server.yml`.
- Build the static export **exactly once** per deploy and promote that artifact, so dev and prod can deploy bit-identical bytes.
- Add a smoke-test gate after deploy (curl the canonical URL, check `Content-Type` on a `.well-known/*` file) so a broken deploy fails loudly instead of silently.
- Keep the CloudFront Function + Response Headers Policy deploys *separate* from app deploys (path-filtered, manual approval) — these can take the site down if misconfigured.

### Non-goals (explicit)
- **No rollback automation.** Out of scope for v1. S3 versioning + manual revert is acceptable for now; if we want automated rollback, that's a follow-up plan.
- **No blue/green or canary deploys.** Static export to S3; not justified at this traffic level.
- **No multi-region.** Single CloudFront distribution per environment.
- **No replacing the existing manual `bun run deploy` escape hatch.** Devs keep the ability to deploy from a laptop if CI is down.
- **No Docker self-hosted deploy automation.** `docker/docker-compose.yml` is for user self-hosting, not our infra.
- **No changes to the MCP server publish workflow.** That's already CI'd and working.
- **No PocketBase deployment.** Backend lives on AWS EC2 and is managed separately.

---

## 3. Options considered

### Option A — Tag-based prod, push-to-main → dev (recommended)
- Push to `main` → run CI (typecheck/lint/test/build) → on green, auto-deploy to dev.
- Git tag matching `v*.*.*` → require approval → deploy to prod.
- Mirrors `publish-mcp-server.yml`'s `mcp-v*.*.*` pattern; tag = explicit release intent.

**Pros:** Every merge gets a real dev URL test surface for free. Prod requires deliberate action (tag + approval). One reviewer-controlled gate.
**Cons:** Devs have to remember to tag. Hotfix flow is "tag, push tag, approve" — three steps.

### Option B — Branch-based (`main` → dev, `release` → prod)
- Push to `main` → dev. Merge `main` → `release` → prod.

**Pros:** No tags to remember. Visible branch state.
**Cons:** Extra branch to maintain. `release` becomes a long-lived branch with merge conflicts. Doesn't mesh with the existing tag-based MCP release flow.

### Option C — Fully manual `workflow_dispatch`
- Both dev and prod deploys triggered by manual button-press with environment input.

**Pros:** Zero surprise deploys. Maximum control.
**Cons:** Loses most of the value of CI deploy — devs still have to "do the deploy", just via a different button. PRs don't get auto-dev URLs.

**Recommendation: Option A.** Matches existing conventions, gives the most leverage, keeps prod safe behind tags + GitHub Environment approval.

---

## 4. Proposed file & infra layout

### 4.1 Refactor existing scripts (prerequisite — small PR)

Hoist the inline `deploy:s3` one-liner out of `package.json` into a proper script, so dev and prod call identical code paths:

- **New:** `scripts/deploy-app.sh` — parameterized version of `deploy-dev.sh` that takes env vars (`S3_BUCKET`, `CLOUDFRONT_ID`, `ENV_LABEL`, `SITE_URL`). Replaces the body of both `deploy-dev.sh` and the inline `deploy:s3`.
- **Update:** `scripts/deploy-dev.sh` → thin wrapper that exports dev env vars and calls `scripts/deploy-app.sh`.
- **Update:** `package.json` — `deploy:dev` and `deploy` both call the new script with their respective env vars. The 600-character `deploy:s3` one-liner goes away.

This is a no-behavior-change refactor. It exists purely to give CI a single entry point and to make the bash testable.

### 4.2 New `.github/workflows/` files

| File | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR to `main`, push to `main` | Required status checks: `typecheck`, `lint`, `test`, `build`. Uploads the built `out/` as an artifact for downstream deploy jobs to consume. |
| `deploy-dev.yml` | Push to `main` (after `ci.yml` succeeds via `workflow_run`), or manual `workflow_dispatch` | Downloads the `out/` artifact, syncs to dev S3, invalidates dev CF, runs smoke test. |
| `deploy-prod.yml` | Tag push `v*.*.*` or manual `workflow_dispatch` with version input | Same as dev but for prod, gated by `environment: production` (GitHub-side approval). |
| `deploy-cloudfront-infra.yml` | Push to `main` with path filter on `cloudfront-function-*.cjs`, `cloudfront/response-headers-policy.json`, or the relevant scripts. Always manual approval. | Runs `deploy-cloudfront-function.sh` and/or `deploy-cloudfront-response-headers-policy.sh` depending on which paths changed. |

**Shared logic** lives in `.github/actions/build-static-export/action.yml` (composite action): checkout → setup Bun → `bun install --frozen-lockfile` → cache `.next/cache` → `bun run build` → upload `out/` artifact. Both `ci.yml` and the deploy workflows reuse it.

### 4.3 GitHub Environments

| Environment | Purpose | Protections |
|---|---|---|
| `development` | Holds `AWS_DEPLOY_ROLE_ARN`, `S3_BUCKET=gsd-dev.vinny.dev`, `CLOUDFRONT_ID=E1HY1IKF5GT513`, `SITE_URL=https://gsd-dev.vinny.dev` | None (auto-deploy on main) |
| `production` | Holds prod equivalents (`E1T6GDX0TQEP94`, `gsd.vinny.dev`) | **Required reviewer = vscarpenter.** Wait timer optional. |
| `cloudfront-infra` | Same prod role | **Required reviewer.** Separate from `production` so an app deploy doesn't accidentally re-publish a CF Function. |

Putting the bucket/distribution IDs in environment-scoped variables (not workflow YAML) is what lets one workflow file serve both envs without `if: github.ref == ...` branching.

### 4.4 AWS IAM (you have to create these — not in repo)

Two IAM roles (one per environment), each with:

- **Trust policy:** GitHub OIDC provider, conditioned on `repo:vscarpenter/gsd-task-manager:environment:development` (or `:production`, `:cloudfront-infra`).
- **Permissions for app deploy roles:**
  - `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`, `s3:GetObject` on the specific bucket ARN
  - `cloudfront:CreateInvalidation` on the specific distribution ARN
- **Additional permissions for `cloudfront-infra` role:**
  - `cloudfront:CreateFunction`, `UpdateFunction`, `DescribeFunction`, `PublishFunction`, `ListFunctions`
  - `cloudfront:GetDistributionConfig`, `UpdateDistribution`
  - `cloudfront:CreateResponseHeadersPolicy`, `UpdateResponseHeadersPolicy`, `GetResponseHeadersPolicy`, `ListResponseHeadersPolicies`

I'll document these as a `docs/ops/github-actions-iam.md` runbook when we implement.

---

## 5. Smoke test (the gate that catches "deploy succeeded but site is broken")

After the S3 sync + CF invalidation, before declaring the job green, the deploy workflow runs a small bash check:

1. `curl -fsS -o /dev/null ${SITE_URL}/` (200)
2. `curl -fsS ${SITE_URL}/sw.js | head -c 100 | grep -q "GSD"` (service worker served, not the SPA fallback)
3. `curl -fsSI ${SITE_URL}/.well-known/api-catalog | grep -i "^content-type: application/linkset+json"` (proves `fix-discovery-content-types.sh` ran)
4. `curl -fsSI ${SITE_URL}/ | grep -i "^cache-control:.*no-cache"` (proves the index.html no-cache step worked)

These are the four things that have historically silently broken. Cheap to check, expensive to miss.

---

## 6. Implementation phases

Each phase is one PR, small enough to review.

### Phase 1 — Script refactor (no CI yet)
- Extract `scripts/deploy-app.sh` parameterized by env vars.
- Update `scripts/deploy-dev.sh` to be a thin wrapper.
- Update `package.json` — remove `deploy:s3` one-liner, route `deploy` through the new script.
- Run `bun run deploy:dev` manually once to verify byte-identical behavior.
- **Acceptance:** `bun run deploy:dev` produces the same S3 state as before. Diff `aws s3 ls --recursive` output before/after.

### Phase 2 — `ci.yml` (PR gates only, no deploy)
- Add `.github/actions/build-static-export/action.yml` composite action.
- Add `ci.yml` running typecheck, lint, test, build as parallel jobs.
- Update `.github/REPOSITORY_SETTINGS.md` with exact required-check job names.
- Manually enable required checks in repo settings.
- **Acceptance:** A new PR shows four green checks. A PR that breaks `bun typecheck` is blocked.

### Phase 3 — `deploy-dev.yml`
- Create `development` GitHub Environment with vars + OIDC role ARN.
- Add workflow triggered by `workflow_run` after `ci.yml` succeeds on `main`, plus `workflow_dispatch`.
- Implement smoke test (Section 5).
- **Acceptance:** Merge a no-op PR to main → dev URL serves the new build within ~5 minutes. Smoke test passes.

### Phase 4 — `deploy-prod.yml`
- Create `production` GitHub Environment with required reviewer.
- Add workflow triggered by `v*.*.*` tag push + manual dispatch.
- Same smoke test, pointed at prod URL.
- **Acceptance:** Tag a release → reviewer gets prompted → on approval, prod deploys + smoke-tests green.

### Phase 5 — `deploy-cloudfront-infra.yml`
- Create `cloudfront-infra` environment with required reviewer.
- Path-filtered workflow that conditionally runs each of the two infra scripts based on which file changed.
- **Acceptance:** Edit `cloudfront/response-headers-policy.json` on a branch → merge to main → CI shows the infra workflow waiting for approval → on approval, policy updates.

### Phase 6 — Remove the manual deploy fallback? (optional, post-bake)
- After 2-4 weeks of green CI deploys, decide whether to remove `bun run deploy` / `bun run deploy:dev` from `package.json` or keep them as escape hatches. Recommend **keep**, but document in README that CI is the supported path.

---

## 7. Open decisions (need your input before Phase 1)

1. **Did you mean a specific deploy script?** This plan covers all four deploy surfaces. If you wanted just one (e.g. only `deploy-dev.sh`), I can narrow Phases 3-5.
2. **Trigger model.** Option A (tag-based prod, auto-dev) recommended. Confirm, or switch to B/C.
3. **Prod approval reviewer.** GitHub Environment "required reviewers" needs at least one GitHub user/team. Assume `vscarpenter` solo?
4. **Tag naming for app releases.** `v*.*.*` (matches package.json `version: 9.1.10`) — but the MCP server uses `mcp-v*.*.*`. Confirm `v*.*.*` won't collide with anything else.
5. **CloudFront infra workflow — split or combined?** One workflow that runs both infra scripts on a path-matched change, or two separate workflows? Plan above assumes one; happy to split.
6. **Smoke test failure handling.** If smoke test fails after a successful deploy, do we (a) just fail the job and alert (current plan), or (b) attempt to roll back by re-syncing the previous artifact? (b) is more work — recommend (a) for v1.
7. **Concurrency.** Plan adds `concurrency: group: deploy-${{ env }}, cancel-in-progress: false` so back-to-back merges queue rather than race. Confirm `cancel-in-progress: false` (safer) vs `true` (faster).

---

## 8. What I will NOT do without explicit go-ahead

- Create the IAM roles in AWS (you own that account; I'd give you the trust + permission JSON to paste).
- Enable required status checks in GitHub repo settings (one-click step you should do manually after Phase 2).
- Delete `bun run deploy` from `package.json` (Phase 6 is opt-in).
- Touch the MCP server publish workflow.
- Modify the docker-compose self-host deploy.

---

## 9. Estimated effort

| Phase | LOC | Review time |
|---|---|---|
| 1. Script refactor | ~80 lines bash + package.json edit | 15 min |
| 2. `ci.yml` + composite action | ~120 lines YAML | 20 min |
| 3. `deploy-dev.yml` | ~80 lines YAML | 15 min |
| 4. `deploy-prod.yml` | ~80 lines YAML (mostly copy of dev) | 10 min |
| 5. `deploy-cloudfront-infra.yml` | ~100 lines YAML | 20 min |
| **Total** | ~460 lines | ~80 min review across 5 PRs |

Each PR is under the 400-LOC ceiling from `coding-standards.md` Part 5.
