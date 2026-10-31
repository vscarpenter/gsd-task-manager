# Spec: weekly sweep

**Status:** draft, 2026-10-31. Not implemented on any client. Sprint 2 builds it. One input is still missing: the `weekly-review` vote count (section 8).
**Decisions:** D-14 (the sweep ships everywhere; the web Review page stays web-only and links to it). It reads the escalation rule from D-11 and D-12. Section 13 lists what this spec decides by reading.
**Contract:** `tests/fixtures/cross-platform/sweep-corpus.json` (74 cases, version 1). This repo is the authority; iOS and Android copy it byte-identical.
**Matrix row:** F3.
**Evidence:** code paths come from reading web `main` at `ed72ca3`, iOS `main`, and Android `feat/saved-parity`. Nothing here has run on a client.

## 1. Why

A matrix goes stale quietly. Due dates pass, Eliminate tasks sit untouched, Saved items pile up, and Schedule tasks never get a date. Nothing in GSD asks about them. The sweep is a short pass, one task at a time, through what needs a decision.

## 2. What it does, and what it doesn't

- It shows cards, one at a time, for tasks that match section 3. The user decides or skips.
- Every action is an edit that already exists on that client, through the path it already uses, with the Undo it already has.
- It adds no synced field, no pull contract change, no PocketBase change, and no backup envelope change. The only new state is per device: when this device last swept, and the reminder setting.
- It never changes a task by itself. Opening, skipping, and finishing a sweep write nothing to any task.
- It has no streaks, scores, completion percentages, or summary of how far behind someone is. A sweep with nothing to do says so and ends. `PRODUCT.md` rules out the gamified version, and iOS removed its streak tiles for the same reason.

## 3. The rule

A pure function, the same on every client.

```
sweepCards(tasks, now, windowDays, zone) -> [{ id, reason }]
reason: "overdue" | "escalating" | "stale" | "saved" | "undated-schedule"
```

The input is active-store rows that aren't completed. Archived and trashed rows live in their own stores, so the function never sees them. Every age is a count of **local calendar days** in `zone`, never elapsed time, as in the escalation rule.

Each task gets one card, from the first group it qualifies for:

| Order | Reason | Qualifies when | Sorted by |
|---|---|---|---|
| 1 | `overdue` | Not Saved, has a due date, and `daysUntilDue < 0`, in any quadrant | `dueDate`, then important first, then `id` |
| 2 | `escalating` | Not Saved, and `evaluateEscalation` says escalating with reason `due-soon`. With escalation Off, this group is empty | `dueDate`, then important first, then `id` |
| 3 | `stale` | Not Saved, and `updatedAt` is 14 or more local days before today | Q4 first, then oldest `updatedAt`, then `id` |
| 4 | `saved` | Saved, and `savedAt` is 30 or more local days before today | Oldest `savedAt`, then `id` |
| 5 | `undated-schedule` | Not Saved, Schedule (important, not urgent), and no due date | Oldest `createdAt`, then `id` |

Notes the corpus pins:

- **Overdue doesn't need escalation.** With escalation Off, an overdue task still gets a card, and a due-soon task doesn't.
- **A Saved task can only ever be a `saved` card,** however old its due date or last edit.
- **Due today isn't overdue,** whatever the time. The same task can be overdue in Tokyo and due today in Chicago at the same instant.
- **A future `updatedAt` isn't stale.** A device with a wrong clock can write one, and a negative age never qualifies.
- Recurrence, tags, snooze, dependencies, and subtasks don't change a card.

### What `updatedAt` means here

Stale reads the synced stamp, so it agrees across devices once they've synced. Any real edit resets it, including a top three pick (`tasks/spec-top-three.md` section 3.2) and a snooze.

