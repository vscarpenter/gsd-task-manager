# Phase 2: Insights & Analytics Implementation Plan

## Overview
Transform GSD from a task tracker into a productivity insights tool by adding analytics, visualization, and smart features.

## Timeline: 3-4 weeks

---

## Feature 1: Dashboard Page (Week 1-2)

### Route Setup
- Create `/dashboard` route in App Router
- Add navigation between matrix and dashboard views
- Update AppHeader with dashboard/matrix toggle

### Core Metrics Module
**File**: `lib/analytics.ts`

```typescript
interface ProductivityMetrics {
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  activeStreak: number; // Consecutive days with completed tasks
  longestStreak: number;
  completionRate: number; // completed / total tasks
  quadrantDistribution: Record<QuadrantId, number>;
  tagStats: Array<{ tag: string; count: number; completionRate: number }>;
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
}

function calculateMetrics(tasks: TaskRecord[]): ProductivityMetrics
function getCompletionTrend(tasks: TaskRecord[], days: number): Array<{ date: string; completed: number }>
function getStreakData(tasks: TaskRecord[]): { current: number; longest: number }
```

### Data Visualization Components

**Component**: `components/dashboard/stats-card.tsx`
- Reusable card for displaying single metric
- Icon, value, label, trend indicator (+/-)
- Optional sparkline for trend visualization

**Component**: `components/dashboard/completion-chart.tsx`
- Line/bar chart showing completions over time
- Use lightweight charting library (recharts or Chart.js)
- 7-day, 30-day, 90-day views

**Component**: `components/dashboard/quadrant-distribution.tsx`
- Pie/donut chart showing task distribution across quadrants
- Color-coded by quadrant theme
- Click to filter matrix view by quadrant

**Component**: `components/dashboard/streak-indicator.tsx`
- Visual calendar heatmap (GitHub-style)
- Shows daily completion activity
- Highlights current streak

**Component**: `components/dashboard/tag-analytics.tsx`
- Table/list of tags with:
  - Task count per tag
  - Completion rate percentage
  - Most/least productive tags

**Component**: `components/dashboard/upcoming-deadlines.tsx`
- List of tasks due soon
- Grouped by: Overdue, Due Today, Due This Week
- Link to task for quick editing

