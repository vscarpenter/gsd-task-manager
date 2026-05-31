# GSD Task Manager — Native iOS/iPadOS Product Specification

- **Date:** 2026-05-30
- **Status:** Draft for review
- **Author:** Vinny Carpenter (with Claude)
- **Purpose:** A self-contained product specification for rebuilding and reimagining the GSD Task Manager web app as a **native SwiftUI app for iPhone and iPad**. This document is written to be handed to a fresh Claude Code session in a new Xcode project. It assumes **no access to the web codebase** — every behavioral rule, data limit, and protocol detail needed to build the app is inlined here.

> **Reader note.** Where this spec says "matches the web app," the relevant behavior is described in full in this document; you do not need the original source. Enumerated values (recurrence types, archive tiers, snooze durations, field limits) have been reconciled against the web app's source-of-truth constants and are authoritative as written.

---

## 1. Overview & Vision

GSD ("Get Stuff Done") Task Manager is a **privacy-first Eisenhower-matrix task manager**. Tasks are classified along two axes — **urgent** and **important** — into four quadrants, helping the user decide what to *do first*, *schedule*, *delegate*, or *eliminate*.

The web app's defining characteristics, which the native app must preserve:

- **Privacy-first & offline-first.** All data lives on-device. The app is fully usable with no account and no network. Cloud sync is strictly **optional** and opt-in.
- **Frictionless capture.** A persistent capture bar with a natural-language shorthand (`!`, `!!`, `*`, `#tag`) lets the user add and classify a task in one keystroke-light gesture.
- **Depth under a simple surface.** Behind the 2×2 grid sit recurrence, subtasks, dependency graphs, time tracking, analytics, and multi-device sync.
- **Editorial, calm aesthetic.** A serif display typeface for headings, generous spacing, restrained color — quadrant accents carry the only strong color.

### Why native (not React Native / not a wrapped PWA)

The goal is a first-class iOS/iPadOS citizen: instant launch, native gestures and haptics, Home/Lock-Screen widgets, Siri/Shortcuts via App Intents, a Share Extension, Spotlight indexing, Dynamic Type, and VoiceOver — none of which a wrapped web view delivers convincingly. The rebuild is also a chance to **reimagine** interactions around native idioms (swipe actions, context menus, drag-and-drop, `NavigationSplitView` on iPad) rather than transliterate web layouts.

### Success criteria

1. A user can capture, classify, edit, complete, and organize tasks entirely offline, with a UI that feels designed for iOS — not ported.
2. Signing in syncs tasks bidirectionally with the existing web app and other devices, with conflicts resolved deterministically.
3. The app ships the full web feature set (matrix, capture parser, recurrence, subtasks, dependencies, time tracking, snooze, archive, smart views, search, analytics, import/export, notifications) plus native widgets and App Intents.
4. The app passes App Store review (Sign in with Apple offered, privacy nutrition labels accurate).

---

## 2. Goals & Anti-Goals

### Goals

- Full feature parity with the web app's **behavior**, reimagined with native **interaction patterns**.
- Bidirectional multi-device sync with the existing PocketBase backend, sharing data with the web app.
- Native surfaces: Home & Lock Screen widgets; Siri / App Intents / Shortcuts; Share Extension; Spotlight.
- Universal app: iPhone and iPad as **co-equal first-class targets** with genuinely adaptive layouts.
- App Store–ready: Sign in with Apple, privacy labels, accessibility baseline.

### Anti-Goals (explicitly out of scope for this version)

- **No Apple Watch app.** (Deferred; not designed here.)
- **No Live Activities / Dynamic Island.** (The web time-tracker has no real-time-pushed analog requirement; deferred.)
- **No changes to the existing MCP server.** It already talks to the shared PocketBase backend and keeps working unchanged. The iOS app neither bundles nor reimplements it. (See §11.)
- **No macOS-native or Mac Catalyst target** in this version (iPad app may run on Apple silicon Macs via "Designed for iPad" by default; not a design target).
- **No new backend features.** The app consumes the existing PocketBase `tasks` collection as-is. The one backend question raised is identity linking (§8), flagged as an open question, not a committed change.
- **No real-time collaborative editing / shared task lists.** Sync is single-user, multi-device.

---

## 3. Platforms & Targets

- **Deployment target:** the **latest iOS/iPadOS release only.** The spec freely uses current-generation APIs (SwiftUI, GRDB, WidgetKit, App Intents, `ASWebAuthenticationSession`, `BGTaskScheduler`, CoreSpotlight) without back-compatibility fallbacks.
- **Devices:** Universal — **iPhone and iPad**. iPad is first-class, not an afterthought (real 2×2 split-view matrix; hardware-keyboard shortcuts; pointer/trackpad; drag-and-drop).
- **Orientation:** iPhone portrait-primary (landscape supported); iPad all orientations.
- **Distribution:** Public **App Store** release. Implies Sign in with Apple (§8, §13) and accurate privacy nutrition labels (§13).
- **Languages:** English at launch; architecture must not hard-block localization (use `String(localized:)`, no concatenated UI strings).

### Recommended technical foundation (implementation guidance, not product requirement)

- **UI:** SwiftUI throughout.
- **Local store:** **GRDB (SQLite)** as the on-device source of truth. Rationale: the app requires a hand-rolled external REST + SSE last-write-wins sync engine (§7); GRDB gives explicit control over rows and change observation that maps almost 1:1 to the web app's Dexie + sync-queue model, whereas SwiftData's change-tracking is built around CloudKit-style sync and would fight a custom engine. *(SwiftData is the trendier default and is acceptable if the team prefers it, but the sync engine becomes harder.)*
- **Networking / PocketBase client:** There is **no official PocketBase Swift SDK.** Build a small client: REST over `URLSession`, realtime over a streaming `URLSession` SSE task, OAuth via `ASWebAuthenticationSession`. This is net-new, higher-risk code and gets its own milestone and test surface.
- **Module structure:** A shared Swift package (e.g. `GSDKit`) containing the model, persistence, sync engine, and business logic, depended on by the **app target, the widget extension, the Share Extension, and the App Intents** — because all of those need the same model and a read path into the store (via an App Group container).
- **Concurrency:** Swift Concurrency (`async/await`, actors for the sync engine and store coordinator).

---

## 4. Information Architecture & Navigation

The app reimagines the web's "single-matrix shell + icon rail" as native navigation that adapts by size class.

### 4.1 iPhone (compact width)

A **`TabView`** with these tabs:

1. **Matrix** — the primary surface: a sticky **capture field** at top, then the four quadrants. Because four quadrants cannot be shown legibly at once on a phone, the matrix uses a **vertical stack of quadrant sections** (each a collapsible, scrollable group with a header showing the quadrant name + live count), which mirrors how the web app stacks quadrants on mobile. A segmented **"Focus / All"** control and a quadrant filter let the user zero in. (Alternative considered: a paged 2×2; rejected as cramped and gesture-conflicting with row swipes.)
2. **Dashboard** — analytics (§6.15).
3. **Browse** — Smart Views list + Archive access + full-text search entry (this is where resurrected smart views live on iPhone; see §6.13).
4. **Settings** — §6.17.

Global affordances on iPhone:
- **Quick capture** is always one tap away (the capture field on Matrix; plus a Share Extension and App Intents).
- The **command palette** (§6.14) is reachable via a search/⌘-style affordance: a pull-down search at the top of Matrix/Browse and, on hardware keyboards, ⌘K.

### 4.2 iPad (regular width)

A **`NavigationSplitView`** (two- or three-column):

