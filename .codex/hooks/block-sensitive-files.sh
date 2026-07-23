#!/usr/bin/env bash
# PreToolUse hook — blocks Edit/Write to sensitive files.
# Reads Claude Code hook JSON from stdin; exits 2 to block, 0 to allow.
set -euo pipefail

input="$(cat)"
path="$(printf '%s' "$input" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.tool_input?.file_path||j.tool_input?.path||'')}catch(e){}})")"

# Empty path = nothing to check.
[ -z "$path" ] && exit 0

# Sensitive file patterns. Add to this list as needed.
case "$path" in
  *.env|*.env.*|*/.env|*/.env.*)
    echo "Blocked: $path is an env/secrets file. Edit manually if intentional." >&2
    exit 2
    ;;
  */gitleaks-report.json|*/bun.lock|*/package-lock.json|*/pnpm-lock.yaml)
    echo "Blocked: $path is a generated/lock file. Regenerate via the package manager." >&2
    exit 2
    ;;
  */setup-pocketbase-collections.sh|*/update-pocketbase-tasks-schema.sh)
    echo "Blocked: $path mutates production PocketBase schema. Edit manually if intentional." >&2
    exit 2
    ;;
esac

exit 0
