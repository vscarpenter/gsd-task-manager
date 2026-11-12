# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label", which is `ready-for-agent`), use the corresponding label string from this table.

Edit the middle column to match whatever vocabulary you actually use.

No agent acts on `ready-for-agent` today. The builder is retired, and [`builder.md`](builder.md) treats that label as workflow metadata only. `scripts/setup-labels.sh` creates the separate pipeline labels (`risk:*`, `plan:*`, `agent:building`, `builder:paused`, and `triage:paused`). It does not create the five labels in this table, so confirm them with `gh label list`. `triage:paused` is the night shift's kill switch for pull-request discovery. It is not an issue triage label.
