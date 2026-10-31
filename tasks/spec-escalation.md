# Spec: escalation by due date

**Status:** draft, 2026-10-29. Not yet implemented on any client.
**Decisions:** D-11 (escalation signals; it doesn't move tasks) and D-12 (2-day default window; Off, 1, 2, 3, 7; per device), both settled 2026-10-29. See the GSD Project's `parity/backlog.md` ("Decided") and `parity/roadmap.md` (phase 2).
**Contract:** `tests/fixtures/cross-platform/escalation-corpus.json` (38 cases, version 1). This repo is the authority; iOS and Android copy it byte-identical.
**Matrix row:** F1.

## 1. Why

In the Eisenhower matrix, urgency is about time. A task in Schedule (important, not urgent) that is due tomorrow has become urgent, but GSD only knows that if the user flips the flag. Today a due date changes the due chip and the badge, and never the quadrant. Escalation points out the gap and makes it one tap to close.

## 2. What it does, and what it doesn't

- It **marks** a task that is escalating and offers **Mark urgent**.
- It **never changes a task by itself.** No flag flips, no stored field, no sync traffic, no new wire field. A task changes only when the user taps Mark urgent, which is an ordinary edit through the existing update path.
- Importance never changes. Schedule (Q2) escalates toward Do First (Q1); Eliminate (Q4) escalates toward Delegate (Q3).
- Reminders, badges, analytics, and smart views don't change. They keep reading the stored flags.

Auto-move is a possible later step. It would need a synced `escalated_at`, so a device with escalation on doesn't keep re-escalating a task the user demoted on another device. It is out of scope here.

## 3. The rule

A pure function, the same on every client:

```
evaluateEscalation(task, now, windowDays, timeZone) -> {
  escalating: boolean,
  daysUntilDue: integer | null,
  reason: "overdue" | "due-soon" | null,
  target: "urgent-important" | "urgent-not-important" | null
}
```

1. **daysUntilDue** is the number of local calendar days from `now` to `task.dueDate`, both converted to dates in `timeZone`. It is negative when the due date has passed, 0 when due today, and null when the task has no due date. It is computed for every task with a due date, eligible or not, so the due chip can share it.
2. A task is **eligible** when it is not completed, not Saved (`savedAt` is null), not urgent, has a due date, and the window isn't Off (`windowDays` is null when Off).
3. An eligible task is **escalating** when `daysUntilDue <= windowDays`. Overdue tasks always meet this, so an overdue task escalates whatever the window, unless escalation is Off.
4. **reason** is `"overdue"` when `daysUntilDue < 0`, otherwise `"due-soon"`. It is null when not escalating.
5. **target** is `"urgent-important"` when the task is important, otherwise `"urgent-not-important"`. It is null when not escalating.

Notes that the corpus pins:

- **Calendar days, never elapsed time.** On a Tuesday at 21:30, a Friday due date is 3 days away, not 2.1 (web #633 fixed the due chip for the same reason). Daylight-saving changes, year ends, and leap days don't change the count.
- **A due time doesn't change the count** (D-1: local midnight means all day; any other time is a time of day). A task due today at 09:00 is still "due-soon" with 0 days at 14:00, and becomes "overdue" at midnight. The due chip, not escalation, says it's late. This keeps the rule the same on clients that do and don't show due times yet.
- **The time zone is the device's current zone.** The same task can be 1 day away in Chicago and 0 days away in Tokyo at the same instant.
- Recurrence, snooze, dependencies, tags, and subtasks don't matter.
- Archived and Trash rows are never evaluated.
- The rule accepts any non-negative `windowDays`. The setting offers 1, 2, 3, and 7.

## 4. The setting

| | |
|---|---|
| Label | Escalate tasks due within |
| Options | Off · 1 day · 2 days (default) · 3 days · 1 week |
| Helper text | Flags tasks that aren't marked urgent when their due date gets this close. Nothing moves until you say so. |
| Storage | Per device, outside the backup envelope, so the envelope doesn't change. Web: `lib/preferences/escalation-window.ts` in `localStorage`, like `show-completed.ts`. iOS: app-group `UserDefaults`. Android: `GsdPrefs` |
| Where | Web: Settings › Appearance, beside Show completed. Native: the same group as Show completed |

## 5. Surfaces

Keep it quiet. PRODUCT.md says "the matrix is the argument", so escalation adds one marker and one action, not a new section.

- **Card marker.** On an escalating card, an "Escalating" tag beside the due chip, in the target quadrant's ink (`--q1-ink` for a Schedule task, `--q3-ink` for an Eliminate task). Never color alone: the tag has text and an up-arrow icon.
- **Accessible name.** "Escalating: due tomorrow, not marked urgent." Use the due chip's existing phrase ("due today", "due in 2 days", "3 days overdue").
- **Action.** "Mark urgent", with the hint "Moves to Do First" or "Moves to Delegate". Web: in the hover icons and the ⋯ menu. Apple and Android: in the card menu and the swipe actions, beside Snooze. On every client, the editor shows the same hint next to the urgency control while the task is escalating.
- **After Mark urgent.** The card moves through the client's existing quadrant-move animation and toast, with Undo. No celebration.
- **Not in v1:** a count in the quadrant header, a matrix banner, or a notification. Revisit after people have used v1. The weekly sweep (F3) and top three (F2) will consume the rule.

## 6. Implementation by client

| | Web (first) | Apple | Android |
|---|---|---|---|
| Rule | `lib/escalation.ts` | `GSDKit/Sources/GSDModel/Escalation.swift` | `core/model/.../Escalation.kt` |
| Calendar math | `Intl.DateTimeFormat` with `timeZone` to get the local date parts, then a UTC day difference. No new dependency | `Calendar` with `timeZone`, `dateComponents([.day], from: startOfDay, to: startOfDay)` | `ZonedDateTime.toLocalDate()` and `ChronoUnit.DAYS.between` |
| Corpus test | `tests/data/escalation-corpus.test.ts`, modeled on `capture-parser-corpus.test.ts` | `GSDModelTests/EscalationCorpusTests.swift` | `EscalationCorpusTest.kt` |
| Mark urgent | `updateTask(id, { urgent: true })` | `TaskStore` edit | `TaskStore.change` |

Each corpus test builds a task from the case's `task` object, filling every missing field with the model's default, and asserts all four outputs. `windowDays: null` means Off.

MCP is out of scope for v1. A later version could add an `escalating` field to `list_tasks` and `get_upcoming_deadlines`, computed with the same rule.

## 7. Tests (TDD, red first)

1. The corpus test, failing until `lib/escalation.ts` exists.
2. Unit: the preference reads, writes, and defaults to 2 days; an unknown stored value falls back to 2.
3. UI: an escalating card shows the tag with its accessible name; a non-escalating card doesn't; Mark urgent moves the card and offers Undo; Off removes every tag.
4. E2E: seed a Schedule task due tomorrow, see the tag, Mark urgent, find the task in Do First.
5. Use the `verify-frontend-change` skill on the running app before the PR.

## 8. Rollout

1. Web implements the rule, corpus test, setting, marker, and action.
2. Copy `escalation-corpus.json` byte-identical into the iOS and Android repos, and check with `md5sum` (`731c71e9ed3fde49c5a44b35e7a617d0` for version 1).
3. iOS and Android implement in parallel.
4. Update the Project's `parity/feature-matrix.md` row F1 and `contracts-and-decisions.md` as each client ships.

## 9. Acceptance criteria

- All 38 corpus cases pass on web, iOS, and Android, from byte-identical copies.
- With escalation on, no task's stored fields change unless the user taps Mark urgent. A sync history after a day of use shows no extra pushes.
- With escalation Off, the matrix looks exactly as it does today.
- The marker passes WCAG AA contrast in light and dark, on every quadrant wash.

## 10. Open questions

- **Header count.** Should Schedule and Eliminate show "2 escalating" in their headers? Deferred to after v1 (see §5).
- **MCP.** Expose `escalating` in list tools in v1.1, or wait for top three?
