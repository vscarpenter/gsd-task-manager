---
name: claude-code-primitives
description: Reference for Claude Code's own mechanics — slash commands, skills, subagents, hooks — and how they route together. Use when creating or editing a slash command, skill, subagent, or hook, or when deciding which primitive fits a task.
---

## Claude Code Primitives

* **Routing:** Commands initiate, subagents verify, hooks gate.
* **Slash Commands (`.claude/commands/`):** Short, repeatable actions. Canonical text of prompts lives here (e.g., `/qspec`, `/tdd`, `/qcheck`).
* **Skills (`.claude/skills/`):** Complex multi-step workflows. Write descriptions as triggers ("when should I fire?"). Provide goals, constraints, and a "Gotchas" section.
* **Subagents (`.claude/agents/`):** Spawn for fanning out or parallel reads. Skip for <3 tool calls. Read-only agents use `haiku`; write agents use `sonnet`/`opus` with `isolation: worktree`.
* **Agent teams vs subagents:** Use subagents for scoped delegation inside one workstream. Use teams when work should split across longer-lived sessions that coordinate.
* **Hooks:** Enforce standards mechanically (e.g., `PostToolUse`, `Stop`). Hook types: shell commands, prompt hooks, MCP tool hooks.
* Hooks receive event data as JSON on stdin. Read fields with `jq`, for example `.tool_input.file_path`; do not rely on `$CLAUDE_FILE_PATH` style variables unless explicitly configured.
