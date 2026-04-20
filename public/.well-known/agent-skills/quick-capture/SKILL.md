# Skill: Quick Capture

Use this skill to drop a new task into GSD Task Manager from any AI assistant
that has the `gsd-mcp-server` connected.

## Trigger

Invoke when the user asks to "add a task", "remind me to", "capture", "queue
up", or similar phrasing that maps to creating a single new task.

## Steps

1. Decide quadrant from the user's wording:
   - explicit deadline today / blocking → `urgent=true, important=true`
   - long-term planning, learning, prep → `urgent=false, important=true`
   - quick favor, low value request → `urgent=true, important=false`
   - everything else → `urgent=false, important=false`
2. Call `create_task` with `{ title, urgent, important, tags?, dueAt? }`.
   Pass `dryRun: true` first when the user is exploring options.
3. If the user named a project, add it as a tag (lowercase, kebab-case).
4. Confirm the created quadrant back to the user in one short sentence.

## Anti-goals

- Do not create more than one task per invocation. Use `bulk_update_tasks` for
  batch work instead.
- Do not invent due dates the user did not state.
- Do not modify existing tasks; that belongs in the `triage-inbox` skill.
