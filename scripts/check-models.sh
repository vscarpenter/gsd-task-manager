#!/usr/bin/env bash
# Runs every TLA+ model under docs/. A model without a runner, or a config its
# runner never ran, fails: a check nobody runs can't catch anything.
#
# Usage: bash scripts/check-models.sh
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root" || exit 1
out="$(mktemp -d "${TMPDIR:-/tmp}/gsd-models.XXXXXX")" || exit 1
trap 'rm -rf "$out"' EXIT

models="$(find docs -name '*.tla' ! -name '*_TTrace_*' -exec dirname {} \; | sort -u)"
if [ -z "$models" ]; then
  echo "check-models.sh: found no .tla model under docs/" >&2
  exit 1
fi

workdir_for() {
  printf '%s/%s' "$out" "$(printf '%s' "$1" | tr '/' '_')"
}

# Each config gets a line in its runner's output, with or without ".cfg".
report_unrun_configs() {
  local model="$1" log="$2" cfg name missing=0
  for cfg in "$model"/*.cfg; do
    [ -e "$cfg" ] || continue
    name="$(basename "$cfg" .cfg)"
    if ! grep -Eq "(^|[[:space:]])${name}(\.cfg)?([[:space:]]|$)" "$log"; then
      echo "$name.cfg never ran: add it to $model/check.sh, with the result it should have" >&2
      missing=1
    fi
  done
  return "$missing"
}

# The counterexample is what someone needs to fix a mismatch from a CI log.
print_counterexamples() {
  local work="$1" name
  awk '$1 == "FAIL" || $1 == "MISMATCH" { print $2 }' "$work/log" | while read -r name; do
    find "$work" -name "${name%.cfg}.out" -exec tail -n 200 {} \;
  done
}

pids=()
for model in $models; do
  work="$(workdir_for "$model")"
  mkdir "$work"
  if [ -f "$model/check.sh" ]; then
    TMPDIR="$work" bash "$model/check.sh" >"$work/log" 2>&1 &
  else
    false &
  fi
  pids+=("$!")
done

failures=0
index=0
for model in $models; do
  wait "${pids[$index]}"
  status=$?
  index=$((index + 1))
  work="$(workdir_for "$model")"
  echo "== $model"
  if [ ! -f "$model/check.sh" ]; then
    echo "$model: add a check.sh that runs each config through scripts/tlc.sh and compares its result" >&2
    failures=$((failures + 1))
    continue
  fi
  cat "$work/log"
  broken=0
  if [ "$status" -ne 0 ]; then
    echo "$model: check.sh failed. Either the code broke the rule, or the model no longer describes the code." >&2
    print_counterexamples "$work"
    broken=1
  fi
  report_unrun_configs "$model" "$work/log" || broken=1
  failures=$((failures + broken))
done

if [ "$failures" -gt 0 ]; then
  echo "check-models.sh: $failures model(s) failed" >&2
  exit 1
fi
echo "check-models.sh: every model matches"
