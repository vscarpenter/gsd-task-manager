# Agent operating docs

Operating specs and conventions for the autonomous delivery pipeline and its agents.

- [`../pipeline-summary.html`](../pipeline-summary.html) — "Two Gates & a Night Shift": a visual map of the whole delivery pipeline (cycles, gates, and the label state machine) as a single self-contained HTML page — open it in a browser.
- [`builder.md`](builder.md) — Builder operating spec (cycle B): turns a fully-specified issue into a reviewed PR, pausing once for Gate 1 plan approval; never merges.
- [`night-shift.md`](night-shift.md) — Night-shift operating spec (cycle D): nightly unattended triage of failing checks on the agent fleet's own open PRs.
- [`issue-tracker.md`](issue-tracker.md) — GitHub issue-tracker conventions (`gh` CLI) for creating, reading, labeling, and closing issues.
- [`triage-labels.md`](triage-labels.md) — Maps the five canonical triage roles to this repo's actual label strings.
- [`domain.md`](domain.md) — How the engineering skills should consume this repo's domain docs (`CONTEXT.md`, `docs/adr/`) before exploring the codebase.
