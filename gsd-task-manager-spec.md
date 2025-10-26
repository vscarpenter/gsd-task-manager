# GSD Task Manager

**Version:** 5.0.0
**Tagline:** Prioritize what matters. GSD!
**GSD:** 'Get Stuff Done' or 'Get Shit Done'

Stop juggling, start finishing. GSD Task Manager makes it easy to sort your to-dos into what's urgent and what's important, so you can finally get stuff done without burning out. It's simple, visual, and works entirely offline—with optional cloud sync for multi-device access.

## Goal

Build a privacy-first task manager that implements the Eisenhower matrix with optional end-to-end encrypted cloud sync. Users create tasks, classify them by urgency and importance, and view them in a 2×2 grid. Local data stays on device in IndexedDB. Cloud sync is opt-in with OAuth authentication and client-side encryption. Include PWA for offline access, analytics dashboard, and AI integration via MCP server.

## Tech Stack

### Frontend
-   **Next.js 16** with Turbopack and React Compiler
-   **React 19** with View Transitions API
-   **TypeScript** with strict mode
-   **Tailwind CSS** for styling
-   **shadcn/ui** with Radix Primitives (Dialog, Switch, Select, Tooltip, Collapsible)
-   **IndexedDB** via Dexie with React hooks
-   **Recharts** for analytics visualizations
-   **date-fns** for date manipulation
-   **zod** for schema validation
-   **nanoid** for ID generation
-   **lucide-react** for icons
-   **next-themes** for dark mode
-   **sonner** for toast notifications
-   **@dnd-kit** for drag-and-drop

### Backend (Optional Cloud Sync)
-   **Cloudflare Workers** for API endpoints
-   **D1 Database** for encrypted task storage (SQLite)
-   **KV Namespaces** for sessions and rate limiting
-   **R2 Buckets** for backup storage
-   **OAuth 2.0 / OIDC** for Google and Apple authentication
-   **AES-256-GCM** for end-to-end encryption

### AI Integration
-   **Model Context Protocol (MCP)** server for Claude Desktop
-   **Node.js 18+** runtime for MCP server
-   **Web Crypto API** for client-side decryption

### Deployment
-   **AWS S3** for static hosting
-   **AWS CloudFront** with custom Function for URL rewriting
-   **Cloudflare Workers** for sync backend (multi-environment: dev, staging, prod)

## Eisenhower Model

Quadrants: 1. Urgent + Important (Do first)\
2. Not Urgent + Important (Schedule)\
3. Urgent + Not Important (Delegate)\
4. Not Urgent + Not Important (Eliminate)

Quadrant is derived from urgent and important flags.

## Core Features

