# Cycle C — Review + Gate 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic `release-ready` signal, and a Gate 2 approval enriched with version + preview link + a real rollback command — reusing the existing `production` Environment gate and smoke test.

**Architecture:** `release-ready.yml` computes the state from CI + reviewer + threads and labels the PR. An ungated `evidence` job prepended to `deploy-prod.yml` surfaces the rollback command (computed by a tested semver helper) to the approver. No existing deploy step changes.

**Tech Stack:** GitHub Actions (`actions/github-script@v7`, `workflow_run`), `gh` CLI, Node CommonJS (`.cjs`), Vitest, the existing `production` Environment + `smoke-test.sh`.

## Global Constraints

- Additive; the `deploy` job in `deploy-prod.yml` keeps every existing step byte-for-byte (only a `needs: evidence` line is added).
- Required CI check names (verbatim): `lint`, `typecheck`, `test`, `build`. Reviewer check: `claude-review`.
- `release-ready` is set ONLY by `release-ready.yml`, never by the reviewer.
- Rollback = redeploy the previous tag: `gh workflow run deploy-prod.yml --ref v<prev>`.
- Node helpers `.cjs`; tests `.test.ts` under `tests/`. Commits: Conventional + `Vinny Carpenter <vscarpenter@gmail.com>` + `Claude-Session` trailer, no Co-Authored-By.

---

### Task 1: `prev-release-tag` semver helper (TDD)

**Files:**
- Create: `scripts/prev-release-tag.cjs`
- Test: `tests/prev-release-tag.test.ts`

**Interfaces:**
- Produces `prevReleaseTag(currentVersion: string, tags: string[]): string | null` — the highest `v*.*.*` tag strictly less than `currentVersion` by numeric semver, returned as-given (e.g. `"v9.3.2"`); `null` if none. Malformed / non-`X.Y.Z` tags ignored. Consumed by Task 2.

- [ ] **Step 1: Write the failing test** — `tests/prev-release-tag.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { prevReleaseTag } from "../scripts/prev-release-tag.cjs";

const TAGS = ["v9.4.0", "v9.3.2", "v9.3.1", "v9.2.0"];

describe("prevReleaseTag", () => {
  it("returns the immediately previous release", () => {
    expect(prevReleaseTag("9.4.0", TAGS)).toBe("v9.3.2");
  });
  it("accepts a v-prefixed current version", () => {
    expect(prevReleaseTag("v9.4.0", TAGS)).toBe("v9.3.2");
  });
  it("returns null when there is no earlier release", () => {
    expect(prevReleaseTag("9.4.0", ["v9.4.0"])).toBeNull();
    expect(prevReleaseTag("9.4.0", [])).toBeNull();
  });
  it("ignores malformed and pre-release tags", () => {
    expect(prevReleaseTag("9.4.0", ["garbage", "v9.4.0-rc1", "v9.3.2"])).toBe("v9.3.2");
  });
  it("compares numerically, not lexically", () => {
    expect(prevReleaseTag("9.4.5", ["v9.4.4", "v9.4.10", "v9.4.5"])).toBe("v9.4.4");
  });
  it("skips tags >= current and finds the highest below", () => {
    expect(prevReleaseTag("9.4.0", ["v10.0.0", "v9.5.0", "v9.1.0", "v8.9.9"])).toBe("v9.1.0");
  });
  it("returns null for invalid current version or non-array tags", () => {
    expect(prevReleaseTag("not-a-version", TAGS)).toBeNull();
    expect(prevReleaseTag("9.4.0", null as unknown as string[])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `bun run test -- tests/prev-release-tag.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write implementation** — `scripts/prev-release-tag.cjs`

```js
"use strict";

// Match a plain vMAJOR.MINOR.PATCH release tag (no pre-release/build metadata).
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

function parse(v) {
  const m = SEMVER.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * The highest v*.*.* tag strictly less than currentVersion (numeric semver),
 * returned exactly as it appears in `tags` (e.g. "v9.3.2"), or null if none.
 * Malformed and pre-release tags are ignored.
 *
 * @param {string} currentVersion  e.g. "9.4.0" or "v9.4.0"
 * @param {string[]} tags
 * @returns {string|null}
 */
function prevReleaseTag(currentVersion, tags) {
  const cur = parse(currentVersion);
  if (!cur || !Array.isArray(tags)) return null;
  let best = null;
  let bestParsed = null;
  for (const tag of tags) {
    const p = parse(tag);
    if (!p || cmp(p, cur) >= 0) continue;
    if (!bestParsed || cmp(p, bestParsed) > 0) {
      best = String(tag).trim();
      bestParsed = p;
    }
  }
  return best;
}

module.exports = { prevReleaseTag };
```

- [ ] **Step 4: Run test to verify it passes** — `bun run test -- tests/prev-release-tag.test.ts` → PASS.

