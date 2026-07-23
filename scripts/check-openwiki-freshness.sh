#!/usr/bin/env bash
#
# check-openwiki-freshness.sh — non-blocking OpenWiki staleness check.
#
# Reports (but NEVER fails) when doc-affecting source has changed since OpenWiki last
# documented the repo. It compares the gitHead recorded in openwiki/.last-update.json
# against a target ref (default: HEAD) over the same doc-affecting paths that trigger
# .github/workflows/openwiki-update.yml.
#
# This is informational only: openwiki-update.yml (nightly + post-merge) is what actually
# refreshes the docs. A hard failure here would red-X every feature PR until the doc bot
# catches up, so the script always exits 0.
#
# Usage:  scripts/check-openwiki-freshness.sh [TARGET_REF]
# Under GitHub Actions it emits ::warning:: annotations on drift.

set -uo pipefail

LAST_UPDATE_FILE="openwiki/.last-update.json"
TARGET_REF="${1:-HEAD}"

# Doc-affecting paths — keep in sync with the push filter in openwiki-update.yml.
PATHS=(app components lib packages scripts docker docs '*.md' package.json next.config.ts)
# Subtract OpenWiki's own output so its update PRs never register as "drift"
# (openwiki/*.md would otherwise match the '*.md' glob above).
EXCLUDES=(':(exclude)openwiki' ':(exclude)scripts/build-openwiki-site.cjs')

note() { printf '%s\n' "$*"; }
warn() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    printf '::warning::%s\n' "$*"
  else
    printf 'WARN: %s\n' "$*"
  fi
}

if [ ! -f "$LAST_UPDATE_FILE" ]; then
  warn "No $LAST_UPDATE_FILE; run 'bunx openwiki --update' to initialize the docs."
  exit 0
fi

# Extract the recorded commit sha without a jq dependency.
LAST_HEAD="$(grep -oE '"gitHead"[[:space:]]*:[[:space:]]*"[0-9a-fA-F]{7,40}"' "$LAST_UPDATE_FILE" \
             | grep -oE '[0-9a-fA-F]{7,40}' | head -1)"

if [ -z "$LAST_HEAD" ]; then
  warn "Could not read gitHead from $LAST_UPDATE_FILE; skipping freshness check."
  exit 0
fi

if ! git cat-file -e "${LAST_HEAD}^{commit}" 2>/dev/null; then
  warn "OpenWiki's recorded commit ${LAST_HEAD:0:12} is not in history (shallow clone / rebased); skipping."
  exit 0
fi

CHANGED="$(git diff --name-only "$LAST_HEAD" "$TARGET_REF" -- "${PATHS[@]}" "${EXCLUDES[@]}" 2>/dev/null)"

if [ -z "$CHANGED" ]; then
  note "OpenWiki is fresh: no doc-affecting changes since ${LAST_HEAD:0:12}."
  exit 0
fi

COUNT="$(printf '%s\n' "$CHANGED" | grep -c '')"
warn "OpenWiki docs may be stale: ${COUNT} doc-affecting file(s) changed since ${LAST_HEAD:0:12}."
note "Changed files:"
printf '%s\n' "$CHANGED" | sed 's/^/  - /'
note ""
note "Fix: the post-merge 'OpenWiki Update' workflow will refresh these, or run"
note "'bunx openwiki --update' locally, then 'bun run build:docs', and commit the result."
exit 0