Reminder bookkeeping shouldn't reset it. Web doesn't: `markNotificationSent` writes only the reminder fields (`lib/notification-checker.ts`). I didn't find the equivalent write on iOS or Android, so check it there first. The test `a posted reminder doesn't reset staleness` holds on each client.

## 4. The session

1. Compute the cards when the sweep opens. Later syncs don't reorder them.
2. Before showing each card, check again that the task still qualifies for a card. If it was completed or edited elsewhere, skip it without saying so.
3. After an action, go to the next card. The action's existing toast and Undo still apply. Undo doesn't bring a card back into this session, because the task is back where it was and next week's sweep can ask again.
4. **Skip** writes nothing, and the card can return next time.
5. **Done** is always available.
6. Reaching the end, or tapping Done, stamps "last swept" on this device. Leaving another way (Back, closing the app) stamps nothing, so the entry stays for a sweep the user didn't finish.

With no cards, the sweep shows the end state at once and stamps nothing.

## 5. Actions

Every action already exists. The sweep calls it and adds nothing to it.

| Card | Actions |
|---|---|
| `overdue` | Complete · New date · Mark urgent (when not urgent) · Save for later · Delete · Skip |
| `escalating` | Mark urgent · New date · Complete · Skip |
| `stale` | Complete · Move to quadrant · New date · Save for later · Delete · Skip |
| `saved` | Return to matrix · Delete · Skip |
| `undated-schedule` | Add date · Move to quadrant · Save for later · Skip |

| Action | Web | Apple | Android |
|---|---|---|---|
| Complete | `toggleCompleted` | `TaskStore.toggleComplete` | `TaskStore.setCompleted` |
| New date, Add date | `updateTask` | `TaskStore.saveEdits` | `TaskStore.change` |
| Mark urgent | F1's `handleMarkUrgent` (`components/matrix-simplified/task-actions.ts`, #638) | F1's `TaskActions.markUrgent` (`App/Matrix/TaskActions.swift`, #44) | F1's `TaskActionsViewModel.markUrgent` (`app/.../matrix/`, #38) |
| Move to quadrant | `moveTaskToQuadrant` | `TaskStore.saveEdits` | `TaskStore.change` |
| Save for later | `saveTaskForLater` | `TaskStore.moveToSaved` | `TaskStore.moveToSaved` |
| Return to matrix | `returnSavedTask`, with its quadrant and due date choices | `TaskStore.returnToMatrix` | `TaskStore.returnToMatrix` |
| Delete (to Trash) | `deleteTask` | `TaskStore.delete` | `TaskStore.delete` |

Existing rules hold: Save refuses a running timer, completing a recurring task spawns the next one, and Delete goes to Trash. New date uses the client's existing date control, including All day and time of day once C14 ships. Mark urgent calls F1's own action, with its hint, toast, and Undo. Don't build a second one here.

## 6. Per-device state

Both values stay outside the backup envelope and outside sync, like the escalation window.

| | Value | Default |
|---|---|---|
| Last swept | ISO timestamp, or none | None |
| Reminder | On or off, ISO weekday (1 is Monday, 7 is Sunday), `HH:mm` | Off. Turning it on starts at Sunday 09:00 |

| | Web | Apple | Android |
|---|---|---|---|
| Storage | `lib/preferences/weekly-sweep.ts` in `localStorage`, like `show-completed.ts` | App-group `UserDefaults` | `GsdPrefs` |
| Cleared by | `lib/reset-local-data.ts` | Erase All Data | Local erase |

A reset must clear both. B-16 is the same mistake made once already, with the feedback draft.

### The entry

```
entryShown(lastSweptAt, cardCount, now, zone) -> boolean
```

True when there's at least one card and the device has never swept or last swept seven or more local days ago. A future `lastSweptAt` counts as swept recently.

### The reminder

```
nextReminder(reminder, now, zone) -> instant | null
```

The next occurrence of that weekday and local time strictly after `now`, or null when off. It keeps its wall-clock time across a clock change. A time inside a gap shifts forward by the gap, and a time inside an overlap takes the first occurrence.

The notification text is fixed: "Weekly sweep" and "A few minutes to clear what's gone quiet." It carries no count, no task title, and no task content, and it fires whether or not cards exist, because a background task can't always compute them. It doesn't skip a week the user already swept, for the same reason. Quiet hours don't defer it, since the user chose the time.

| | Web | Apple | Android |
|---|---|---|---|
| Delivery | The notification checker, when the app is running, within 60 minutes after the occurrence. Otherwise it doesn't fire. The setting says so | One repeating `UNCalendarNotificationTrigger` | One inexact alarm, rescheduled after it fires and in `BootReceiver` |
| Permission | The existing contextual ask, when the user turns it on | Same | Same (`ReminderPermission`) |
| Limits | None | iOS keeps 64 pending notifications. E-IOS-DATA's B-37 check owns that question (`sprint/findings/B-37.md`, once written). Apply its answer to this reminder too | None: task reminders stop at `MAX_SCHEDULED_REMINDERS` (400), below Android's 500 |

**Task reminder rebuilds (read, not run):**

- *Apple:* `TaskStore.resyncReminders` calls `cancelAll` (`TaskStore.swift:818`), and `LiveReminderScheduler.cancelAll` calls `removeAllPendingNotificationRequests` (`:68-70`). The app runs that resync whenever the task set changes, so a repeating trigger added once disappears at the next task change. `resyncReminders` must schedule the sweep reminder again from the stored setting after its `cancelAll`. Leave `cancelAll` alone, because Erase All Data also uses it (`TaskStore.swift:1054`) and has to clear this reminder. Erase clears the stored setting too.
- *Android:* `ReminderScheduler.resyncAll` only touches alarms for the task ids it's given, one `PendingIntent` per id, so it leaves a separate alarm alone. Give the sweep alarm its own action, so it can't match a task's `PendingIntent` by request code. For the same reason, a local erase won't clear it by itself: the erase has to cancel it explicitly.
- *Web:* nothing to rebuild. The checker reads the setting each time it runs.

The tests hold on Apple and Android: `a task reminder resync keeps the sweep reminder` and `a local erase clears the sweep reminder`.

## 7. Surfaces

| | |
|---|---|
| Entry | A quiet "Weekly sweep" line above the matrix while `entryShown` is true. Also in the web command palette and in Settings on every client, where it's always available |
| Web Review page | Stays web-only (D-14). Adds a "Start weekly sweep" link near `ReviewPrompts`, shown always. Review's stats and prompts don't change, and native gets no Review page |
| Card | The task's title, due chip, and quadrant, one reason line, and the actions |
| Progress | "3 of 12". Position only, with no bar or percentage |
| End | "That's the sweep." and a way back. No tally |
| Setting | Settings › Notifications: "Weekly sweep reminder", with day and time |
| Route | Web: `/sweep`. Apple and Android: a pushed screen |

| Reason | Reason line |
|---|---|
| `overdue` | Due date passed |
| `escalating` | Due soon, not marked urgent |
| `stale` | No changes in 14 days or more |
| `saved` | Saved over a month ago |
| `undated-schedule` | No date yet |

The copy states facts and asks nothing of the reader. It never says behind, neglected, still, missed, or forgot, and never counts what's left beyond the position line.

**Accessibility:** focus moves to the new card's title after each action. A live region announces "3 of 12". Every action has a text label. Keyboard works on web, including Skip and Done. Reason lines use text, never color alone, and pass WCAG AA in light and dark.

**Web route note:** a new App Router route needs three things. Add `/sweep/` to the precached pages in `public/sw.js`, beside `/saved/`, or it fails offline. Vinny deploys the CloudFront function (`scripts/deploy-cloudfront-function.sh`). And it falls under the route budget in `quality:bundle`.

## 8. Retiring the `weekly-review` feedback slug

The sweep is what that roadmap item asked for, so it stops being on offer. Each client removes the item in the build that ships the sweep on that client.

| | Item | Test to update |
|---|---|---|
| Web | `lib/feedback/roadmap-items.ts:36` | The feedback tests under `tests/data/` and `tests/ui/feedback-settings.test.tsx` that name the list |
| Apple | `GSDKit/Sources/GSDModel/Feedback.swift:61` | `GSDModelTests/FeedbackTests.swift:68` |
| Android | `core/model/.../Feedback.kt:28` | `FeedbackTest.kt:43` |

This changes no wire shape. The payload keeps its exact seven keys. A stored vote for the retired slug is dropped when the payload is built (web `buildPayload`, and each client's filter), so add a test on each client: `a stored vote for weekly-review isn't sent`. By the iOS parity note, the server enumerates no slugs (`gsd-iosapp/docs/2026-08-29-feedback-parity.md`), so older builds can keep sending it. **Never reuse the slug.**

