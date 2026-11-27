---
name: weekly-review
description: Review a week or month of GSD tasks, covering completions, quadrant balance, tags, and upcoming deadlines. Use when the user reviews their progress.
---

# Weekly review

Use this skill when the user reviews a week or a month of work, or asks for a productivity report.

## Gather the numbers

- `get_productivity_metrics` returns completions for today, this week, and this month, plus the current and longest streak. It also has the completion rate, quadrant distribution, per-tag stats, and due-date counts.
- `get_quadrant_analysis` gives each quadrant's completion rate and task count.
- `get_tag_analytics` gives each tag's usage count and completion rate. Call it alone when the user asks only about tags or projects.
- `get_upcoming_deadlines` lists what's overdue, due today, and due this week.
- `get_task_insights` returns a prose summary of the same data when the user wants text rather than numbers.

Every one of them leaves Saved items out, so the review covers the user's live tasks.

## Read the matrix

Compare the quadrants. Many open Delegate or Eliminate tasks suggest work the user could hand off or drop. A Do First quadrant that keeps filling means important work keeps turning urgent, and more of it belongs in Schedule. Name the pattern and the tasks behind it.

## Read the tags

Rank tags by completion rate and call out the strongest and the weakest. Point to any area with many open tasks and few completions. Tags often split work from personal, so mention that split when it shows.

## Write it up

Lead with completions and the streak, then quadrant balance, tags, and the deadlines ahead. End with two or three recommendations tied to specific tasks or tags. The metrics count this week but not last week, so don't claim a week-over-week change from them alone.