### Dashboard Page Layout
**File**: `app/(dashboard)/dashboard/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Header with Matrix/Dashboard Toggle                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Completed      │   Active Streak │   Completion Rate       │
│  Today: 5       │   🔥 7 days     │   73%                   │
├─────────────────┴─────────────────┴─────────────────────────┤
│  Completion Trend (Line Chart)                              │
│  [7-day chart showing daily completions]                    │
├──────────────────────────────────┬──────────────────────────┤
│  Quadrant Distribution (Pie)     │  Upcoming Deadlines      │
│  [Visual pie chart]               │  • Overdue (3)           │
│                                   │  • Due Today (2)         │
│                                   │  • Due This Week (5)     │
├──────────────────────────────────┴──────────────────────────┤
│  Tag Analytics (Table)                                       │
│  #work: 15 tasks, 80% completion                            │
│  #personal: 8 tasks, 62% completion                         │
├──────────────────────────────────────────────────────────────┤
│  Activity Heatmap (Calendar)                                 │
│  [GitHub-style contribution graph]                           │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create analytics utility functions
- [ ] Add recharts dependency (`pnpm add recharts`)
- [ ] Build stats card component with Tailwind styling
- [ ] Implement completion trend chart
- [ ] Build quadrant distribution pie chart
- [ ] Create streak indicator with calendar heatmap
- [ ] Implement tag analytics table
- [ ] Add upcoming deadlines widget
- [ ] Create dashboard page route
- [ ] Add navigation toggle in header
- [ ] Write tests for analytics calculations
- [ ] Update CLAUDE.md documentation

---

## Feature 2: Enhanced Search & Filtering (Week 2-3)

### Advanced Search UI
**Component**: `components/advanced-search.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  🔍 Search: [keyword_________________]  [Filter ▼]     │
├─────────────────────────────────────────────────────────┤
│  Filters (when expanded):                               │
│  ☑ Urgent + Important    ☐ Urgent + Not Important      │
│  ☑ Not Urgent + Important ☐ Not Urgent + Not Important │
│                                                          │
│  Status: ○ All  ○ Active  ○ Completed                  │
│                                                          │
│  Tags: [#work ×] [#personal ×] [+ Add]                 │
│                                                          │
│  Due Date:                                               │
│  ○ All  ○ Overdue  ○ Due Today  ○ Due This Week        │
│  ○ Custom Range: [____] to [____]                      │
│                                                          │
│  Recurrence: ☐ None ☐ Daily ☐ Weekly ☐ Monthly        │
│                                                          │
│  [Clear All]           [Save as Smart View]             │
└─────────────────────────────────────────────────────────┘
```

### Smart Views (Saved Filters)
**Feature**: Pre-defined and custom saved searches

**Built-in Smart Views:**
1. **Today's Focus**
   - Due today + overdue + Q1 tasks
   - Most actionable items
2. **This Week**
   - Due within 7 days, sorted by quadrant
3. **Overdue Backlog**
   - All overdue tasks across quadrants
4. **No Deadline**
   - Tasks without due dates (for planning)
5. **Recently Added**
   - Tasks created in last 7 days
6. **Recently Completed**
   - Completed in last 7 days (with undo option)

**Custom Smart Views:**
- User-created saved filter combinations
- Stored in IndexedDB
- Quick access from dropdown

### Implementation Details

**File**: `lib/filters.ts`
```typescript
interface FilterCriteria {
  quadrants?: QuadrantId[];
  status?: 'all' | 'active' | 'completed';
  tags?: string[];
  dueDateRange?: { start?: string; end?: string };
  overdue?: boolean;
  dueToday?: boolean;
  dueThisWeek?: boolean;
  recurrence?: RecurrenceType[];
  searchQuery?: string;
}

interface SmartView {
  id: string;
  name: string;
  icon?: string;
  criteria: FilterCriteria;
  isBuiltIn: boolean;
  createdAt: string;
}

function applyFilters(tasks: TaskRecord[], criteria: FilterCriteria): TaskRecord[]
function saveSmartView(view: Omit<SmartView, 'id' | 'createdAt'>): Promise<SmartView>
function getSmartViews(): Promise<SmartView[]>
```

**Database Schema Update (v4):**
```typescript
this.version(4).stores({
  tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]",
  smartViews: "id, name, createdAt"  // New table
});
```

### Implementation Checklist
- [ ] Create filter criteria types and utilities
- [ ] Build advanced search panel component
- [ ] Implement quadrant filter checkboxes
- [ ] Add status radio buttons (All/Active/Completed)
- [ ] Create tag filter with multi-select
- [ ] Build due date range picker
- [ ] Add recurrence type filters
- [ ] Implement "Clear All" functionality
- [ ] Create SmartView save/load system
- [ ] Add SmartView dropdown to header
- [ ] Build built-in smart views
- [ ] Add custom smart view creation UI
- [ ] Update MatrixBoard to support filtering
- [ ] Write tests for filter logic
- [ ] Update CLAUDE.md

---

## Feature 3: Smart Notifications (Week 3)

### Browser Notification API Integration
**File**: `lib/notifications.ts`

```typescript
interface NotificationPreferences {
  enabled: boolean;
  morningReminder: boolean; // 9 AM daily summary
  overdueReminder: boolean; // Check every 2 hours
  dueTodayReminder: boolean; // 8 AM for due today tasks
  recurringTaskReminder: boolean; // When recurring task created
  reminderHours: number[]; // Hours to check (e.g., [9, 14, 18])
}

