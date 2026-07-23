# Pipeline audit — the standards loop

Gates and manual evidence tell you *whether* the pipeline is healthy; the audit is how you keep it that way. This doc is the **learning loop**: how findings from spot-checks become durable rules in `coding-standards.md`, so each mistake is paid down once instead of rediscovered forever. It reuses the repo's existing standards machinery (§ "How a finding becomes a rule") rather than adding new.

## The spot-check discipline

Automated agents can share a blind spot: the builder and night shift are one model family, so a mistake one makes another can miss. The defense is a standing human audit.

- **Spot-check ~1 in 10 merged PRs by hand** — deliberately including the ones the gates trust most: fast-lane (`risk:docs`/`risk:chore`) merges, night-shift fix PRs, and anything auto-approved at Gate 1.
- **A "chore" that touches auth is not a chore.** Re-read the diff, not the label.
- **The audit has teeth.** Each agent keeps its autonomy only while spot-checks stay clean. If audits start surfacing defects at any meaningful rate, reduce that agent's autonomy and restore more human review until it re-earns trust. Autonomy is earned continuously and can be lost the same way.

## How to choose audit candidates

The automated telemetry workflow is retired. Use GitHub PR/check history and
periodic manual samples to find candidates:

- **Large or repeatedly revised PRs** — these are worth a hand-read because churn often signals a weak contract or standards gap.
- **Long cycle time / high plan-revision rate** — a slow or churny stretch points at a weak gate or an unclear contract, not just slow typing.
- **Auto-approved / night-shift merges** — the merges with the least human contact; over-represent them in the 1-in-10 sample.

The point is to find the next weak gate before it becomes the next escaped defect.

## How a finding becomes a rule (reuse the existing loop)

When a spot-check or recurring review category surfaces a real problem, do **not** just fix the code and move on — fix the **standard**, so every future build inherits the correction. Use the machinery already in the repo:

1. Record the tactical finding in the deviations ledger, `tasks/implementation-notes.md` (`coding-standards.md §4`).
2. Distill it via the **Self-Improvement Loop** (`coding-standards.md`) into `tasks/lessons.md` (a project learning) or `CLAUDE.md` (a behavioral rule) — then clear the ledger entry.
3. For pipeline-wide rules (coverage thresholds, a class of mistake to reject in review), add the rule to `coding-standards.md` itself — the versioned interface every agent builds against.

Because the builder and night shift both read `coding-standards.md`, a rule added once is enforced everywhere thereafter. The escaped defect that prompted it never gets reviewed twice.

## Where this connects

- **Audit evidence:** GitHub PR/check history plus the manual spot-check record.
- **Standards:** `coding-standards.md` (§4 Deviations Ledger, Self-Improvement Loop), `tasks/lessons.md`, `tasks/implementation-notes.md`.
- **Gates the audit protects:** Gate 1 (plan), Gate 2 (`docs/ops/gate2.md`), required PR review, and the night shift's fix PRs.
