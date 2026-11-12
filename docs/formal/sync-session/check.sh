#!/usr/bin/env bash
# Runs every sync-session config through scripts/tlc.sh and compares each
# result to the outcome it expects. Prints one line per config and exits 0
# only when every result matches.
#
# Usage: bash docs/formal/sync-session/check.sh
#
# A mismatch keeps TLC's output and prints where it is. A "pass" expectation
# means TLC found no error. Any other expectation names the invariant that
# must break first.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
spec="$here/SyncSession.tla"

# config | expected outcome | why
expectations=(
  "SyncSession.cfg|DeviceHoldsOnlyTheSignedInAccount|the code today: findings 2 to 4"
  "SyncSessionFixed.cfg|pass|the code with findings 2 to 4 fixed too"
  "GapSignOutRead.cfg|NoRecordInAnotherAccount|finding 2: sign-out reads sync_config early"
  "GapSettingsWrite.cfg|NoRecordInAnotherAccount|finding 3: Settings writes a stale sync_config"
  "GapPopulate.cfg|NoRecordInAnotherAccount|finding 4: populate runs after sign-in commits"
  "BrokenPullFence.cfg|DeviceHoldsOnlyTheSignedInAccount|broken: pull without the fence"
  "BrokenSignInGuard.cfg|DeviceHoldsOnlyTheSignedInAccount|broken: sign-in without the owner check"
  "BrokenPushPrincipal.cfg|NoRecordInAnotherAccount|broken: push without the principal check"
  "BrokenPushQueueFence.cfg|NoRecordInAnotherAccount|broken: push reads the queue without the fence"
)

out_dir="$(mktemp -d "${TMPDIR:-/tmp}/sync-session-check.XXXXXX")"
keep_output=0
cleanup() {
  if [ "$keep_output" -eq 0 ]; then rm -rf "$out_dir"; fi
}
trap cleanup EXIT

outcome_of() {
  local log="$1"
  local broken
  broken="$(sed -n 's/^Error: Invariant \([A-Za-z0-9_]*\) is violated.*/\1/p' "$log" | head -n 1)"
  if [ -n "$broken" ]; then
    printf '%s' "$broken"
  elif grep -q "^Error: Deadlock reached" "$log"; then
    printf 'deadlock'
  elif grep -q "^Model checking completed. No error has been found." "$log"; then
    printf 'pass'
  else
    printf 'tlc-error'
  fi
}

states_of() {
  sed -n 's/.* \([0-9]*\) distinct states found.*/\1/p' "$1" | tail -n 1
}

failures=0
for row in "${expectations[@]}"; do
  IFS='|' read -r config expected why <<<"$row"
  log="$out_dir/${config%.cfg}.out"
  start=$SECONDS
  bash "$repo/scripts/tlc.sh" "$spec" "$here/$config" >"$log" 2>&1
  got="$(outcome_of "$log")"
  elapsed=$((SECONDS - start))
  states="$(states_of "$log")"
  if [ "$got" = "$expected" ]; then
    status="ok"
  else
    status="MISMATCH"
    failures=$((failures + 1))
    keep_output=1
  fi
  printf '%-8s %-24s expected %-34s got %-34s %8s states %3ss  (%s)\n' \
    "$status" "$config" "$expected" "$got" "${states:-?}" "$elapsed" "$why"
done

if [ "$failures" -gt 0 ]; then
  echo "check.sh: $failures config(s) did not match. TLC output is in $out_dir"
  exit 1
fi
echo "check.sh: every config matched"
