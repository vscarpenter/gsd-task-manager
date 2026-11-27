---
name: safe-cleanup
description: Delete or bulk-edit GSD tasks without losing work the user meant to keep. Use when the user deletes, cleans up, or changes many tasks at once.
---

# Safe cleanup

Use this skill when the user deletes tasks, cleans up their list, or changes many tasks at once. A GSD delete is permanent. It skips the 30-day Trash on every client, so the web, iOS, and Android apps can't restore the task.

## Delete only what the user asked

Delete only what the user asked to delete. When they ask to clean up, list the candidates and let them choose. If they mean "I'm done with it", `complete_task` may be what they want, and it keeps the history.

## Preview first

`delete_task` and a bulk delete default to `dryRun: true`, which shows what would be deleted without deleting it. Run that preview, show the user the titles, and pass `dryRun: false` only after they agree.

## Expect a confirmation from some clients

Some clients also ask the user to confirm in their own dialog before the delete runs. Others delete as soon as you pass `dryRun: false`, so your preview may be the only check. A reply starting "Not deleted:" means the user declined or the task changed after the preview. Report it, and don't retry on your own.

## Bulk changes

`bulk_update_tasks` completes, moves, tags, re-dates, or deletes up to 50 tasks per call, or 10 deletes. Split a bigger job into batches. Only deletes default to a preview; every other bulk operation saves unless you pass `dryRun: true`, so preview those yourself.

## Dependencies

Deleting a task removes its ID from the `dependencies` of every task that depended on it, so nothing points at a missing task. Those tasks are no longer blocked by it, so mention them when the task you're deleting blocks others.

## Conflicts

A conflict means the task changed elsewhere after you read it, often in an app on another device. Read it again with `get_task` and check with the user before you retry. A bulk call reports each conflicted task and applies the rest.
