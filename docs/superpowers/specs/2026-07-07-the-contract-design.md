# Spec: The Contract — Enforced Issue Templates + Risk Labels

- **Date:** 2026-07-07
- **Status:** Accepted (design approved 2026-07-07; per standing correction, proceeding straight to plan + implementation)
- **Deciders:** Vinny Carpenter
- **Related:** `coding-standards.md` (the "standards are the interface" doc), `.github/REPOSITORY_SETTINGS.md`, blog post "Two Gates and a Night Shift" (the target operating model)

## Goal

Make every change enter the delivery pipeline as an **enforced, machine-parseable contract that carries a risk tier**, so a human is forced to write the spec well *before* any agent reads it, and so downstream automation can scale plan depth by risk.

This is **sub-project A ("The Contract")** — the first of five cycles that together reproduce the "Two Gates and a Night Shift" pipeline for GSD Task Manager. It builds the pipeline's *entry point* only.

## Scope & non-goals

**In scope:**
- One enforced GitHub Issue Form (`change_request.yml`) with required contract fields + a required risk dropdown.
- `config.yml` that disables blank issues and routes security reports away from public contracts.
- Four `risk:*` labels + an idempotent script that creates them.
- One small `apply-risk-label.yml` workflow that reads the risk dropdown and applies the matching label.
- A PR template carrying the linked issue, risk tier, and a required rollback plan.
- A documented forward-looking label taxonomy for cycles B–E (documented, **not** created).

**Explicit non-goals (deferred to later cycles):**
- **No agents.** The builder (cycle B), reviewer hardening (cycle C), and night shift (cycle D) are not built here.
- **No deploy/CI behavior change.** Existing `ci.yml`, `deploy-dev.yml`, `deploy-prod.yml` are untouched.
- **No Telegram/Roci bot** and **no ephemeral preview environments** — the pipeline is GitHub-native by decision.
- **No separate Bug Report template** — every change flows through the single uniform contract for now (trivially added later).
- **Creating** the `plan:*` / `release-ready` state labels — documented only; each future cycle creates the labels it wires up.

## Background — current state

The repo already implements ~half of the target pipeline: `coding-standards.md` (the versioned standards), a reviewer agent (`.github/workflows/claude-code-review.yml`), a reactive builder (`.github/workflows/claude.yml`), CI, dev/prod deploys, and a real Gate 2 (`deploy-prod.yml` uses a GitHub `production` environment with a required-reviewer gate).

What is missing is the **front door**: there is no `.github/ISSUE_TEMPLATE/`, no PR template, and no risk taxonomy. Issues today can be filed blank, so nothing forces the acceptance criteria / constraints / rollback that a downstream builder agent needs, and there is no risk signal to scale plan depth against.

**Existing labels to align with (not duplicate):** the repo already has an AFK-agent vocabulary — `ready-for-agent` ("Fully specified, ready for an AFK agent"), `ready-for-human`, `needs-triage`, `needs-info`, plus `bug`, `documentation`, `enhancement`, `security`, `tech-debt`, `ci-cd`. The new `risk:*` labels occupy a **distinct namespace**: they encode *plan depth / blast radius*, an orthogonal axis to *readiness* (`ready-for-agent`) and *type* (`bug`/`enhancement`). The taxonomy doc reconciles the two rather than inventing parallel `needs-human`-style labels.

## Decision

A single enforced **GitHub Issue Form** (YAML) is the contract, with a required **risk dropdown**, and a small dependency-free workflow that maps the dropdown answer to a `risk:*` label.

Why this over the alternatives (from brainstorming):
- **Enforcement.** Issue Forms block submission on empty required fields; classic markdown templates only suggest a shape. The blog's whole premise is "raise the floor before an agent sees the work" — only Forms actually raise it.
- **Machine-parseable.** Structured Form fields render as predictable `### Heading` + value blocks, so cycle B's builder can parse the contract deterministically.
- **One source of truth.** A single template + a dropdown beats four near-duplicate per-tier templates; the risk axis lives in one field, not in the choice of file.

## Design

### 1. `.github/ISSUE_TEMPLATE/change_request.yml` — the enforced contract