- **Sidebar:** Matrix, a live list of **Smart Views** (built-in + custom, pinned ones first), Dashboard, Archive, Settings.
- **Content:** the selected surface. For **Matrix**, a true **2×2 grid** filling the content column (Q1 top-left, Q2 top-right, Q3 bottom-left, Q4 bottom-right). For a Smart View, the filtered task list.
- **Inspector (optional third column):** the task editor (§6.3) opens here on iPad rather than as a sheet, so editing doesn't occlude the board.

iPad gets the **full hardware-keyboard shortcut set** (§6.14) and **drag-and-drop between quadrants**.

### 4.3 Cross-cutting navigation rules

- **Deep links / routes:** define a `gsd://` URL scheme and/or universal-link routing so widgets, App Intents, Spotlight results, and notifications can open a specific task, a specific quadrant, the capture field, or a smart view.
- **State restoration:** restore the last-selected tab/sidebar item and scroll position.
- **First run:** an onboarding/about flow (the web app shows an About page to first-time visitors) — a brief, skippable intro to the matrix concept, capture shorthand, and the optional-sync/privacy story. (See §6.16.)

---

## 5. Data Model

All entities below must be representable in the local GRDB store, in the JSON import/export format (§6.16), and (for the syncable subset) in the PocketBase collection (§7). **Timestamps are ISO-8601 strings with timezone offset** in the wire/export formats; internally they may be stored as `Date`. **IDs are URL-safe nanoid-style strings** (the web app uses `nanoid`); the iOS app must generate compatible IDs (≥ minimum lengths below) so records round-trip with the web app and backend.

### 5.1 Task (the core entity)

| Field | Type | Required | Default | Constraints / Notes |
|---|---|---|---|---|
| `id` | String | yes | generated | ≥ 4 chars, unique, URL-safe |
| `title` | String | yes | — | 1–80 chars |
| `description` | String | no | `""` | 0–600 chars |
| `urgent` | Bool | yes | — | one axis of the matrix |
| `important` | Bool | yes | — | other axis |
| `quadrant` | enum | yes | derived | **derived** from `urgent`/`important` (§5.8); persisted for indexing |
| `completed` | Bool | yes | `false` | |
| `completedAt` | Date? | no | — | set when marked complete; cleared when un-completed |
| `createdAt` | Date | yes | now | |
| `updatedAt` | Date | yes | now | bumped on every mutation; drives sync LWW |
| `dueDate` | Date? | no | — | |
| `recurrence` | enum | yes | `none` | one of `none`, `daily`, `weekly`, `monthly` — **there is no "yearly"** |
| `tags` | [String] | yes | `[]` | 0–20 items; each 1–30 chars; stored lowercase |
| `subtasks` | [Subtask] | yes | `[]` | 0–50 items (§5.2) |
| `dependencies` | [String] | yes | `[]` | 0–50 task IDs that must complete first (§6.8) |
| `parentTaskId` | String? | no | — | lineage pointer for recurring instances (§6.5) |
| `notifyBefore` | Int? | no | — | minutes before `dueDate` to remind; ≥ 0 |
| `notificationEnabled` | Bool | yes | `true` | per-task reminder switch |
| `notificationSent` | Bool | yes | `false` | **device-local**, never overwritten by sync |
| `lastNotificationAt` | Date? | no | — | **device-local** |
| `snoozedUntil` | Date? | no | — | **device-local**; reminders suppressed until this time |
| `estimatedMinutes` | Int? | no | — | 1–10080 (max 7 days); a stored `0` is coerced to "unset" |
| `timeSpent` | Int? | no | — | total tracked minutes, **calculated** from `timeEntries` |
| `timeEntries` | [TimeEntry] | yes | `[]` | 0–1000 items (§5.3) |

**Device-local fields** (`notificationSent`, `lastNotificationAt`, `snoozedUntil`) are *not* authoritative across devices: on sync pull they are preserved from the existing local record, never clobbered by the remote (§7.4).

### 5.2 Subtask (embedded in Task)

| Field | Type | Constraints |
|---|---|---|
| `id` | String | ≥ 4 chars |
| `title` | String | 1–100 chars |
| `completed` | Bool | |

### 5.3 TimeEntry (embedded in Task)

| Field | Type | Constraints |
|---|---|---|
| `id` | String | nanoid-style (web uses length 8) |
| `startedAt` | Date | when the timer started |
| `endedAt` | Date? | nil while the timer is running |
| `notes` | String? | 0–200 chars |

> **Sync note.** The PocketBase representation of a time entry is `{ id, startedAt, minutes }` (a flattened duration), whereas the local/export model is `{ id, startedAt, endedAt, notes }`. The task-mapper must convert between them (§7.2). Preserve `endedAt`/`notes` locally even though the wire form is lossy.

### 5.4 NotificationSettings (singleton)

Singleton row (the web keys it `id = "settings"`).

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | Bool | `true` | global reminder master switch |
| `defaultReminder` | Int | `15` | minutes before due; UI presets: 15, 30, 60, 120, 1440 |
| `soundEnabled` | Bool | `true` | maps to notification sound on iOS |
| `quietHoursStart` | String? | — | `"HH:mm"` local time |
| `quietHoursEnd` | String? | — | `"HH:mm"` local time |
| `permissionAsked` | Bool | `false` | tracks whether the OS permission prompt was shown |
| `updatedAt` | Date | now | |

### 5.5 ArchiveSettings (singleton)

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | Bool | `false` | auto-archive on/off |
| `archiveAfterDays` | enum Int | `30` | exactly one of **30, 60, 90** |

### 5.6 SmartView (saved filter)

| Field | Type | Notes |
|---|---|---|
| `id` | String | nanoid (web uses length 12); built-ins use stable IDs |
| `name` | String | e.g. "Today's Focus" |
| `description` | String? | |
| `icon` | String? | SF Symbol name (native) — web stored an emoji/icon token |
| `criteria` | FilterCriteria | §5.9 |
| `isBuiltIn` | Bool | built-ins are read-only (cannot edit/delete) |
| `createdAt` | Date | |
| `updatedAt` | Date | |

### 5.7 AppPreferences (singleton)

| Field | Type | Default | Notes |
|---|---|---|---|
| `pinnedSmartViewIds` | [String] | `[]` | max 5; ordered; pinned views surface first in the sidebar/Browse |
| `maxPinnedViews` | Int | `5` | |

Plus lightweight UI state the web keeps in `localStorage` — port to `UserDefaults` (App-Group-scoped where widgets need it):
- `showCompleted` (Bool) — whether completed tasks are visible in the matrix.
- Theme preference (`light` / `dark` / `system`).
- Sidebar/section collapse states.

### 5.8 Quadrant derivation (authoritative)

`quadrant` is a pure function of the two booleans. Never let it drift from the flags.

| `urgent` | `important` | `quadrant` id | Display title | Subtitle/intent | Accent |
|---|---|---|---|---|---|
| true | true | `urgent-important` | **Do First** (Q1) | crises, deadlines | rust/red |
| false | true | `not-urgent-important` | **Schedule** (Q2) | growth, planning | ocean/accent |
| true | false | `urgent-not-important` | **Delegate** (Q3) | interruptions | olive/amber |
| false | false | `not-urgent-not-important` | **Eliminate** (Q4) | distractions | warning/gray |

Canonical display/iteration order: **Q1, Q2, Q3, Q4** (the table order above).

### 5.9 FilterCriteria (powers smart views, filters, and search)

A predicate bundle. All present criteria are ANDed. Fields:

