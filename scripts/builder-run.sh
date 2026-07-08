#!/usr/bin/env bash
# GSD Builder — launchd entry point (cycle B: Builder + Gate 1).
# Non-blocking: pre-checks cheaply and invokes the builder only when there is
# work, so most scheduled wake-ups cost zero Claude tokens. Labels are the
# durable state across runs. See docs/agents/builder.md.
set -euo pipefail

# launchd starts jobs with a minimal PATH (/usr/bin:/bin:...), so the toolchain
# (gh/git in Homebrew, node/claude in ~/.local/bin, bun in ~/.bun/bin) isn't
# found and gh silently fails the pre-check. Append (don't prepend) the tool
# dirs so an existing gh on PATH — e.g. a test stub — still wins.
export PATH="$PATH:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin"

REPO="${GSD_BUILDER_REPO:-vscarpenter/gsd-task-manager}"
WORKTREE="${GSD_BUILDER_WORKTREE:-$HOME/.gsd-builder/worktree}"
SOURCE="${GSD_BUILDER_SOURCE:-$HOME/Projects/gsd-taskmanager}"
LOG_DIR="${GSD_BUILDER_LOG_DIR:-$SOURCE/docs/ops/builder-logs}"
TOKENS_HELPER="${GSD_BUILDER_TOKENS_HELPER:-$SOURCE/scripts/extract-run-tokens.cjs}"

MODE="run"
for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE="dry-run" ;;
    --check)   MODE="check" ;;
    "")        ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# Count open issues carrying a label. Fail-safe to 0 so a gh hiccup never makes
# the pre-check think there is work (and burn a Claude run) — it just idles.
# A failure is logged (not silently swallowed) so a persistent gh/auth outage is
# discoverable rather than an invisible permanent idle.
count() {
  local out
  if out=$(gh issue list --repo "$REPO" --label "$1" --state open --json number --jq 'length' 2>/dev/null); then
    printf '%s\n' "$out"
  else
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    printf '%s gh count failed for label %q\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG_DIR/gh-errors.log" 2>/dev/null || true
    echo 0
  fi
}

# 1. Kill switch — checked first, before any work is considered.
if [ "$(count "builder:paused")" != "0" ]; then
  echo "PAUSED: builder:paused is set — exiting."
  exit 0
fi

# 2. Cheap work check. plan:revise is included so a human /revise request on a
#    pending plan actually wakes the builder (label counts can't see comments,
#    so "request changes" is a label swap: plan:pending -> plan:revise).
to_plan="$(count "ready-for-agent")"
to_build="$(count "plan:approved")"
to_revise="$(count "plan:revise")"
if [ "$to_plan" = "0" ] && [ "$to_build" = "0" ] && [ "$to_revise" = "0" ]; then
  echo "NO_WORK: no ready-for-agent, plan:approved, or plan:revise issues — exiting."
  exit 0
fi
echo "WORK: ready-for-agent=$to_plan plan:approved=$to_build plan:revise=$to_revise"

if [ "$MODE" = "check" ]; then exit 0; fi
if [ "$MODE" = "dry-run" ]; then
  echo "DRYRUN: would run 'claude -p /build-next' in $WORKTREE"
  exit 0
fi

# 3. Isolation — refresh a dedicated worktree off the latest origin/main so the
#    builder never touches the user's active checkout or uncommitted work.
mkdir -p "$(dirname "$WORKTREE")" "$LOG_DIR"
git -C "$SOURCE" fetch origin main --quiet
if git -C "$SOURCE" worktree list --porcelain | grep -q "^worktree $WORKTREE$"; then
  git -C "$WORKTREE" reset --hard origin/main
else
  git -C "$SOURCE" worktree add --force "$WORKTREE" origin/main
fi

# 4. Invoke the builder with a scoped tool allow-list (never the full
#    --dangerously-skip-permissions), bounded to git/gh/bun + in-repo edits.
#    --output-format json so the run's token usage + OPENED_PR can be recorded.
# 5. Log the run for audit (JSON to the run log, stderr alongside).
run_id="builder-$(git -C "$SOURCE" rev-parse --short origin/main)-$$"
run_log="$LOG_DIR/$run_id.json"
echo "RUN: $run_id"
(
  cd "$WORKTREE" &&
  claude -p "/build-next" --output-format json \
    --allowedTools "Bash(git*),Bash(gh*),Bash(bun*),Edit,Write,Read"
) > "$run_log" 2> "$run_log.err" || true

# 6. Record the run's token cost against the PR it opened (best-effort; a
#    failure here never fails the run). The builder ends its output with
#    OPENED_PR=<n>; extract-run-tokens.cjs pairs it with the usage total.
read -r tokens pr < <(node "$TOKENS_HELPER" < "$run_log" 2>/dev/null || echo "0 none")
if [ "$pr" != "none" ] && [ "$tokens" != "0" ]; then
  gh pr comment "$pr" --repo "$REPO" --body "<!-- gsd-tokens tokens=$tokens -->" 2>/dev/null \
    && echo "RECORDED: $tokens tokens on PR #$pr" \
    || echo "WARN: could not post token marker on PR #$pr"
fi
