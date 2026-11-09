#!/usr/bin/env bash
# Runs every reminder model config through the pinned TLC (scripts/tlc.sh) and
# compares each result with what it should be. Prints one line per config and
# exits 0 only when every result matches.
#
# Usage: bash docs/diagrams/reminder-model/check.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tlc="$here/../../../scripts/tlc.sh"

# spec|config|expected, where expected is "holds" or the rule TLC must report broken.
checks=(
  "Reminders.tla|Reminders.cfg|DueReminderStillOwed"
  "Reminders.tla|RemindersOneDevice.cfg|DueReminderStillOwed"
  "RemindersFixed.tla|RemindersFixed.cfg|holds"
  "RemindersFixed.tla|BreakSnoozeKeepsSent.cfg|SnoozeBringsItBack"
  "RemindersFixed.tla|BreakSnoozeFiresEarly.cfg|NoEarlyReminder"
  "RemindersFixed.tla|BreakRawOffsetCompare.cfg|EachReminderOnce"
)

describe() {
  if [ "$1" = "holds" ]; then echo "holds"; else echo "breaks $1"; fi
}

mismatches=0
for check in "${checks[@]}"; do
  IFS='|' read -r spec config expected <<<"$check"
  output="$(bash "$tlc" "$here/$spec" "$here/$config" 2>&1)"
  status=$?
  states="$(printf '%s\n' "$output" | sed -n 's/.* \([0-9][0-9]*\) distinct states found.*/\1/p' | tail -n 1)"
  case "$status" in
    0) actual="holds" ;;
    12) actual="$(printf '%s\n' "$output" | sed -n 's/^Error: Invariant \([A-Za-z0-9_]*\) is violated\.$/\1/p' | head -n 1)" ;;
    *) actual="TLC exit $status" ;;
  esac

  if [ "$actual" = "$expected" ]; then
    printf 'ok    %-26s %s (%s states)\n' "$config" "$(describe "$actual")" "${states:-?}"
  else
    mismatches=$((mismatches + 1))
    printf 'FAIL  %-26s expected %s, got %s. Rerun: bash scripts/tlc.sh %s %s\n' \
      "$config" "$(describe "$expected")" "$(describe "$actual")" \
      "docs/diagrams/reminder-model/$spec" "docs/diagrams/reminder-model/$config"
  fi
done

if [ "$mismatches" -gt 0 ]; then
  echo "$mismatches of ${#checks[@]} configs did not match."
  exit 1
fi
echo "All ${#checks[@]} configs match."