async function requestNotificationPermission(): Promise<boolean>
async function showNotification(title: string, options: NotificationOptions): Promise<void>
async function scheduleNotificationCheck(): Promise<void>
function getNotificationPreferences(): NotificationPreferences
function saveNotificationPreferences(prefs: NotificationPreferences): Promise<void>
```

### Notification Types
1. **Morning Summary** (9 AM)
   - "Good morning! You have 5 tasks due today and 2 overdue."
2. **Overdue Alert** (Every 2-4 hours)
   - "You have 3 overdue tasks. Tap to review."
3. **Due Today Reminder** (8 AM)
   - "Today's focus: Complete 'Client presentation' (Q1)"
4. **Recurring Task Created** (Immediate)
   - "New daily task created: 'Morning standup'"

### Settings Panel
**Component**: `components/settings-dialog.tsx`

```
┌────────────────────────────────────────────────┐
│  ⚙️ Settings                                    │
├────────────────────────────────────────────────┤
│  Notifications                                  │
│  ☑ Enable notifications                        │
│  ☑ Morning summary (9:00 AM)                  │
│  ☑ Overdue reminders (every 2 hours)          │
│  ☑ Due today alerts (8:00 AM)                 │
│  ☐ Recurring task notifications                │
│                                                 │
│  Check for notifications at:                    │
│  ☑ 9 AM  ☑ 2 PM  ☑ 6 PM                       │
│                                                 │
│  [Save Preferences]                             │
└────────────────────────────────────────────────┘
```

### Implementation using Service Worker
- Use existing `/public/sw.js` for background checks
- Store notification preferences in IndexedDB
- Schedule periodic checks using `setInterval` or Web Alarms API
- Show notifications when app is closed/backgrounded

### Implementation Checklist
- [ ] Create notification utility module
- [ ] Request notification permission on first use
- [ ] Implement notification scheduling logic
- [ ] Build settings dialog component
- [ ] Add notification preferences to IndexedDB schema (v4)
- [ ] Integrate with service worker for background checks
- [ ] Test notification delivery in various states
- [ ] Add "Snooze" and "Dismiss" actions
- [ ] Update CLAUDE.md

---

## Database Migration Strategy

### Version 4 Schema
```typescript
this.version(4)
  .stores({
    tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]",
    smartViews: "id, name, createdAt",
    preferences: "key" // For notification settings
  })
  .upgrade((trans) => {
    // Initialize default preferences
    return trans.table("preferences").add({
      key: "notifications",
      value: {
        enabled: false,
        morningReminder: true,
        overdueReminder: true,
        dueTodayReminder: true,
        recurringTaskReminder: false,
        reminderHours: [9, 14, 18]
      }
    });
  });
```

---

## Testing Strategy

### Unit Tests
- `lib/analytics.test.ts`: Metric calculations
- `lib/filters.test.ts`: Filter logic
- `lib/notifications.test.ts`: Notification scheduling

### Integration Tests
- Dashboard renders all metrics correctly
- Filters apply to task list properly
- Notifications trigger at correct times

### E2E Tests (Future)
- User navigates to dashboard and sees charts
- User creates and applies a smart view
- User enables notifications and receives alert

---

## Dependencies to Add

```json
{
  "recharts": "^2.12.0",  // For charts and visualizations
  "date-fns": "^3.0.0"     // For date manipulation (optional, can use native Date)
}
```

---

## Documentation Updates

### CLAUDE.md Additions
- Document dashboard analytics functions
- Explain smart view system
- Detail notification preferences
- Update database schema to v4

### README.md Additions
- Add dashboard feature description
- Explain smart views usage
- Document notification setup

---

## Success Metrics

After Phase 2 completion, measure:
- [ ] Dashboard loads in <500ms
- [ ] Filter operations complete in <100ms
- [ ] Notifications delivered within 1 minute of scheduled time
- [ ] User engagement: % of users who enable notifications
- [ ] Feature adoption: % of users who use dashboard weekly

---

## Phase 2 Deliverables

1. ✅ Working dashboard with 6+ visualizations
2. ✅ Advanced filtering with 6+ built-in smart views
3. ✅ Notification system with 4 notification types
4. ✅ Settings panel for customization
5. ✅ Database migration to v4
6. ✅ 85%+ test coverage for new features
7. ✅ Updated documentation (CLAUDE.md, README.md)

---

## Next: Phase 3 Preview

After Phase 2, we'll tackle:
- **Mobile-first optimizations**: Swipe gestures, touch targets, bottom nav
- **Batch operations**: Multi-select and bulk actions
- **Task templates**: Quick-add from templates
- **Rich text notes**: Markdown support in descriptions

Want to proceed with Phase 2? Let me know which feature to start with!
