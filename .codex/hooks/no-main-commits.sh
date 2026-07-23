#!/usr/bin/env bash
# PreToolUse Bash hook (matcher if=Bash(git commit*)) — blocks commits on main.
# CLAUDE.md mandates branch -> commit -> push -> PR; this enforces the branch step.
# Per audit Section 7 #5: 52% of historical sessions ran on main.
set -uo pipefail

input="$(cat)"

# Only act on actual `git commit` commands. The matcher `if` in settings.json is
# meant to scope this hook to commits, but not all runners honor it — so we also
# inspect the command here to avoid blocking unrelated Bash (e.g. branch creation).
command="$(printf '%s' "$input" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.tool_input?.command||'')}catch(e){}})")"
case "$command" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cwd="$(printf '%s' "$input" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.cwd||'')}catch(e){}})")"
[ -z "$cwd" ] && cwd="$(pwd)"

branch="$(git -C "$cwd" branch --show-current 2>/dev/null || true)"

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  cat <<EOF >&2
{"decision":"block","reason":"Commit blocked: you are on '$branch'. CLAUDE.md requires branch -> commit -> push -> PR. Create a feature branch first (git checkout -b <type>/<short-desc>)."}
EOF
  exit 2
fi
exit 0
