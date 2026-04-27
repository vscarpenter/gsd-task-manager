#!/usr/bin/env bash
# PostToolUse hook — runs eslint --fix on edited TS/JS files.
# Reads Claude Code hook JSON from stdin; never blocks (always exits 0).
set -uo pipefail

input="$(cat)"
path="$(printf '%s' "$input" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.tool_input?.file_path||'')}catch(e){}})")"

# Only lint TS/JS source files.
case "$path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

# Skip generated, vendored, and config files.
case "$path" in
  */node_modules/*|*/.next/*|*/out/*|*/coverage/*|*next-env.d.ts) exit 0 ;;
esac

cd /Users/vinnycarpenter/Projects/gsd-taskmanager
bunx eslint --fix "$path" 2>&1 | tail -20 || true
exit 0
