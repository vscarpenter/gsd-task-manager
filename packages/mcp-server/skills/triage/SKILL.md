---
name: triage
description: Sort new or unsorted GSD tasks into the right Eisenhower quadrant with tags, due dates, and dependencies. Use when the user captures tasks or asks where a task belongs.
---

# Triage

Use this skill when the user captures new tasks or asks where a task belongs. Every GSD task sits in one quadrant of an Eisenhower matrix, and the quadrant should mean what it means in the apps.

## Pick the quadrant

A task's quadrant comes from two booleans, `urgent` and `important`. Set both on every `create_task` call, and the server derives the quadrant from them. Urgent means time-sensitive; important means high-value or strategic.

- Do First: urgent and important. Deadlines and real emergencies.
- Schedule: important but not urgent. Work that matters and has room to plan.
- Delegate: urgent but not important. Time-sensitive asks someone else could handle.
- Eliminate: neither. Candidates to drop.

When the user's words don't settle one of the two booleans, ask instead of guessing. To move a task later, change `urgent` or `important` with `update_task`.

## Search before you create

Call `search_tasks` first so you don't add a duplicate. It matches titles, descriptions, tags, and subtask titles, completed tasks included. If a match exists, offer to update it instead.

## Fill in the fields

- Tags are lowercase without a leading #, such as `work` or `project-alpha`. The server normalizes them and drops repeats, and a task holds up to 20.
- Links belong in the description. `create_task` moves any http(s) URL in the title into the description for you.
- Due dates are ISO 8601 datetime strings, such as `2026-12-01T17:00:00.000Z`. Pass an empty string to `update_task` to clear one.
- A reminder fires `notifyBefore` minutes before the due date, 15 by default, and 0 reminds at the due time. To turn reminders off, set `notificationEnabled` to false.

## Link dependencies

`dependencies` lists the IDs of tasks that must be completed first, up to 50. The server rejects a dependency that would create a cycle. Find the IDs with `search_tasks` or `list_tasks` before you link them.

## Preview a batch

Every write tool takes `dryRun: true`, which validates and shows the result without saving. When you sort several tasks at once, preview them and apply once the user agrees.
