# Claude Code Setup — gsd-taskmanager

How this repo's Claude Code configuration works, what each piece does, and the workflows it enables.

> Last reviewed: 2026-04-25 · Baseline established by `claude-code-setup` plugin recommender

---

## TL;DR for new contributors

After cloning, do these three things:

1. **Copy the MCP config template:**
   ```sh
   cp .mcp.json.example .mcp.json
   ```
2. **Export your GitHub PAT** so the GitHub MCP server can authenticate:
   ```sh
   export GITHUB_PAT="ghp_..."  # add to ~/.zshrc or ~/.bashrc
   ```
3. **(Optional) Customize your local permissions** in `.claude/settings.local.json`. This file is gitignored — your prompts are different from everyone else's.

That's it. Open the repo in Claude Code and the hooks, agents, slash commands, and MCP servers all activate.

---

## What lives where

| Path | Checked in? | Purpose |
|------|:-:|---------|
| `.claude/settings.json` | ✓ | Hooks + minimum allowlist for the team |
| `.claude/settings.local.json` | — | YOUR personal allowlist; gitignored |
| `.claude/agents/*.md` | ✓ | Specialized reviewer subagents |
| `.claude/commands/*.md` | ✓ | Project-level slash commands |
| `.claude/skills/*/SKILL.md` | ✓ | Reusable multi-step workflows |
| `.claude/hooks/*.sh` | ✓ | Shell scripts invoked by hooks |
| `.claude/decisions/` | — | Personal decision log; gitignored |
| `.mcp.json` | — | MCP server config; gitignored (personal) |
| `.mcp.json.example` | ✓ | Sanitized template — copy to `.mcp.json` on setup |
| `CLAUDE.md` | ✓ | Project conventions Claude reads on every session |
| `coding-standards.md` | ✓ | The standards Claude enforces |

**Rule of thumb:** if it's a *team* convention, it's checked in. If it's *your* preference or contains anything sensitive, it stays local.

---

## Hooks (automatic — fire without you asking)

Three hooks run automatically. You don't invoke them; Claude Code does.

### `PreToolUse` — `block-sensitive-files.sh`
**Fires before:** every `Edit`, `Write`, or `MultiEdit` operation.
**Blocks (exits with code 2):**
- `.env*` files (any environment file)
- `bun.lock`, `package-lock.json`, `pnpm-lock.yaml` (regenerate via package manager)
- `gitleaks-report.json`
- `setup-pocketbase-collections.sh`, `update-pocketbase-tasks-schema.sh` (mutate prod PB schema)

If you genuinely need to edit one of these, tell Claude in plain language and edit it yourself outside the conversation, or extend the script's `case` block.

