#!/usr/bin/env bash
# Checks the sync convergence model: runs every config through scripts/tlc.sh
# and compares each result with the outcome it should have.
#
# Usage: bash docs/formal/sync-convergence/check.sh [CONFIG ...]
#   With no arguments it runs every config below. Name configs (without .cfg)
#   to run only those.
#
# Prints one line per config and exits 0 only when every result matches.
# TLC's full output for each config, including any counterexample, stays in
# the folder printed at the end.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
spec="$here/SyncConvergence.tla"

# config name, then the outcome it should have: "holds", or the invariant
# TLC should report as broken.
expected() {
  cat <<'EOF'
SyncConvergence holds
FastClockHoldOff holds
FindingOtherTaskCursor QuietMeansSameCopy
FindingPushRace QuietMeansSameCopy
FindingRetriesRunOut QuietMeansSameCopy
FindingFastClock QuietMeansSameCopy
BrokenPushOverwritesNewer QuietMeansNewestEdit
BrokenFailedPushDropsRow QuietMeansNewestEdit
BrokenCursorFollowsClock QuietMeansSameCopy
BrokenApplyIgnoresStamps UnsentEditStays
BrokenNoHoldOff UnsentEditStays
EOF
}

picks=" $* "
wanted() {
  [ "$picks" = "  " ] && return 0
  case "$picks" in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

out_dir="$(mktemp -d "${TMPDIR:-/tmp}/sync-convergence.XXXXXX")"
failures=0
ran=0

while read -r name want; do
  wanted "$name" || continue
  ran=$((ran + 1))
  out="$out_dir/$name.out"
  set +e
  bash "$repo/scripts/tlc.sh" "$spec" "$here/$name.cfg" >"$out" 2>&1
  status=$?
  set -e

  states="$(grep -Eo '[0-9]+ distinct states found' "$out" | tail -1 | cut -d' ' -f1)"
  case "$status" in
    0) got="holds" ;;
    12) got="$(grep -Eo 'Invariant [A-Za-z]+ is violated' "$out" | head -1 | cut -d' ' -f2)" ;;
    *) got="error(exit $status)" ;;
  esac

  if [ "$got" = "$want" ]; then
    verdict="ok  "
  else
    verdict="FAIL"
    failures=$((failures + 1))
  fi
  if [ "$want" = "holds" ]; then shown_want="holds"; else shown_want="breaks $want"; fi
  if [ "$got" = "holds" ] || [ "${got#error}" != "$got" ]; then shown_got="$got"; else shown_got="breaks $got"; fi
  printf '%s %-26s expected %-28s got %-28s %s states\n' \
    "$verdict" "$name" "$shown_want" "$shown_got" "${states:-?}"
done < <(expected)

if [ "$ran" -eq 0 ]; then
  echo "check.sh: no config matched: $*" >&2
  exit 2
fi
echo "TLC output: $out_dir"
if [ "$failures" -gt 0 ]; then
  echo "check.sh: $failures of $ran configs did not match" >&2
  exit 1
fi
echo "check.sh: all $ran configs match"