GitHub Issue Form. Required fields (mirroring the blog's spec, adapted to GSD):

| Field (id) | Type | Required | Notes |
|---|---|---|---|
| `summary` | textarea | yes | Problem statement — what & why |
| `acceptance_criteria` | textarea | yes | How we know it's done (checklist-friendly) |
| `constraints` | textarea | yes | Must / must-not; placeholder guides "write None if none" |
| `out_of_scope` | textarea | yes | Explicit non-goals |
| `rollback` | textarea | yes | How to undo if it goes wrong |
| `risk` | dropdown | yes | `docs` / `chore` / `feature` / `risky`, each with a one-line meaning |
| `affected_areas` | input | no | Optional: components/paths likely touched |
| `context` | textarea | no | Optional: links, screenshots, prior art |

- `name: "New Change"`, `description` explains this is the pipeline contract.
- `labels: [needs-triage]` applied on creation (aligns with existing `needs-triage`).
- The dropdown includes a leading "Select a risk tier" non-answer so an unset value is detectable, but the field is `required: true` so submission is blocked until a real tier is chosen.

### 2. `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: false        # every issue goes through the contract
contact_links:
  - name: Report a security vulnerability
    url: https://github.com/vscarpenter/gsd-task-manager/security/policy
    about: Do not file security issues publicly — see SECURITY.md.
```

### 3. `risk:*` labels + `scripts/setup-labels.sh`

| Label | Meaning | Color |
|---|---|---|
| `risk:docs` | Docs/content only | `#0075ca` (blue) |
| `risk:chore` | Deps, config, tooling — no user-facing behavior change | `#c5def5` (light blue) |
| `risk:feature` | New/changed user-facing behavior | `#0e8a16` (green) |
| `risk:risky` | Touches security, auth, data, deploy/CI, or migrations | `#b60205` (red) |

`scripts/setup-labels.sh`: idempotent, uses `gh label create "<name>" --color <hex> --description "<desc>" --force` (with `--force`, create acts as upsert). Re-runnable safely. Follows the repo's existing `scripts/*.sh` convention.

### 4. `.github/workflows/apply-risk-label.yml` — the auto-labeler

- **Trigger:** `issues: [opened, edited]`.
- **Permissions:** `issues: write` only (single power — separation of duties in miniature). `contents: read`.
- **Logic (via `actions/github-script`, no third-party action):**
  1. Read `context.payload.issue.body`.
  2. Extract the answer under the `### Risk tier` heading that GitHub Forms renders.
  3. Normalize and match against the fixed enum `{docs, chore, feature, risky}`. Anything else → no-op (safe against malformed/malicious bodies).
  4. Remove any existing `risk:*` label on the issue (so editing the dropdown updates the label).
  5. Apply `risk:<tier>`.
- **Concurrency:** group per-issue so rapid edits don't race.
- The parsing contract (the exact `### Risk tier` heading and the dropdown option strings) is defined by §1 and must stay in sync with it; a comment in each file points at the other.

### 5. `.github/pull_request_template.md` — the PR contract

Sections: `Closes #<issue>` linkage; summary of change; **risk tier** (carried from the issue); a test / acceptance-criteria checklist; a **required rollback command/plan** (the blog's Gate 2 rule — "no rollback path, no approval" — captured at PR time); and a reviewer/CI checklist.

### 6. Forward-looking label taxonomy (documented, not created)

Recorded in this spec for cycles B–E to key off, reconciled with existing labels:

| Future label | Cycle | Purpose | Reconciliation |
|---|---|---|---|
| `risk:{docs,chore,feature,risky}` | **A (now)** | Plan-depth / blast-radius axis | New namespace |
| `ready-for-agent` *(exists)* | B | Contract complete → builder may claim | Reuse existing |
| `plan:pending` | B | Plan drafted, awaiting Gate 1 | New |
| `plan:approved` | B | Gate 1 passed → build may proceed | New |
| `ready-for-human` *(exists)* | B/D | Needs human judgment / implementation | Reuse existing (do **not** add `needs-human`) |
| `release-ready` | C | Review clean + CI green → awaiting Gate 2 | New |
| `triage:paused` | D | Night-shift kill switch | New |

## Verification approach

Per the repo's TDD/verification standards:
- **YAML validity + schema parse** for `change_request.yml`, `config.yml`, and `apply-risk-label.yml` (Forms schema fields, workflow schema).
- **Labeler logic** exercised against sample issue bodies — each valid tier, missing/unselected tier, and junk input — asserting correct label vs. no-op. This is the one component with real logic, so it gets real test cases (the parse/match/normalize function is extracted so it is unit-testable without GitHub).
- **Script idempotency** — `setup-labels.sh` re-run produces no error and no drift.

## Rollback

Everything here is additive and confined to `.github/` + one script + one doc. Rollback = delete the added files and `gh label delete risk:docs risk:chore risk:feature risk:risky`. No runtime, deploy, or data surface is touched.
