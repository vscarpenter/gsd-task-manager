#!/usr/bin/env bash
# Provision the labels used by the delivery pipeline. Idempotent —
# `gh label create --force` upserts, so this is safe to re-run. Requires an
# authenticated `gh` CLI with repo scope.
#   Cycle A ("The Contract"):  risk:* — plan-depth / blast-radius tier.
#   Cycle B ("Builder + Gate 1"): plan:* / agent:* / builder:* — the builder
#                                 state machine and kill switch.
set -euo pipefail

create() {
  gh label create "$1" --color "$2" --description "$3" --force
}

# Cycle A — risk tiers (the contract).
create "risk:docs"    "0075ca" "Docs/content only"
create "risk:chore"   "c5def5" "Deps, config, tooling — no user-facing behavior change"
create "risk:feature" "0e8a16" "New/changed user-facing behavior"
create "risk:risky"   "b60205" "Touches security, auth, data, deploy/CI, or migrations"

# Cycle B — builder state machine + Gate 1.
create "plan:pending"    "fbca04" "Plan posted, awaiting Gate 1 approval"
create "plan:revise"     "d876e3" "Human requested plan changes; builder re-plans"
create "plan:approved"   "0e8a16" "Human approved the plan; build may proceed"
create "agent:building"  "5319e7" "Builder is actively building (claim-lock)"
create "builder:paused"  "b60205" "Kill switch — halts all builder runs"

# Cycle C — review + Gate 2.
create "release-ready"   "1d76db" "Reviewed + CI green + no open threads — ready to merge, test, and release"

# Cycle D — the night shift.
create "triage:paused"   "b60205" "Kill switch — halts the nightly triage routine"

echo "pipeline labels created/updated."
