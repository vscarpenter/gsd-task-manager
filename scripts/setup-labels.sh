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
