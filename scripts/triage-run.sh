#!/usr/bin/env bash
# GSD Night Shift — launchd entry point (cycle D). Nightly, unattended: triages
# failing checks on the agent fleet's own (claude/*) open PRs. Non-blocking;
# checks the triage:paused kill switch and only invokes Claude when there is
# failing work. See docs/agents/night-shift.md.
set -euo pipefail

# launchd starts jobs with a minimal PATH (/usr/bin:/bin:...), so the toolchain
# (gh/git in Homebrew, node/claude in ~/.local/bin, bun in ~/.bun/bin) isn't
# found and gh silently fails the pre-check. Append (don't prepend) the tool
# dirs so an existing gh on PATH — e.g. a test stub — still wins.
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin"

REPO="${GSD_TRIAGE_REPO:-vscarpenter/gsd-task-manager}"
WORKTREE="${GSD_TRIAGE_WORKTREE:-$HOME/.gsd-night-shift/worktree}"
SOURCE="${GSD_TRIAGE_SOURCE:-$HOME/Projects/gsd-taskmanager}"
LOG_DIR="${GSD_TRIAGE_LOG_DIR:-$SOURCE/docs/ops/night-shift-logs}"
HELPER="${GSD_TRIAGE_HELPER:-$SOURCE/scripts/failing-agent-prs.cjs}"

MODE="run"
for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE="dry-run" ;;
    --check)   MODE="check" ;;
    "")        ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

gh_fail_log() {
  mkdir -p "$LOG_DIR" 2>/dev/null || true
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG_DIR/gh-errors.log" 2>/dev/null || true
}

# 1. Kill switch.
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

# 2. Work check — failing claude/* PRs from a trusted origin (provenance +
# failing-check filtering live in the tested helper). Fetch headRepositoryOwner /
# isCrossRepository so fork PRs — whose head branch name is attacker-controlled —
# are told apart from the fleet's own same-repo branches, and pass the base-repo
# owner so the helper can confirm same-repo provenance.
REPO_OWNER="${REPO%%/*}"
prs_json='[]'
if out=$(gh pr list --repo "$REPO" --state open --json number,headRefName,headRepositoryOwner,isCrossRepository,statusCheckRollup 2>/dev/null); then
  prs_json="$out"
else
  gh_fail_log "pr list failed"
fi
failing="$(printf '%s' "$prs_json" | GSD_TRIAGE_REPO_OWNER="$REPO_OWNER" node "$HELPER" 2>/dev/null || echo 0)"
if [ "$failing" = "0" ]; then
  echo "NO_WORK: no failing claude/* PRs — exiting."
  exit 0
fi
echo "WORK: failing claude/* PRs=$failing"

if [ "$MODE" = "check" ]; then exit 0; fi
if [ "$MODE" = "dry-run" ]; then
  echo "DRYRUN: would run 'claude -p /triage-prs' in $WORKTREE"
  exit 0
fi

# 3. Isolation — dedicated worktree off latest origin/main.
mkdir -p "$(dirname "$WORKTREE")" "$LOG_DIR"
git -C "$SOURCE" fetch origin main --quiet
if git -C "$SOURCE" worktree list --porcelain | grep -q "^worktree $WORKTREE$"; then
  git -C "$WORKTREE" reset --hard origin/main
else
  git -C "$SOURCE" worktree add --force "$WORKTREE" origin/main
fi

# 4. Invoke the night shift with a scoped tool allow-list. 5. Log.
run_id="night-shift-$(git -C "$SOURCE" rev-parse --short origin/main)-$$"
echo "RUN: $run_id"
(
  cd "$WORKTREE" &&
  claude -p "/triage-prs" \
    --allowedTools "Bash(git*),Bash(gh*),Bash(bun*),Bash(node*),Edit,Write,Read"
) 2>&1 | tee "$LOG_DIR/$run_id.log"
