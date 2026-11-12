# Agent operating docs

Operating specs and conventions for the delivery pipeline and its agents. Neither the builder nor the night shift executes code unattended today.

- [`../pipeline-summary.html`](../pipeline-summary.html) — "Two Gates & a Night Shift": a visual map of the whole delivery pipeline (cycles, gates, and the label state machine) as a single self-contained HTML page — open it in a browser. The page shows the pipeline as built in July 2026. Its diagrams still draw the builder and the night shift as live agents. The text and captions say both are retired or reduced, and `builder.md` and `night-shift.md` hold their current state.
- [`builder.md`](builder.md): the builder (milestone B in the pipeline page's timeline) is retired. `scripts/builder-run.sh` and `/build-next` refuse to run. The file lists the controls a replacement needs.
- [`night-shift.md`](night-shift.md): the night shift (milestone D in the pipeline page's timeline) is discovery-only. `scripts/triage-run.sh` counts failing bot pull requests and never checks out or runs branch code.
- [`issue-tracker.md`](issue-tracker.md) — GitHub issue-tracker conventions (`gh` CLI) for creating, reading, labeling, and closing issues.
- [`triage-labels.md`](triage-labels.md) — Maps the five canonical triage roles to this repo's actual label strings.
- [`domain.md`](domain.md) — How the engineering skills should consume this repo's domain docs (`CONTEXT.md`, `docs/adr/`) before exploring the codebase.
