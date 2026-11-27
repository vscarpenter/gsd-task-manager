---
name: daily-plan
description: Plan the user's day from their GSD tasks, starting with their top three, what's urgent, and what's due. Use when the user plans the day or asks what to work on now.
---

# Daily plan

Use this skill when the user plans the day, asks for a standup, or asks what to work on now.

## Start with the user's top three

Call `get_top_three` first. Its `picks` are up to three tasks the user chose for today in a GSD app, in rank order, and they anchor the plan. Only the user chooses them, and no tool can set them, so never present your own choice as a pick.

When `picks` is empty, the user hasn't chosen yet. Offer the `suggestions` instead, labeled as suggestions, and invite the user to pick in the app. When `needsTidy` is true, two picks share a rank or there are more than three, so mention it. Pass `timeZone`, an IANA name such as `America/Chicago`, when the user's day differs from this machine's.

## Check deadlines

Call `get_upcoming_deadlines` for tasks that are overdue, due today, and due this week. Lead with overdue tasks, then what's due today.

## Focus on Do First

To answer "what should I do now", narrow to Do First tasks, the ones both urgent and important. Call `list_tasks` with `quadrant: "urgent-important"` and `completed: false`. Order them overdue first, then by the soonest due date. A task whose `dependencies` aren't complete is blocked, so flag it and look past it. Then suggest one task to start with.

## Standup

For a standup, report what's due today, what's overdue, and what the user completed today (`completedToday` in `get_productivity_metrics`). Keep it short and end on the next action.
