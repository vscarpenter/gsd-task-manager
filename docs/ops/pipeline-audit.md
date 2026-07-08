# Pipeline audit — the standards loop

Telemetry and gates tell you *whether* the pipeline is healthy; the audit is how you keep it that way. This doc is the **learning loop**: how findings from spot-checks and telemetry become durable rules in `coding-standards.md`, so each mistake is paid down once instead of rediscovered forever. It reuses the repo's existing standards machinery (§ "How a finding becomes a rule") rather than adding new.

## The spot-check discipline

Automated gates can share a blind spot: the builder, reviewer, and night shift are one model family, so a mistake one makes another can miss. The defense is a standing human audit.

- **Spot-check ~1 in 10 merged PRs by hand** — deliberately including the ones the gates trust most: fast-lane (`risk:docs`/`risk:chore`) merges, night-shift fix PRs, and anything auto-approved at Gate 1.
- **A "chore" that touches auth is not a chore.** Re-read the diff, not the label.
- **The audit has teeth.** Each agent keeps its autonomy only while spot-checks stay clean. If audits start surfacing defects the reviewer missed at any meaningful rate, that agent's judgment stops counting for the gate (e.g. its `release-ready`/auto-approve privilege is revoked and human review returns) until it re-earns trust. Autonomy is earned continuously and can be lost the same way.

## How telemetry surfaces audit candidates

The **Pipeline Telemetry** issue (updated weekly by `telemetry.yml`) is where the pipeline flags where to look:

- **High review-findings/PR** — a PR (or a category) the reviewer flagged heavily is worth a hand-read; a rising mean suggests a standards gap.
- **Long cycle time / high plan-revision rate** — a slow or churny stretch points at a weak gate or an unclear contract, not just slow typing.
- **Auto-approved / night-shift merges** — the merges with the least human contact; over-represent them in the 1-in-10 sample.

The point is not to admire the dashboard — it is to find the next weak gate before it becomes the next escaped defect.

## How a finding becomes a rule (reuse the existing loop)

When a spot-check or a recurring reviewer category surfaces a real problem, do **not** just fix the code and move on — fix the **standard**, so every future build inherits the correction. Use the machinery already in the repo:

1. Record the tactical finding in the deviations ledger, `tasks/implementation-notes.md` (`coding-standards.md §4`).
2. Distill it via the **Self-Improvement Loop** (`coding-standards.md`) into `tasks/lessons.md` (a project learning) or `CLAUDE.md` (a behavioral rule) — then clear the ledger entry.
3. For pipeline-wide rules (coverage thresholds, a class of mistake to reject in review), add the rule to `coding-standards.md` itself — the versioned interface every agent builds against.

Because the builder, reviewer, and night shift all read `coding-standards.md`, a rule added once is enforced everywhere thereafter. The escaped defect that prompted it never gets reviewed twice.

## Where this connects

- **Telemetry:** `.github/workflows/telemetry.yml` → the Pipeline Telemetry issue + `telemetry` branch snapshots (`docs/ops/telemetry/`).
- **Standards:** `coding-standards.md` (§4 Deviations Ledger, Self-Improvement Loop), `tasks/lessons.md`, `tasks/implementation-notes.md`.
- **Gates the audit protects:** Gate 1 (plan), Gate 2 (`docs/ops/gate2.md`), the reviewer's `release-ready` call, and the night shift's fix PRs.
