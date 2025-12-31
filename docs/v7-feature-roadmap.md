# GSD Task Manager v7.0 Feature Roadmap

> Last updated: December 30, 2025

This document outlines the planned features for v7.0, including implementation status, technical details, and effort estimates.

---

## Overview

| Phase | Feature | Status | Effort |
|-------|---------|--------|--------|
| 1 | Quick Wins | ✅ Completed | 1 day |
| 2 | Time Tracking | ✅ Completed | 2 days |
| 3 | Task Templates | 🔲 Not Started | 2-3 days |
| 4 | Focus Mode | 🔲 Not Started | 2-3 days |
| 5 | Calendar View | 🔲 Not Started | 4-5 days |
| 6 | Recurring Improvements | 🔲 Not Started | 2-3 days |
| 7 | Collaboration | 🔲 Not Started | 5+ days |

---

## ✅ Phase 1: Quick Wins (COMPLETED)

Small improvements that enhance existing functionality.

### Features Implemented

| Feature | Description | Files Modified |
|---------|-------------|----------------|
| Add Filter button | Re-enabled filter popover access | `components/app-header.tsx` |
| Dependency visualization | Shows blocking/blocked indicators on task cards | Already in `components/task-card.tsx` |
| Snooze UI | Dropdown to snooze task notifications | `components/snooze-dropdown.tsx`, `lib/tasks/crud/snooze.ts` |
| Ready to Work smart view | Filters tasks with no blocking dependencies | `lib/filters.ts` |

### New Files Created
- `components/snooze-dropdown.tsx` - Snooze duration selector
- `components/ui/dropdown-menu.tsx` - Radix dropdown primitive
- `lib/tasks/crud/snooze.ts` - Snooze CRUD operations

---

## ✅ Phase 2: Time Tracking (COMPLETED)

Track time spent on tasks with estimation comparison.

### Features Implemented

| Feature | Description | Files Modified |
|---------|-------------|----------------|
| Schema fields | `estimatedMinutes`, `timeSpent`, `timeEntries` | `lib/types.ts`, `lib/schema.ts` |
| DB migration | Version 12 with time tracking fields | `lib/db.ts` |
| Timer component | Play/pause with real-time elapsed display | `components/task-timer.tsx` |
| Time estimation | Dropdown in task form (15min to 5 days) | `components/task-form/index.tsx` |
| Dashboard analytics | Time tracking summary and charts | `components/dashboard/time-analytics.tsx` |

### New Files Created
- `lib/tasks/crud/time-tracking.ts` - Time tracking CRUD operations
- `lib/analytics/time-tracking.ts` - Time analytics calculations
- `components/task-timer.tsx` - Timer UI component
- `components/dashboard/time-analytics.tsx` - Dashboard widget

### Data Model

```typescript
interface TimeEntry {
  id: string;
  startedAt: string;      // ISO datetime
  endedAt?: string;       // ISO datetime (undefined if running)
  notes?: string;         // Optional notes for the session
}

// Added to TaskRecord:
estimatedMinutes?: number;  // User's time estimate
timeSpent?: number;         // Total minutes tracked
timeEntries?: TimeEntry[];  // Individual tracking sessions
```

---

## 🔲 Phase 3: Task Templates (NOT STARTED)

Save and reuse common task configurations for recurring workflows.

### User Stories
- As a user, I want to save a task as a template so I can quickly create similar tasks
- As a user, I want to browse my templates and create tasks from them
- As a user, I want to manage (edit/delete) my saved templates

### Technical Implementation

| Component | Purpose | Location |
|-----------|---------|----------|
| `TaskTemplate` type | Template data structure | `lib/types.ts` |
| `templateSchema` | Zod validation | `lib/schema.ts` |
| DB table | `templates` table | `lib/db.ts` (v13) |
| CRUD operations | Create, list, update, delete | `lib/templates.ts` |
| Template picker | Selection UI | `components/template-picker.tsx` |
| Task form integration | "Save as template" button | `components/task-form/index.tsx` |

