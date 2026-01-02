# GSD Task Manager - Features & Functionality Guide

**Get Stuff Done** — A privacy-first, open-source task manager built on the Eisenhower Matrix productivity framework.

- **Live App**: [gsd.vinny.dev](https://gsd.vinny.dev)
- **Version**: 6.5.0
- **License**: MIT
- **Tech Stack**: Next.js 16, React 19, TypeScript, IndexedDB, Cloudflare Workers

---

## Executive Summary

GSD Task Manager is a modern web application that helps users prioritize tasks using the time-tested Eisenhower Matrix framework—distinguishing between what's urgent and what's truly important. Unlike commercial task managers that lock your data in proprietary clouds, GSD takes a **privacy-first, local-first approach**: your tasks live in your browser's IndexedDB by default, with optional end-to-end encrypted sync when you need it.

**What makes GSD different:**

- **Zero tracking, zero analytics, zero data collection** — Your task data never leaves your device unless you explicitly enable encrypted sync
- **Framework-driven productivity** — The Eisenhower Matrix forces intentional prioritization, helping you focus on what matters rather than what's merely urgent
- **Power-user features without complexity** — Dependencies, recurring tasks, subtasks, batch operations, and advanced analytics—all with a clean, intuitive interface
- **Command-driven workflow** — Universal ⌘K command palette for instant access to any action, task, or setting
- **Progressive Web App** — Install on any device, works completely offline, no app store required
- **AI-powered with Claude Desktop** — Natural language task management through the MCP server (optional)

**Target Users:**
- Productivity enthusiasts who value proven frameworks over gamification
- Privacy-conscious individuals who want control over their data
- Remote workers managing complex projects with dependencies
- Anyone overwhelmed by commercial task managers' bloat and subscription fees

**The Value Proposition:**
_"Get Stuff Done while keeping your data yours."_ Work smarter with proven productivity science, own your data completely, and choose your own adventure: local-only for maximum privacy, or encrypted sync for multi-device workflows.

---

## Core Concept: The Eisenhower Matrix

### The Framework

The Eisenhower Matrix, named after President Dwight D. Eisenhower, is a decision-making framework that categorizes tasks along two dimensions:

- **Urgency** — Does this require immediate attention? Is there a deadline?
- **Importance** — Does this contribute to long-term goals? Does it have real impact?

This creates four distinct quadrants, each with a different action strategy:

```
                    URGENT              NOT URGENT
               ┌─────────────────┬─────────────────┐
               │                 │                 │
IMPORTANT      │   Q1: DO FIRST  │  Q2: SCHEDULE   │
               │   Crises        │   Strategic     │
               │   Deadlines     │   Planning      │
               │   Emergencies   │   Learning      │
               │                 │                 │
               ├─────────────────┼─────────────────┤
               │                 │                 │
NOT IMPORTANT  │  Q3: DELEGATE   │  Q4: ELIMINATE  │
               │   Interruptions │   Time-wasters  │
               │   Busy work     │   Distractions  │
               │   Others' goals │   Mindless acts │
               │                 │                 │
               └─────────────────┴─────────────────┘
```

### How GSD Implements the Matrix

**Visual Design:**
- Each quadrant is color-coded (Blue, Amber, Emerald, Purple) with distinct background shading
- Tasks are displayed as cards within their respective quadrants
- Drag-and-drop between quadrants updates urgency/importance flags automatically
- Responsive 2×2 grid on desktop, vertical stack on mobile

**Task Classification** (`lib/quadrants.ts`):
```typescript
function resolveQuadrantId(urgent: boolean, important: boolean): QuadrantId {
  if (urgent && important) return "urgent-important";        // Q1: Do First
  if (!urgent && important) return "not-urgent-important";   // Q2: Schedule
  if (urgent && !important) return "urgent-not-important";   // Q3: Delegate
  return "not-urgent-not-important";                         // Q4: Eliminate
}
```

When creating or editing a task, users simply toggle two switches (Urgent/Important), and GSD automatically places it in the correct quadrant. This simplicity is deceptive—it forces users to make conscious decisions about priority rather than defaulting everything to "high priority."

### Best Practices for Task Categorization

**Q1: Do First (Urgent + Important)**
- _Examples_: Customer emergencies, project deadlines, critical bugs
- _Strategy_: Minimize time spent here; too many Q1 tasks indicates poor planning
- _GSD Features_: Overdue warnings (red borders), due today alerts (amber), deadline tracking

**Q2: Schedule (Not Urgent + Important)**
- _Examples_: Long-term planning, skill development, relationship building, strategic work
- _Strategy_: This is where you should spend most of your time for sustainable success
- _GSD Features_: Calendar integration via due dates, recurring tasks for habits, dependency chains for complex projects

**Q3: Delegate (Urgent + Not Important)**
- _Examples_: Some emails, interruptions, other people's priorities masquerading as your own
- _Strategy_: If you can't delegate, minimize time and batch similar tasks
- _GSD Features_: Batch operations for quick processing, tags for categorization

**Q4: Eliminate (Not Urgent + Not Important)**
- _Examples_: Busy work, excessive social media, low-value meetings
- _Strategy_: Be ruthless—these tasks don't deserve space in your workflow
- _GSD Features_: If a task sits in Q4 for weeks, bulk delete it during weekly reviews

**Dashboard Analytics** help you validate your approach:
- **Quadrant distribution chart** shows where your tasks concentrate—ideally Q2 should dominate
- **Completion rates by quadrant** reveal if you're firefighting (high Q1 completion) or planning (high Q2 completion)
- **Trend analysis** (7/30/90 days) helps you see if you're shifting from reactive to proactive over time

---

## Privacy-First Architecture

### The Local-First Philosophy

GSD is built on a **local-first** architecture, meaning your browser is the source of truth—not a remote server. This design choice has profound implications for privacy, performance, and user control.

**How it works:**

1. **IndexedDB as Primary Storage** (`lib/db.ts`)
   - All tasks stored in browser's IndexedDB (Dexie wrapper for developer ergonomics)
   - Database schema: `tasks`, `archivedTasks`, `smartViews`, `notificationSettings`, `syncQueue`, `syncMetadata`, `deviceInfo`, `archiveSettings`, `syncHistory`, `appPreferences`
   - Current schema version: 12 (migrations handle backward compatibility)
   - Supports millions of tasks without performance degradation

2. **No Server by Default**
   - The application is a static Next.js export served from CloudFront/S3
   - No database, no API, no backend required for core functionality
   - No tracking pixels, no analytics services, no third-party scripts
   - Works entirely offline after first load (PWA service worker caches assets)

3. **Data Never Leaves Device** (unless sync enabled)
   - Task content, titles, descriptions, tags, subtasks—all stored locally
   - No telemetry, no crash reports, no usage analytics sent anywhere
   - Browser clearing data is the only way to lose tasks (export regularly!)

**Privacy guarantees:**

- ✅ **No user accounts required** — Install and start using immediately
- ✅ **No IP logging** — Static site has no access logs for user activity
- ✅ **No fingerprinting** — No attempt to identify or track users
- ✅ **No third-party cookies** — Zero cross-site tracking
- ✅ **Open source** — Verify privacy claims by reading the code


### What Data Never Leaves Your Device

When running in **local-only mode** (default), the following data stays on your device:

- ✅ All task content (titles, descriptions)
- ✅ Quadrant classifications and urgency/importance flags
- ✅ Tags, subtasks, checklists
- ✅ Due dates, recurrence patterns, dependencies
- ✅ Notification preferences and settings
- ✅ Smart views and custom filters
- ✅ Completion history, streaks, analytics
- ✅ Archive settings and archived tasks

**The only data that leaves your device:**
- ❌ None (in local-only mode)

**If you enable sync (optional):**
- Encrypted task blobs (AES-256-GCM, zero-knowledge server)
- Device metadata (device ID, last seen timestamp)
- Sync metadata (vector clocks for conflict resolution)

See "Cloud Sync" section below for details on the encrypted sync architecture.

### How Sync Works Without Compromising Privacy

**Optional Cloud Sync** is available for users who need multi-device access. The design maintains **end-to-end encryption** with a **zero-knowledge server**:

**The Challenge:**
- Traditional cloud sync sends plaintext data to servers (Todoist, Asana, Notion, etc.)
- Server operators can read, analyze, monetize, or leak your data
- Requires blind trust in privacy policies that can change overnight

**GSD's Solution:**

1. **Client-Side Encryption** (`lib/sync/crypto.ts`)
   - User chooses a passphrase (never sent to server)
   - Passphrase + salt → PBKDF2 (600k iterations) → 256-bit encryption key
   - Each task → JSON → AES-256-GCM (96-bit random nonce per operation)
   - Result: `{encryptedBlob, nonce, checksum}` sent to Worker

2. **Zero-Knowledge Server** (`worker/src/`)
   - Cloudflare Worker stores only encrypted blobs in D1 (SQLite)
   - Worker has zero ability to decrypt task content
   - Encryption salt is stored encrypted (useless without user's passphrase)
   - Server only sees: blob size, upload timestamp, device ID

3. **Local Decryption Only**
   - When syncing down, encrypted blobs fetched from Worker
   - Client decrypts locally using passphrase → original task data
   - If passphrase is wrong, decryption fails (no password recovery!)

**What the server knows:**
- You have an account (email from OAuth provider)
- You have N devices registered
- You have M tasks (count only, not content)
- Last sync timestamp per device

**What the server cannot know:**
- Task titles, descriptions, tags, subtasks, due dates
- Which quadrants your tasks are in
- Anything about your productivity or workflow

**Security Implementation:**
- AES-256-GCM (authenticated encryption with associated data)
- PBKDF2 with 600,000 iterations (OWASP 2023 recommendation)
- Unique 96-bit nonce per encryption operation (no nonce reuse)
- SHA-256 checksums for integrity verification
- JWT authentication with 7-day expiry (signed with 256-bit secret)
- Rate limiting: 100 requests/minute per IP via Cloudflare KV

### Data Ownership and Export Capabilities

**You own your data completely.** No lock-in, no proprietary formats, no barriers to migration.

**Export features:**
- One-click download of all tasks as JSON
- Human-readable format (open in any text editor)
- Includes all task properties (nothing hidden)
- Timestamped for version tracking
- Can be checked into version control (track task history with git!)

**Import features:**
- **Merge mode** (safe): Keeps existing tasks, adds imported tasks, auto-regenerates duplicate IDs
- **Replace mode** (destructive): Deletes all tasks, replaces with imported (shows warning + task count)
- Zod schema validation ensures data integrity
- Supports importing from any version (migrations applied automatically)

**Use cases:**
- Regular backups before major changes
- Migrate to another task manager (export → transform → import)
- Share task lists with team (export subset → send JSON)
- Disaster recovery (browser crash, IndexedDB corruption)
- Historical analysis (export weekly, diff in git)

**Recommendation:** Export monthly and store in cloud backup (Dropbox, Google Drive, etc.). The file size is tiny (thousands of tasks = ~1 MB), so storage is never an issue.

---

## Key Features

### Task Management

#### Task Creation and Quick Entry

**Multiple entry points:**

1. **New Task Button** (header)
   - Always visible, primary call-to-action
   - Opens full task form dialog
   - Keyboard shortcut: `n` (global)

2. **Keyboard-Driven Workflow**
   - Press `n` anywhere in app → task form opens
   - Focus automatically on title field
   - Tab through form fields (title → description → urgent → important → due date → ...)
   - Enter to save, Escape to cancel
   - Zero mouse clicks required for power users

3. **Task Form** (`components/task-form.tsx`)
   - **Title** (required, 1-80 chars): Short, actionable description
   - **Description** (optional, 0-600 chars): Additional context, notes, links
   - **Urgent toggle**: Time-sensitive? Deadline approaching?
   - **Important toggle**: High-value? Strategic? Long-term impact?
   - **Due Date picker**: Optional deadline with date + time
   - **Recurrence**: None, Daily, Weekly, Monthly
   - **Tags**: Multi-select with autocomplete from existing tags
   - **Subtasks**: Checklist editor with add/remove/reorder
   - **Dependencies**: Select tasks that must complete first (circular detection)
   - **Notifications**: Enable/disable, set reminder (5 min to 1 day before due)

**Validation** (`lib/schema.ts`):
- Zod schemas enforce data integrity at runtime
- Title: 1-80 chars (prevents empty or overly long)
- Description: max 600 chars (keeps tasks focused)
- Tags: max 30 chars each (prevents tag bloat)
- Subtask titles: max 100 chars
- Due dates: must be valid ISO 8601 datetime with timezone
- All validation errors shown inline with helpful messages

**Smart Defaults:**
- New tasks default to Q2 (Schedule) — encourages proactive planning
- Notifications enabled by default (15 minutes before due date)
- Recurrence set to "none" (one-time tasks are most common)
- Tags and subtasks start empty (add as needed)

#### Task Editing and State Management

**In-Place Editing:**
- Click edit icon (pencil) on any task card
- Same form as creation, pre-populated with current values
- Changes saved immediately to IndexedDB
- Live updates across all views (matrix, dashboard, smart views)

**Quick Actions** (task card):
- **Complete** (checkmark icon): Toggle completion status
  - Completed tasks fade, show completion timestamp
  - If recurring, new instance auto-created with next due date
  - Subtasks reset to uncompleted in new instance
- **Edit** (pencil icon): Open full edit form
- **Delete** (trash icon): Confirmation dialog, permanent removal
- **Selection mode** (batch operations): Click anywhere on card to select

**Moving Between Quadrants:**
1. **Drag-and-drop** (`components/matrix-board.tsx`, `@dnd-kit/core`)
   - Grab task card, drag to different quadrant
   - Visual feedback during drag (shadow, drop zone highlight)
   - Urgency/importance flags update automatically on drop
   - Touch-friendly (works on mobile)

2. **Edit form**
   - Toggle urgent/important switches
   - Quadrant updates automatically when saved

3. **Bulk operations**
   - Select multiple tasks → "Move to Quadrant" dropdown
   - All selected tasks update at once

**State Persistence:**
- Every change writes to IndexedDB immediately (no "save" button)
- Optimistic updates (UI updates instantly, IndexedDB write happens async)
- If write fails, UI reverts and shows error toast
- All operations wrapped in Dexie transactions (atomic updates)

#### Bulk Operations and Multi-Select

**Selection Mode** (`components/bulk-actions-bar.tsx`, `lib/bulk-operations.ts`):

**Activating selection mode:**
- Click "Select Tasks" button in header, OR
- Click anywhere on a task card (not on action icons)
- Visual ring indicator appears on selected cards
- Selection persists across quadrants (select from Q1, Q2, etc.)

**Bulk Actions Bar** (floating at bottom):
- **Selection count**: Shows "3 tasks selected" with clear button
- **Complete selected**: Mark all as done (or reopen if already complete)
- **Move to Quadrant**: Dropdown menu to change urgency/importance for all
- **Add Tags**: Opens dialog to add tags to all selected tasks
- **Delete selected**: Confirmation dialog, then permanent removal
- **Assign Dependencies**: (Future feature) Set blocking relationships


**Use cases:**
- **Weekly review**: Select all Q4 tasks → bulk delete
- **Sprint planning**: Select related tasks → bulk add #sprint-3 tag
- **Emergency pivot**: Select all project tasks → move to Q1 (urgent)
- **Batch completion**: Finished 5 quick tasks → select all → complete
- **Cleanup**: Select all completed tasks older than 30 days → bulk delete

**Safety features:**
- Confirmation dialog for destructive operations (delete)
- Undo not supported (use export/backup before bulk deletes)
- Toast notifications show operation results ("5 tasks completed")
- Error handling: if one task fails, others still process (partial success)

#### Task Dependencies and Relationships

**Purpose:**
Define prerequisite relationships between tasks to enforce proper sequencing in complex projects.

**UI** (`components/task-form-dependencies.tsx`):

1. Open task form (create or edit)
2. Scroll to "Dependencies" section
3. Search/filter available tasks
4. Click to add dependency (appears as chip with X to remove)
5. Real-time circular dependency validation
6. Save task with updated dependencies

**Rules enforced:**

- ✅ Can't depend on self
- ✅ Can't depend on completed tasks (already done, no point)
- ✅ Can't create circular dependencies (A → B → C → A detected via BFS)
- ✅ Can depend on tasks in any quadrant
- ✅ Can have multiple dependencies (task blocked by 5 others = valid)


**Use cases:**

- **Project phases**: "Deploy to production" depends on "Run integration tests" and "Approval from PM"
- **Learning paths**: "Advanced React" depends on "Learn React basics"
- **Sequential workflows**: "Invoice client" depends on "Deliver project" depends on "Client approval"

**Cleanup:**
When deleting a task, all dependency references are automatically removed from other tasks (prevents dangling references).

#### Recurring Tasks

**Purpose:**

Automatically recreate tasks on a schedule for habits, routines, and periodic work.

**Recurrence types** (`lib/schema.ts`):

- **None** (default): One-time task
- **Daily**: Every day (e.g., morning standup, exercise)
- **Weekly**: Every 7 days (e.g., weekly review, team meeting)
- **Monthly**: Same day each month (e.g., expense reports, invoicing)

**Behavior** (`lib/tasks.ts`):

1. User marks recurring task as complete
2. Task completion saves normally (completed = true, completedAt = now)
3. **Immediately after**, GSD creates a new task instance:
   - Same title, description, urgency, importance, tags
   - Same recurrence pattern (stays recurring)
   - Subtasks copied with `completed: false` (fresh checklist)
   - **New due date** calculated based on recurrence type
   - `parentTaskId` set to original task ID (links instances)


**Visual indicators:**
- Recurring tasks show ⟳ (repeat icon) on task card
- Due date displays next occurrence
- Original and instances have separate IDs (can diverge)

**Use cases:**
- **Daily habits**: Morning review, exercise, journaling
- **Weekly routines**: Team standup, weekly planning, laundry
- **Monthly chores**: Pay rent, review finances, oil change reminder

**Limitations:**
- No advanced patterns (every 2 weeks, 1st and 15th, etc.)
- No end date (recurring tasks continue forever until deleted)
- No skip/postpone (mark complete → new instance always created)

#### Tags and Labels

**Purpose:**
Cross-cutting categorization beyond quadrants (projects, contexts, priorities).

**Implementation** (`components/task-form-tags.tsx`):
- Multi-select tag input with autocomplete
- Tags stored as `string[]` on task record
- Indexed for fast filtering (`*tags` multi-entry index)

**Tag input features:**
- Type to search existing tags
- Autocomplete dropdown shows matching tags
- Click tag to add (appears as colored chip)
- Click X on chip to remove
- Can add multiple tags per task
- Tags created on-the-fly (no pre-registration)

**Tag display:**
- Shown as colored chips on task cards (primary, secondary, accent colors)
- Color assignment deterministic (hash tag name → color)
- Clicking tag (future feature) filters to that tag


**Search integration:**
- Global search (`/` keyboard shortcut) searches tag content
- Search "work" matches tasks tagged #work
- Can combine search with filters (e.g., urgent tasks tagged #client-x)

**Common tag patterns:**
- **Projects**: #project-alpha, #website-redesign, #q4-goals
- **Contexts**: #work, #personal, #home, #errands
- **Priorities**: #high-priority, #quick-win, #deep-work
- **Waiting**: #waiting-for, #blocked, #follow-up

**Best practices:**
- Use consistent naming (lowercase, hyphens, no spaces)
- Start with # for visual consistency (optional)
- Keep tags focused (3-5 main tags, not 50)
- Review tag analytics monthly to prune unused tags

#### Subtasks and Checklists

**Purpose:**
Break down complex tasks into smaller, actionable steps with progress tracking.


**UI** (`components/task-form-subtasks.tsx`):
- Text input to add new subtask
- List of existing subtasks with checkboxes
- Click checkbox to toggle completion
- Click X to remove subtask
- Reorder via drag-and-drop (future feature)


**Recurring task behavior:**
- When recurring task completes → new instance created
- Subtasks copied to new instance with `completed: false`
- Provides fresh checklist for next occurrence

**Search integration:**
- Global search includes subtask titles
- Search "data gathering" matches tasks with that subtask

**Use cases:**
- **Project tasks**: "Launch website" → [Design mockups, Write copy, Deploy, Test]
- **Shopping lists**: "Grocery shopping" → [Milk, Eggs, Bread, Coffee]
- **Process checklists**: "Monthly close" → [Export transactions, Reconcile accounts, Generate reports]

**Limitations:**
- One level only (no nested subtasks)
- No due dates on individual subtasks
- No dependencies between subtasks (sequential execution via list order)

### Advanced Filtering and Smart Views

**Purpose:**
Save common filter combinations for quick access to specific task subsets.

**Smart Views** (`lib/filters.ts`, `components/smart-view-selector.tsx`):

**7 Built-in Views** (pre-configured, cannot delete):
1. **Today's Focus**: Due today OR overdue, active only
2. **This Week**: Due within 7 days, active only
3. **Overdue Backlog**: Past due date, active only
4. **No Deadline**: No due date set, active only
5. **Recently Added**: Created in last 7 days
6. **Recently Completed**: Completed in last 7 days
7. **Recurring Tasks**: Recurrence ≠ 'none'

**Custom Smart Views** (user-created):
- Click "Save as Smart View" button when filters are active
- Name the view (e.g., "Q1 #work tasks", "Blocked by dependencies")
- View appears in smart view selector dropdown
- Click to apply saved filters instantly
- Delete custom views via trash icon


**Filter application** (`lib/filters.ts:applyFilters()`):
- Filters applied in sequence (AND logic)
- Quadrants: task.quadrant in selected quadrants
- Status: completed flag match
- Tags: task.tags intersects with selected tags (any match)
- Due date: compare task.dueDate against range
- Text search: fuzzy match against title, description, tags, subtask titles

**UI Components:**
- **FilterBar** (`components/filter-bar.tsx`): Shows active filters as removable chips
- **FilterPopover** (`components/filter-panel.tsx`): Detailed filter editor with collapsible sections
- **Smart View Selector** (`components/smart-view-selector.tsx`): Dropdown in header
- **Add Filter Button**: _Currently disabled_ (smart views provide sufficient filtering)

**Use cases:**
- **Focus sessions**: Create "Deep Work" view → Q2 tasks tagged #deep-work, no dependencies
- **Client reviews**: "Client X Tasks" → All tasks tagged #client-x, active only
- **Weekly planning**: "This Week" built-in view → see upcoming deadlines
- **Dependency tracking**: "Blocked Tasks" → isBlocked = true

**Performance:**
- Filters run client-side (no server queries)
- IndexedDB indexes optimize common filters (quadrant, completed, tags)
- Filter logic unit tested (99.23% coverage)

### Productivity Features

#### Dashboard and Analytics

**Overview** (`app/(dashboard)/dashboard/page.tsx`):
Comprehensive productivity analytics with interactive visualizations. Toggle between Matrix and Dashboard views via header.


**Visualization Components** (`components/dashboard/`):

1. **Stats Cards** (`stats-card.tsx`)
   - Total tasks, active tasks, completed tasks
   - Completion rate with percentage
   - Trend indicators (up/down arrows for 7-day change)
   - Color-coded borders (green for positive trends)

2. **Completion Trend Chart** (`completion-chart.tsx`)
   - Recharts line/bar chart (toggleable)
   - X-axis: Last 7/30/90 days (period selector)
   - Y-axis: Number of tasks
   - Two data series: Created (blue), Completed (green)
   - Hover tooltips with exact counts
   - Responsive (adjusts to viewport)

3. **Quadrant Distribution** (`quadrant-distribution.tsx`)
   - Recharts pie chart
   - Shows active tasks per quadrant
   - Color-matched to quadrant colors (blue, amber, emerald, purple)
   - Percentage labels + counts
   - Validates focus areas (Q2 should be largest slice ideally)

4. **Streak Indicator** (`streak-indicator.tsx`)
   - Flame icon with current streak count
   - "X days" label
   - Shows longest streak below
   - Encourages daily task completion

5. **Tag Analytics Table** (`tag-analytics.tsx`)
   - Sortable table: Tag | Total | Completed | Rate
   - Progress bars for visual completion rate
   - Click to filter tasks by tag (future feature)
   - Sorted by usage (most used tags first)

6. **Upcoming Deadlines** (`upcoming-deadlines.tsx`)
   - Grouped sections: Overdue | Due Today | Due This Week
   - Task cards with due date, quadrant badge
   - Color-coded (red for overdue, amber for today)
   - Empty state if no deadlines


### Synchronization and Backup

#### OAuth Authentication

**Providers Supported:**
- **Google** (OIDC-compliant)
- **Apple** (OIDC-compliant)

**Flow** (`worker/src/handlers/oidc/`):

1. **Initiate** (`initiate.ts`)
 
   - User clicks "Sign in with Google/Apple" button
   - Frontend generates PKCE code verifier + challenge (SHA-256)
   - Redirect to OAuth provider with state parameter
   - State stored in KV for 10 minutes (prevents CSRF)

2. **Callback** (`callback.ts`)

   - OAuth provider redirects back with authorization code
   - Worker validates state parameter (CSRF protection)
   - Exchanges code for tokens (PKCE verification)
   - Fetches user profile (email, name)
   - Stores session in KV (24 hours)
   - Redirects to frontend with result token

3. **Result** (`result.ts`)

   - Frontend polls /api/auth/oidc/result/:resultId
   - Worker returns JWT token + device ID
   - Frontend stores in localStorage
   - User now authenticated

**Security Features:**

- PKCE (Proof Key for Code Exchange) prevents authorization code interception
- State parameter prevents CSRF attacks
- ID token verification (JWT signature validation)
- Short-lived session tokens (24 hours)
- JWT tokens with 7-day expiry (refresh flow required)

**Device Registration:**

- Each device gets unique ID (UUID)
- Device name stored (e.g., "MacBook Pro", "iPhone 15")
- Tracked in D1 database (devices table)
- Last seen timestamp updated on each sync

#### Sync Frequency and Controls

**Sync Triggers:**

1. **Manual Sync**
   - Click sync button in header
   - Forces immediate sync (bypasses throttling)
   - Shows spinner during sync
   - Toast notification on completion

2. **Automatic Background Sync** ⭐ NEW (v5.7.0)
   - **Enabled by default** when sync is turned on
   - Configurable interval (1-30 minutes, default: 2 minutes)
   - Smart triggers:
     - **Periodic**: Syncs every N minutes when changes are pending
     - **Tab Focus**: Syncs when returning to the tab after being away
     - **Network Reconnect**: Syncs immediately when coming back online
     - **Debounced After Edits**: Syncs 30 seconds after the last task change
   - Respects conditions: only syncs when online + changes pending
   - Minimum 15-second interval between syncs (prevents spam)
   - Can be disabled in Settings → Cloud Sync

3. **Service Worker Background Sync** (when PWA installed, Chrome/Edge only)
   - Periodic Background Sync API for true background syncing
   - Syncs even when app is closed (if PWA installed)
   - Requires sync enabled + PWA installed
   - Fallback to automatic background sync on unsupported browsers

**Sync Settings** (`components/settings/sync-settings.tsx`):
- Auto-sync toggle (enable/disable automatic background sync)
- Sync interval slider (1-30 minutes)
- Real-time interval preview
- Helpful explanations of all sync triggers
- View last sync timestamp
- Manual sync button (always available)
- View sync history
- Device list with last seen
- Sign out button (clears JWT, stops sync)

**Sync Status Indicators:**
- **Green checkmark**: Last sync successful, no conflicts
- **Yellow warning**: Conflicts detected, manual resolution needed
- **Red error**: Sync failed, retry or check connection
- **Spinner**: Sync in progress

#### Conflict Resolution Strategy

**The Problem:**
Two devices edit the same task offline, then both sync. Which version wins?



**Resolution Strategies:**

1. **Last-Write-Wins** (default)
   - Compare `updatedAt` timestamps
   - Most recent edit wins, other discarded
   - Simple, automatic, no user intervention
   - Risk: may lose edits if clocks skewed

2. **Manual Resolution** (future feature)
   - Show both versions side-by-side
   - User picks winning version or merges manually
   - Preserves all data, no silent loss
   - UX burden on user

**Cascade Sync** (`lib/sync/engine/coordinator.ts`):
- After resolving conflicts, immediately push resolution
- Ensures all devices converge to same state
- Prevents ping-pong conflicts (A → B → A → B...)

**Example Scenario:**
```
Device A (MacBook):
  - Edit task title: "Finish report" → "Finish quarterly report"
  - Vector clock: {A: 5}
  - updatedAt: 2025-01-08T10:00:00Z

Device B (iPhone):
  - Edit same task description: "Draft" → "Final version"
  - Vector clock: {B: 3}
  - updatedAt: 2025-01-08T10:05:00Z

Sync conflict detected (neither clock dominates):
  - Last-write-wins: Device B wins (newer timestamp)
  - Result: Title reverts to "Finish report", description becomes "Final version"
  - Cascade sync: Device B pushes winning version → Device A pulls and updates
```

#### Manual Backup and Restore

**Export Tasks** (Settings → Export):
- Downloads `gsd-tasks-YYYY-MM-DD.json`
- Contains all active tasks + metadata
- Human-readable JSON format
- Can be opened in any text editor

**Import Tasks** (Settings → Import):

1. **Select file** (JSON from export)
2. **Choose mode**:
   - **Merge**: Keep existing + add imported (safe, no data loss)
     - Duplicate IDs auto-regenerated
     - Shows summary: "X existing, Y imported, Z total"
   - **Replace**: Delete all + replace with imported (destructive)
     - Confirmation dialog: "This will delete 42 tasks. Continue?"
     - Irreversible (unless you exported first!)

3. **Validation** (Zod schema):
   - Checks JSON structure matches `importPayloadSchema`
   - Validates all task records against `taskRecordSchema`
   - If validation fails, import rejected with error message

4. **Result**:
   - Success toast: "Imported 25 tasks"
   - Failure toast: "Import failed: [error message]"

**Backup Best Practices:**
- Export before major operations (bulk delete, replace import)
- Schedule monthly exports (calendar reminder)
- Store backups in cloud (Dropbox, Google Drive, iCloud)
- Name files with dates for version history
- Test restore occasionally (verify backup integrity)

#### Data Portability Features

**Migration to Other Systems:**

GSD's export format is intentionally simple to facilitate migration:


**No Vendor Lock-In:**
- Standard JSON format
- No proprietary encoding
- No required API access for export
- Can parse and transform with any language
- Works with jq, Python, JavaScript, etc.

---

## User Experience Highlights

### Onboarding Flow

**First-Time User Experience:**

1. **Landing** (Matrix view)
   - Empty state with helpful message: "No tasks yet. Click 'New Task' to get started."
   - Visual guide image showing the four quadrants
   - Prominent "New Task" button

2. **First Task Creation**
   - Form opens with inline help text
   - Tooltips on urgent/important toggles explain quadrants
   - Example task pre-filled (user can edit or clear)
   - Success message after creation with celebration animation

3. **Help Dialog** (triggered by `?` key or help icon)
   - Tabbed sections: Getting Started, Matrix Guide, Features, Shortcuts
   - Visual examples with screenshots
   - Links to dashboard, settings, PWA install instructions

4. **Progressive Disclosure**
   - Basic features shown first (title, urgency, importance)
   - Advanced features (tags, subtasks, dependencies) collapsed
   - Tooltips reveal on hover for curious users

**No Sign-Up Required:**
- Start using immediately
- No email, no password, no verification
- Data stored locally from first task
- Sync opt-in presented in settings (not forced)

### Responsive Design

**Breakpoints** (Tailwind):
- **Mobile** (<640px): Single column, stacked quadrants
- **Tablet** (640-1024px): 2x2 grid with smaller cards
- **Desktop** (>1024px): Full 2x2 grid with spacious cards

**Mobile Optimizations:**
- Touch targets: 44x44px minimum (Apple HIG compliant)
- Swipe gestures: Swipe task card left → delete (future feature)
- Bottom navigation: Fixed footer with primary actions
- Viewport height handling: Accounts for mobile browser chrome
- Font scaling: Readable text sizes (16px minimum)

**Tablet Optimizations:**
- Hybrid layout: Grid on landscape, stack on portrait
- Sidebar navigation (future feature)
- Split-screen support (iPad multitasking)

**Desktop Enhancements:**
- Keyboard shortcuts (n, /, ?, Escape)
- Hover states for interactive elements
- Drag-and-drop between quadrants
- Multi-column layouts for dashboard

### Accessibility Features

**Keyboard Navigation:**
- Tab through all interactive elements
- Focus visible (outline on focused elements)
- Shortcuts announced via screen readers
- Escape to close dialogs/modals
- Enter to submit forms

**Screen Reader Support:**
- Semantic HTML (header, nav, main, section, article)
- ARIA labels on all buttons/icons
  ```tsx
  <button aria-label="Delete task">
    <Trash className="h-4 w-4" aria-hidden="true" />
  </button>
  ```
- ARIA live regions for toast notifications
  ```tsx
  <div role="status" aria-live="polite" aria-atomic="true">
    Task created successfully
  </div>
  ```
- Descriptive alt text on images (future feature: image attachments)

**Color Contrast:**
- WCAG AA compliance (4.5:1 for normal text, 3:1 for large)
- High contrast theme option in dark mode
- Color not sole indicator (quadrants have text labels + colors)

**Focus Management:**
- Dialog opens → focus moves to first input
- Dialog closes → focus returns to trigger button
- Tab trapping in modals (Escape to exit)

**Reduced Motion:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Offline Functionality

**PWA Service Worker** (`public/sw.js`):

**Cache Strategy:**
- **App Shell** (HTML, CSS, JS): Cache-first (instant load)
- **Static Assets** (icons, fonts): Cache-first, update in background
- **API Calls** (if sync enabled): Network-first, fallback to cache

**Offline Capabilities:**
- ✅ View all tasks (IndexedDB persists across sessions)
- ✅ Create new tasks (saved to IndexedDB)
- ✅ Edit tasks (changes queued for sync)
- ✅ Delete tasks (soft delete, synced when online)
- ✅ Complete tasks (optimistic update)
- ✅ Navigate between Matrix/Dashboard (no network required)
- ❌ OAuth sign-in (requires network)
- ❌ Initial sync setup (requires network)

**Sync Queue** (when offline):
- All changes written to `syncQueue` table
- Operations: create, update, delete
- When online, queue flushed to server
- Consolidation: Multiple edits to same task merged into one operation

**Offline Indicator:**
- Browser native (no custom UI)
- Tasks still fully functional
- Sync button shows "Offline" state
- Queued changes badge count

### PWA Capabilities

**Installation:**

**Desktop (Chrome/Edge):**
1. Visit gsd.vinny.dev
2. Click install icon in address bar
3. Confirm "Install GSD Task Manager"
4. App opens in standalone window (no browser chrome)
5. Added to Applications folder (macOS) or Start Menu (Windows)

**Mobile (iOS Safari):**
1. Visit gsd.vinny.dev in Safari
2. Tap Share button (square with up arrow)
3. Scroll and tap "Add to Home Screen"
4. Edit name if desired, tap "Add"
5. Icon appears on home screen

**Mobile (Android Chrome):**
1. Visit gsd.vinny.dev in Chrome
2. Tap three-dot menu → "Install app"
3. Confirm installation
4. App appears in app drawer

**PWA Features:**

**Standalone Mode:**
- No browser UI (address bar, tabs, etc.)
- Full-screen work area
- Native app feel
- System integration (notifications, badge)

**App Shortcuts** (`public/manifest.json`):
```json
"shortcuts": [
  {
    "name": "New Task",
    "url": "/?action=new-task",
    "icons": [...]
  },
  {
    "name": "View Matrix",
    "url": "/",
    "icons": [...]
  }
]
```
- Long-press app icon → quick actions
- Deep links to specific features

**Background Sync:**
- Registers Background Sync on install
- Syncs pending changes even when app closed
- Requires sync enabled + PWA installed
- Chrome/Edge only (not Safari)

**Push Notifications:**
- Due date reminders
- Overdue task alerts
- Sync conflict notifications
- Requires permission grant + PWA installed

**Update Mechanism** (`components/pwa-update-toast.tsx`):
1. Service worker detects new version
2. Toast appears: "New version available. Refresh?"
3. User clicks "Refresh" → app reloads with updates
4. User clicks "Dismiss" → update deferred until next visit

---

## UI/UX Enhancements (v5.10.0)

### Command Palette — Universal Search and Action Interface

The **Command Palette** is GSD's power-user feature for instant access to any action, task, or setting through a single keyboard shortcut.

**Opening the Command Palette:**
- Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) anywhere in the app
- Keyboard-first interface with no mouse required
- Remembers your last search query when reopened

**Features:**

1. **Universal Search**
   - Search across all tasks by title, description, tags, and subtasks
   - Real-time filtering as you type (shows top 10 matches)
   - Task results include quadrant badge, completion status, and tags
   - Click any task to navigate to it in the matrix view

2. **Quick Actions**
   - Create new task (`⌘N`)
   - Toggle theme (`⌘T`)
   - Export/import tasks
   - Trigger sync (if enabled)
   - Toggle selection mode
   - Clear selection (when active)

3. **Navigation**
   - View matrix (`⌘M`)
   - View dashboard (`⌘D`)
   - View archived tasks
   - View sync history (if sync enabled)

4. **Smart Views**
   - All 7 built-in smart views accessible instantly
   - Apply any view filter with a single click
   - Displays view name and description for context

5. **Settings**
   - Open settings (`⌘,`)
   - Open user guide (`?`)

**Implementation Details:**
- Built with `cmdk` library (v1.1.1) for accessible keyboard navigation
- Uses Radix UI Dialog primitives for accessibility
- Fuzzy search matches against action labels and keywords
- Grouped sections (Tasks, Actions, Navigation, Smart Views, Settings)
- Arrow keys to navigate, Enter to select, Escape to close
- Displays keyboard shortcuts for each action when available

**Use Cases:**
- **Quick task lookup**: Type "quarterly report" to find related tasks instantly
- **Fast navigation**: `⌘K` → "dashboard" → Enter (3 keystrokes to dashboard)
- **Action discovery**: Explore all available actions without memorizing shortcuts
- **Theme switching**: `⌘K` → `⌘T` → toggle theme (or use command palette to trigger)

**Keyboard Navigation:**
```
⌘K / Ctrl+K      Open/close command palette
↑ / ↓             Navigate items
Enter             Execute action/select task
Escape            Close palette
```

---

### Quick Settings Panel — Streamlined Preference Access

The **Quick Settings Panel** provides instant access to frequently-adjusted preferences without opening the full settings dialog.

**Opening the Panel:**
- Click the settings icon in the header (gear icon)
- Panel slides out from the right side
- Non-modal (can click outside to close)

**Settings Available:**

1. **Theme**
   - Light / Dark / System (auto)
   - Three-button toggle for instant switching
   - Icon indicators (sun, moon, monitor)
   - Changes apply immediately

2. **Show Completed Tasks**
   - Toggle switch to show/hide completed tasks in matrix view
   - Syncs with matrix board state
   - Useful for focusing on active work vs. reviewing accomplishments

3. **Notifications**
   - Enable/disable browser notifications
   - Requests permission on first enable
   - Applies to all task due date reminders

4. **Auto-Sync Interval** (conditional)
   - Only shown if sync is enabled AND auto-sync is on
   - Slider control from 1-30 minutes
   - Real-time preview (e.g., "Tasks sync automatically every 5 minutes")
   - Changes apply immediately to sync schedule

**Link to Full Settings:**
- "All settings" button at bottom of panel
- Opens full settings dialog with tabs for advanced options

**Implementation Details:**
- Built with Radix UI Sheet primitive (slide-out panel)
- Uses Radix UI Slider for sync interval control
- State managed by `useQuickSettings` hook
- Emits CustomEvents for cross-component reactivity:
  - `toggle-completed` — Syncs show/hide completed state with matrix board
  - Settings persisted to IndexedDB (appPreferences table)

**Use Cases:**
- **Theme switching**: Quickly adapt to changing lighting conditions
- **Focus mode**: Hide completed tasks to focus on active work
- **Sync tuning**: Adjust sync frequency based on network conditions or battery life
- **Notification management**: Disable reminders during focused work sessions

---

### Smart View Pinning — Instant Filter Access

**Smart View Pinning** allows you to pin up to 5 frequently-used smart views to the header for instant access with keyboard shortcuts.

**Pinning Smart Views:**
1. Click the "More" button (three dots) in the header smart view area
2. Opens the full Smart View Selector dialog
3. Click the pin icon next to any smart view to pin/unpin
4. Pinned views appear as pills in the header (max 5)

**Keyboard Shortcuts:**
- `1-9` — Activate pinned smart view at that position (e.g., `2` activates 2nd pinned view)
- `0` — Clear active smart view filter (show all tasks)
- Shortcuts disabled when typing in input fields (automatic detection)

**Visual Indicators:**
- Active view highlighted with primary button styling (blue background)
- Inactive views shown with subtle button styling (gray background)
- Keyboard shortcut badge shown on desktop (`1`, `2`, etc.)
- "Clear" button appears when a view is active (shows `0` shortcut)

**Horizontal Scrolling:**
- Pills scroll horizontally on narrow screens
- No visible scrollbar (cleaner UI)
- Touch-friendly swipe gestures on mobile

**"More" Button:**
- Opens full smart view selector for all 7+ views
- Highlighted with ring indicator if no view is currently active
- Access to custom smart view creation (future feature)

**Implementation Details:**
- Pinned view IDs stored in `appPreferences` table (IndexedDB)
- `getPinnedSmartViews()` loads pinned views on component mount
- `pinnedViewsChanged` CustomEvent emitted when pins change (reactivity)
- `useSmartViewShortcuts` hook handles keyboard shortcuts with typing detection
- `isTypingElement()` helper prevents shortcuts when typing in inputs

**Use Cases:**
- **Daily workflow**: Pin "Today's Focus" for quick access at start of day (`1` → today's tasks)
- **Weekly planning**: Pin "This Week" for planning sessions (`2` → week view)
- **Sprint tracking**: Pin custom sprint view for agile workflows
- **Context switching**: Quick toggle between work/personal views with number keys

**Example Pin Setup:**
```
1. 📅 Today's Focus          (Shortcut: 1)
2. 📆 This Week              (Shortcut: 2)
3. ⏰ Overdue Backlog        (Shortcut: 3)
4. 🔁 Recurring Tasks        (Shortcut: 4)
5. ✅ Recently Completed     (Shortcut: 5)

Press 0 to clear and view all tasks
```

---

### Enhanced Keyboard Navigation

GSD v5.10.0 introduces comprehensive keyboard shortcuts for power users who prefer keyboard-driven workflows.

**Global Shortcuts** (work anywhere in app):
```
⌘K / Ctrl+K      Open command palette
n                 Create new task
/                 Focus search bar
?                 Show help dialog
Escape            Close dialogs/modals
```

**Smart View Shortcuts:**
```
1-9               Activate pinned smart view at position
0                 Clear active smart view filter
```

**Command Palette Shortcuts:**
```
⌘M / Ctrl+M      View matrix
⌘D / Ctrl+D      View dashboard
⌘T / Ctrl+T      Toggle theme
⌘, / Ctrl+,      Open settings
⌘N / Ctrl+N      Create new task
```

**Task Form Shortcuts:**
```
Tab               Move to next field
Shift+Tab         Move to previous field
Enter             Submit form (if valid)
Escape            Cancel and close
```

**Navigation Shortcuts:**
```
Arrow keys        Navigate command palette items
Enter             Execute action/select item
Escape            Close palette/dialog
```

**Accessibility Features:**
- All shortcuts respect typing context (disabled in input fields)
- Screen reader announcements for state changes
- Focus management (dialog open → focus first input, close → return to trigger)
- ARIA labels and live regions for non-visual feedback

**Discovering Shortcuts:**
- Open command palette (`⌘K`) to see all shortcuts
- Hover tooltips show keyboard shortcuts on desktop
- Help dialog (`?`) lists all shortcuts with descriptions

---

## Technical Implementation Excellence

### State Management Approach

**Philosophy:**
Avoid over-engineered global state. Use React fundamentals + IndexedDB as source of truth.

**Architecture:**

1. **IndexedDB = Single Source of Truth**
   - All persistent state stored in Dexie
   - No Redux, no Zustand, no MobX
   - Components read via `useLiveQuery()` hook
   - Writes via direct Dexie API calls

2. **React State for UI Only**
   - Dialog open/closed states: `useState()`
   - Form inputs: Controlled components with `useState()`
   - Selection mode: `useState<Set<string>>(new Set())`
   - Transient UI states only, never persisted data

3. **Server State (if sync enabled)**
   - JWT token: localStorage
   - Sync metadata: IndexedDB (`syncMetadata` table)
   - No React Query, no SWR (unnecessary complexity)

**Data Flow:**
```
User action (click, keypress)
  ↓
Event handler (onClick, onSubmit)
  ↓
Business logic (lib/tasks.ts, lib/filters.ts)
  ↓
Dexie write (db.tasks.update(), db.tasks.add())
  ↓
IndexedDB persists
  ↓
useLiveQuery() detects change
  ↓
React re-renders affected components
  ↓
UI updates (task card moves, count increments)
```

**Example** (Task Completion):
```tsx
// Component
function TaskCard({ task }: { task: TaskRecord }) {
  const handleComplete = async () => {
    await toggleTaskCompletion(task.id);
  };

  return (
    <button onClick={handleComplete}>
      {task.completed ? <CheckCircle /> : <Circle />}
    </button>
  );
}

// Business logic (lib/tasks.ts)
export async function toggleTaskCompletion(id: string): Promise<void> {
  const task = await db.tasks.get(id);
  if (!task) throw new Error('Task not found');

  const completed = !task.completed;
  const now = new Date().toISOString();

  await db.tasks.update(id, {
    completed,
    completedAt: completed ? now : undefined,
    updatedAt: now
  });

  // If recurring + completed, create new instance
  if (completed && task.recurrence !== 'none') {
    await createRecurringInstance(task);
  }
}

// Live query hook
function MatrixBoard() {
  const { all, byQuadrant } = useTasks(); // Re-runs on any task change

  return (
    <div>
      {quadrantOrder.map(qid => (
        <MatrixColumn key={qid} tasks={byQuadrant[qid] || []} />
      ))}
    </div>
  );
}
```

**Benefits:**
- ✅ Simple mental model (database → UI, no middleware)
- ✅ No prop drilling (components query DB directly)
- ✅ No stale data (live queries always fresh)
- ✅ Easy to debug (check IndexedDB in DevTools)
- ✅ TypeScript enforces schema (Zod validation + TS types)

### Component Architecture

**Design Principles:**
- **Co-location**: Keep related code together (component + styles + logic)
- **Single Responsibility**: Each component does one thing well
- **Composition over Inheritance**: Build complex UIs from simple primitives
- **File size limit**: ~300 lines max, split if exceeding

**Component Structure:**

```
components/
├── ui/                    # shadcn primitives (button, dialog, input)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   └── ...
├── matrix-board.tsx       # Main matrix container (590 lines)
├── matrix-column.tsx      # Single quadrant column (120 lines)
├── task-card.tsx          # Individual task display (180 lines)
├── task-form.tsx          # Create/edit task dialog (250 lines)
├── task-form-tags.tsx     # Tag input with autocomplete (85 lines)
├── task-form-subtasks.tsx # Subtask checklist editor (90 lines)
├── task-form-dependencies.tsx # Dependency selector (110 lines)
├── bulk-actions-bar.tsx   # Floating action bar (95 lines)
├── app-header.tsx         # Header with search, new task, settings (180 lines)
├── settings-dialog.tsx    # Import/export, sync settings (220 lines)
├── dashboard/             # Analytics components
│   ├── stats-card.tsx
│   ├── completion-chart.tsx
│   ├── quadrant-distribution.tsx
│   └── ...
└── user-guide/            # Help dialog sections (modularized)
    ├── user-guide-dialog.tsx (163 lines, down from 1,049!)
    ├── shared-components.tsx
    ├── getting-started-section.tsx
    ├── matrix-section.tsx
    └── ...
```

**Modular Refactoring Example** (October 2025):

**Before** (UserGuideDialog.tsx: 1,049 lines):
- Monolithic component with all guide content inline
- Hard to navigate, slow to edit
- Violated 300-line coding standard

**After** (13 modular files):
- `user-guide-dialog.tsx`: 163 lines (wrapper + navigation)
- `shared-components.tsx`: Reusable guide primitives (GuideSection, QuadrantBlock, FeatureBlock)
- 11 section components: Each <120 lines, single topic, independently maintainable
- Preserved exact same UI/UX
- Easier to update (edit one section without scrolling through 1,000 lines)

**Component Patterns:**

**1. Presentation Components** (no business logic):
```tsx
export function TaskCard({ task, onComplete, onEdit, onDelete }: Props) {
  return (
    <div className="task-card">
      <h3>{task.title}</h3>
      <p>{task.description}</p>
      <button onClick={() => onComplete(task.id)}>Complete</button>
    </div>
  );
}
```

**2. Container Components** (fetch data, handle logic):
```tsx
export function MatrixBoard() {
  const { byQuadrant } = useTasks(); // Data fetching
  const [selectedIds, setSelectedIds] = useState(new Set()); // UI state

  const handleBulkComplete = async (completed: boolean) => {
    await bulkComplete(selectedIds, completed);
    setSelectedIds(new Set()); // Clear selection
  };

  return (
    <div>
      {quadrantOrder.map(qid => (
        <MatrixColumn
          tasks={byQuadrant[qid]}
          selectedIds={selectedIds}
          onSelect={id => setSelectedIds(prev => new Set(prev).add(id))}
        />
      ))}
      <BulkActionsBar
        selectedIds={selectedIds}
        onComplete={handleBulkComplete}
      />
    </div>
  );
}
```

**3. Form Components** (controlled inputs, validation):
```tsx
export function TaskForm({ taskId }: Props) {
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const result = taskDraftSchema.safeParse({ title, ... });
    if (!result.success) {
      setErrors(result.error.issues.map(i => i.message));
      return;
    }

    await createTask(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={e => setTitle(e.target.value)} />
      {errors.map(err => <p className="error">{err}</p>)}
    </form>
  );
}
```

### Testing Coverage and Strategies

**Test Framework:**
- Vitest (Vite-native, faster than Jest)
- @testing-library/react (component testing)
- @testing-library/jest-dom (assertions)
- @testing-library/user-event (interaction simulation)
- fake-indexeddb (IndexedDB mocking)

**Test Organization:**
```
tests/
├── ui/                    # Component tests
│   ├── task-card.test.tsx
│   ├── task-form.test.tsx
│   ├── matrix-column.test.tsx
│   ├── bulk-actions-bar.test.tsx
│   └── ... (18 files)
├── data/                  # Business logic tests
│   ├── tasks.test.ts
│   ├── filters.test.ts
│   ├── dependencies.test.ts
│   ├── analytics.test.ts
│   └── ... (20 files)
└── integration/           # End-to-end workflows (future)
```

**Coverage Thresholds** (`vitest.config.ts`):
```typescript
coverage: {
  thresholds: {
    statements: 80,  // 80% of statements executed
    lines: 80,       // 80% of lines covered
    functions: 80,   // 80% of functions called
    branches: 75     // 75% of conditional branches taken
  }
}
```

**Current Coverage** (66 test files):
- **Data Layer**: 90%+ (tasks.ts, filters.ts, dependencies.ts, analytics.ts)
- **UI Components**: 75%+ (task-card, task-form, matrix-column)
- **Sync Engine**: 85%+ (crypto, api-client, conflict resolution)
- **Overall**: ~82% (exceeds targets)

**Testing Patterns:**

**1. Component Tests** (behavior-driven):
```tsx
// tests/ui/task-card.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('TaskCard', () => {
  it('marks task as complete when checkmark clicked', async () => {
    const task = createMockTask({ completed: false });
    const onComplete = vi.fn();

    render(<TaskCard task={task} onComplete={onComplete} />);

    await userEvent.click(screen.getByLabelText('Complete task'));

    expect(onComplete).toHaveBeenCalledWith(task.id);
  });

  it('shows overdue warning for past due dates', () => {
    const task = createMockTask({
      dueDate: '2024-01-01T00:00:00Z' // Past
    });

    render(<TaskCard task={task} />);

    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});
```

**2. Data Logic Tests** (pure functions):
```typescript
// tests/data/filters.test.ts
import { applyFilters } from '@/lib/filters';

describe('applyFilters', () => {
  it('filters tasks by quadrant', () => {
    const tasks = [
      createTask({ quadrant: 'urgent-important' }),
      createTask({ quadrant: 'not-urgent-important' })
    ];

    const filtered = applyFilters(tasks, {
      quadrants: ['urgent-important']
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].quadrant).toBe('urgent-important');
  });

  it('combines multiple filters with AND logic', () => {
    const tasks = [
      createTask({ quadrant: 'urgent-important', tags: ['#work'], completed: false }),
      createTask({ quadrant: 'urgent-important', tags: ['#personal'], completed: false }),
      createTask({ quadrant: 'urgent-important', tags: ['#work'], completed: true })
    ];

    const filtered = applyFilters(tasks, {
      quadrants: ['urgent-important'],
      tags: ['#work'],
      status: 'active'
    });

    expect(filtered).toHaveLength(1);
  });
});
```

**3. Integration Tests** (IndexedDB workflows):
```typescript
// tests/data/tasks.test.ts
import { createTask, updateTask, deleteTask } from '@/lib/tasks';
import { db } from '@/lib/db';

beforeEach(async () => {
  await db.tasks.clear(); // Clean slate for each test
});

describe('Task CRUD', () => {
  it('creates task and stores in IndexedDB', async () => {
    const draft = {
      title: 'Test task',
      urgent: true,
      important: false
    };

    const task = await createTask(draft);

    expect(task.id).toBeDefined();
    expect(task.quadrant).toBe('urgent-not-important');

    const stored = await db.tasks.get(task.id);
    expect(stored?.title).toBe('Test task');
  });

  it('updates task and increments vector clock', async () => {
    const task = await createTask({ title: 'Original' });
    const deviceId = await getDeviceId();

    await updateTask(task.id, { title: 'Updated' });

    const updated = await db.tasks.get(task.id);
    expect(updated?.title).toBe('Updated');
    expect(updated?.vectorClock[deviceId]).toBeGreaterThan(0);
  });
});
```

**Test Utilities:**
- `createMockTask()`: Generate realistic test data
- `setupTestDb()`: Initialize fake IndexedDB
- `mockAuthToken()`: Stub JWT authentication
- `waitForElement()`: Async assertions for DOM updates

**CI/CD Integration:**
```bash
# package.json scripts
"test": "vitest run",              # CI mode (single run)
"test:watch": "vitest",            # Dev mode (watch files)
"test:coverage": "vitest run --coverage"  # Generate reports
```

**Coverage Reports:**
- HTML report: `coverage/index.html` (line-by-line highlighting)
- LCOV: `coverage/lcov.info` (CodeCov integration)
- JSON summary: `coverage/coverage-summary.json` (CI parsing)

### Build and Deployment Process

**Build Pipeline:**

```bash
# 1. Clean previous builds
npm run clean  # Removes .next/ and out/ directories

# 2. Generate build info (git commit, timestamp)
node scripts/generate-build-info.js
# Creates .build-env.sh with NEXT_PUBLIC_BUILD_* env vars

# 3. Build Next.js app
source .build-env.sh && next build
# - TypeScript compilation (strict mode)
# - React compilation (Turbopack + React Compiler)
# - CSS optimization (Tailwind purging)
# - Bundle splitting (code splitting by route)
# - Image optimization
# - Static export generation

# 4. Deploy to S3
aws s3 sync out/ s3://gsd.vinny.dev/ \
  --delete \
  --exclude "*.html" \
  --exclude "sw.js" \
  --cache-control "public,max-age=31536000,immutable"

# HTML files (separate command for cache control)
aws s3 sync out/ s3://gsd.vinny.dev/ \
  --exclude "*" \
  --include "*.html" \
  --include "sw.js" \
  --cache-control "public,max-age=0,must-revalidate"

# index.html (force no-cache)
aws s3 cp s3://gsd.vinny.dev/index.html s3://gsd.vinny.dev/index.html \
  --metadata-directive REPLACE \
  --cache-control "no-cache,no-store,must-revalidate"

# 5. Deploy CloudFront Function (URL rewriting)
./scripts/deploy-cloudfront-function.sh
# - Creates/updates function
# - Publishes to LIVE stage
# - Attaches to distribution
# - Invalidates CloudFront cache

# 6. Invalidate CDN
aws cloudfront create-invalidation \
  --distribution-id E1T6GDX0TQEP94 \
  --paths "/*"
# - Clears edge cache globally
# - Propagates in ~2-3 minutes
```

**CloudFront Edge Routing** (`cloudfront-function-url-rewrite.js`):

**Why needed:**
- Next.js static export with `trailingSlash: true` creates `/dashboard/index.html`
- S3 bucket endpoints don't auto-serve `index.html` for directory paths
- Navigating to `/dashboard/` returns 403 Forbidden without URL rewriting

**How it works:**
```javascript
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Rewrite directory paths to index.html
  if (uri.endsWith('/') || !uri.includes('.')) {
    request.uri = uri.endsWith('/')
      ? uri + 'index.html'     // /dashboard/ → /dashboard/index.html
      : uri + '/index.html';   // /dashboard → /dashboard/index.html
  }

  return request;
}
```

**Deployment:**
```bash
./scripts/deploy-cloudfront-function.sh

# Steps:
# 1. aws cloudfront create-function (if new) or update-function
# 2. aws cloudfront publish-function --if-match [ETag]
# 3. aws cloudfront get-distribution-config → modify → update-distribution-config
# 4. aws cloudfront create-invalidation --paths "/*"
```

**Performance Characteristics:**
- Runs at CloudFront edge (sub-millisecond latency)
- Processes 100% of viewer requests (before S3 origin)
- Lightweight JavaScript runtime (no Node.js overhead)
- Cost: ~$0.10 per million invocations

**Multi-Environment Deployment:**

| Environment | Frontend URL | Worker URL | Purpose |
|------------|--------------|------------|---------|
| **Dev** | localhost:3000 | localhost:8787 | Local development |
| **Staging** | gsd-dev.vinny.dev | gsd-dev-worker.vinny.dev | Pre-production testing |
| **Prod** | gsd.vinny.dev | gsd.vinny.dev/api | Live application |

**Worker Deployment:**
```bash
cd worker/

# Deploy to all environments
npm run deploy:all

# Or individually:
npm run deploy:dev     # Uses wrangler.dev.toml
npm run deploy:staging # Uses wrangler.staging.toml
npm run deploy:prod    # Uses wrangler.toml

# Migrations (run after schema changes):
npm run migrations:dev
npm run migrations:staging
npm run migrations:prod
```

**Environment Variables** (per environment):
- `DATABASE` (D1): Encrypted task storage
- `KV_NAMESPACE` (KV): Sessions, rate limiting
- `R2_BUCKET` (R2): Backup storage (future)
- `JWT_SECRET`: 256-bit signing key
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: OAuth
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`: OAuth

**Security:**
```bash
# Set secrets (not checked into git)
wrangler secret put JWT_SECRET --env prod
wrangler secret put GOOGLE_CLIENT_SECRET --env prod
wrangler secret put APPLE_PRIVATE_KEY --env prod
```

### Browser Compatibility

**Supported Browsers:**
- ✅ Chrome 111+ (full support, including View Transitions)
- ✅ Edge 111+ (full support)
- ✅ Safari 18+ (partial View Transitions support)
- ✅ Firefox 120+ (works, but no View Transitions)
- ✅ Mobile Safari iOS 16+ (works, PWA installable)
- ✅ Chrome Android 111+ (full support)

**Feature Detection:**
```typescript
// View Transitions API
if (document.startViewTransition) {
  document.startViewTransition(() => {
    router.push(href);
  });
} else {
  router.push(href); // Instant navigation (fallback)
}

// IndexedDB
if (typeof indexedDB === 'undefined') {
  throw new Error('IndexedDB not supported');
}

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// Web Crypto API (for sync encryption)
if (!crypto.subtle) {
  throw new Error('Web Crypto API not supported');
}
```

**Polyfills:**
- None required (evergreen browser baseline)
- Next.js provides ES6+ transpilation for older browsers
- Tailwind handles CSS prefixing automatically

**Progressive Enhancement:**
- Core functionality works without JavaScript (initial HTML render)
- Enhanced features require JS (drag-and-drop, live updates, animations)
- Offline mode requires service worker (graceful degradation)

### Performance Benchmarks

**Lighthouse Scores** (gsd.vinny.dev, tested Dec 2024):
- **Performance**: 98/100
- **Accessibility**: 100/100
- **Best Practices**: 100/100
- **SEO**: 92/100
- **PWA**: ✅ Installable

**Key Metrics:**
- **First Contentful Paint**: 0.8s
- **Largest Contentful Paint**: 1.2s
- **Total Blocking Time**: 50ms
- **Cumulative Layout Shift**: 0.01
- **Time to Interactive**: 1.5s

**Bundle Sizes** (production build):
- **Initial JS**: 180 KB (gzipped)
- **CSS**: 12 KB (gzipped)
- **Total page weight**: 220 KB (first load)
- **Subsequent navigations**: <10 KB (cached)

**Optimizations:**
- ✅ React Compiler (automatic memoization, no manual useMemo/useCallback)
- ✅ Turbopack (faster builds, better tree-shaking)
- ✅ Route-based code splitting (each page loads only needed JS)
- ✅ Image optimization (Next.js Image component)
- ✅ Tailwind CSS purging (removes unused classes)
- ✅ Brotli compression (CloudFront)
- ✅ HTTP/2 (multiplexing, header compression)
- ✅ CDN edge caching (CloudFront global PoPs)

**IndexedDB Performance:**
- **Read latency**: <1ms (indexed queries)
- **Write latency**: <5ms (single task)
- **Bulk operations**: 1,000 tasks in <50ms
- **Live query reactivity**: <16ms (60 FPS)
- **Database size**: 1 MB per 1,000 tasks

**Rendering Performance:**
- **Matrix view**: 60 FPS with 500+ tasks
- **Dashboard charts**: Smooth animations with Recharts
- **Drag-and-drop**: Hardware-accelerated transforms
- **No layout thrashing**: Batched DOM reads/writes

---

## Developer & Contributor Information

### Open-Source License

**MIT License** — Maximum freedom, minimal restrictions.

**You can:**
- ✅ Use commercially (run your own instance, charge for hosting)
- ✅ Modify (add features, rebrand, fork)
- ✅ Distribute (share modified versions)
- ✅ Sublicense (embed in proprietary software)

**You must:**
- ✅ Include original license and copyright notice
- ✅ Preserve attribution to original authors

**You cannot:**
- ❌ Hold authors liable for damages
- ❌ Claim official endorsement without permission

**Full license**: See [LICENSE](./LICENSE) file in repository.

### Extension Points and Plugin Architecture

**Current Architecture:**
Monolithic app with no formal plugin system. Extension requires forking and modifying source.

**Planned Plugin System** (v6.0+):

**1. Custom Quadrant Definitions:**
```typescript
// user-quadrants.config.ts
export default {
  quadrants: [
    { id: 'urgent-important', title: 'Do Now', color: 'red' },
    { id: 'urgent-not-important', title: 'Delegate', color: 'yellow' },
    { id: 'not-urgent-important', title: 'Plan', color: 'green' },
    { id: 'not-urgent-not-important', title: 'Drop', color: 'gray' }
  ]
};
```

**2. Task Property Extensions:**
```typescript
// plugins/custom-fields.ts
export const customFields = {
  estimatedMinutes: z.number().int().min(0),
  energyLevel: z.enum(['low', 'medium', 'high']),
  location: z.string().optional()
};

// Task form automatically renders these fields
// Stored as JSON in task.customData field
```

**3. Analytics Widgets:**
```typescript
// plugins/time-tracking-widget.tsx
export function TimeTrackingWidget({ tasks }: DashboardWidgetProps) {
  const totalHours = tasks.reduce((sum, t) =>
    sum + (t.customData?.estimatedMinutes || 0), 0
  ) / 60;

  return <StatsCard title="Estimated Hours" value={totalHours} />;
}

// Registered in dashboard via config:
// dashboard.widgets.push(TimeTrackingWidget);
```

**4. Smart View Generators:**
```typescript
// plugins/eisenhower-automations.ts
export function autoAssignQuadrant(task: TaskDraft): QuadrantId {
  // Custom logic: e.g., tasks with deadlines <2 days = urgent
  const daysUntilDue = task.dueDate
    ? differenceInDays(new Date(task.dueDate), new Date())
    : null;

  const urgent = daysUntilDue !== null && daysUntilDue < 2;
  const important = task.tags.some(t =>
    ['#strategic', '#high-impact'].includes(t)
  );

  return resolveQuadrantId(urgent, important);
}
```

**Extension Points Today** (no plugins needed):

1. **Fork & Customize**
   - Clone repo, modify source, deploy your own instance
   - Rebrand (change name, colors, logo)
   - Add custom features (new task properties, integrations)

2. **Export/Import Transformations**
   - Export tasks as JSON
   - Transform with external scripts (Python, Node.js)
   - Import modified tasks back
   - Example: Add machine learning priority predictions

3. **MCP Server Extensions**
   - Add new MCP tools for custom workflows
   - Integrate with external services (calendar, email)
   - Build AI-powered automations

### API Documentation

**No public API** — GSD is a local-first app with optional sync backend.

**Internal APIs:**

**1. IndexedDB API** (`lib/db.ts`, `lib/tasks.ts`):
```typescript
import { db } from '@/lib/db';
import { createTask, updateTask, deleteTask } from '@/lib/tasks';

// Create
const task = await createTask({
  title: 'Example task',
  urgent: true,
  important: false
});

// Read
const task = await db.tasks.get(taskId);
const allTasks = await db.tasks.toArray();

// Update
await updateTask(taskId, { title: 'Updated title' });

// Delete
await deleteTask(taskId);

// Query
const urgentTasks = await db.tasks
  .where({ quadrant: 'urgent-important', completed: false })
  .toArray();
```

**2. Sync API** (if sync enabled, `worker/src/`):

**Authentication:**
```
POST /api/auth/oidc/initiate/:provider
  → Redirect to OAuth provider

GET /api/auth/oidc/callback/:provider?code=...&state=...
  → Exchange code for tokens, return JWT

GET /api/auth/oidc/result/:resultId
  ← { token, userId, deviceId, expiresAt }
```

**Sync Operations:**
```
POST /api/sync/push
  Headers: Authorization: Bearer <JWT>
  Body: { deviceId, operations: [...], clientVectorClock }
  ← { accepted, rejected, conflicts, serverVectorClock }

GET /api/sync/pull
  Headers: Authorization: Bearer <JWT>
  Query: deviceId, lastVectorClock, sinceTimestamp
  ← { tasks: [...], deletedTaskIds, serverVectorClock, hasMore }

GET /api/sync/status
  Headers: Authorization: Bearer <JWT>
  ← { lastSyncAt, pendingPushCount, conflictCount, deviceCount, storageUsed }
```

**Device Management:**
```
GET /api/devices
  Headers: Authorization: Bearer <JWT>
  ← [{ id, name, lastSeenAt, isActive, isCurrent }]
```

**3. MCP API** (Claude Desktop integration, `packages/mcp-server/src/`):

See [MCP Server README](./packages/mcp-server/README.md) for full documentation.

**Available Tools:**
- `list_tasks(quadrant?, completed?, tags?)`
- `get_task(taskId)`
- `search_tasks(query)`
- `create_task(title, urgent, important, ...)`
- `update_task(id, changes)`
- `complete_task(id, completed)`
- `delete_task(id)`
- `bulk_update_tasks(taskIds, operation)`
- `get_productivity_metrics()`
- `get_quadrant_analysis()`
- `get_tag_analytics(limit?)`
- `get_upcoming_deadlines()`
- `get_task_insights()`
- `get_sync_status()`
- `list_devices()`
- `validate_config()`
- `get_help(topic?)`

### Local Development Setup

**Prerequisites:**
- Node.js 18+ (LTS recommended)
- pnpm 8+ (faster than npm, disk-efficient)
- Git

**Installation:**

```bash
# 1. Clone repository
git clone https://github.com/yourusername/gsd-taskmanager.git
cd gsd-taskmanager

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm dev

# 4. Open browser
open http://localhost:3000
```

**Development Commands:**

```bash
# Frontend
pnpm dev          # Start Next.js dev server (hot reload)
pnpm build        # Build production bundle
pnpm start        # Start production server (requires build)
pnpm typecheck    # Run TypeScript compiler (no emit)
pnpm lint         # Run ESLint
pnpm test         # Run Vitest tests (CI mode)
pnpm test:watch   # Run tests in watch mode

# Worker (optional, for sync development)
cd worker/
npm install
npm run dev       # Start Wrangler dev server (local D1)
npm run deploy:dev # Deploy to Cloudflare (dev environment)

# MCP Server (optional, for AI integration development)
cd packages/mcp-server/
npm install
npm run build     # Compile TypeScript
npm run dev       # Watch mode (auto-rebuild)
```

**Environment Variables:**

Create `.env.local` (optional):
```bash
# Only needed if developing sync features
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

**Database Setup:**
- IndexedDB auto-initializes on first use (no config)
- Use Chrome DevTools → Application → IndexedDB to inspect data
- Run `await db.delete()` in console to reset (clears all tasks!)

**Testing:**

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test tasks.test.ts

# Run with coverage
pnpm test -- --coverage

# Watch mode (re-run on file changes)
pnpm test:watch
```

**Debugging:**

**Frontend:**
1. Open Chrome DevTools (F12)
2. Sources tab → set breakpoints in TypeScript files
3. Network tab → inspect API calls (if sync enabled)
4. Application tab → IndexedDB → GsdTaskManager → tasks

**Worker:**
1. `cd worker/ && npm run dev`
2. Open http://localhost:8787 (Wrangler dev server)
3. Use `console.log()` in worker code (appears in terminal)
4. Test endpoints with curl or Postman

**MCP Server:**
1. `cd packages/mcp-server/ && npm run build`
2. Configure Claude Desktop with local path
3. Add `console.error()` statements (appear in Claude Desktop logs)
4. macOS logs: `~/Library/Logs/Claude/mcp*.log`

### Architecture Decisions and Trade-offs

**Decision Log:**

**1. Local-First with Optional Sync** (vs. Cloud-Only)

**Rationale:**
- Privacy-first philosophy prioritizes user control over data
- Offline functionality essential for productivity app (work anywhere)
- Reduces server costs (static hosting is ~$1/month vs. $50+/month for database)
- Enables open-source self-hosting (no vendor lock-in)

**Trade-offs:**
- ✅ Maximum privacy and offline capability
- ✅ Lower operational costs
- ❌ Multi-device sync requires explicit opt-in
- ❌ Collaboration features difficult (no shared workspace)

**Alternative Considered:** Cloud-first like Todoist/Asana
**Why Rejected:** Violates privacy-first principle, increases costs

---

**2. IndexedDB (Dexie) over LocalStorage**

**Rationale:**
- LocalStorage limited to ~5-10 MB (insufficient for thousands of tasks)
- IndexedDB supports complex queries (indexes, filters, ranges)
- Dexie provides live queries (auto-refresh on data changes)
- Better performance for large datasets (binary storage)

**Trade-offs:**
- ✅ Unlimited storage (quota negotiable with browser)
- ✅ Complex querying and indexing
- ❌ More complex API than localStorage
- ❌ Not human-readable (binary format)

**Alternative Considered:** LocalStorage with JSON
**Why Rejected:** Size limits, no querying, slower for large datasets

---

**3. Next.js Static Export over SPA Framework**

**Rationale:**
- Static export = no server required (deploy to S3, GitHub Pages, Netlify)
- SEO-friendly (pre-rendered HTML)
- Next.js provides excellent DX (routing, TypeScript, React)
- Easy to add server features later (API routes, SSR)

**Trade-offs:**
- ✅ Zero hosting cost (S3 + CloudFront = $1/month)
- ✅ Instant page loads (pre-rendered HTML)
- ✅ CDN distribution (global edge caching)
- ❌ No server-side rendering (dynamic content)
- ❌ Requires CloudFront Function for SPA routing

**Alternative Considered:** Create React App, Vite SPA
**Why Rejected:** No SSG (static site generation), worse SEO

---

**4. End-to-End Encryption (AES-256-GCM) over Transport Encryption Only**

**Rationale:**
- Zero-knowledge architecture: server cannot read task content
- Compliance with privacy regulations (GDPR, CCPA)
- User trust (no data mining, no breaches expose task data)
- Future-proof (even if server compromised, data encrypted)

**Trade-offs:**
- ✅ Maximum privacy (server can't decrypt)
- ✅ Regulatory compliance
- ✅ No liability for data breaches (encrypted at rest)
- ❌ No password recovery (lost passphrase = data loss)
- ❌ Increased complexity (key derivation, nonce management)
- ❌ Cannot search server-side (all search client-side)

**Alternative Considered:** Server-side encryption (encrypted at rest, server has keys)
**Why Rejected:** Server could decrypt data (privacy violation)

---

**5. Vector Clocks over Last-Write-Wins**

**Rationale:**
- Detect true conflicts (concurrent edits from different devices)
- Causality tracking (know which edit happened-before which)
- Enables cascade sync (automatic conflict resolution propagation)
- Standard in distributed systems (Cassandra, Riak, CRDTs)

**Trade-offs:**
- ✅ Accurate conflict detection
- ✅ Preserves causality (no lost edits)
- ❌ More complex than simple timestamps
- ❌ Vector clock size grows with device count (mitigated: prune old devices)

**Alternative Considered:** Operational Transforms (like Google Docs)
**Why Rejected:** Overkill for task management (not real-time collaborative editing)

---

**6. React + TypeScript over Vanilla JS**

**Rationale:**
- Type safety catches bugs at compile time (not runtime)
- Better DX (autocomplete, refactoring, inline docs)
- Ecosystem (React has best component library support)
- Hiring (easier to find React developers)

**Trade-offs:**
- ✅ Fewer runtime errors (type checking)
- ✅ Better maintainability (self-documenting code)
- ❌ Increased bundle size vs. vanilla JS
- ❌ Compilation step (slower builds)

**Alternative Considered:** Svelte, Vue
**Why Rejected:** Smaller ecosystem, fewer experienced developers

---

**7. Zod Validation over Manual Checks**

**Rationale:**
- Runtime type validation (TypeScript only compile-time)
- Schema-driven (single source of truth)
- Great error messages (field-level feedback)
- Export format versioning (validate imports)

**Trade-offs:**
- ✅ Catches invalid data at boundaries
- ✅ Self-documenting schemas
- ❌ Additional library dependency
- ❌ Small runtime overhead (acceptable)

**Alternative Considered:** Yup, Joi
**Why Rejected:** Zod has better TypeScript integration

---

**8. Modular Refactoring (300-line file limit)**

**Rationale:**
- Compliance with coding standards
- Easier code reviews (smaller diffs)
- Better maintainability (single responsibility)
- Faster navigation (find code quickly)

**Trade-offs:**
- ✅ More maintainable (edit one file, not scroll 1,000 lines)
- ✅ Better testability (test one module, not monolith)
- ❌ More files to manage (directory organization important)
- ❌ Initial refactoring effort (one-time cost)

**Alternative Considered:** Keep large files (1,000+ lines)
**Why Rejected:** Violates coding standards, hard to navigate

---

### Contribution Guidelines

**How to Contribute:**

1. **Find an Issue**
   - Browse [Issues](https://github.com/yourusername/gsd-taskmanager/issues)
   - Look for `good first issue` or `help wanted` labels
   - Comment "I'll take this" to avoid duplicate work

2. **Fork & Branch**
   ```bash
   git clone https://github.com/yourfork/gsd-taskmanager.git
   cd gsd-taskmanager
   git checkout -b feature/amazing-feature
   ```

3. **Make Changes**
   - Follow coding standards (see `coding-standards.md`)
   - Keep files under 300 lines (split if exceeding)
   - Write tests for new features
   - Update documentation (README, CLAUDE.md)

4. **Test Locally**
   ```bash
   pnpm typecheck  # No TypeScript errors
   pnpm lint       # No ESLint errors
   pnpm test       # All tests pass
   pnpm build      # Production build succeeds
   ```

5. **Commit**
   - Use [Conventional Commits](https://www.conventionalcommits.org/)
   - Format: `type(scope): description`
   - Examples:
     ```
     feat(dashboard): add 90-day trend chart
     fix(sync): handle token expiry gracefully
     docs(readme): update installation instructions
     test(filters): add edge cases for date ranges
     ```

6. **Open Pull Request**
   - Title: Clear, imperative (e.g., "Add 90-day trend chart to dashboard")
   - Description:
     - What changed and why
     - Screenshots (for UI changes)
     - Related issues (`Fixes #123`)
   - Wait for review (respond within 1 business day)

**Code Review Process:**

1. **Automated Checks** (GitHub Actions)
   - TypeScript compilation
   - ESLint linting
   - Vitest tests
   - Coverage thresholds (≥80%)

2. **Manual Review** (maintainers)
   - Code quality and readability
   - Test coverage adequacy
   - Documentation completeness
   - Breaking changes (require major version bump)

3. **Feedback & Iteration**
   - Address review comments
   - Push updates to same branch (PR auto-updates)
   - Request re-review when ready

4. **Merge**
   - Squash commits (clean history)
   - Delete branch after merge
   - Release in next version

**What We Look For:**

✅ **Good:**
- Clear, descriptive variable names
- Functions <30 lines
- Comments explain "why" (not "what")
- Tests cover happy path + edge cases
- Documentation updated

❌ **Bad:**
- Magic numbers (use named constants)
- Copy-pasted code (extract function)
- Commented-out code (delete it, use git history)
- TODOs without ticket links
- Breaking changes without migration guide

**Coding Standards:**

See [`coding-standards.md`](./coding-standards.md) for full details. Key points:

- **Simplicity over cleverness** — Boring code is good code
- **Files ≤300 lines** — Split by responsibility
- **Functions ≤30 lines** — Single responsibility principle
- **Max 3 nesting levels** — Use early returns
- **No magic numbers** — Use named constants
- **Comments explain "why"** — Code should explain "what"

---

## Hidden Gems & Power User Features

### Advanced Keyboard Shortcuts

**Global Shortcuts** (work anywhere in app):
- `n` — New task (opens form dialog)
- `/` — Focus search bar
- `?` — Help dialog
- `Esc` — Close dialogs/modals

**Task Form:**
- `Tab` — Move to next field
- `Shift+Tab` — Move to previous field
- `Enter` — Submit form (if valid)
- `Esc` — Cancel and close

**Future Shortcuts** (v6.0+):
- `j/k` — Navigate tasks (vim-style)
- `x` — Mark task as complete
- `d` — Delete task (with confirmation)
- `e` — Edit task
- `1/2/3/4` — Move task to Q1/Q2/Q3/Q4
- `t` — Toggle tags filter
- `f` — Open filter panel

### Bulk Import from Other Task Managers

**Todoist Export → GSD Import:**

1. Export from Todoist:
   - Settings → Backup → Export as CSV
   - Download `tasks.csv`

2. Transform with script:
   ```python
   import csv, json
   from datetime import datetime

   tasks = []

   with open('todoist-export.csv') as f:
       reader = csv.DictReader(f)
       for row in reader:
           tasks.append({
               'id': row['TASK_ID'],
               'title': row['CONTENT'],
               'description': row['DESCRIPTION'] or '',
               'urgent': row['PRIORITY'] in ['1', '2'],  # P1/P2 = urgent
               'important': row['PRIORITY'] in ['1', '3'],  # P1/P3 = important
               'quadrant': 'urgent-important',  # Recalculated on import
               'completed': row['COMPLETED'] == 'true',
               'dueDate': row['DUE_DATE'] if row['DUE_DATE'] else None,
               'tags': row['LABELS'].split(',') if row['LABELS'] else [],
               'subtasks': [],
               'dependencies': [],
               'recurrence': 'none',
               'createdAt': datetime.now().isoformat(),
               'updatedAt': datetime.now().isoformat(),
               'vectorClock': {}
           })

   with open('gsd-import.json', 'w') as f:
       json.dump({
           'tasks': tasks,
           'exportedAt': datetime.now().isoformat(),
           'version': '5.5.0'
       }, f, indent=2)
   ```

3. Import to GSD:
   - Settings → Import → Choose `gsd-import.json`
   - Select "Merge" mode (keep existing tasks)
   - Confirm import

**Asana Export → GSD Import:**

Similar process, but Asana CSV has different column names:
- `Name` → `title`
- `Notes` → `description`
- `Due Date` → `dueDate`
- `Tags` → `tags`

**Notion Export → GSD Import:**

Notion exports as CSV or JSON. Use same transformation approach.

### Custom Workflows and Automations

**Weekly Review Workflow:**

1. **Friday afternoon** (set recurring task):
   - Title: "Weekly Review"
   - Recurrence: Weekly
   - Due: Friday 4pm
   - Subtasks:
     - [ ] Review completed tasks (celebrate wins!)
     - [ ] Bulk delete Q4 tasks
     - [ ] Move stale Q1 tasks to Q2 (were they really urgent?)
     - [ ] Tag next week's priorities with #next-week
     - [ ] Export tasks (backup)

2. **Execute review**:
   - Toggle "Recently Completed" smart view → see wins
   - Select all Q4 tasks → bulk delete
   - Drag Q1 tasks to Q2 if not truly urgent
   - Add #next-week tags to Monday tasks
   - Settings → Export → save to Dropbox

**Daily Standup Automation** (via MCP Server):

```
# In Claude Desktop, save this as a scheduled task (macOS Shortcuts app)

Prompt Claude:
"Run daily standup report:
1. List tasks completed yesterday
2. List tasks due today or overdue
3. Identify any blockers (tasks with uncompleted dependencies)
4. Show Q1 tasks (urgent + important)
5. Suggest 3 tasks to focus on today (based on due dates and quadrant)"

Claude uses MCP tools to generate report.
```

**GTD-Style Processing:**

Create custom smart views:
- **Inbox** — Recently added (last 7 days), no tags, no due date
- **Next Actions** — Q2 (Schedule), no dependencies, not recurring
- **Waiting For** — Tagged #waiting-for
- **Someday/Maybe** — Q4 (Eliminate), no due date

Process inbox daily:
1. Open "Inbox" smart view
2. For each task:
   - Assign quadrant (urgent? important?)
   - Add tags (#work, #personal, #project-name)
   - Set due date if time-sensitive
   - Add subtasks if complex
   - Move to appropriate quadrant

### Advanced Filtering with Saved Searches

**Example: "High-Value Work" Smart View:**

Filter criteria:
- Quadrants: Q2 (Schedule)
- Tags: #deep-work, #strategic, #high-impact
- Status: Active
- Has dependencies: No (ready to work on)
- No due date or due >7 days (not urgent)

**Example: "Quick Wins" Smart View:**

Filter criteria:
- Quadrants: Q1 (Do First), Q3 (Delegate)
- Tags: #quick-win, #easy
- Status: Active
- No subtasks (simple tasks)
- Due today or overdue

**Example: "Blocked Work" Smart View:**

Filter criteria:
- Status: Active
- Is blocked: Yes (has uncompleted dependencies)
- Sort by: Number of dependencies (descending)
- Purpose: Identify bottlenecks

**Boolean Search** (future feature):

```
(#work OR #project-alpha) AND (urgent OR overdue) AND NOT #waiting-for
```

### Experimental Features

**Feature Flags** (enable in browser console):

```javascript
// Enable experimental features
localStorage.setItem('GSD_EXPERIMENTAL_FEATURES', JSON.stringify({
  enableVimMode: true,         // Vim-style keyboard navigation
  enablePomodoro: true,        // Built-in timer
  enableTimeTracking: true,    // Track time spent per task
  enableCollaboration: false,  // Shared workspaces (not ready)
}));

// Reload app to apply
location.reload();
```

**Vim Mode** (v6.0+):
- `j` — Move down (next task)
- `k` — Move up (previous task)
- `o` — Open (edit task)
- `x` — Toggle completion
- `dd` — Delete task
- `:q` — Close dialog

**Time Tracking** (v6.5.0):
- **Start/Stop Timer**: Click play icon on task card to track time
- **Time Entries**: Each work session stored with start/end times and optional notes
- **Automatic Calculation**: `timeSpent` auto-calculated from completed entries
- **Estimated vs Actual**: Set `estimatedMinutes` to compare planned vs actual time
- **Live Timer Display**: Running timer shows elapsed time (mm:ss or hh:mm:ss)
- **Dashboard Analytics**: Time spent per quadrant, per tag visualization
- **Task Properties**: `timeEntries[]`, `timeSpent`, `estimatedMinutes`

---

## Conclusion

GSD Task Manager proves that **privacy and productivity are not mutually exclusive**. By combining the battle-tested Eisenhower Matrix framework with modern web technologies and end-to-end encryption, GSD delivers a powerful task management experience that respects user privacy.

**Why Choose GSD:**

- **Privacy-First**: Your data stays on your device, or encrypted in transit if you choose sync
- **Framework-Driven**: The Eisenhower Matrix enforces intentional prioritization
- **Open Source**: Verify the code, contribute features, run your own instance
- **No Lock-In**: Export anytime, use standard JSON format, own your data
- **Modern Stack**: Next.js 16, React 19, TypeScript, IndexedDB — built for the future
- **AI-Powered**: Claude Desktop integration for natural language task management
- **Free Forever**: No subscriptions, no ads, no tracking

**Get Started Today:**

1. Visit [gsd.vinny.dev](https://gsd.vinny.dev)
2. Create your first task
3. Install as PWA for offline access
4. (Optional) Enable encrypted sync for multi-device
5. (Optional) Set up MCP server for AI-powered workflows

**Contribute:**

- Star the repo: [github.com/yourusername/gsd-taskmanager](https://github.com/yourusername/gsd-taskmanager)
- Report bugs: [Issues](https://github.com/yourusername/gsd-taskmanager/issues)
- Submit features: [Pull Requests](https://github.com/yourusername/gsd-taskmanager/pulls)
- Share feedback: [Discussions](https://github.com/yourusername/gsd-taskmanager/discussions)

---

**Built with ❤️ and [Claude Code](https://claude.com/claude-code)**

_Get Stuff Done. Own Your Data. Live Better._
