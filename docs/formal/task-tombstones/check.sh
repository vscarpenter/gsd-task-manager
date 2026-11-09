#!/usr/bin/env bash
# Model-checks the task tombstone model: every config in this folder, each
# against the result it should give. Prints one line per config and exits 0
# only when every result matches.
#
# Usage: bash docs/formal/task-tombstones/check.sh
#
# A config expects "holds" (TLC exits 0) or the name of the one rule TLC
# reports broken first (TLC exits 12). TLC's output for each config is kept in
# the folder the last line prints, so a mismatch can be read with /statechart.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
out="$(mktemp -d "${TMPDIR:-/tmp}/task-tombstones.XXXXXX")"

# config:expected result
expectations=(
  "TaskTombstones:OneTable"
  "Fixed:holds"
  "Finding-1-import:OneTable"
  "Finding-2-undo:OneTable"
  "Finding-3-reinstate:OneTable"
  "Finding-4-stale-write:ServerStaysDeleted"
  "Finding-5-stale-delete:NoLoss"
  "Finding-6-config-read:NoComeback"
  "Finding-6-config-read-loss:NoLoss"
  "Broken-restoreKeepsTrashRow:OneTable"
  "Broken-pullSkipsTrashGuard:NoComeback"
  "Broken-absoluteTombstone:NewerEditWins"
  "Broken-resurrectSkipsDelete:NoComeback"
  "Broken-reconcileSkipsQueue:NoLoss"
)

failures=0
for entry in "${expectations[@]}"; do
  config="${entry%%:*}"
  expected="${entry#*:}"
  log="$out/$config.out"
  start=$(date +%s)
  set +e
  bash "$root/scripts/tlc.sh" "$here/TaskTombstones.tla" "$here/$config.cfg" > "$log" 2>&1
  status=$?
  set -e
  seconds=$(( $(date +%s) - start ))

  case "$status" in
    0) got="holds" ;;
    12) got="$(sed -nE 's/^Error: Invariant ([A-Za-z]+) is violated.*/\1/p' "$log" | head -1)" ;;
    *) got="error $status" ;;
  esac
  states="$(sed -nE 's/.* ([0-9]+) distinct states found.*/\1/p' "$log" | tail -1)"

  if [ "$got" = "$expected" ]; then
    verdict="ok  "
  else
    verdict="FAIL"
    failures=$((failures + 1))
  fi
  printf '%s %-28s expected %-18s got %-18s %8s states %4ss\n' \
    "$verdict" "$config" "$expected" "$got" "${states:-?}" "$seconds"
done

echo "TLC output: $out"
if [ "$failures" -gt 0 ]; then
  echo "$failures config(s) did not match. Read each one's output with /statechart." >&2
  exit 1
fi