### Data Model

```typescript
interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  // Template content (subset of TaskDraft)
  template: {
    title: string;
    description?: string;
    urgent: boolean;
    important: boolean;
    recurrence: RecurrenceType;
    tags: string[];
    subtasks: Subtask[];
    estimatedMinutes?: number;
  };
}
```

### UI/UX Design
1. **Save as Template**: Button in task form (edit mode) to save current task as template
2. **Template Picker**: Modal with template list, preview, and "Use" button
3. **Template Manager**: Section in settings to view/edit/delete templates

### Effort Estimate
- Schema + CRUD: 0.5 days
- Template picker UI: 1 day
- Task form integration: 0.5 days
- Testing: 0.5 days
- **Total: 2-3 days**

---

## 🔲 Phase 4: Focus Mode (NOT STARTED)

Distraction-free single-task view with optional Pomodoro timer.

### User Stories
- As a user, I want to focus on one task at a time without distractions
- As a user, I want to use Pomodoro technique (25 min work / 5 min break)
- As a user, I want to track focus sessions in my time tracking

### Technical Implementation

| Component | Purpose | Location |
|-----------|---------|----------|
| Focus page | Full-screen focus view | `app/(focus)/focus/page.tsx` |
| Focus mode component | Task display + timer | `components/focus-mode/index.tsx` |
| Pomodoro timer | Work/break cycle management | `components/focus-mode/pomodoro-timer.tsx` |
| Timer hook | Pomodoro state machine | `lib/use-pomodoro.ts` |
| Focus settings | Customize durations | `components/settings/focus-settings.tsx` |

### Pomodoro Timer States

```typescript
type PomodoroState =
  | 'idle'
  | 'working'
  | 'short-break'
  | 'long-break'
  | 'paused';

interface PomodoroConfig {
  workMinutes: number;      // Default: 25
  shortBreakMinutes: number; // Default: 5
  longBreakMinutes: number;  // Default: 15
  sessionsBeforeLongBreak: number; // Default: 4
}
```

### UI/UX Design
1. **Entry point**: "Focus" button on task card or command palette action
2. **Focus view**: Full-screen with task title, description, subtasks, and timer
3. **Controls**: Start/pause, skip break, end focus session
4. **Integration**: Focus time automatically added to task's time tracking
5. **Notifications**: Browser notification when break starts/ends

### Keyboard Shortcuts
- `Space` - Start/pause timer
- `S` - Skip current phase (break)
- `Escape` - Exit focus mode

### Effort Estimate
- Focus mode UI: 1 day
- Pomodoro timer logic: 0.5 days
- Time tracking integration: 0.5 days
- Settings + notifications: 0.5 days
- Testing: 0.5 days
- **Total: 2-3 days**

---

## 🔲 Phase 5: Calendar View (NOT STARTED)

Visual timeline of tasks organized by due date.

### User Stories
- As a user, I want to see my tasks on a calendar to understand my schedule
- As a user, I want to drag tasks to reschedule them
- As a user, I want to switch between month, week, and day views

### Technical Implementation

| Component | Purpose | Location |
|-----------|---------|----------|
| Calendar page | New route | `app/(calendar)/calendar/page.tsx` |
| Calendar view | Main calendar component | `components/calendar/index.tsx` |
| Month view | Monthly grid | `components/calendar/month-view.tsx` |
| Week view | Weekly timeline | `components/calendar/week-view.tsx` |
| Day view | Daily schedule | `components/calendar/day-view.tsx` |
| Task pill | Compact task display | `components/calendar/task-pill.tsx` |

### Dependencies
Consider using one of:
- `@fullcalendar/react` - Full-featured, larger bundle
- `react-big-calendar` - Lighter weight
- Custom implementation with `date-fns` - Most control, more effort

### UI/UX Design
1. **Navigation**: Previous/Next buttons, "Today" button, view switcher
2. **Task display**: Color-coded by quadrant, shows title + time
3. **Drag-and-drop**: Drag tasks to change due date
4. **Click actions**: Click task to open edit dialog
5. **Overdue indicator**: Visual highlight for past-due tasks