| Field | Type | Meaning |
|---|---|---|
| `quadrants` | [QuadrantId] | include only these quadrants (empty = all) |
| `status` | enum | `all` \| `active` (incomplete) \| `completed` |
| `tags` | [String] | task must contain **all** listed tags |
| `dueDateRange` | { start?: Date, end?: Date } | inclusive date bounds |
| `overdue` | Bool | incomplete **and** `dueDate` < today |
| `dueToday` | Bool | incomplete **and** `dueDate` is today |
| `dueThisWeek` | Bool | incomplete **and** `dueDate` in [today, today+7) |
| `noDueDate` | Bool | has no `dueDate` |
| `recurrence` | [RecurrenceType] | include only these recurrence kinds |
| `recentlyAdded` | Bool | `createdAt` within last 7 days |
| `recentlyCompleted` | Bool | completed **and** `completedAt` within last 7 days |
| `readyToWork` | Bool | incomplete **and** has no incomplete blocking dependency (§6.8) |
| `searchQuery` | String | case-insensitive substring across title, description, tags, and **subtask titles** |

Filter application is a sequential pipeline; `readyToWork` requires the full task set (to resolve dependency completion state).

### 5.10 Local persistence tables (for parity / migration awareness)

The web app's Dexie database (schema v14) holds ten stores: `tasks`, `archivedTasks`, `smartViews`, `notificationSettings`, `archiveSettings`, `appPreferences`, `syncQueue`, `syncMetadata`, `deviceInfo`, `syncHistory`. The native GRDB schema should mirror this separation:

- **`tasks`** and **`archivedTasks`** — archived tasks are the same shape as Task plus an `archivedAt: Date` and live in a separate table (§6.12).
- **`smartViews`**, **`notificationSettings`**, **`archiveSettings`**, **`appPreferences`** — as above.
- **Sync-internal:** `syncQueue` (§7.5), `syncMetadata` (sync config + cursor + device identity), `deviceInfo`, `syncHistory` (§7.7).

