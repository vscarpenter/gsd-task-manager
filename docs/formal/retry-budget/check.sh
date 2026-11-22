#!/usr/bin/env bash
# Model-checks the retry budget model: every config in this folder, each
# against the result it should give. Prints one line per config and exits 0
# only when every result matches.
#
# Usage: bash docs/formal/retry-budget/check.sh
#
# A config expects "holds" (TLC exits 0) or the name of the one rule TLC
# reports broken first (TLC exits 12). TLC's output for each config is kept in
# the folder the last line prints, so a mismatch can be read with /statechart.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
out="$(mktemp -d "${TMPDIR:-/tmp}/retry-budget.XXXXXX")"

# config:expected result
expectations=(
  "RetryBudget:holds"
  "Proposed-transientFree:holds"
  "Finding-outageTrashes:OutageNeverTrashes"
  "Broken-exhaustedRowDeleted:NoSilentLoss"
  "Broken-refusedCharges:RefusedKeepsBudget"
  "Broken-failedRowDropped:NoSilentLoss"
  "Broken-failedRowShields:FailedRowNeverShields"
)

failures=0
for entry in "${expectations[@]}"; do
  config="${entry%%:*}"
  expected="${entry#*:}"
  log="$out/$config.out"
  set +e
  bash "$root/scripts/tlc.sh" "$here/RetryBudget.tla" "$here/$config.cfg" > "$log" 2>&1
  status=$?
  set -e

  case "$status" in
    0) got="holds" ;;
    12) got="$(sed -nE 's/^Error: Invariant ([A-Za-z]+) is violated.*/\1/p' "$log" | head -1)" ;;
    *) got="error $status" ;;
  esac
  states="$(sed -nE 's/^([0-9]+) states generated, ([0-9]+) distinct states found.*/\2/p' "$log" | tail -1)"

  if [ "$got" = "$expected" ]; then
    verdict="ok  "
  else
    verdict="FAIL"
    failures=$((failures + 1))
  fi
  printf '%s %-28s expected %-22s got %-22s %6s states\n' \
    "$verdict" "$config" "$expected" "$got" "${states:-?}"
done

echo "TLC output: $out"
if [ "$failures" -gt 0 ]; then
  echo "$failures config(s) did not match. Read each one's output with /statechart." >&2
  exit 1
fi
