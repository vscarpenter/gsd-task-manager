#!/usr/bin/env bash
# GSD Night Shift discovery-only entry point. It may report failing bot PRs,
# but it never checks out or executes branch code on the maintainer host.
set -euo pipefail

export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin"

REPO="${GSD_TRIAGE_REPO:-vscarpenter/gsd-task-manager}"
SOURCE="${GSD_TRIAGE_SOURCE:-$HOME/Projects/GSD/gsd-taskmanager}"
LOG_DIR="${GSD_TRIAGE_LOG_DIR:-$SOURCE/docs/ops/night-shift-logs}"
HELPER="${GSD_TRIAGE_HELPER:-$SOURCE/scripts/failing-agent-prs.cjs}"
BOT_LOGIN="${GSD_TRIAGE_BOT_LOGIN:-}"

for arg in "$@"; do
  case "$arg" in
    --dry-run | --check | "") ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

gh_fail_log() {
  mkdir -p "$LOG_DIR" 2>/dev/null || true
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG_DIR/gh-errors.log" 2>/dev/null || true
}

if [ -z "$BOT_LOGIN" ]; then
  echo "DISABLED: set GSD_TRIAGE_BOT_LOGIN to enable read-only bot PR discovery."
  exit 0
fi

paused=0
if out=$(gh issue list --repo "$REPO" --label "triage:paused" --state open --json number --jq 'length' 2>/dev/null); then
  paused="$out"
else
  gh_fail_log "issue list triage:paused failed"
fi
if [ "$paused" != "0" ]; then
  echo "PAUSED: triage:paused is set — exiting."
  exit 0
fi

prs_json='[]'
if out=$(gh pr list --repo "$REPO" --state open --json number,author,headRefName,headRefOid,isCrossRepository,statusCheckRollup 2>/dev/null); then
  prs_json="$out"
else
  gh_fail_log "pr list failed"
fi

# A helper that could not run has told us nothing. Reporting that as "no work"
# would turn a broken lookup into a clean bill of health, so the two outcomes
# stay distinct.
if failing="$(printf '%s' "$prs_json" | GSD_TRIAGE_BOT_LOGIN="$BOT_LOGIN" node "$HELPER" 2>/dev/null)" &&
  [ -n "$failing" ]; then
  if [ "$failing" = "0" ]; then
    echo "NO_WORK: no failing bot-authored claude/* PRs with a valid head SHA."
  else
    echo "DISCOVERY: failing bot-authored claude/* PRs=$failing"
  fi
else
  gh_fail_log "discovery helper did not run"
  echo "UNKNOWN: discovery helper did not run; candidate count is unavailable."
fi

echo "DISABLED: local branch remediation is retired; no PR branch is checked out or executed."
echo "REQUIRED: exact-SHA attestation and an ephemeral credential-free runner."