- [ ] **Step 5: Commit** `feat(pipeline): semver prev-release-tag helper for rollback command`

---

### Task 2: Evidence job in `deploy-prod.yml`

**Files:** Modify `.github/workflows/deploy-prod.yml`

**Interfaces:** Consumes `prevReleaseTag` (Task 1). Adds an ungated `evidence` job; adds `needs: evidence` to the existing `deploy` job — nothing else in `deploy` changes.

- [ ] **Step 1: Add the `evidence` job** at the top of `jobs:` (before `deploy:`):

```yaml
  evidence:
    name: Gate 2 evidence
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Compute release evidence
        env:
          TAG_REF: ${{ github.ref_name }}
          EVENT: ${{ github.event_name }}
          DEV_URL: ${{ vars.DEV_SITE_URL }}
        run: |
          if [ "$EVENT" = "push" ]; then VERSION="${TAG_REF#v}"; else VERSION="$(node -p "require('./package.json').version")"; fi
          git fetch --tags --quiet || true
          TAGS="$(git tag -l 'v*.*.*' | tr '\n' ' ')"
          PREV="$(node -e 'const {prevReleaseTag}=require("./scripts/prev-release-tag.cjs"); const p=prevReleaseTag(process.argv[1], process.argv[2].split(/\s+/).filter(Boolean)); process.stdout.write(p||"")' "$VERSION" "$TAGS")"
          {
            echo "## Gate 2 — release evidence"
            echo ""
            echo "**Deploying:** \`v$VERSION\`"
            if [ -n "$PREV" ]; then
              echo "**Previous prod:** \`$PREV\`"
              echo ""
              echo "**Rollback** (if this deploy misbehaves) — redeploys the previous release through this same gated path:"
              echo '```'
              echo "gh workflow run deploy-prod.yml --ref $PREV"
              echo '```'
            else
              echo "**Previous prod:** none found (first release) — roll back by redeploying an earlier good commit."
            fi
            echo ""
            echo "**Preview:** ${DEV_URL:-the dev environment} (test before approving; it already has this build after merge)."
            echo "**Post-deploy:** \`smoke-test.sh\` runs automatically after the invalidation completes."
          } >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 2: Add `needs: evidence` to the `deploy` job** — insert directly under `deploy:`'s `name:` (or `runs-on:`), leaving all existing steps unchanged:

```yaml
  deploy:
    name: Deploy to production
    needs: evidence
    runs-on: ubuntu-latest
```

- [ ] **Step 3: Validate + confirm the deploy job is otherwise unchanged**

Run: `python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/deploy-prod.yml'));print('jobs:',list(d['jobs'].keys()));print('deploy.needs:',d['jobs']['deploy'].get('needs'));print('deploy.steps:',len(d['jobs']['deploy']['steps']))"`
Expected: `jobs: ['evidence','deploy']`; `deploy.needs: evidence`; `deploy.steps: 7` (unchanged).
Also: `git diff origin/main -- .github/workflows/deploy-prod.yml` shows ONLY the added job + the `needs:` line.

- [ ] **Step 4: Commit** `feat(pipeline): Gate 2 evidence job (version + rollback command) in deploy-prod`

---

### Task 3: `release-ready.yml`

