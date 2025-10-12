# Agent Knowledge Base

## Product Snapshot
- GSD Task Manager is a client-only Next.js 15 (App Router) PWA that implements an Eisenhower matrix with drag-and-drop, advanced filtering, and offline storage in IndexedDB (Dexie 4).
- Tasks live entirely in the browser; export/import JSON is the only persistence escape hatch. Service worker + manifest enable install and caching (network-first for HTML, cache-first for assets).
- Core UX: `MatrixBoard` renders the whole app - header (search, Smart Views, notifications, export/import), 2x2 quadrant grid, lazy task dialogs, notification prompts, and footer build info.
- Keyboard shortcuts: `n` new task, `/` focus search, `?` help modal. Mobile shows a floating "+" FAB.
- Notifications: opt-in browser notifications, quiet hours, badges, and a background checker that runs every minute while the app is open (and optional periodic sync when installed).

## Data & Domain Model
- Dexie schema (`lib/db.ts`) version 5 with three tables:
  - `tasks`: indexed by `id`, `quadrant`, `completed`, `dueDate`, `recurrence`, `tags`, timestamps, composite `[quadrant+completed]`, and `notificationSent`.
  - `smartViews`: persisted custom saved filters (built-ins are generated in code and merged at runtime).
  - `notificationSettings`: single record keyed by `"settings"` holding master toggle, default reminder minutes, sound flag, quiet hours, and `permissionAsked`.
- `TaskRecord` (`lib/types.ts`) fields: id, title, description, urgent, important, quadrant, completed, createdAt/updatedAt, optional dueDate, recurrence (`none|daily|weekly|monthly`), tags[], subtasks[], parentTaskId, notifyBefore (minutes), notificationEnabled, notificationSent, lastNotificationAt, snoozedUntil.
- `TaskDraft` is the client form input; defaults set in `TaskForm`. Zod schemas (`lib/schema.ts`) validate drafts, records, import payloads, and notification settings before writing.
- Quadrant helpers (`lib/quadrants.ts`) map urgent/important <-> quadrant ids; `quadrants` export powers UI labels/colors.
- `lib/tasks.ts` owns all persistence logic: create/update/delete, quadrant moves, complete toggling (auto-spawns next instance for recurring tasks), subtask CRUD, import/export (with ID collision regeneration), and JSON helpers.
- Filters (`lib/filters.ts`): `FilterCriteria` supports quadrants, status, tags, due ranges, overdue/today/week, no deadline, recurrence array, and text search. `applyFilters` runs all predicates; built-in Smart Views (e.g., "Today's Focus", "Overdue Backlog", "Recurring Tasks") are defined here.

## UI Architecture
- Routes:
  - `app/(matrix)/page.tsx` -> `MatrixBoard`.
  - `app/(pwa)/install/page.tsx` is a static install instruction page.
  - `app/layout.tsx` wires fonts, theme provider, global toast/error boundaries, and mounts `PwaRegister`.
- Key components:
  - `MatrixBoard`: hooks into `useTasks()` (live Dexie query), `useKeyboardShortcuts`, and `@dnd-kit` drag sensors. Manages state for search, filters, dialogs, imports, notification settings, and toasts with undo via `useErrorHandlerWithUndo`.
  - `AppHeader`: search input, Smart View dropdown, completed toggle eye, notification bell (badge counts from `getDueSoonCount()`), theme toggle, help, new task buttons, and `SettingsMenu` for import/export.
  - `MatrixColumn` + `TaskCard`: droppable sortable lists showing due status (overdue/due today badges), tags, recurrence indicator, subtask progress, and actions.
  - `TaskForm`: Zod-backed form with urgency/importance toggle pills, due date + 15-minute time grid, recurrence selector, subtask/tag editors, and task-level notification controls (enabled + per-task reminder offset).
  - `FilterBar` renders active filter chips; `FilterPopover` dialog offers quadrant/status/tag/due/recurrence controls and "Save View" when something is active.
  - Dialogs (lazy loaded): `HelpDialog`, `ImportDialog` (merge vs replace, previews counts), `SaveSmartViewDialog`, and `NotificationSettingsDialog` (permission flow, default reminder, quiet hours, sound toggle, test notification).
  - Support components: `NotificationPermissionPrompt` (banner asking for opt-in), `ThemeToggle`, `AppFooter` (build stamp via `NEXT_PUBLIC_BUILD_NUMBER/DATE`), shadcn-style primitives in `components/ui/*`, and `ToastProvider` for global toasts.

