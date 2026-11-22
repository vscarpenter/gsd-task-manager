#!/usr/bin/env bash
# PreToolUse Bash hook (matcher if=Bash(git commit*)) — blocks commits on main.
# CLAUDE.md mandates branch -> commit -> push -> PR; this enforces the branch step.
# Per audit Section 7 #5: 52% of historical sessions ran on main.
set -uo pipefail

input="$(cat)"

# Only act on commits. The text check stays broad on purpose, and a second pass
# finds commits with global options between `git` and `commit`.
command="$(printf '%s' "$input" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.tool_input?.command||'')}catch(e){}})")"
case "$command" in
  *git*commit*) ;;
  *) exit 0 ;;
esac

cwd="$(printf '%s' "$input" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.cwd||'')}catch(e){}})")"
[ -z "$cwd" ] && cwd="$(pwd)"

block_if_protected() {
  local branch
  branch="$(git -C "$1" branch --show-current 2>/dev/null || true)"
  if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
    cat <<EOF >&2
{"decision":"block","reason":"Commit blocked: the target checkout is on '$branch'. CLAUDE.md requires branch -> commit -> push -> PR. Create a feature branch first (git checkout -b <type>/<short-desc>), or pass git -C the literal path of a worktree that has one."}
EOF
    exit 2
  fi
}

common_dir() {
  git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null
}

case "$command" in
  *"git commit"*) block_if_protected "$cwd" ;;
esac

# Print each commit's directory. Matching starts at every `git`, without tracking
# outer quotes, so a stray apostrophe or a `bash -c` wrapper can't hide a commit.
targets=$(printf '%s' "$command" | node -e '
  const gap = /(?:[ \t]|\\\n)+/.source;
  const word = /(?:"(?:\\[\s\S]|[^"\\])*"|\x27[^\x27]*\x27|\\.|[^\s"\x27\;&|()<>\x60])+/.source;
  const option = "-(?:C" + gap + "(" + word + ")|c" + gap + word + "|[^cC\\s](?:" + word + ")?)";
  const commit = new RegExp("\\bgit((?:" + gap + option + ")*)" + gap + "commit(?![\\w.=/-])", "g");
  const text = require("fs").readFileSync(0, "utf8");
  for (const [, options] of text.matchAll(commit)) {
    let dir = process.argv[1];
    for (const [, path] of options.matchAll(new RegExp(gap + option, "g"))) {
      if (path === undefined) continue;
      const value = path
        .replace(/\\(.)|["\x27]/g, "$1")
        .replace(/^(?:~|\$HOME|\$\{HOME\})(?=\/|$)/, () => require("os").homedir());
      dir = require("path").resolve(dir, value);
    }
    console.log(dir);
  }
' "$cwd")

repo="$(common_dir "$(dirname "$0")")"
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  target_repo="$(common_dir "$dir")"
  if [ -z "$target_repo" ]; then
    dir="$cwd" # An unexpanded variable or missing path: judge the session's checkout.
  elif [ "$dir" != "$cwd" ] && [ "$target_repo" != "$repo" ]; then
    continue # The branch rule belongs to this repository and its worktrees.
  fi
  block_if_protected "$dir"
done <<EOF
$targets
EOF
exit 0