**Files:** Create `.github/workflows/release-ready.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Release ready

# Marks a PR `release-ready` once CI is green, the reviewer has run, and there
# are no unresolved review threads. Deterministic; the reviewer stays advisory.
on:
  workflow_run:
    workflows: [CI, "Claude Code Review"]
    types: [completed]
  pull_request:
    types: [synchronize, ready_for_review, reopened]
  pull_request_review:
    types: [submitted, dismissed]

permissions:
  contents: read
  checks: read
  pull-requests: write

concurrency:
  group: release-ready-${{ github.event.pull_request.number || github.event.workflow_run.head_sha || github.run_id }}
  cancel-in-progress: true

jobs:
  evaluate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const REQUIRED = ["lint", "typecheck", "test", "build"];
            const MARKER = "<!-- release-ready-bot -->";

            async function prNumbers() {
              const e = context.eventName;
              if (e === "pull_request" || e === "pull_request_review") return [context.payload.pull_request.number];
              if (e === "workflow_run") {
                const wr = context.payload.workflow_run;
                if (wr.pull_requests?.length) return wr.pull_requests.map((p) => p.number);
                const { data: prs } = await github.rest.pulls.list({ ...context.repo, state: "open" });
                return prs.filter((p) => p.head.sha === wr.head_sha).map((p) => p.number);
              }
              return [];
            }

            for (const number of await prNumbers()) {
              const { data: pr } = await github.rest.pulls.get({ ...context.repo, pull_number: number });
              if (pr.state !== "open" || pr.draft) continue;

              const { data: checks } = await github.rest.checks.listForRef({ ...context.repo, ref: pr.head.sha, per_page: 100 });
              const byName = {};
              for (const c of checks.check_runs) byName[c.name] = c;
              const ciGreen = REQUIRED.every((n) => byName[n]?.conclusion === "success");
              const reviewerRan = Object.entries(byName).some(([n, c]) => /claude.?review/i.test(n) && c.status === "completed");

              const g = await github.graphql(
                `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:100){nodes{isResolved}}}}}`,
                { owner: context.repo.owner, repo: context.repo.repo, num: number }
              );
              const openThreads = g.repository.pullRequest.reviewThreads.nodes.filter((t) => !t.isResolved).length;

              const ready = ciGreen && reviewerRan && openThreads === 0;
              const hasLabel = pr.labels.some((l) => l.name === "release-ready");
              core.info(`PR #${number}: ciGreen=${ciGreen} reviewerRan=${reviewerRan} openThreads=${openThreads} -> ready=${ready}`);

              if (ready && !hasLabel) {
                await github.rest.issues.addLabels({ ...context.repo, issue_number: number, labels: ["release-ready"] });
              } else if (!ready && hasLabel) {
                await github.rest.issues.removeLabel({ ...context.repo, issue_number: number, name: "release-ready" }).catch(() => {});
              }

              if (ready) {
                const body = `${MARKER}\n✅ **Release-ready** — CI green, reviewer clean, no open threads.\n\nNext: **merge** → the dev environment auto-deploys this build → **test the dev URL** → \`/release\` to cut the tag → approve Gate 2 (production).\n\nRollback after deploy: redeploy the previous release tag (the deploy-prod evidence job prints the exact command).`;
                const { data: comments } = await github.rest.issues.listComments({ ...context.repo, issue_number: number, per_page: 100 });
                const existing = comments.find((c) => c.body?.includes(MARKER));
                if (existing) await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
                else await github.rest.issues.createComment({ ...context.repo, issue_number: number, body });
              }
            }
```

- [ ] **Step 2: Validate workflow YAML** — `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/release-ready.yml'));print('OK')"` → `OK`.

- [ ] **Step 3: Commit** `feat(pipeline): release-ready workflow (CI + review + threads -> label + summary)`

---

### Task 4: `release-ready` label

**Files:** Modify `scripts/setup-labels.sh`

- [ ] **Step 1: Add the label** in a new "Cycle C" block:

```bash
# Cycle C — review + Gate 2.
create "release-ready"   "1d76db" "Reviewed + CI green + no open threads — ready to merge, test, and release"
```

- [ ] **Step 2: Verify** — `bash -n scripts/setup-labels.sh && grep -c '^create ' scripts/setup-labels.sh` → `10` create lines (4 risk + 5 builder + 1 release-ready).

- [ ] **Step 3: Commit** `feat(pipeline): add release-ready label`

---

### Task 5: `docs/ops/gate2.md` runbook

**Files:** Create `docs/ops/gate2.md`

- [ ] **Step 1: Write the runbook** covering: the release path (release-ready → merge → dev test → `/release` → Gate 2 approve → prod → smoke test); the meaning of each evidence field; the rollback command with a worked example (`gh workflow run deploy-prod.yml --ref v9.3.2`) and that rollback is itself gated; and the policy line "no rollback path, no approval."

- [ ] **Step 2: Cross-reference check** — `grep -q "deploy-prod.yml --ref" docs/ops/gate2.md && grep -q "release-ready" docs/ops/gate2.md && echo OK`.

- [ ] **Step 3: Commit** `docs(pipeline): Gate 2 runbook (release path + rollback)`

---

## Full-suite verification (after all tasks)

- [ ] `bun run test -- tests/prev-release-tag.test.ts` — helper green.
- [ ] `bun run lint` — no new errors.
- [ ] All new/modified YAML parses (`deploy-prod.yml`, `release-ready.yml`).
- [ ] `git diff origin/main -- .github/workflows/deploy-prod.yml` — only the `evidence` job + `needs:` line changed; `deploy` steps intact.

## Rollout (outside git — requires confirmation)

1. `bash scripts/setup-labels.sh` — create `release-ready` (idempotent).
2. Push branch, open PR, merge (CI required; release-ready.yml will itself run on the PR).
3. E2E: on a subsequent PR confirm `release-ready` appears once green + reviewed; cut a release and confirm the evidence job shows the correct previous version + rollback command before the Environment gate.

## Self-review (plan vs. spec)

- Spec §1 helper → Task 1 (TDD). §2 evidence job → Task 2. §3 release-ready.yml → Task 3. §4 label → Task 4. §5 runbook → Task 5. Verification approach → Task 1 test + full-suite. **All spec sections covered.**
- No placeholders in code steps. `prevReleaseTag` signature identical across Task 1 (def), Task 2 (consumer). Required check names identical across Task 3 and the ruleset. Label string `release-ready` identical across Tasks 3, 4, 5.