**Vote count: pending.** Vinny holds it (`sprint/OWNER-DECISIONS.md` item 3), because reading the feedback collection takes admin access on hosted. Record it here before this leaves draft: `weekly-review` votes as of `<date>`: `<count>`, of `<total>` submissions. D-14 already decides the feature ships, so the number is a record of demand and shouldn't change the plan. If it surprises him, that's a reason to reopen scope with him.

## 9. Implementation by client

| | Web | Apple | Android |
|---|---|---|---|
| Rule | `lib/weekly-sweep.ts` | `GSDKit/Sources/GSDModel/WeeklySweep.swift` | `core/model/.../WeeklySweep.kt` |
| Corpus test | `tests/data/sweep-corpus.test.ts` | `GSDModelTests/SweepCorpusTests.swift` | `SweepCorpusTest.kt` |
| Depends on | `lib/escalation.ts` | `GSDModel/Escalation.swift` | `core/model/.../Escalation.kt` |
| State | `lib/preferences/weekly-sweep.ts`, `lib/reset-local-data.ts` | `AppGroupDefaults.shared` in `GSDStore` | `GsdPrefs` |
| Screen | New `app/(dashboard)/sweep/page.tsx`, `components/weekly-sweep/` | New `App/Sweep/` | New `app/.../sweep/` |
| Entry | `components/matrix-simplified/`, command palette, `app/(dashboard)/dashboard/page.tsx` | `App/Matrix/`, `App/Settings/SettingsView.swift` | `app/.../matrix/`, `app/.../settings/SettingsScreen.kt` |
| Reminder | `lib/notification-checker.ts`, `components/settings/notification-settings.tsx` | `App/Notifications/` | `app/.../notifications/ReminderScheduler.kt`, `BootReceiver.kt`, `app/.../settings/NotificationsGroup.kt` |
| Retired slug | Section 8 | Section 8 | Section 8 |

