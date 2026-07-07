# The Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an enforced, machine-parseable GitHub issue contract that carries a risk tier, plus the labels, auto-labeler, and PR template that make it the pipeline's front door.

**Architecture:** A GitHub Issue Form enforces the contract fields and a required risk dropdown. A pure `.cjs` parser extracts the chosen tier from the issue body; a thin `actions/github-script` workflow calls that parser and applies the matching `risk:*` label. Labels are provisioned by an idempotent `gh` script. Nothing here touches runtime, deploy, or CI-gate behavior.

**Tech Stack:** GitHub Issue Forms (YAML), GitHub Actions (`actions/github-script@v7`, `actions/checkout@v4`), `gh` CLI, Node CommonJS (`.cjs`), Vitest (`.test.ts`).

## Global Constraints

- Additive only — confined to `.github/`, `scripts/`, `docs/`. Do not modify `ci.yml`, `deploy-dev.yml`, `deploy-prod.yml`, or any runtime/app code.
- Risk tiers are exactly: `docs`, `chore`, `feature`, `risky` (lowercase, bare words).
- `risk:*` is a distinct label namespace; do NOT create/rename existing `ready-for-agent` / `ready-for-human` / `needs-triage` labels.
- Node helpers use `.cjs` (repo convention, `type: module`). Tests use `.test.ts` (Vitest default glob).
- Commits: Conventional Commits with scope, author `Vinny Carpenter <vscarpenter@gmail.com>`, trailer `Claude-Session: https://claude.ai/code/session_01VTzjLGNTCEByQKuedNvBoB`, no Co-Authored-By footer.
- The dropdown field label is exactly `Risk tier` (renders as `### Risk tier` in the issue body) — the parser depends on this string.

---

### Task 1: Risk-tier parser (the one piece with real logic — TDD)

**Files:**
- Create: `scripts/parse-risk-tier.cjs`
- Test: `scripts/parse-risk-tier.test.ts`

**Interfaces:**
- Produces: `parseRiskTier(body: string | null | undefined): 'docs'|'chore'|'feature'|'risky'|null` and `RISK_TIERS: string[]`, exported via `module.exports`. Consumed by Task 4's workflow.

- [ ] **Step 1: Write the failing test** — `scripts/parse-risk-tier.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseRiskTier, RISK_TIERS } from "./parse-risk-tier.cjs";

const body = (value: string) =>
  `### Summary\n\nDo the thing\n\n### Risk tier\n\n${value}\n\n### Additional context\n\n_No response_`;