## Notifications & Background Work
- `notificationChecker` (`lib/notification-checker.ts`) runs `checkAndNotify()` on mount from `MatrixBoard` and then every minute (configurable via `NOTIFICATION_TIMING`). It skips when notifications disabled, permission denied, or inside quiet hours. Eligible tasks: incomplete, dueDate present, notifications enabled, within reminder window (default 15 minutes before due, configurable per task or global).
- When a notification fires (`lib/notifications.ts`), it respects per-task `snoozedUntil`, uses Notification API with optional sound, sets `notificationSent` and `lastNotificationAt`, and updates the app badge via `setAppBadge`.
- `NotificationSettingsDialog` persists options to Dexie; `NotificationPermissionPrompt` ensures we only ask once (`permissionAsked` flag).
- `PwaRegister` registers `/sw.js`, and if `periodicSync` is available, sets a 15-minute background check tag (`check-notifications`). The service worker handles install/activate, network-first HTML caching (works around iOS PWA staleness), cache-first assets, notification clicks, placeholder periodic sync, and push hooks.

## Smart Views & Filtering
- `SmartViewSelector` loads combined built-in + custom views (`getSmartViews()` merges Dexie records with `BUILT_IN_SMART_VIEWS`), allows deletion of custom views, and clears selection when filters reset.
- `SaveSmartViewDialog` writes new views via `createSmartView` with optional emoji icon/description.
- `FilterBar` + `FilterPopover` keep `FilterCriteria` in sync; `MatrixBoard` resets search when selecting a Smart View and maintains `showCompleted` toggle separately (affects criteria via `status`).

## Import / Export
- Export: `exportToJson()` returns prettified payload `{ tasks, exportedAt, version }`; UI triggers download with timestamped filename.
- Import: `ImportDialog` prompts for merge (adds tasks, regenerating conflicting ids + subtask ids) or replace (clears table first). JSON integrity validated via Zod; invalid JSON/formats surface friendly errors through `useErrorHandlerWithUndo`.

## Build, Tooling, and Tests
- Scripts (`package.json`):
  - `pnpm dev`, `build`, `export`, `lint`, `test`, `typecheck`, `deploy:*`.
  - `pnpm build` runs `scripts/generate-build-info.js` to bump `.build-info.json`, write `.build-env.sh` with `NEXT_PUBLIC_BUILD_NUMBER/DATE`, sources that file, then executes `next build`.
- Configuration:
  - `next.config.ts` sets `output: "export"`, disables image optimization, enables typed routes.
  - `tailwind.config.ts` defines CSS vars-based palette, safelists quadrant/accent tones.
- `vitest.config.ts` uses jsdom, React plugin, alias `@ -> .`, enforces >=80% statements/lines/functions, 75% branches, and includes coverage for `lib/**` + `components/**`.
  - `vitest.setup.ts` enables jest-dom, fake IndexedDB, and mocks `matchMedia`.
- Testing layout:
  - `tests/data/*` cover Dexie task CRUD, import/export behavior, filter logic, and quadrant helpers.
  - `tests/ui/*` exercise components (header interactions, filter chips, drag column stub, task form validation, etc.).
- Keep pnpm lock in sync, run Prettier/ESLint auto-fixes before commits, and honor repo-wide strict TypeScript + 2-space indentation + Tailwind ordering conventions.

## Operational Reminders
- Update `gsd-task-manager-spec.md` when altering behavior.
- If task schema changes, synchronize Zod schemas, Dexie migrations, import/export, fixtures, and offline assets together.
- PWA assets live in `public/`; change icons/manifest/sw in tandem and verify `pnpm export`.
- Never assume network access at runtime; the app must remain fully offline-capable.
