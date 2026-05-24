---
name: reviewable-pr-slicing
description: Convert an approved technical plan into a sequence of small, reviewable PRs with clear phase boundaries, validation gates, and PR descriptions. Use for multi-step refactors, workflow changes, security-remediation tranches, documentation-plus-code rollouts, or any change that is too risky or noisy for one PR.
disable-model-invocation: false
---

# reviewable-pr-slicing

Use this skill when a plan is ready to implement, but the work should be split into small PRs instead of one broad change.

This skill only changes repository artifacts. It may document manual prerequisites, but it must not perform external account setup, store secrets, or change settings outside the repo.

## Good fits

- A plan that already has goals, non-goals, and a target state.
- Work that affects multiple layers, such as scripts, workflows, docs, tests, and runtime code.
- Security findings that should land as narrow remediation tranches.
- Refactors that need behavior-preserving setup before behavior-changing work.
- Documentation plus implementation rollouts where reviewers need a clean breadcrumb trail.

Do not use this for tiny fixes, speculative ideas, or work without a clear stopping condition.

## Required inputs

Before editing code, collect:

1. Approved plan or issue path.
2. Current behavior and affected surfaces.
3. Goals and non-goals.
4. Locked decisions and open decisions.
5. Manual prerequisites the human must complete outside the repo.
6. Validation commands.
7. Manual acceptance tests.
8. Rollback or fallback posture.

If these are missing, add them to the plan first and stop before implementation.

## Phase design rules

- Keep each PR independently understandable.
- Prefer one concern per PR.
- Put plan-only documentation before implementation.
- Put shared foundations before files that consume them.
- Put read-only validation before write-path changes.
- Put lower-risk environments or paths before higher-risk ones.
- Keep manual prerequisites explicit and separate from code behavior.
- Stop after the current phase. Do not sneak in the next phase.

## Default phase pattern

Adapt the names to the work, but start here:

1. **Plan PR** — canonical plan, options, decisions, phase list. No behavior change.
2. **Foundation PR** — shared helpers, scripts, types, or docs scaffolding. Preserve behavior.
3. **Validation PR** — checks, tests, assertions, or reports that make later change safer.
4. **First behavior PR** — narrow live behavior change with the smallest blast radius.
5. **Second behavior PR** — next scoped behavior change after the first proves clean.
6. **Cleanup PR** — remove old paths only after the replacement has been validated.

## PR body template

```md
## Summary

Phase N of `<plan path>` — <one-sentence scope>. State whether this is plan-only, behavior-preserving, dormant until manual prerequisites, or live on merge.

## Changes

| File | Change |
|---|---|
| `<path>` | <specific change> |

## Design notes

**Why <decision>.** <rationale and tradeoff>

**Why not <tempting alternative>.** <reason it was skipped>

## Manual prerequisites

List only work the human must complete outside this PR. If none, say none.

## What is next

Name the next phase and this phase's acceptance condition.

## Test plan

- [ ] Automated validation.
- [ ] Manual first-run or review check.
- [ ] Negative or failure-mode check for the riskiest path.
```

## Implementation checklist

- [ ] Read the plan end to end.
- [ ] Confirm the phase and stopping condition.
- [ ] Keep unrelated cleanup out.
- [ ] Update the runbook or docs next to the changed surface.
- [ ] Include manual prerequisites in both docs and PR body.
- [ ] Run static validation for changed file types.
- [ ] Add a negative test or failure-mode check when practical.
- [ ] Stop at the phase boundary.

## Review checklist

Before marking ready:

- [ ] A reviewer can understand the PR without reading chat history.
- [ ] The blast radius is stated honestly.
- [ ] Manual prerequisites are clear.
- [ ] Validation is specific and reproducible.
- [ ] Next step is explicit.
- [ ] No secrets, account identifiers, or local-only paths are committed unless intentionally documented as examples.