describe("parseRiskTier", () => {
  it("exposes the four canonical tiers", () => {
    expect(RISK_TIERS).toEqual(["docs", "chore", "feature", "risky"]);
  });

  it.each(RISK_TIERS)("parses a valid tier: %s", (tier) => {
    expect(parseRiskTier(body(tier))).toBe(tier);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(parseRiskTier(body("  Feature  "))).toBe("feature");
  });

  it("handles CRLF line endings", () => {
    expect(parseRiskTier("### Risk tier\r\n\r\nrisky\r\n")).toBe("risky");
  });

  it("returns null when the heading is absent", () => {
    expect(parseRiskTier("### Summary\n\nno risk field here")).toBeNull();
  });

  it("returns null for an unanswered dropdown (_No response_)", () => {
    expect(parseRiskTier(body("_No response_"))).toBeNull();
  });

  it("returns null when the answer is not one of the four tiers", () => {
    expect(parseRiskTier(body("medium"))).toBeNull();
  });

  it("returns null when the section is empty (next heading follows)", () => {
    expect(parseRiskTier("### Risk tier\n\n### Next\n\nx")).toBeNull();
  });

  it.each([null, undefined, "", 123 as unknown as string])(
    "returns null for non-string/empty input: %s",
    (input) => {
      expect(parseRiskTier(input as string)).toBeNull();
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- scripts/parse-risk-tier.test.ts`
Expected: FAIL — cannot resolve `./parse-risk-tier.cjs`.

- [ ] **Step 3: Write minimal implementation** — `scripts/parse-risk-tier.cjs`

```js
"use strict";

// Canonical risk tiers, in escalation order. Must match the dropdown options
// in .github/ISSUE_TEMPLATE/change_request.yml exactly (bare lowercase words).
const RISK_TIERS = ["docs", "chore", "feature", "risky"];

/**
 * Extract the selected risk tier from a GitHub Issue Form body.
 * The form renders the dropdown as an "### Risk tier" heading followed by the
 * chosen option on the next non-empty line. Returns null for anything that is
 * not exactly one of RISK_TIERS (unanswered, junk, malformed, non-string).
 *
 * @param {string|null|undefined} body
 * @returns {"docs"|"chore"|"feature"|"risky"|null}
 */
function parseRiskTier(body) {
  if (typeof body !== "string" || body.length === 0) return null;
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const headingIdx = lines.findIndex((line) =>
    /^#{1,6}\s+Risk tier\s*$/i.test(line.trim())
  );
  if (headingIdx === -1) return null;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const value = lines[i].trim();
    if (value === "") continue;
    if (/^#{1,6}\s+/.test(value)) return null; // hit next heading = empty answer
    const normalized = value.toLowerCase();
    return RISK_TIERS.includes(normalized) ? normalized : null;
  }
  return null;
}

module.exports = { parseRiskTier, RISK_TIERS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- scripts/parse-risk-tier.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-risk-tier.cjs scripts/parse-risk-tier.test.ts
git commit  # feat(pipeline): risk-tier parser for issue contract  + Claude-Session trailer
```

---

### Task 2: Risk labels provisioning script

**Files:**
- Create: `scripts/setup-labels.sh`

**Interfaces:**
- Produces the four `risk:*` labels in the GitHub repo. Consumed operationally by Task 4 (labeler assumes labels exist).

- [ ] **Step 1: Write the script** — `scripts/setup-labels.sh`

```bash
#!/usr/bin/env bash
# Provision the risk:* labels used by the delivery pipeline (sub-project A:
# "The Contract"). Idempotent — `gh label create --force` upserts, so this is
# safe to re-run. Requires an authenticated `gh` CLI with repo scope.
set -euo pipefail

create() {
  gh label create "$1" --color "$2" --description "$3" --force
}

create "risk:docs"    "0075ca" "Docs/content only"
create "risk:chore"   "c5def5" "Deps, config, tooling — no user-facing behavior change"
create "risk:feature" "0e8a16" "New/changed user-facing behavior"
create "risk:risky"   "b60205" "Touches security, auth, data, deploy/CI, or migrations"

echo "risk:* labels created/updated."
```

- [ ] **Step 2: Make executable + shell-lint**

Run: `chmod +x scripts/setup-labels.sh && bash -n scripts/setup-labels.sh && (command -v shellcheck >/dev/null && shellcheck scripts/setup-labels.sh || echo "shellcheck not installed; syntax OK")`
Expected: no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-labels.sh
git commit  # chore(pipeline): idempotent risk:* label provisioning script
```

(Actual label creation against GitHub happens at rollout, not in this task — see Rollout.)

---

### Task 3: Issue Form contract + config

**Files:**
- Create: `.github/ISSUE_TEMPLATE/change_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

**Interfaces:**
- Produces an issue body whose `### Risk tier` section holds a bare tier word — the exact shape Task 1 parses and Task 4 reads.

- [ ] **Step 1: Write the Issue Form** — `.github/ISSUE_TEMPLATE/change_request.yml`

```yaml
name: New Change
description: File a change as a pipeline contract — enforced spec + risk tier.
title: "[change]: "
labels: ["needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Every change enters the pipeline through this contract. Fields marked with * are required.
        Write it like a spec, not a sticky note — a vague contract produces a plausible plan for the wrong problem.
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What needs to change and why. State the problem, not just the solution.
      placeholder: "Today the app … which causes … . We want …"
    validations:
      required: true
  - type: textarea
    id: acceptance_criteria
    attributes:
      label: Acceptance criteria
      description: How we'll know it's done. Prefer a checklist of observable outcomes.
      placeholder: |
        - [ ] …
        - [ ] …
    validations:
      required: true
  - type: textarea
    id: constraints
    attributes:
      label: Constraints
      description: Must / must-not — performance, compatibility, security, UX. Write "None" if there are none.
      placeholder: "Must not change the sync protocol. Must keep the bundle under budget."
    validations:
      required: true
  - type: textarea
    id: out_of_scope
    attributes:
      label: Out of scope
      description: Explicit non-goals — what this change will NOT do.
      placeholder: "Not touching the MCP server. Not redesigning the matrix."
    validations:
      required: true
  - type: textarea
    id: rollback
    attributes:
      label: Rollback considerations
      description: If this ships and goes wrong, how do we undo it? No rollback path, no release approval.
      placeholder: "Revert PR and redeploy the previous tag. / Flip the feature flag off. / Migration is reversible via …"
    validations:
      required: true
  - type: dropdown
    id: risk
    attributes:
      label: Risk tier
      description: |
        Drives how deep a plan the builder writes and whether it stops for human approval.
        docs — docs/content only ·
        chore — deps, config, tooling; no user-facing behavior change ·
        feature — new/changed user-facing behavior ·
        risky — touches security, auth, data, deploy/CI, or migrations
      options:
        - docs
        - chore
        - feature
        - risky
    validations:
      required: true
  - type: input
    id: affected_areas
    attributes:
      label: Affected areas (optional)
      description: Components or paths you expect to touch.
      placeholder: "components/matrix, lib/sync, .github/workflows"
    validations:
      required: false
  - type: textarea
    id: context
    attributes:
      label: Additional context (optional)
      description: Links, screenshots, prior art, related issues.
    validations:
      required: false
```

- [ ] **Step 2: Write the config** — `.github/ISSUE_TEMPLATE/config.yml`

```yaml
# Every issue must go through the contract; no blank issues.
blank_issues_enabled: false
contact_links:
  - name: Report a security vulnerability
    url: https://github.com/vscarpenter/gsd-task-manager/security/policy
    about: Please do not file security issues publicly — see SECURITY.md.
```

- [ ] **Step 3: Validate YAML + Issue Form shape**

Run: `node -e "const y=require('js-yaml'); for (const f of ['.github/ISSUE_TEMPLATE/change_request.yml','.github/ISSUE_TEMPLATE/config.yml']){const d=y.load(require('fs').readFileSync(f,'utf8')); console.log(f,'OK')}"` (fallback if `js-yaml` absent: `python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]; print('OK')" .github/ISSUE_TEMPLATE/change_request.yml .github/ISSUE_TEMPLATE/config.yml`)
Then assert the dropdown options equal the parser's tiers.
Expected: both parse; dropdown options == `["docs","chore","feature","risky"]`.

- [ ] **Step 4: Commit**

```bash
git add .github/ISSUE_TEMPLATE/change_request.yml .github/ISSUE_TEMPLATE/config.yml
git commit  # feat(pipeline): enforced New Change issue contract + templates config
```

---

### Task 4: Auto-labeler workflow

**Files:**
- Create: `.github/workflows/apply-risk-label.yml`

**Interfaces:**
- Consumes: `parseRiskTier` / `RISK_TIERS` from `scripts/parse-risk-tier.cjs` (Task 1) and the `risk:*` labels (Task 2).

- [ ] **Step 1: Write the workflow** — `.github/workflows/apply-risk-label.yml`

```yaml
name: Apply risk label

# Reads the risk dropdown on the issue contract and applies the matching
# risk:* label. Safe for issues from any author: it only ever applies one of
# four fixed labels derived from the body, holds no secrets, and executes no
# issue-supplied content — so no author_association gate is needed (unlike
# claude.yml, which is secret-bearing).
on:
  issues:
    types: [opened, edited]

concurrency:
  group: apply-risk-label-${{ github.event.issue.number }}
  cancel-in-progress: true

permissions:
  contents: read   # checkout the parser module
  issues: write    # the single power this job holds

jobs:
  label:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - uses: actions/github-script@v7
        with:
          script: |
            const { parseRiskTier } = require(`${process.env.GITHUB_WORKSPACE}/scripts/parse-risk-tier.cjs`);
            const tier = parseRiskTier(context.payload.issue.body);
            if (!tier) {
              core.info("No valid risk tier in issue body; leaving labels unchanged.");
              return;
            }
            const target = `risk:${tier}`;
            const { owner, repo } = context.repo;
            const issue_number = context.payload.issue.number;

            const { data: labels } = await github.rest.issues.listLabelsOnIssue({ owner, repo, issue_number });
            const riskLabels = labels.map((l) => l.name).filter((n) => n.startsWith("risk:"));

            if (riskLabels.length === 1 && riskLabels[0] === target) {
              core.info(`Already labeled ${target}; nothing to do.`);
              return;
            }
            for (const name of riskLabels) {
              if (name !== target) {
                await github.rest.issues
                  .removeLabel({ owner, repo, issue_number, name })
                  .catch((e) => { if (e.status !== 404) throw e; });
              }
            }
            if (!riskLabels.includes(target)) {
              await github.rest.issues.addLabels({ owner, repo, issue_number, labels: [target] });
            }
            core.info(`Applied ${target}.`);
```

- [ ] **Step 2: Validate workflow YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/apply-risk-label.yml')); print('OK')"`
Expected: `OK`.

- [ ] **Step 3: Confirm the parser path in the workflow matches Task 1's file**

Run: `test -f scripts/parse-risk-tier.cjs && grep -q 'scripts/parse-risk-tier.cjs' .github/workflows/apply-risk-label.yml && echo LINKED`
Expected: `LINKED`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/apply-risk-label.yml
git commit  # feat(pipeline): auto-apply risk:* label from issue contract
```

---

### Task 5: PR contract template

**Files:**
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Write the PR template** — `.github/pull_request_template.md`

```markdown
## Summary

<!-- What changed and why. Link the contract this implements. -->
Closes #

## Risk tier

<!-- Carry the risk:* label from the linked issue: docs | chore | feature | risky -->

## How to verify

<!-- Steps to exercise the change. Mirror the linked issue's acceptance criteria. -->
- [ ]

## Rollback plan

<!-- REQUIRED. How to undo this if it goes wrong in production.
     No rollback path, no release approval. -->

## Checklist

- [ ] Acceptance criteria from the linked issue are met
- [ ] Tests added/updated and passing (`bun run test`)
- [ ] Lint and typecheck clean (`bun run lint`, `bun run typecheck`)
- [ ] Coding standards followed (`coding-standards.md`)
- [ ] Rollback plan above is real
```

- [ ] **Step 2: Sanity-check it renders (headings present)**

Run: `grep -c '^## ' .github/pull_request_template.md`
Expected: `5`.

- [ ] **Step 3: Commit**

```bash
git add .github/pull_request_template.md
git commit  # feat(pipeline): PR contract template with required rollback plan
```

---

## Full-suite verification (after all tasks)

- [ ] `bun run test -- scripts/parse-risk-tier.test.ts` — parser green.
- [ ] `bun run lint` — no new lint errors from added files.
- [ ] Re-parse every new YAML file to confirm validity.
- [ ] Confirm dropdown options in `change_request.yml` === `RISK_TIERS` in the parser (drift guard).

## Rollout (operational, outside git — requires confirmation before running)

1. `bash scripts/setup-labels.sh` — create the `risk:*` labels (mutates the live repo).
2. Push branch, open PR, merge.
3. Verify end-to-end: open a test issue via **New Change**, pick a tier, confirm `apply-risk-label.yml` applies `risk:<tier>`; edit the tier, confirm the label swaps.

## Self-review (plan vs. spec)

- Spec §1 Issue Form → Task 3. §2 config → Task 3. §3 labels+script → Task 2. §4 labeler → Task 4. §5 PR template → Task 5. §6 taxonomy → documented in spec (no code). Verification approach → Task 1 tests + full-suite section. **All spec sections covered.**
- No placeholders: every code step contains complete content.
- Type consistency: `parseRiskTier` / `RISK_TIERS` names identical across Task 1 (def), Task 3 (drift guard), Task 4 (consumer). Dropdown option strings identical to `RISK_TIERS`.