### `PostToolUse` — `lint-on-edit.sh`
**Fires after:** every successful `Edit`, `Write`, or `MultiEdit` on a `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, or `.cjs` file.
**Runs:** `bunx eslint --fix <path>` and pipes the last 20 lines back into the conversation.
**Skips:** files under `node_modules/`, `.next/`, `out/`, `coverage/`, and `next-env.d.ts`.

This catches style violations and auto-fixes safe ones (semicolons, quote style, unused imports) before they pile up.

### `Stop` — type-check gate
**Fires when:** the conversation ends.
**Runs:** `bun typecheck` and reports the last 10 lines.

This is a fast last-line-of-defense check (~3-5s) that catches type regressions before you discover them in CI. **Note:** the full Vitest suite is *not* run automatically — that's deliberate (it took 30s+ on every conversation end). Run `bun run test` manually before pushing.

### Disabling a hook temporarily

Comment out the relevant block in `.claude/settings.json`:
```json
"PostToolUse": []  // disabled for this session
```
Restart the conversation to apply.

---

## Subagents (invoke when you need them)

Subagents are specialized reviewers that run in isolation. They protect the main context window from noise and produce focused findings.

### `a11y-reviewer`
**When to use:** after editing any `.tsx`/`.jsx` file in `components/` or `app/`.
**What it checks:** WCAG AA baseline from `coding-standards.md` Part 2 — semantic HTML, keyboard accessibility (especially dnd-kit and Radix dialogs), form labels, image alt text, color-only state, contrast, modal focus.
**How to invoke:** ask Claude "review the components I just changed for accessibility" or `Use the a11y-reviewer subagent on <files>`.
**Returns:** structured findings as `file:line — issue — fix`. Read-only — does not modify code.

### `pb-sync-reviewer`
**When to use:** after editing anything under `lib/sync/**` or sync-related code in `lib/tasks/**`.
**What it checks:** all 10 PocketBase v0.23+ gotchas from `CLAUDE.md` — `client_updated_at` (not `updated`) in sort/filter, `_superusers` admin endpoint, LWW resolution, echo filtering, 100ms push throttle, batch lookups (no N+1), proper field mapping via `task-mapper.ts`, structured logging via `lib/logger.ts`.
**How to invoke:** "review my sync changes" or explicitly name the subagent.
**Returns:** findings tied to specific gotcha rules. Read-only.

---

## Slash Commands (project-level workflows)

The three commands form a TDD-driven feature workflow when used in order.

### `/qspec <feature description>`
Writes a Spec-Driven Development spec to `tasks/spec.md`. Includes Goal, Inputs/Outputs, Constraints, Edge Cases, Out of Scope, Acceptance Criteria, and Test Stubs. **Does not write any code.** Wait for spec approval before moving on.

**Example:**
```
/qspec add a "remind me later" snooze field that syncs across devices
```

### `/tdd <behavior description>`
Starts a strict red/green/refactor cycle. Writes a failing test first, pauses for your approval, then writes the minimum implementation. If you touch `lib/sync/**`, it auto-invokes `pb-sync-reviewer` before refactor; if you touch `components/`, it auto-invokes `a11y-reviewer`.

**Example:**
```
/tdd snooze field round-trips through PocketBase mapper
```

### `/qcheck`
Skeptical staff-engineer review of changed files. Checks file/function size limits, type safety, test quality, project-specific gotchas (PB, schema `safeParse` vs `parse`, `bun run test` not `bun test`, sonner `toast.error()` not `alert()`), security, and the Definition of Done from `coding-standards.md`.

**Use it before:** every PR.
```
/qcheck
```

---

## Skills (reusable multi-step workflows)

### `pb-collection` (user-only)
End-to-end workflow for adding/modifying a field on the PocketBase `tasks` collection. Walks through 10 ordered steps: Zod schema → task-mapper → PocketBase script → Dexie version bump → CRUD → sync engine → MCP server → tests → verification gate → commit. Codifies all the recurring step-order mistakes.

**When to use:** any change to the synced task schema. Don't use for local-only Dexie fields.
**Invoke:** `Skill(pb-collection)` (it's marked `disable-model-invocation: true`, so Claude won't auto-trigger — you have to ask for it).

### `ui-ux-pro-max`
Reference design system already in your config — 67 styles, 96 palettes, 57 font pairings. Useful when designing new components.

---

## MCP Servers

Configured in `.mcp.json` (gitignored). Currently 5 servers:

| Server | Purpose | Notes |
|--------|---------|-------|
| `next-devtools` | Next.js 16 devtools integration | Auto-loaded |
| `aws-mcp` | AWS docs + API access | For CloudFront/S3 deploy work |
| `github` | GitHub PRs, issues, releases | **Requires `GITHUB_PAT` env var** |
| `context7` | Live docs for libraries | Useful for Next.js 16 / React 19 / Zod 4 (post-cutoff) |
| `playwright` | Browser automation | For "verify in browser" workflows |

**Setting up the GitHub MCP:** export `GITHUB_PAT` in your shell. The token needs `repo`, `read:org`, and `workflow` scopes for typical use.

```sh
echo 'export GITHUB_PAT="ghp_..."' >> ~/.zshrc
source ~/.zshrc
```

Restart Claude Code after changing the token (MCP servers read env vars at startup, not per-call).

---

## Permissions

Two files contribute to the effective allowlist:

- **`.claude/settings.json`** (checked in) — minimum permissions for everyone on the team. Currently 6 entries: `bun typecheck`, `bun lint`, `bun audit`, `bun outdated`, and two read-only `claude-in-chrome` tools.
- **`.claude/settings.local.json`** (gitignored) — your personal allowlist. Currently ~101 entries.

### What NOT to add to `settings.json`

The team-shared file should only contain things every contributor benefits from. Don't add:
- Personal preferences (`Bash(open:*)`, `Bash(defaults read:*)`)
- Risky wildcards (`Bash(rm:*)`, `Bash(node:*)`, `Bash(curl:*)`)
- Anything Claude Code already auto-allows (`Bash(cat:*)`, `Bash(ls:*)`, `Bash(git status:*)`, `Bash(grep:*)`, etc. — see [the auto-allowed list](https://docs.claude.com/en/docs/claude-code/settings))

### Maintenance

The allowlist drifts over time as one-shot literal commands and parser-artifact junk accumulate. Run the `fewer-permission-prompts` skill quarterly:

```
Skill(fewer-permission-prompts)
```

A calendar reminder fires on **2026-05-25** to do this. Baseline as of last prune: 101 entries. If you're significantly above that, it's time.

---

## Common Workflows

### Feature: add a new field that syncs across devices
1. `/qspec add <field> to tasks` — write the spec
2. `Skill(pb-collection)` — walks through all 10 layers
3. `/qcheck` — final review before PR
4. Commit + push + PR (the `commit-push-pr` skill is allowlisted)

### Feature: add a new UI component
1. `/qspec <component> for <use case>`
2. `/tdd <component> renders correctly with <prop>` — RGR cycle, auto-invokes `a11y-reviewer`
3. Manual verification: `bun dev` + Playwright MCP or `claude-in-chrome` to test the golden path
4. `/qcheck` → commit

### Bug: PocketBase sync misbehaving
1. Reproduce with a failing test in `tests/data/sync-*.test.ts` (red)
2. Diagnose using the `pb-sync-reviewer` subagent on the suspect file
3. Fix, then re-run the test (green)
4. `/qcheck` → commit

### Reviewing someone else's PR
1. `gh pr checkout <number>`
2. `/qcheck` runs the full skeptical review against the diff
3. If sync code: also invoke `pb-sync-reviewer`
4. If UI code: also invoke `a11y-reviewer`

---

## Troubleshooting

### "The PostToolUse hook didn't fire"
- It only fires on `Edit`, `Write`, `MultiEdit` — not `Read` or `Bash`.
- Check the file extension: it only lints `.ts/.tsx/.js/.jsx/.mjs/.cjs`.
- Restart Claude Code if you just changed `settings.json` — hooks load at session start.

### "MCP server isn't responding"
- Check `~/.claude/logs/` for startup errors.
- For GitHub: confirm `echo $GITHUB_PAT` returns your token *in the shell that started Claude Code* (not in a new terminal tab).
- Restart Claude Code after exporting a new token.

### "I'm getting permission prompts for commands I run constantly"
- Look at the prompt text — Claude Code shows the exact pattern needed to allowlist.
- Add it to `settings.local.json`, not `settings.json`, unless it benefits everyone.
- For arbitrary code-execution wildcards (`Bash(node:*)`, `Bash(curl:*)`), accept the prompts rather than allowlist — the friction is the point.

### "The Stop hook is failing my session"
- Check the bottom of the conversation for `bun typecheck` errors. Fix them, then start a new conversation.
- If you need to bypass temporarily, comment out the `Stop` block in `settings.json` for that session.

### "I want to add a new subagent"
- Drop a `.md` file in `.claude/agents/` with this frontmatter:
  ```yaml
  ---
  name: my-agent
  description: When to use this agent (Claude reads this to decide when to invoke).
  model: sonnet
  tools: Read, Grep, Glob, Bash
  ---
  ```
- Body of the file is the agent's system prompt. Restart Claude Code.

### "I want to add a new slash command"
- Drop a `.md` file in `.claude/commands/`. Filename = command name (e.g., `qcheck.md` → `/qcheck`).
- Optional frontmatter: `---\ndescription: short description\n---`.
- Use `$ARGUMENTS` to access arguments passed after the command.

---

## Checked-in artifacts (commit list reference)

If you're reviewing the initial setup PR, these are the files that should be added:

```
.claude/README.md                       (this file)
.claude/settings.json
.claude/agents/a11y-reviewer.md
.claude/agents/pb-sync-reviewer.md
.claude/commands/qspec.md
.claude/commands/qcheck.md
.claude/commands/tdd.md
.claude/skills/pb-collection/SKILL.md
.claude/hooks/block-sensitive-files.sh
.claude/hooks/lint-on-edit.sh
```

Plus the sanitized template:
```
.mcp.json.example
```

Files that should remain gitignored (handled by `.gitignore`):
```
.claude/settings.local.json
.claude/decisions/
.claude/worktrees/
.claude/skills/ui-ux-pro-max/    (personal/global skill cache)
.mcp.json                        (personal MCP config; use .mcp.json.example as template)
```

---

## Maintenance schedule

| Cadence | Action |
|---------|--------|
| Every PR | `/qcheck` |
| Weekly | Review `tasks/lessons.md` for new patterns to capture in `CLAUDE.md` |
| Monthly | Check `bun outdated` and `bun audit` |
| Quarterly | Run `Skill(fewer-permission-prompts)` to prune `settings.local.json` |
| Per-feature | `/qspec` → `/tdd` → `/qcheck` cycle |

---

## Further reading

- `CLAUDE.md` — project conventions Claude loads automatically every session
- `coding-standards.md` — the full standards Claude enforces (10 parts, ~600 lines)
- `tasks/lessons.md` — accumulated learnings from prior sessions
- [Claude Code docs](https://docs.claude.com/en/docs/claude-code) — hooks, agents, MCP server reference
