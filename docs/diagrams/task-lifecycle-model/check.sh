#!/usr/bin/env bash
# Runs every task lifecycle config through scripts/tlc.sh against the result it
# should have. The two recurring breaks await the owner's decision on
# WEB-UNCHECK-REPEATING and WEB-UNDO-COMPLETE-TRASH.
#
# Usage: bash docs/diagrams/task-lifecycle-model/check.sh
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
tlc="$here/../../../scripts/tlc.sh"
out="$(mktemp -d "${TMPDIR:-/tmp}/task-lifecycle.XXXXXX")" || exit 1

# config:expected, where expected is "holds" or the first rule TLC reports broken.
expectations=(
  "TaskLifecycle:holds"
  "TaskLifecycleRecurringBoard:OneOpenCopy"
  "TaskLifecycleRecurring:OneOpenCopy"
)

failures=0
for entry in "${expectations[@]}"; do
  config="${entry%%:*}"
  expected="${entry#*:}"
  log="$out/$config.out"
  bash "$tlc" "$here/TaskLifecycle.tla" "$here/$config.cfg" >"$log" 2>&1
  status=$?
  case "$status" in
    0) got="holds" ;;
    12) got="$(sed -nE 's/^Error: Invariant ([A-Za-z]+) is violated.*/\1/p' "$log" | head -1)" ;;
    *) got="error-$status" ;;
  esac
  if [ "$got" = "$expected" ]; then
    verdict="ok  "
  else
    verdict="FAIL"
    failures=$((failures + 1))
  fi
  printf '%s %-29s expected %-12s got %s\n' "$verdict" "$config" "$expected" "$got"
done

echo "TLC output: $out"
[ "$failures" -eq 0 ]