### Effort Estimate
- Calendar library integration: 1 day
- View components: 2 days
- Drag-and-drop reschedule: 1 day
- Testing + polish: 1 day
- **Total: 4-5 days**

---

## 🔲 Phase 6: Recurring Task Improvements (NOT STARTED)

Enhanced recurrence patterns beyond daily/weekly/monthly.

### User Stories
- As a user, I want to set custom intervals (every 3 days, every 2 weeks)
- As a user, I want to select specific weekdays (Mon/Wed/Fri)
- As a user, I want to set an end condition (after 10 times, until Dec 31)
- As a user, I want to skip specific dates (holidays)

### Technical Implementation

| Component | Purpose | Location |
|-----------|---------|----------|
| Enhanced recurrence type | New data structure | `lib/types.ts` |
| Recurrence schema | Zod validation | `lib/schema.ts` |
| Recurrence calculator | Next occurrence logic | `lib/recurrence.ts` |
| Recurrence editor | UI for pattern selection | `components/recurrence-editor.tsx` |
| Skip dates manager | Holiday/exception dates | `components/skip-dates.tsx` |

### Data Model

```typescript
interface RecurrencePattern {
  type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval?: number;           // Every N days/weeks/months
  weekdays?: number[];         // 0-6 for Sun-Sat
  monthDay?: number;           // Day of month (1-31)
  endType?: 'never' | 'after' | 'until';
  endAfter?: number;           // Number of occurrences
  endUntil?: string;           // ISO date
  skipDates?: string[];        // ISO dates to skip
}
```

### Migration Strategy
- Keep existing `recurrence: 'none' | 'daily' | 'weekly' | 'monthly'` working
- Add optional `recurrencePattern` field for advanced patterns
- Migrate existing tasks to new format gradually

### Effort Estimate
- Data model + schema: 0.5 days
- Recurrence calculation logic: 1 day
- Recurrence editor UI: 1 day
- Testing: 0.5 days
- **Total: 2-3 days**

---

## 🔲 Phase 7: Collaboration Features (NOT STARTED)

Share and collaborate on tasks with other users.

### User Stories
- As a user, I want to share a task with someone via a link
- As a user, I want to collaborate on a shared task list
- As a user, I want to assign tasks to team members
- As a user, I want to comment on tasks

### Technical Implementation

| Component | Purpose | Location |
|-----------|---------|----------|
| Sharing endpoint | Generate share links | `worker/src/routes/share.ts` |
| Shared lists | Collaborative lists | `worker/src/routes/lists.ts` |
| Comments | Task discussions | `worker/src/routes/comments.ts` |
| User lookup | Find users by email | `worker/src/routes/users.ts` |
| Share dialog | UI for sharing | `components/share-dialog.tsx` |
| Comments panel | Task comments UI | `components/comments-panel.tsx` |

### Backend Requirements
- New D1 tables: `shared_tasks`, `task_lists`, `list_members`, `comments`
- Permission system: owner, editor, viewer roles
- Real-time updates: Consider WebSocket or polling

### Security Considerations
- Share links should be unguessable (UUID v4)
- Encryption key sharing for E2E encrypted tasks
- Rate limiting on share link generation
- Audit log for access

### Effort Estimate
- Backend schema + endpoints: 2 days
- Frontend share UI: 1 day
- Comments system: 1.5 days
- Testing + security: 1.5 days
- **Total: 5+ days**

---

## Implementation Priority

Recommended order based on user value vs. effort:

1. **Phase 3: Task Templates** - High value, moderate effort
2. **Phase 4: Focus Mode** - Differentiating feature
3. **Phase 6: Recurring Improvements** - Fills functionality gap
4. **Phase 5: Calendar View** - Visual enhancement
5. **Phase 7: Collaboration** - Major feature, high complexity

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-30 | Initial roadmap, Phase 1 & 2 completed |
