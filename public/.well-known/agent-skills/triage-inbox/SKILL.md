# Skill: Triage Inbox

Use this skill to walk the user through their unfiled or stale tasks and move
them into the right Eisenhower quadrant.

## Trigger

Invoke when the user asks to "triage", "clean up my inbox", "what should I
work on", or "review my open tasks".

## Steps

1. Call `list_tasks` with `status: "open"` and sort by `client_updated_at` asc.
2. Call `get_task_stats` to surface quadrant distribution and stale counts.
3. For each task older than 7 days with `urgent=false, important=false`,
   suggest archive or completion. Use `complete_task` or `delete_task` only
   after the user confirms each action.
4. For tasks the user reclassifies, call `update_task` with the new
   `urgent` / `important` flags. Prefer `bulk_update_tasks` when applying the
   same change to 3+ tasks.
5. End with a one-line summary of how the quadrants shifted.

## Anti-goals

- Never auto-delete tasks without explicit user confirmation per task or batch.
- Do not change `dueAt` during triage; the user may need that history.
- Do not mark recurring tasks complete unless the user asks; completing one
  silently spawns the next instance.