### Task Management
-   **Eisenhower Matrix View** — 2×2 grid organizing tasks by urgency and importance
-   **Create and Edit Tasks** — Comprehensive form with title, description, due date, tags, subtasks, dependencies
-   **Task Dependencies** — Define blocking relationships with circular dependency prevention
-   **Recurring Tasks** — Auto-recreate tasks daily, weekly, or monthly when completed
-   **Tags & Labels** — Categorize with multiple tags (#work, #personal, etc.)
-   **Subtasks & Checklists** — Break down complex tasks with progress tracking
-   **Batch Operations** — Multi-select for bulk complete, move, tag, or delete
-   **Drag & Drop** — Reorder tasks and move between quadrants
-   **Smart Search** — Search across titles, descriptions, tags, and subtasks
-   **Keyboard Shortcuts** — `n` for new task, `/` for search, `?` for help

### Analytics & Dashboard
-   **Dashboard View** — Toggle between Matrix and Dashboard layouts
-   **Completion Metrics** — Track daily, weekly, and monthly completion rates
-   **Streak Tracking** — Monitor current and longest completion streaks
-   **Quadrant Distribution** — Visualize task allocation across quadrants
-   **Tag Analytics** — View completion rates and usage per tag
-   **Trend Analysis** — 7/30/90-day views with line and bar charts
-   **Upcoming Deadlines** — Grouped display of overdue, due today, and due this week

### Data & Privacy
-   **Local-First Storage** — All data in IndexedDB via Dexie (no server by default)
-   **Export/Import JSON** — Backup tasks with merge or replace modes
-   **Works Offline** — Full functionality without internet connection
-   **Privacy-First** — No tracking, no analytics, no data collection

### Cloud Sync (Optional)
-   **End-to-End Encryption** — Zero-knowledge architecture with AES-256-GCM
-   **OAuth Authentication** — Secure login with Google or Apple (OIDC-compliant)
-   **Multi-Device Sync** — Vector clock-based synchronization across unlimited devices
-   **Conflict Resolution** — Automatic cascade sync for concurrent edits
-   **Device Management** — View and revoke access for specific devices
-   **Session Management** — JWT tokens with configurable expiration

### PWA & Notifications
-   **Install as PWA** — Desktop and mobile with offline support
-   **Smart Notifications** — Configurable reminders (5min to 1 day before due)
-   **Auto-Updates** — Service worker with user-friendly update notifications
-   **Periodic Sync** — Background sync for installed PWAs (Chrome/Edge)

### AI Integration (v5.0.0)
-   **MCP Server** — Model Context Protocol server for Claude Desktop integration
-   **Natural Language Queries** — "What are my urgent tasks this week?"
-   **Decrypted Task Access** — 6 MCP tools for reading and analyzing tasks
-   **Smart Search & Filtering** — AI-powered task discovery across all content
-   **Privacy-Preserved** — Encryption passphrase stored locally, decryption on your machine
-   **Read-Only Access** — Claude cannot modify, create, or delete tasks

### User Experience
-   **Dark Mode** — Automatic theme switching with system preference support
-   **Responsive Design** — Optimized for desktop, tablet, and mobile
-   **View Transitions** — Smooth page animations (Chrome/Edge 111+, Safari 18+)
-   **Accessible** — WCAG-compliant with keyboard navigation support

## UI Layout

### Main Layout
-   **App Header** — Logo, view toggle (Matrix/Dashboard), search bar, new task button, settings menu, theme toggle
-   **Matrix View** — 2×2 grid with quadrant headers and task cards
-   **Dashboard View** — Analytics layout with stats cards, charts, and widgets
-   **Footer** — Build info, credits, links

### Task Card Components
-   **Title** with description preview
-   **Urgency/Importance Badges** — Visual quadrant indicators
-   **Due Date Display** — Overdue (red), due today (amber), upcoming
-   **Tags** — Colored chips with tag labels
-   **Subtasks Progress** — Visual progress bar (e.g., 2/5)
-   **Recurrence Indicator** — Repeat icon for recurring tasks
-   **Dependency Indicators** — Blocking/blocked status
-   **Actions** — Complete, edit, delete buttons
-   **Selection Mode** — Click anywhere on card to select (for batch operations)

### Dialogs & Modals
-   **Task Form** — Create/edit with validation, tags, subtasks, dependencies
-   **Import Dialog** — Mode selection (merge vs replace) with task counts
-   **Settings Menu** — Export/import, preferences
-   **Help Dialog** — Keyboard shortcuts (triggered by `?`)

### Batch Operations
-   **Floating Action Bar** — Appears when tasks selected, fixed at bottom center
-   **Bulk Actions** — Complete, uncomplete, move to quadrant, add tags, delete
-   **Selection Count** — Shows number of selected tasks with clear button

## Data Architecture

### IndexedDB Schema (Dexie v6)
-   **tasks** table — TaskRecord with id, title, description, urgent, important, quadrantId, completed, dueDate, tags, subtasks, recurrence, dependencies, createdAt, updatedAt
-   **smartViews** table — Custom filter combinations (future feature)
-   **notificationSettings** table — Per-task notification preferences

### CRUD Operations (`lib/tasks.ts`)
-   `createTask()` — Validate with zod, generate nanoid, persist to Dexie
-   `updateTask()` — Merge changes, update timestamps, handle quadrant recalculation
-   `deleteTask()` — Remove task and cleanup dependency references
-   `toggleTaskCompletion()` — Handle recurring task recreation
-   `importTasks()` — Support merge/replace modes with duplicate ID handling
-   `exportTasks()` — Serialize to JSON
-   **Subtask operations** — `addSubtask()`, `deleteSubtask()`, `toggleSubtask()`
-   **Dependency operations** — `addDependency()`, `removeDependency()`, `removeDependencyReferences()`

### Live Queries (`lib/use-tasks.ts`)
-   `useTasks()` — React hook returning `{ all, byQuadrant }` with real-time updates via `useLiveQuery`
-   Auto-reacts to IndexedDB changes (create, update, delete)

### Validation (`lib/schema.ts`)
-   Zod schemas for TaskDraft, TaskRecord, Subtask, ImportPayload, RecurrenceType
-   Runtime validation for all task mutations
-   Type-safe data flow throughout application

## Cloud Sync Architecture (Optional)

### Authentication Flow
1. User clicks "Login with Google/Apple" in app
2. Redirect to `/api/auth/login/:provider` endpoint on Worker
3. OAuth provider authenticates user (OIDC)
4. Worker creates user record with encrypted salt, issues JWT
5. Client receives JWT token, stores in localStorage
6. All sync API calls include `Authorization: Bearer <token>` header

### Encryption Flow
1. **Registration** — Client generates random 32-byte salt, derives encryption key from user's passphrase using PBKDF2 (600k iterations), uploads salt to Worker (encrypted in D1)
2. **Task Creation** — Client encrypts task JSON with AES-256-GCM, generates random nonce, uploads `{encryptedBlob, nonce}` to Worker
3. **Sync Pull** — Client fetches encrypted blobs from Worker, decrypts locally with derived key
4. **Zero-Knowledge** — Worker stores only encrypted blobs + metadata, cannot decrypt task content

### Sync Protocol
-   **Vector Clocks** — Each device maintains logical timestamp, resolves conflicts via causality
-   **Cascade Sync** — Hierarchical sync algorithm ensures eventual consistency
-   **Conflict Resolution** — Last-write-wins with vector clock comparison, manual resolution UI for conflicts
-   **Device Management** — Worker tracks device IDs, last sync times, active status

### API Endpoints (`worker/src/index.ts`)
-   `POST /api/auth/login/:provider` — OAuth initiation
-   `GET /api/auth/callback/:provider` — OAuth callback
-   `POST /api/auth/register` — Upload encryption salt
-   `GET /api/auth/encryption-salt` — Fetch salt for decryption
-   `POST /api/sync/push` — Upload encrypted task changes
-   `POST /api/sync/pull` — Fetch encrypted task updates
-   `GET /api/sync/status` — Sync health check
-   `GET /api/devices` — List registered devices
-   `DELETE /api/devices/:id` — Revoke device access

### Multi-Environment Deployment
-   **Development** — `localhost:3000` with local D1 database
-   **Staging** — `gsd-dev.vinny.dev` with staging D1/KV/R2
-   **Production** — `gsd.vinny.dev` with prod D1/KV/R2
-   Each environment has isolated secrets (OAuth client IDs, JWT secrets)

## MCP Server Architecture (v5.0.0)

### Purpose
Enable AI assistants like Claude Desktop to access and analyze user's tasks through natural language queries while maintaining end-to-end encryption.

### Components
-   **MCP Server** (`packages/mcp-server/`) — Node.js TypeScript server implementing Model Context Protocol
-   **Communication** — stdio transport (JSON-RPC 2.0) with Claude Desktop
-   **Decryption Module** (`crypto.ts`) — Port of client-side crypto logic to Node.js Web Crypto API
-   **API Client** (`tools.ts`) — Authenticated requests to Worker sync endpoints

### Available MCP Tools
1. `list_tasks` — List all decrypted tasks with optional filtering (quadrant, status, tags)
2. `get_task` — Get detailed information about a specific task by ID
3. `search_tasks` — Search across titles, descriptions, tags, and subtasks
4. `get_sync_status` — Check sync health (last sync time, conflicts, storage)
5. `list_devices` — View all registered devices
6. `get_task_stats` — Get task statistics and metadata

### Security Model
-   **Local Decryption** — Encryption passphrase stored in Claude Desktop config (never in cloud)
-   **Zero-Knowledge Maintained** — Worker still cannot decrypt tasks; MCP server handles decryption locally
-   **Read-Only Access** — MCP server cannot modify, create, or delete tasks (safe exploration)
-   **Opt-In** — Requires explicit passphrase configuration in Claude Desktop config

### Configuration
-   **Claude Desktop Config** — `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
-   **Environment Variables** — `GSD_API_BASE_URL`, `GSD_AUTH_TOKEN`, `GSD_ENCRYPTION_PASSPHRASE`
-   **Setup** — See `packages/mcp-server/README.md` for detailed instructions

## Deployment

### Frontend (Static Export)
1. Build with Next.js 16 static export: `pnpm build`
2. Upload to AWS S3: `pnpm deploy:s3`
3. Invalidate CloudFront cache: `pnpm deploy:cf`
4. CloudFront Function handles URL rewriting for SPA routing

### CloudFront Edge Function
-   **Purpose** — Rewrite directory paths to serve `index.html` (e.g., `/dashboard/` → `/dashboard/index.html`)
-   **Runtime** — Lightweight JavaScript (not Node.js) running at edge locations
-   **Deployment** — `./scripts/deploy-cloudfront-function.sh` (auto-creates, publishes, attaches)
-   **Performance** — Sub-millisecond latency, runs on 100% of viewer requests before reaching S3

### Backend (Cloudflare Workers)
-   **Deployment** — `npm run deploy:all` (deploys to dev, staging, prod)
-   **Environments** — Separate D1, KV, R2, and secrets per environment
-   **Setup Scripts** — `./worker/scripts/setup-dev.sh`, `setup-staging.sh`, `setup-prod.sh`
-   **Migration** — `npm run migrations:dev` (applies D1 schema changes)

### MCP Server (Local)
-   **Installation** — Global npm install: `npm install -g @gsd/mcp-server`
-   **Configuration** — Add to Claude Desktop config JSON
-   **Authentication** — Requires valid JWT token from Worker API
-   **Passphrase** — User's encryption passphrase for task decryption

## Acceptance Criteria

### Core Functionality
-   ✅ Tasks can be created, edited, moved, completed, and deleted
-   ✅ Matrix updates instantly with live queries
-   ✅ Tasks persist across reloads in IndexedDB
-   ✅ Export/import JSON works with merge and replace modes
-   ✅ App installs as PWA and runs offline
-   ✅ Recurring tasks auto-recreate when completed
-   ✅ Task dependencies prevent circular references
-   ✅ Batch operations support multi-select actions

### Analytics & Dashboard
-   ✅ Dashboard view toggles with Matrix view
-   ✅ Completion metrics track daily, weekly, monthly rates
-   ✅ Streak tracking shows current and longest streaks
-   ✅ Charts visualize trends with Recharts
-   ✅ Tag analytics show usage and completion rates

### Cloud Sync (Optional)
-   ✅ OAuth login with Google and Apple
-   ✅ End-to-end encryption with zero-knowledge architecture
-   ✅ Multi-device sync with vector clocks
-   ✅ Conflict resolution with cascade sync
-   ✅ Device management (view and revoke)

### AI Integration (v5.0.0)
-   ✅ MCP server communicates with Claude Desktop via stdio
-   ✅ 6 MCP tools provide read-only task access
-   ✅ Local decryption maintains encryption security
-   ✅ Natural language queries work across all task content

### Performance & Quality
-   ✅ Lighthouse score ≥95 in performance, accessibility, best practices
-   ✅ Test coverage ≥80% statements, lines, functions
-   ✅ TypeScript strict mode with zero type errors
-   ✅ View Transitions API for smooth page animations
-   ✅ Responsive design works on desktop, tablet, mobile