MCP gets nothing in v1. It has no sessions, and the corpus rule can be exposed later with no contract change.

The Matrix screen and card are hotspots on every client, so land through the sprint 2 hotspot table.

## 10. Tests (TDD, red first)

1. The corpus test on each client, failing until the rule exists. It keeps only `location: active` rows before calling the function.
2. Unit, on each client: reading and writing the two preferences; a reset clears both; an unknown stored reminder falls back to off; `a posted reminder doesn't reset staleness`; `a stored vote for weekly-review isn't sent`.
3. Session, on each client: opening, skipping, and leaving write nothing to any task and queue no push; reaching the end stamps last swept; leaving doesn't; a task completed elsewhere mid-sweep is skipped.
4. Each action on each card calls the existing path, and its Undo works.
5. UI: the entry follows `entryShown`; Review links to the sweep on web; the accessible names and live region; no count outside the position line.
6. Reminder: scheduling on and off on native, plus the two named tests in section 6. On web, firing inside and outside the 60-minute window.
7. E2E on web: seed an overdue task, a stale Q4 task, and an undated Schedule task. Sweep them in order, complete one, skip one, and confirm the skipped task is unchanged.
8. `verify-frontend-change` on web, and a simulator and emulator run on native, in two time zones.

## 11. Rollout

1. Vinny records the vote count (section 8) and answers section 13.
2. F1 has to be on `main` on each client first, since the rule reads it. It's a sprint 1 goal.
3. Build on all three clients in parallel from the frozen corpus. No server step and no ordering between clients: nothing here crosses the wire.
4. Each client retires the slug in the build that ships the sweep.
5. Vinny deploys the CloudFront function with the web release.
6. Vinny updates the Project's `parity/feature-matrix.md` row F3 and `contracts-and-decisions.md`, and the workspace `CLAUDE.md` contracts table gets a sweep corpus row.

## 12. Acceptance criteria

- All 74 corpus cases pass on web, iOS, and Android, from byte-identical copies.
- A sweep with no action writes nothing to any task, and a sync history shows no extra pushes.
- Every action goes through a path that already existed, with no new stored field beyond section 6.
- No surface shows a streak, score, percentage, or tally, and no copy uses the words in section 7.
- A notification carries no count and no task content.
- A reset clears last swept and the reminder.
- `weekly-review` is gone from each client's roadmap list in the build that ships the sweep, and a stored vote for it isn't sent.
- The vote count is recorded in section 8.
- The screens pass WCAG AA in light and dark, with the names in section 7.

## 13. Decisions for Vinny

The brief settles the card groups, the 14 and 30 days, and the ban on stored fields. These are my readings of what it leaves open, written into the corpus where they apply. Changing one changes the corpus, so answer before it freezes.

1. **A stale task the user wants to keep comes back every week.** Skip writes nothing, and "Still matters" would need an edit with no content, which the brief rules out. A per-task "not stale until" would be a new synced field. Skipping weekly is the honest cost of no new fields. Tell me if it's too naggy.
2. **No cap on cards.** A first sweep on an old list could run long. Done is always there, and the position line shows the length. A cap of 20 would be one line and a few corpus cases. Oldest-first ordering would then decide what gets seen.
3. **The sort orders inside each group.** The brief gives the group order and "Q4 first". Everything finer is mine: oldest first throughout, important first on due-date ties.
4. **A stale task outside Q4 runs oldest first, across quadrants.** The alternative is Q4, then Q3, Q2, and Q1.
5. **Today's top three picks aren't excluded.** An overdue pick still gets an overdue card. A pick can't be stale, because picking is an edit.
6. **Entry after seven local days, and the reminder's fixed text and Sunday 09:00 start.** Copy in sections 6 and 7 is a first draft.
7. **Quiet hours don't defer the reminder.** Task reminders defer, but here the user picked the time themselves.
8. **Delegate and Do First tasks with no date and recent edits get no card.** The brief names undated Schedule only.
