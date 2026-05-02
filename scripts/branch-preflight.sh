#!/usr/bin/env bash
# branch-preflight.sh — sanity-check the working tree before starting plan execution.
#
# Catches inherited damage that would silently break verification later:
#   1. Unresolved merge-conflict markers in tracked files
#   2. Outstanding stash entries that may bleed into your work
#   3. Uncommitted changes you may not realize you have
#
# Exits 1 if any check finds something worth surfacing. Exits 0 if clean.
# Output is human-readable; pipe to /dev/null if you only care about the exit code.

set -u

red()    { printf '\033[31m%s\033[0m' "$1"; }
yellow() { printf '\033[33m%s\033[0m' "$1"; }
green()  { printf '\033[32m%s\033[0m' "$1"; }

findings=0

# --- Check 1: merge conflict markers in tracked files ---------------------
# Limit to tracked files so we don't false-positive on .claude/ scratch notes.
marker_hits=$(git ls-files -z 2>/dev/null | xargs -0 grep -lE '^(<<<<<<< |={7}$|>>>>>>> )' 2>/dev/null || true)
if [ -n "$marker_hits" ]; then
  printf '%s ' "$(red '✗')"
  printf 'Merge conflict markers in tracked files:\n'
  printf '  %s\n' $marker_hits
  findings=$((findings + 1))
else
  printf '%s ' "$(green '✓')"
  printf 'No merge conflict markers in tracked files.\n'
fi

# --- Check 2: stash entries -----------------------------------------------
stash_count=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
if [ "$stash_count" -gt 0 ]; then
  printf '%s ' "$(yellow '!')"
  printf '%s stash entr%s present:\n' "$stash_count" "$([ "$stash_count" = "1" ] && echo y || echo ies)"
  git stash list | sed 's/^/  /'
  findings=$((findings + 1))
else
  printf '%s ' "$(green '✓')"
  printf 'No stash entries.\n'
fi

# --- Check 3: uncommitted changes -----------------------------------------
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  printf '%s ' "$(yellow '!')"
  printf 'Uncommitted changes in working tree:\n'
  git status --short | sed 's/^/  /'
  findings=$((findings + 1))
else
  printf '%s ' "$(green '✓')"
  printf 'Working tree clean.\n'
fi

# --- Summary ---------------------------------------------------------------
echo
if [ "$findings" -eq 0 ]; then
  printf '%s ' "$(green '→')"
  printf 'Branch preflight clean. Safe to start plan execution.\n'
  exit 0
else
  printf '%s ' "$(red '→')"
  printf '%s finding(s). Resolve or acknowledge before starting plan execution.\n' "$findings"
  exit 1
fi