Define an explicit, versioned GRDB migration sequence from day one (don't rely on auto-migration), since the schema will evolve.

---

## 6. Feature Specifications

Each feature lists **Behavior** (the rule, authoritative and unchanged from the web) and **Native reimagining** (how it should feel on iOS/iPadOS).

### 6.1 The Matrix

**Behavior.** Tasks are grouped into the four quadrants (§5.8). Within a quadrant, incomplete tasks sort above completed ones; completed tasks render dimmed with a strikethrough title. A global **"show completed"** toggle hides/reveals completed tasks. Live counts (active / done / overdue) are shown per quadrant and/or in a summary.

**Native reimagining.**
- **iPad:** a true 2×2 grid filling the content column; each quadrant is a header + scrollable list. **Drag a task card across quadrant boundaries** to reclassify it (updates `urgent`/`important`); use SwiftUI `.draggable`/`.dropDestination`.
- **iPhone:** a vertical stack of quadrant sections with sticky headers and live counts; reclassify via the row's context menu or the editor (drag-across is impractical in a single column).
- **Row interactions (both):**
  - **Leading swipe →** complete/uncomplete (with haptic + confetti on complete, §6.4).
  - **Trailing swipe ←** reveal **Snooze** and **Delete**.
  - **Tap** → open editor (§6.3).
  - **Long-press / context menu** → Edit, Complete, Start/Stop timer, Snooze, Duplicate, Share, Move to quadrant, Delete.
- **Empty quadrants** show a quiet illustration + one-line prompt and an "Add to {quadrant}" affordance.
- **Large lists** must stay smooth (the web uses list virtualization); SwiftUI `List`/`LazyVStack` handle this natively — verify with hundreds of tasks.

**Task card contents** (everything the row must be able to show):
- Title (strikethrough if completed); 2-line description preview with tappable links.
- **Tags** as small chips.
- **Subtask progress** — a mini progress bar + `done/total` (e.g. `3/5`); 100% styled as success.
- **Dependency badges** — "Blocked by N" (lock) and/or "Blocking N" (link). Blocked tasks are visually de-emphasized.
- **Due date** — relative ("in 3 days", "Due today" highlighted, overdue in alert color).
- **Recurrence** indicator (repeat glyph) when `recurrence != none`.
- **Timer** state — when a time entry is running, show a live elapsed indicator; show total tracked time when present.
- **Snoozed** indicator with remaining time when `snoozedUntil` is in the future.

### 6.2 Quick Capture + the shorthand parser

**Behavior.** A single text field accepts a task title with inline shorthand that is parsed out on submit. The parser grammar (authoritative):

| Token | Effect | Notes |
|---|---|---|
| `!!` | sets `urgent = true` **and** `important = true` | matched on word boundaries |
| `!` | sets `urgent = true` | word boundaries; `!!` takes precedence |
| `*` | sets `important = true` | word boundaries |
| `#tag` | adds `tag` (lowercased) | case-insensitive; deduplicated; capped at 20 tags |
| `http://…` / `https://…` URL | **extracted from the title and appended to the description** | sanitized & validated (below) |

After parsing, the cleaned title has the tokens and URLs removed and whitespace collapsed. The parser returns `{ title, urgent, important, tags }`; the resulting quadrant is derived from the flags (§5.8). If no flags are present, the task lands in **Eliminate (Q4)** by default unless the user has set a manual quadrant override (below).

**URL handling (security-sensitive — replicate exactly):**
- Recognize `http`/`https` URLs in the title.
- **Sanitize:** accept only `http`/`https` schemes; reject URLs containing embedded credentials (`user:pass@`); require a valid hostname; reject URLs ≥ 2048 chars. Strip trailing sentence punctuation (`,` `;` `:` `.` `!` `?` `)`) off the captured URL.
- Move valid URLs into the description (appended on their own lines; if the description already has text, separate with a newline).
- If removing the URL empties the title but at least one URL was found, set the title to **"Review link below"**.
- Invalid/unsafe URLs are left in the title untouched.

**Manual quadrant override.** The capture UI lets the user pin a target quadrant that overrides the parsed flags. In the web app this cycles `none → Q1 → Q2 → Q3 → Q4 → none` via the Tab key.

**Native reimagining.**
- The capture field shows a **live preview** of how the task will be classified as the user types (e.g., a quadrant chip that updates with `!`/`*`), and renders detected `#tags` as chips.
- **Submit:** Return key adds the task and keeps the field focused for rapid serial capture.
- **"Details" affordance** opens the full editor (§6.3) pre-filled from the parsed input (web shortcut: Shift+N).
- **Quadrant override** as a tappable segmented chip; on hardware keyboards, Tab cycles it.
- Capture is also reachable from the **Share Extension** (§10.3) and **App Intents/Siri** (§10.2).

### 6.3 Task Editor

**Behavior.** Full create/edit surface exposing every field: title, description, quadrant (via urgent/important), due date, tags, recurrence, subtasks, dependencies, reminder (`notifyBefore` + `notificationEnabled`), estimated minutes. Save validates against the limits in §5.1. Editing a task's `dueDate` or `notifyBefore` **resets** its reminder state (`notificationSent = false`, clears `lastNotificationAt` and `snoozedUntil`) so the user gets re-notified.

**Native reimagining.**
- **iPad:** opens in the **inspector** (third column) so the board stays visible.
- **iPhone:** a sheet (with detents) or pushed detail.
- **Quadrant picker:** a 2×2 selector mirroring the matrix, each cell labeled and accent-colored.
- **Due date:** native `DatePicker` plus quick presets — **None, Today, This week, Next week** (§6.10).
- **Tags:** a token field; type + Return (or comma) to add; backspace on empty removes the last; autocomplete from existing tags.
- **Subtasks:** an inline, reorderable checklist with add/remove (§6.6).
- **Dependencies:** a searchable task picker that **prevents cycles** (§6.8) and shows current blockers/blocked.
- **Reminder:** a toggle + "remind me N before" picker using the presets (15m/30m/1h/2h/1d) defaulting to the user's `defaultReminder`.
- **Estimate:** a minutes/duration field (1 min – 7 days).
- Save disabled while title is empty; Cancel/Escape discards.

### 6.4 Completion (+ celebration)

**Behavior.** Toggling a task complete sets `completed = true` and `completedAt = now`; un-completing clears `completedAt`. Completing a task triggers a **confetti celebration** (the web fires ~120 particles from center plus ~60 from each side). Completing a **recurring** task additionally spawns the next instance (§6.5).

**Native reimagining.**
- Completion via leading swipe, checkbox tap, or context menu, with a **success haptic** (`UINotificationFeedbackGenerator .success`).
- **Confetti** via a SwiftUI particle effect (e.g. `Canvas` + `TimelineView`, or a lightweight package), **suppressed when Reduce Motion is enabled** (the web respects `prefers-reduced-motion`).
- Completed task animates to its sorted/dimmed position.

### 6.5 Recurrence engine

**Behavior.** `recurrence ∈ {none, daily, weekly, monthly}`. When a **recurring** task is marked complete, the app immediately creates a **new task instance**:
- New `id`, `createdAt`, `updatedAt`.
- `parentTaskId` set to the completed task's `id` (or, if the completed task was itself an instance, to *its* `parentTaskId` — keep a single-level lineage to the original).
- `dueDate` advanced from the prior due date by: **daily → +1 day, weekly → +7 days, monthly → +1 calendar month.** Use the platform's calendar month arithmetic for month-end clamping (e.g. Jan 31 + 1 month → Feb 28/29). If a recurring task has **no** `dueDate`, the spawned instance also has none (recurrence simply re-creates the task on completion).
- `completed = false`; **all subtasks reset to incomplete**.
- Reminder state reset (`notificationSent = false`; `lastNotificationAt`, `snoozedUntil` cleared).
- The original (now completed) task remains as a historical record; the new instance carries the recurrence forward.

**Native reimagining.** No UI change beyond the recurrence picker in the editor and the repeat glyph on the card; the spawn happens automatically on completion. Schedule the new instance's local reminder at spawn time (§9).

### 6.6 Subtasks

**Behavior.** Up to 50 per task; each has a title (1–100 chars) and completed flag. Add, toggle, delete, reorder. Card shows progress (`done/total` + bar). Recurring completion resets them (§6.5).

**Native reimagining.** Inline checklist in the editor with swipe-to-delete and drag-to-reorder; the matrix card shows the progress bar read-only.

### 6.7 Snooze

**Behavior.** Snoozing sets `snoozedUntil = now + duration`; while snoozed, the task's reminders are suppressed and the card shows remaining snooze time. Preset durations (authoritative): **15 minutes, 30 minutes, 1 hour, 3 hours, Tomorrow (+1 day), Next week (+7 days).** Maximum snooze is 1 year. `snoozedUntil` is device-local.

**Native reimagining.** Snooze from trailing swipe or context menu via a menu of the six presets; reschedule/skip the local notification accordingly (§9). Show remaining time on the card.

### 6.8 Dependencies (blocking graph)

**Behavior.** A task may list up to 50 `dependencies` (IDs of tasks that must complete first). The system:
- **Prevents cycles** using breadth-first search: before adding `B` as a dependency of `A`, BFS from `B` over the dependency graph; if `A` is reachable, the edge would create a cycle and is rejected. A self-reference (`A` depends on `A`) is always rejected.
- **Validates** on add: no self-reference, every dependency ID must exist, no cycle.
- **Queries:** *blocking tasks* (a task's dependencies), *uncompleted blockers*, *isBlocked* (any uncompleted blocker exists), *blocked tasks* (tasks that depend on this one), *ready tasks* (incomplete with no uncompleted blockers — powers the "Ready to Work" smart view).
- **Cleanup on delete:** when a task is deleted, its ID is removed from every other task's `dependencies` array first.

**Native reimagining.** The editor's dependency picker runs the cycle check live and disables choices that would create a cycle, with an explanation. Cards surface "Blocked by N"/"Blocking N" badges; tapping a badge reveals the related tasks. Blocked tasks are visually de-emphasized and excluded from "Ready to Work."

### 6.9 Time tracking

**Behavior.** Each task holds a list of `timeEntries`. **Start** creates an entry `{ id, startedAt: now }`; only **one running entry per task** is allowed (starting a second while one runs is rejected). **Stop** sets `endedAt = now` on the running entry (optionally with notes) and recalculates `timeSpent` = sum over completed entries of `(endedAt − startedAt)` in whole minutes. Formatting: `< 1m` → "< 1m"; `< 60m` → "Xm"; otherwise "Xh Ym" (or "Xh" when no remainder).

**Native reimagining.**
- Start/Stop from the card context menu and the editor; running state shows a **live-ticking elapsed time** on the card (a `TimelineView` updating each second).
- A subtle running indicator (no Live Activity in v1 — see anti-goals).
- The editor shows total tracked vs. estimate, with over-estimate styled in the alert color.

### 6.10 Due dates & presets

**Behavior.** Optional `dueDate`. Quick presets resolve as: **None** → unset; **Today** → today's date; **This week** → the **Friday of the current week** (if today is Saturday/Sunday, the *next* Friday); **Next week** → the **Monday of next week** (strictly after today). All resolved in the device's local time zone.

**Native reimagining.** Preset chips + a `DatePicker` for arbitrary dates in the editor; relative formatting on cards ("in 3 days", "Due today", overdue emphasized).

### 6.11 Bulk actions (multi-select)

**Behavior.** The user can select multiple tasks and act on them at once. Supported bulk operations (authoritative — these mirror the web's batch operations and the MCP `bulk_update_tasks` tool): **complete**, **move to quadrant**, **add tags**, **remove tags**, **set due date**, **delete**. Each operation applies per-task validation and enqueues sync per affected task. Destructive bulk actions (delete) confirm first.

**Native reimagining.** An **Edit/Select mode** on lists (matrix sections, smart-view lists, archive): tapping enters multi-select with checkmarks; a **bottom toolbar** exposes the bulk actions; a selection count is shown; an undo affordance follows destructive actions. On iPad, support rubber-band/shift-click selection with a hardware keyboard and a bulk-action context menu.

### 6.12 Archive

**Behavior.** Completed tasks can move to a separate **archive** store (they keep all fields plus `archivedAt`). Two paths:
- **Manual:** archive a completed task; **restore** it back to active; **delete** permanently from the archive.
- **Auto-archive:** when enabled, completed tasks whose `completedAt` is older than `archiveAfterDays` (30 / 60 / 90; default 30) are moved to the archive automatically. The web app runs this check on launch and roughly hourly.

Restoring re-inserts the task as active (removing `archivedAt`). All archive transitions also enqueue the corresponding sync operation (archiving a task syncs as a delete of the active record; restoring as a create/update) — see §7.

**Native reimagining.**
- A dedicated **Archive** screen (sidebar item on iPad; under "Browse" on iPhone): read-only dimmed cards; **swipe to Restore or Delete**; an undo affordance after destructive actions.
- Run the auto-archive sweep on launch and via the background-refresh task (§9.4) rather than an in-app hourly timer.

### 6.13 Smart Views & Filters *(resurrected as first-class)*

> The web v9 shell retains the smart-views **data** but hid the UI. This spec **resurrects** smart views as a first-class native feature.

**Behavior.** A SmartView bundles a `FilterCriteria` (§5.9) with a name/icon. **Nine built-in views** ship (read-only, stable IDs):

1. **Today's Focus** — Q1, active
2. **This Week** — active, due this week
3. **Overdue Backlog** — active, overdue
4. **No Deadline** — active, no due date
5. **Recently Added** — active, created in last 7 days
6. **This Week's Wins** — completed, completed in last 7 days
7. **All Completed** — completed (all time)
8. **Recurring Tasks** — active, recurrence ∈ {daily, weekly, monthly}
9. **Ready to Work** — active, no uncompleted blocking dependency

Users can **create / edit / delete custom views** (built-ins cannot be edited or deleted) and **pin up to 5** views (ordered) for quick access.

**Native reimagining.**
- **iPad:** built-in + custom views live in the **sidebar** (pinned first); selecting one shows the filtered list in the content column. A "+" creates a custom view via a criteria editor.
- **iPhone:** a **Browse** tab listing the views (pinned first), each opening a filtered list.
- Each view shows a live count. Custom-view creation reuses the criteria controls (quadrants, status, tags, due-date predicates, recurrence, ready-to-work, search).

### 6.14 Search & Command Palette *(resurrected as first-class)*

> The web's ⌘K command palette exists in source but isn't wired into v9. This spec **resurrects** it as a native command/search surface.

**Behavior — search.** Full-text, case-insensitive substring match across **title, description, tags, and subtask titles** (the `searchQuery` criterion, §5.9). Results update live.

**Behavior — command palette.** A single overlay that fuzzy-matches both **tasks** (jump to/edit) and **commands/actions** (new task, open a smart view, navigate to Dashboard/Archive/Settings, toggle theme, start sync, etc.).

**Native reimagining.**
- **Invoke:** ⌘K on a hardware keyboard (iPad / Magic Keyboard); a search affordance (pull-down or a prominent button) on iPhone.
- Sectioned results (Tasks, Smart Views, Actions, Navigation); arrow-key navigation + Return on keyboard; tap on touch.
- Standard `.searchable` for plain in-list search where a full palette is overkill (e.g., Archive).

### 6.15 Analytics Dashboard

**Behavior.** Computed from the current task set. Metrics (authoritative list):
- **Counts:** completed today / this week / this month; active tasks; completed tasks; total.
- **Completion rate:** completed ÷ total, as a percentage.
- **Streaks:** *active streak* (consecutive days up to today with ≥ 1 completion) and *longest streak*; plus a **last-7-days** array of booleans (≥ 1 completion that day).
- **Quadrant distribution:** count of active tasks per quadrant; and per-quadrant completion rate.
- **Tag stats:** per tag — total count, completed count, completion rate; sorted by count.
- **Deadlines:** overdue / due-today / due-this-week / no-due-date counts; plus an upcoming-deadlines list.
- **Completion trend:** for the last N days (selectable **7 / 30 / 90**), per-day counts of tasks *created* vs *completed*.
- **Time tracking summary:** total tracked vs estimated; estimation accuracy; time-by-quadrant; over/under-estimate counts.

**Native reimagining.** Build with **Swift Charts** (the web uses Recharts): a stat-card grid, a completion-trend line chart with a 7/30/90 segmented control, a quadrant donut/bar, a top-tags bar, an upcoming-deadlines list (tap to open the task), and a time-by-quadrant chart. An overdue banner when overdue > 0. Graceful empty state when there are no tasks.

### 6.16 Import / Export & Onboarding

**Export.** Produce JSON of the form:
```json
{ "tasks": [ /* full Task records */ ], "exportedAt": "<ISO-8601>", "version": "<app version>" }
```
**Import.** Accept that JSON (lenient parsing — **ignore/strip unknown fields** such as legacy `vectorClock` from old exports). Limits: **max 10,000 tasks**, **max ~10 MB** raw JSON. Two modes:
- **Replace** — clear existing tasks, then insert the imported set.
- **Merge** — insert alongside existing; for any imported ID that collides with an existing ID, **regenerate** the imported task's ID and **remap references** (other tasks' `dependencies` and `parentTaskId`) to the new ID.

Both modes enqueue the appropriate sync operations.

**Native reimagining.** Export via the share sheet / Files (`.json`); import via the document picker / "Open in" / Share Extension. A reset/erase-all flow (the web requires typing "RESET" and offers an export-first option and theme preservation) becomes a clearly-guarded destructive action with confirmation and an export-first prompt.

**Onboarding / About.** A first-run, skippable flow communicating: the matrix concept, the capture shorthand, the privacy story ("no account required; your data stays on device"), and optional sync. Reachable later from Settings → About (which also shows version and project links).

### 6.17 Settings

Port the web's grouped settings into native `Form`/`List` sections:

- **Appearance** — theme (Light / Dark / System); show-completed toggle.
- **Notifications** — master enable; default reminder (15m / 30m / 1h / 2h / 1d); sound; quiet hours (start/end); OS permission status + request affordance.
- **Cloud Sync** — enable/disable; sign in/out (Google / GitHub / Sign in with Apple); current account; auto-sync interval; manual "Sync now"; link to Sync History; pending/last-sync status.
- **Archive** — auto-archive toggle; archive-after (30 / 60 / 90 days); "Archive now."
- **Data & Storage** — export; import; erase all (guarded).
- **About** — version, privacy summary, links, re-show onboarding.

### 6.18 Task sharing (outbound)

**Behavior.** Every task card and the editor expose a **Share** action that exports a single task as human-readable text. The web app offers three variants — **native share**, **email**, and **copy to clipboard** — over a formatted rendering of the task (title, description, tags, due date, and relevant metadata). This is *outbound* sharing of one task's content; it is distinct from the inbound Share Extension (§10.3) and from JSON export (§6.16).

**Native reimagining.**
- A single **share sheet** (`ShareLink` / `UIActivityViewController`) is the primary path — it subsumes the web's separate "email" and "copy" buttons, since Mail, Messages, Copy, etc. are all activities in the sheet.
- Share a **formatted plain-text rendering** of the task; optionally append a `gsd://task/<id>` deep link so a recipient with the app can open it (the link resolves only if they have that task locally — it is a convenience, not a transfer of data).
- Available from the card context menu, the trailing-swipe overflow, and the editor.

---

## 7. Sync & Backend

Sync is **optional and opt-in**. With no account, the app is fully functional offline; nothing leaves the device. When signed in, tasks sync bidirectionally with the **existing self-hosted PocketBase** at `https://api.vinny.io`, sharing data with the web app and the user's other devices.

> **No official PocketBase Swift SDK exists.** Build a minimal client over `URLSession`: REST for CRUD/auth, a streaming task for realtime SSE. Treat this as net-new, higher-risk code with its own tests (record/replay fixtures of PocketBase responses).

### 7.1 PocketBase `tasks` collection schema (authoritative wire model)

Fields use **snake_case**. The collection already exists on the backend; the iOS client must read/write these exact field names.

| Field | Type | Notes |
|---|---|---|
| `id` | string | PocketBase **record** id (system) — distinct from the task's own id |
| `task_id` | string | the app's Task `id`; unique per owner; the join key |
| `owner` | string | the authenticated user id; API rule restricts rows to `owner = @request.auth.id` |
| `title` | string | |
| `description` | string | default `""` |
| `urgent` | bool | |
| `important` | bool | |
| `quadrant` | string | one of the four quadrant ids |
| `due_date` | string | ISO-8601 or empty |
| `completed` | bool | |
| `completed_at` | string | ISO-8601 or empty |
| `recurrence` | string | `none` / `daily` / `weekly` / `monthly` |
| `tags` | json (array of string) | |
| `subtasks` | json (array of `{id,title,completed}`) | |
| `dependencies` | json (array of task ids) | |
| `notification_enabled` | bool | default true |
| `notification_sent` | bool | device-local semantics (see §7.4) |
| `notify_before` | number or null | minutes |
| `last_notification_at` | string | device-local |
| `estimated_minutes` | number or null | 1–10080 |
| `time_spent` | number | default 0 |
| `time_entries` | json (array of `{id, startedAt, minutes}`) | flattened duration form |
| `snoozed_until` | string | device-local |
| `client_updated_at` | string (ISO-8601) | **the LWW comparison key and the pull cursor** |
| `client_created_at` | string (ISO-8601) | |
| `device_id` | string | originating device; used for realtime echo filtering |
| `created`, `updated` | string (system) | **do not** use for sort/filter (PocketBase ≥ 0.23 forbids it); always use `client_updated_at` |

### 7.2 Task mapper

Implement a bidirectional mapper between the local `Task` (camelCase, rich `timeEntries`) and the PocketBase record (snake_case, flattened `time_entries`). Notably:
- `timeEntries` `{id, startedAt, endedAt, notes}` → `time_entries` `{id, startedAt, minutes}` on push; reconstruct best-effort on pull (the wire form loses `endedAt`/`notes`, so **prefer the local copy** when both exist).
- `updatedAt` (local) ↔ `client_updated_at` (remote) is the LWW key.
- Preserve `notification_sent` / `last_notification_at` / `snoozed_until` as device-local (§7.4).

### 7.3 Conflict resolution — Last-Write-Wins (LWW)

The protocol is **last-write-wins keyed on `client_updated_at`** (milliseconds). For any given `task_id`:
- The record with the **newer** `client_updated_at` wins.
- If timestamps are equal or unparseable (NaN), treat as a no-op (don't overwrite).
- This rule guards **both** push and pull paths to prevent stale writes.

### 7.4 Pull (remote → local)

1. Fetch records where `owner == currentUserId` **and** `client_updated_at >= lastSyncAt`. Apply a **30-second overlap** (subtract 30s from the cursor) to avoid missing boundary writes.
2. For each record: validate its shape; **skip malformed** records (don't abort the whole pull).
3. LWW: if remote `client_updated_at` > local `updatedAt` (or the task doesn't exist locally), upsert it.
4. **Preserve device-local fields** from the existing local record on merge: `notificationSent`, `lastNotificationAt`, `snoozedUntil` are **never** taken from the remote.
5. **Reconcile deletions:** compare local tasks against the full remote index; delete local tasks that are absent remotely **and** not currently pending in the local sync queue.
6. Advance the cursor to the max applied `client_updated_at`, clamped so it never moves into the future, minus the 30s overlap.

### 7.5 Push (local → remote) & the sync queue

Every local mutation (create/update/delete/archive/restore/import) enqueues a `SyncQueueItem`:

| Field | Type | Notes |
|---|---|---|
| `id` | String | queue entry id |
| `taskId` | String | affected task |
| `operation` | enum | `create` / `update` / `delete` |
| `timestamp` | Int (ms) | when queued |
| `retryCount` | Int | |
| `payload` | Task? | full task for create/update; nil for delete |
| `status` | enum | `pending` / `failed` |
| `lastError` | String? | truncated |
| `lastAttemptAt` | Int? (ms) | |
| `failedAt` | Int? (ms) | |

Push algorithm:
1. **Bulk-fetch** the remote index once per push: a map `task_id → { recordId, client_updated_at }` (avoids per-item round-trips and 429s).
2. For each pending item, apply the **LWW guard**: if a remote record exists and its `client_updated_at` is newer than the queued item's timestamp, **skip** the write (the next pull delivers the remote version).
3. Otherwise upsert (create if no `recordId`, else update by `recordId`) or delete.
4. **Throttle ~100 ms between requests.** On HTTP **429**, abort the push loop immediately (back off; don't hammer).
5. **Retry policy:** exponential backoff at **5s, 10s, 30s, 60s, 300s**; after **5** failed attempts, mark the item `failed` (kept in the queue, surfaced for manual retry — not silently dropped).

### 7.6 Realtime (SSE) + periodic safety net

- Subscribe to the `tasks` collection (`*`) via PocketBase realtime (SSE over a streaming `URLSession`).
- **Validate** each incoming record; **echo-filter** by `device_id` (ignore events originating from this device); enforce the `owner` check.
- Apply creates/updates/deletes to the local store immediately (still honoring LWW and device-local-field preservation).
- **Foreground only:** SSE runs while the app is active. On reconnect/foreground, run a full sync to catch missed events.
- **Periodic safety net:** a recurring sync (default **every 2 minutes** while active; also on foreground and on network-regained) reconciles anything realtime missed. A coordinator ensures only one sync runs at a time (dedupe concurrent triggers).

### 7.7 Sync history & health

- **Sync history:** record each sync attempt — `{ id, timestamp, status: success|error|conflict|partial, pushedCount, pulledCount, conflictsResolved, failedCount?, errorMessage?, duration?, deviceId, triggeredBy: user|auto }`. Surface recent history (default page size ~50) in a Sync History screen; show summary stats (total syncs, successes, pushed, pulled).
- **Health monitoring:** periodically check for stale queue items (> 1 hour old), failed items, token expiry, and reachability; surface a non-alarming status indicator and actionable messaging.
- **Status surface:** a sync status indicator (idle / syncing / pending count / error) in the UI, plus pull-to-refresh to trigger a manual sync.

### 7.8 Device identity

On first run, generate and persist a stable `deviceId` (UUID) and a human `deviceName` (e.g. device model). These populate `device_id` on pushed records (echo filtering) and the sync-history/device list. Store in the App-Group container so extensions share identity.

---

## 8. Authentication

### 8.1 Providers

- **Google** and **GitHub** — already configured on the PocketBase backend; the web app uses these. The iOS app offers the same so it joins the **same user accounts** and shares data.
- **Sign in with Apple** — **required** for App Store approval because the app offers third-party social logins (Guideline 4.8). See the identity caveat in §8.4.

### 8.2 OAuth flow (native)

- Use **`ASWebAuthenticationSession`** for the OAuth2 authorization-code flow against PocketBase's `authWithOAuth2` endpoints, with a registered **redirect scheme** (e.g. `gsd://oauth-callback`). (The web app delegates this to the PocketBase JS SDK; on iOS it's hand-built.)
- On success, persist the PocketBase auth token and refresh it as needed (PocketBase issues a JWT; implement token refresh and handle expiry by prompting re-auth).

### 8.3 Token storage

Store the auth token in the **Keychain** (not `UserDefaults`), ideally with an access group so extensions that need authenticated reads can use it. (The web app keeps it in `localStorage`; Keychain is the native, more secure equivalent.)

### 8.4 OPEN QUESTION — cross-provider identity (the #1 sync gotcha)

PocketBase treats each OAuth identity as a distinct user. A user who signs in with **Google on web** and **Sign in with Apple on iOS** becomes **two different PocketBase users** → **no shared data**, and sync silently appears "broken." Resolution options (decide before sync ships):

- **(a) Backend account-linking** — link multiple OAuth identities (Google/GitHub/Apple) to one PocketBase user (by verified email or an explicit link flow). Most user-friendly; requires backend work outside this app.
- **(b) Constrain providers** — on iOS, present Sign in with Apple **only** to satisfy 4.8 but steer existing users to the **same Google/GitHub** account they used on web; document that mixing providers creates separate spaces.
- **(c) Email-keyed identity** — if all providers reliably return a verified email and PocketBase is configured to key users by email, identities converge. Needs verification against the current backend config.

**Recommendation to validate:** pursue (a) if feasible; otherwise ship (b) with clear in-app guidance. This must be settled before enabling sign-in in production.

---

## 9. Notifications (a redesign, not a port)

The web app **polls**: an in-app checker loop, a periodic background sync, and the service worker cooperate to fire reminders. **iOS does not allow background polling**, so reminders are **scheduled locally at write time** with `UNUserNotificationCenter`. This is a behavioral redesign with the same user-visible outcome.

### 9.1 Scheduling model

- When a task with a `dueDate`, `notificationEnabled == true`, and a reminder offset (`notifyBefore`, falling back to `defaultReminder`) is **created or edited**, schedule a local notification at `dueDate − offset`.
- **Reschedule** whenever `dueDate`, `notifyBefore`, `notificationEnabled`, or completion state changes; **cancel** when the task is completed, deleted, or its reminder disabled.
- **Snooze** cancels the pending notification and schedules a new one at `snoozedUntil` (using the §6.7 presets).
- **Recurring tasks:** when a new instance spawns on completion (§6.5), schedule its reminder at spawn time.
- Respect **quiet hours** (`quietHoursStart`/`quietHoursEnd`): if a fire time falls in the quiet window, defer to the window's end (match the web's suppression intent). Map `soundEnabled` to the notification sound.
- Use a stable identifier per task (e.g. `task-<id>`) so reschedules replace rather than stack.

### 9.2 Permission flow

Request notification authorization contextually (when the user first enables reminders or sets a due date with a reminder), not at cold launch. Track `permissionAsked`; reflect the OS permission state in Settings with a path to the system settings if denied.

### 9.3 Device-local state

`notificationSent`, `lastNotificationAt`, `snoozedUntil` remain **device-local** and are preserved across sync (§7.4) — each device manages its own reminder state.

### 9.4 Badges & background freshness

- **App icon badge:** set via `UNUserNotificationCenter` badge or `setBadgeCount` to reflect due-soon/overdue counts; update on relevant changes and from the background-refresh task.
- **Background refresh:** register a `BGAppRefreshTask` to (a) run the auto-archive sweep (§6.12) and (b) perform an opportunistic sync so data is fresh on next open. **Do not** rely on background tasks for timely reminders — those are pre-scheduled (§9.1).
- **No remote push:** PocketBase does not send APNs; cross-device reminders while backgrounded are not possible. Each device schedules its own reminders from synced task data. (A future APNs bridge is a backend project, out of scope.)

---

## 10. Native Surfaces

These are net-new capabilities with no web equivalent. All share `GSDKit` and read the store through the **App Group** container.

### 10.1 Widgets (WidgetKit) — Home & Lock Screen

- **Home Screen widgets:**
  - *Quadrant Overview* — the 2×2 with live counts per quadrant (small/medium).
  - *Today's Focus* — top Q1 / due-today tasks (medium/large).
  - *Upcoming Deadlines* — next overdue/today/this-week items (medium/large).
- **Lock Screen widgets** (accessory family): a compact "active / due today" count and a "tap to capture" affordance.
- **Data path:** widgets read a snapshot from the shared store (App Group); refresh via `TimelineProvider` on a sensible cadence and on app writes (reload timelines). Tapping a widget deep-links (§4.3) into the relevant quadrant/task or the capture field.

### 10.2 App Intents / Siri / Shortcuts / Spotlight

Expose tasks to the system so users can act without opening the app. This is the **iOS-native analog of the MCP value proposition** (§11), additive to it.

- **Intents (minimum set):**
  - **Create Task** — parameters: title, urgent, important, due date, tags (run the §6.2 parser on the title so `!`/`*`/`#tag` work from Siri too). Phrase: *"Add an urgent task to GSD."*
  - **Complete Task** — by task reference/search.
  - **Open Quadrant / Smart View** — navigate.
  - **Query Tasks** — e.g. "what's due today," "show my Do First" (returns a snippet / opens a filtered list).
- **App Shortcuts:** provide `AppShortcutsProvider` phrases so common intents work with zero user setup; donate intents for Siri Suggestions.
- **Spotlight:** index tasks via **CoreSpotlight** (`CSSearchableItem`) and/or App-Intents `EntityQuery`, so tasks appear in system search and deep-link into the app.
- Intents and the app **share `GSDKit`** so creating a task from Siri/Shortcuts/Widget enqueues sync exactly like in-app creation.

### 10.3 Share Extension

Replaces the web app's PWA share-target. Accept **URLs and text** shared from other apps and create a task:
- Default to the **Eliminate (Q4)** quadrant (`urgent=false, important=false`), matching the web share-capture default.
- Clamp the title to a sane max (web clamps shared titles to 300 chars); parse comma-separated tags if provided (unique, lowercased, max 20); sanitize URLs (§6.2) into the description.
- Write through `GSDKit` into the shared store and enqueue sync.

### 10.4 Other system integrations (baseline)

- **Handoff / `NSUserActivity`** for continuing on another device (optional but cheap given activities are defined for Spotlight/Siri).
- **Quick Actions** (Home-Screen long-press): "New Task," "Today's Focus."
- **Keyboard shortcuts** (iPad): the §6.14 set, plus ⌘N (new), ⌘F (search), ⌘1–4 (jump to quadrant), etc.

---

## 11. MCP Server (unchanged)

The existing **MCP server is desktop-only and is not modified, bundled, or reimplemented** by the iOS app. It runs in Claude Desktop and talks to the **same PocketBase backend**. Because the iOS app writes to that shared backend, **MCP "just works" against the user's data** with no iOS-side effort — tasks created on iPhone are visible to Claude Desktop's MCP tools and vice-versa, mediated by the sync layer (§7).

For context (so the iOS team understands what already exists and must remain compatible), the MCP server exposes ~20 tools over the shared backend: reads (`list_tasks`, `get_task`, `search_tasks`, `get_task_stats`, `get_sync_status`, `list_devices`, `get_token_status`), writes (`create_task`, `update_task`, `complete_task`, `delete_task`, `bulk_update_tasks` — all support a dry-run preview), analytics (`get_productivity_metrics`, `get_quadrant_analysis`, `get_tag_analytics`, `get_upcoming_deadlines`, `get_task_insights`), and system tools (`validate_config`, `get_help`, `get_cache_stats`), plus prompt templates (daily standup, weekly review, focus mode, etc.). It authenticates with a PocketBase JWT (`GSD_AUTH_TOKEN`) against `GSD_POCKETBASE_URL`.

**Compatibility requirement for iOS:** keep the task data model and the PocketBase wire schema (§7.1) **exactly compatible** — any new field the iOS app introduces must be added in a way that round-trips through the existing collection without breaking MCP or the web app. The **native App Intents** surface (§10.2) is the iOS-side counterpart to MCP for on-device AI/automation; the two coexist.

---

## 12. Non-Functional Requirements

### 12.1 Offline-first
The app is **fully functional with no network and no account**. All reads/writes hit the local store synchronously; sync is a background reconciliation layer, never on the critical path of a user action. Optimistic UI everywhere; failures surface as unobtrusive, undoable errors.

### 12.2 Performance
- Launch to interactive quickly; the matrix must stay smooth with **hundreds of tasks** (use lazy lists; avoid recomputing analytics on the main thread).
- Run sync, analytics aggregation, and import/export off the main actor.
- Widgets and intents must read a lightweight snapshot, not the full store.

### 12.3 Accessibility (baseline — required)
- **Dynamic Type** throughout (no fixed font sizes that clip); layouts reflow at accessibility text sizes.
- **VoiceOver:** every interactive element labeled; cards expose a coherent reading order (title, quadrant, due, status) and custom actions for complete/snooze/edit.
- **Reduce Motion:** suppress confetti and non-essential animation.
- **Contrast:** quadrant accent colors meet WCAG AA against their backgrounds in both light and dark.
- **Hit targets** ≥ 44pt; full keyboard operability on iPad.
- Respect Increase Contrast / Bold Text / Reduce Transparency.

### 12.4 Privacy & security
- Local-only by default; **no analytics/tracking** without explicit opt-in.
- Auth tokens in **Keychain**; never logged.
- All backend traffic over **HTTPS**; validate inputs (the URL sanitizer in §6.2 is security-relevant — reject non-http(s) schemes, embedded credentials, and oversize URLs).
- **Logging:** structured, environment-aware, with **secret/content masking** — never log task content or tokens. Sentry (if used) is **opt-in** and ships only allowlisted diagnostic metadata (ids, phases, status codes), never task content. Mirror the web app's posture.

### 12.5 Error handling
- Typed errors distinguishing not-found / validation / network / auth.
- User-facing copy that is human and actionable; technical detail only in logs.
- Sync errors are recoverable (queue persists; manual retry available).

### 12.6 Testing & verification
- **Unit tests** for the pure logic ported from the web (and worth porting the web's test cases as fixtures): the capture parser grammar, quadrant derivation, recurrence date math, **BFS cycle detection**, filter pipeline, time-spent calculation, analytics/streak math, and the import merge/ID-remap logic.
- **Sync engine tests** against recorded PocketBase responses: LWW both directions, device-local-field preservation, deletion reconciliation, 429/backoff, echo filtering.
- **Snapshot/UI tests** for the matrix, editor, and adaptive iPhone/iPad layouts.
- **Accessibility audits** (VoiceOver pass, Dynamic Type at max).
- Follow TDD where practical (the project's standard): red → green → refactor.

---

## 13. App Store Requirements

- **Sign in with Apple** offered alongside Google/GitHub (Guideline 4.8) — settle the identity model (§8.4) first.
- **Privacy nutrition labels** accurate to actual behavior: if sync is enabled, the app stores user task content on the self-hosted backend tied to an account identifier; if Sentry is enabled, disclose diagnostic data. Local-only mode collects nothing.
- **Privacy policy** URL covering the optional backend and any opt-in diagnostics.
- **Permissions usage strings:** notifications (and any others) with clear `Info.plist` purpose strings.
- **App Group + Keychain access group** entitlements for widgets/extensions.
- **Background modes:** background fetch/processing for `BGTaskScheduler`.
- Standard metadata: icon, screenshots (iPhone + iPad), description, keywords.

---

## 14. Phased Roadmap

A suggested build order. Each phase is independently shippable/testable; this replaces a separate implementation plan since the app is built outside this repo.

- **Phase 0 — Foundations.** Xcode project, `GSDKit` package, App Group, GRDB store + versioned migrations, the `Task` model and all embedded types, ID generation compatible with the web app. Unit-test the model and limits.
- **Phase 1 — Core local app (no sync).** Matrix (iPhone stack + iPad 2×2), capture field **with the full parser**, editor, complete/uncomplete + confetti, delete, show-completed, theming. Pure offline. Port parser/quadrant/recurrence tests.
- **Phase 2 — Task depth.** Due dates + presets, recurrence engine, subtasks, snooze, dependencies + BFS cycle prevention, time tracking. Tests for each.
- **Phase 3 — Organization & insight.** Archive (manual + auto), smart views (built-ins + custom + pinning), search + command palette, analytics dashboard (Swift Charts), import/export, onboarding/About.
- **Phase 4 — Notifications.** Local scheduling, permission flow, quiet hours, badges, background-refresh sweep.
- **Phase 5 — Sync.** Hand-built PocketBase client (REST + SSE), OAuth via `ASWebAuthenticationSession`, Keychain tokens, the LWW push/pull engine, sync queue + retries, realtime + periodic safety net, sync history/health UI. **Resolve §8.4 identity before production.** This is the highest-risk phase — budget accordingly.
- **Phase 6 — Native surfaces.** Widgets, App Intents/Siri/Shortcuts, Spotlight, Share Extension, Quick Actions, iPad keyboard shortcuts.
- **Phase 7 — App Store readiness.** Sign in with Apple, privacy labels/policy, accessibility audit, screenshots, submission.

> Sync (Phase 5) can be deferred without blocking a useful local-only TestFlight after Phase 4 — consistent with the app's "sync is optional" ethos.

---

## 15. Open Questions & Risks

1. **Cross-provider identity (§8.4)** — *blocking for sync.* Decide account-linking vs. provider-constraint vs. email-keyed identity, and confirm the backend's current behavior. **Owner: backend.**
2. **No PocketBase Swift SDK** — the hand-built REST+SSE client is the single biggest engineering risk; validate against the live backend early (record fixtures) and budget Phase 5 generously.
3. **`time_entries` lossiness** — the wire form (`{id,startedAt,minutes}`) drops `endedAt`/`notes`. Confirm the local-preferred reconciliation (§7.2) is acceptable, or propose extending the collection.
4. **Sync-history retention** — the web keeps a bounded recent set (page size ~50). Confirm the exact cap/pruning the native app should use.
5. **iPhone matrix layout** — this spec recommends a stacked-quadrant list over a paged 2×2. Validate with a prototype; revisit if the 2×2 tests better.
6. **Confetti implementation** — choose a Reduce-Motion-aware approach (native `Canvas`/`TimelineView` vs. a small dependency); the web's particle counts (≈120 + 60×2) are a feel reference, not a hard requirement.
7. **Theming fidelity** — the web's editorial serif aesthetic needs a font decision (system serif vs. a bundled face) and an asset-catalog color system for the quadrant accents in light/dark.
8. **Spotlight vs. App Intents entity indexing** — pick one indexing path (or both) and confirm deep-link behavior.

---

## Appendix A — Authoritative enumerations (quick reference)

- **Recurrence:** `none`, `daily`, `weekly`, `monthly` (no "yearly").
- **Quadrants:** `urgent-important` (Do First), `not-urgent-important` (Schedule), `urgent-not-important` (Delegate), `not-urgent-not-important` (Eliminate).
- **Archive after:** 30 / 60 / 90 days (default 30).
- **Snooze presets:** 15 min, 30 min, 1 hour, 3 hours, Tomorrow (+1d), Next week (+7d); max 1 year.
- **Reminder presets:** 15 min, 30 min, 1 hour, 2 hours, 1 day (default 15 min).
- **Due-date presets:** None, Today, This week (Friday; next Friday if weekend), Next week (Monday).
- **Completion-trend windows:** 7 / 30 / 90 days.
- **Sync:** default auto interval 2 min; push throttle ~100 ms; retry backoff 5s/10s/30s/60s/300s; max 5 retries; pull overlap 30s.
- **Limits:** title 1–80; description 0–600; tag 1–30 (max 20 tags); subtask title 1–100 (max 50); dependencies max 50; time entries max 1000; estimate 1–10080 min; import max 10,000 tasks / ~10 MB.

## Appendix B — Field limits table

| Limit | Value |
|---|---|
| ID min length | 4 |
| Title | 1–80 chars |
| Description | 0–600 chars |
| Tag | 1–30 chars, max 20 tags |
| Subtask title | 1–100 chars, max 50 subtasks |
| Dependencies | max 50 |
| Time entry note | 0–200 chars, max 1000 entries |
| Estimated minutes | 1–10080 (7 days) |
| Default reminder | 15 minutes |
| Import | ≤ 10,000 tasks, ≤ ~10 MB JSON |
