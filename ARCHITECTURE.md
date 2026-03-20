# ARCHITECTURE.md

## 1. Project Identification

| Field | Value |
|-------|-------|
| **Project Name** | GSD Task Manager |
| **Repository** | https://github.com/vscarpenter/gsd-task-manager |
| **Primary Contact** | Vinny Carpenter |
| **Version** | 7.2.4 |
| **Last Updated** | 2026-03-19 |

---

## 2. Project Structure

```
gsd-taskmanager/
├── app/                              # Next.js 16 App Router (pages & layouts)
│   ├── (archive)/archive/page.tsx    #   Archived tasks view
│   ├── (dashboard)/dashboard/page.tsx#   Analytics dashboard
│   ├── (docs)/docs/page.tsx          #   User guide documentation
│   ├── (matrix)/page.tsx             #   Main Eisenhower matrix view
│   ├── (pwa)/install/page.tsx        #   PWA installation page
│   ├── (sync)/sync-history/page.tsx  #   Sync operation history
│   ├── layout.tsx                    #   Root layout (providers, theme, error boundary)
│   ├── globals.css                   #   Global styles
│   └── not-found.tsx                 #   404 page
│
├── components/                       # React UI components
│   ├── ui/                           #   Shadcn-style primitives (button, dialog, input, etc.)
│   ├── command-palette/              #   Global ⌘K / Ctrl+K command interface
│   ├── dashboard/                    #   Analytics charts and metrics
│   ├── docs/                         #   User guide sections
│   ├── matrix-board/                 #   Eisenhower matrix grid with drag-and-drop
│   ├── settings/                     #   iOS-style grouped settings sections
│   ├── sync/                         #   OAuth buttons, sync dialog, status hooks
│   ├── task-form/                    #   Modular task creation/editing form
│   ├── app-header.tsx                #   Header with smart view pills & navigation
│   ├── app-footer.tsx                #   Footer
│   ├── bulk-actions-bar.tsx          #   Multi-select batch operations
│   ├── error-boundary.tsx            #   React error boundary wrapper
│   ├── filter-panel.tsx              #   Task filtering by urgency, tags, due date
│   ├── pwa-register.tsx              #   Service worker registration
│   ├── smart-view-pills.tsx          #   Pinned smart view shortcuts in header
│   ├── task-card.tsx                 #   Individual task card UI
│   ├── task-timer.tsx                #   Time tracking controls
│   └── theme-provider.tsx            #   Dark/light mode provider
│
├── lib/                              # Core application logic
│   ├── analytics/                    #   Productivity metrics, streaks, tags, trends, time tracking
│   ├── constants/                    #   Schema limits, sync config, UI constants
│   ├── hooks/                        #   Custom React hooks
│   ├── notifications/                #   Browser notifications (display, permissions, settings, badge)
│   ├── smart-views/                  #   Built-in & custom smart view definitions
│   ├── sync/                         #   PocketBase cloud sync engine (17 files)
│   │   ├── config/                   #     Sync feature toggle & reset
│   │   ├── pocketbase-client.ts      #     SDK singleton wrapper
│   │   ├── pb-sync-engine.ts         #     Push/pull with LWW conflict resolution
│   │   ├── pb-realtime.ts            #     SSE subscriptions with echo filtering
│   │   ├── pb-auth.ts                #     OAuth login/logout (Google, GitHub)
│   │   ├── task-mapper.ts            #     camelCase ↔ snake_case field mapping
│   │   ├── sync-coordinator.ts       #     Orchestrates sync lifecycle
│   │   ├── sync-provider.tsx         #     React context for sync state
│   │   ├── health-monitor.ts         #     Connection monitoring & auto-reconnect
│   │   ├── queue.ts                  #     Pending operation queue
│   │   ├── retry-manager.ts          #     Exponential backoff retry
│   │   ├── background-sync.ts        #     Periodic background sync
│   │   └── error-categorizer.ts      #     Transient vs. permanent error classification
│   ├── tasks/                        #   Task CRUD operations (modular)
│   │   ├── crud/                     #     create, update, toggle, delete, move, duplicate, snooze, time-tracking
│   │   ├── subtasks.ts               #     Subtask management
│   │   ├── dependencies.ts           #     Dependency add/remove with cleanup
│   │   └── import-export.ts          #     JSON import/export with schema validation
│   ├── db.ts                         #   Dexie IndexedDB database (v13, 10 tables)
│   ├── dependencies.ts               #   Circular dependency detection (BFS algorithm)
│   ├── schema.ts                     #   Zod validation schemas (strict export, lenient import)
│   ├── types.ts                      #   TypeScript type definitions (TaskRecord, QuadrantId, etc.)
│   ├── quadrants.ts                  #   Eisenhower quadrant metadata and resolution
│   ├── filters.ts                    #   Smart view filter logic
│   ├── bulk-operations.ts            #   Batch delete, complete, move, tag
│   ├── logger.ts                     #   Structured JSON logging with secret sanitization
│   ├── use-tasks.ts                  #   useTasks() hook with Dexie live queries
│   └── utils.ts                      #   General utility functions
│
├── packages/                         # Monorepo workspaces
│   └── mcp-server/                   #   Claude Desktop MCP server (v0.9.0)
│       └── src/
│           ├── tools/                #     20 tool definitions (read, write, analytics, system)
│           │   ├── handlers/         #       Tool execution logic
│           │   └── schemas/          #       Zod input/output schemas
│           ├── write-ops/            #     Task mutations with dry-run support
│           ├── api/                  #     PocketBase API wrappers
│           ├── analytics.ts          #     Analytics tool router
│           ├── cache.ts              #     TTL-based result caching
│           ├── pocketbase-client.ts  #     SDK singleton
│           └── index.ts              #     Entry point (stdio transport)
│
├── public/                           # Static assets
│   ├── manifest.json                 #   PWA manifest (standalone mode, shortcuts)
│   ├── sw.js                         #   Service worker (network-first HTML, cache-first assets)
│   └── icons/                        #   App icons (192px, 512px, SVG maskable)
│
├── scripts/                          # Deployment & setup
│   ├── deploy-cloudfront-function.sh #   CloudFront Function deployment for SPA routing
│   ├── deploy-dev.sh                 #   Development deployment
│   ├── setup-pocketbase-collections.sh # PocketBase collection provisioning
│   ├── generate-build-info.js        #   Build metadata injection
│   └── build-local.sh               #   Local build script
│
├── tests/                            # Vitest test suite
│   ├── data/                         #   Data layer tests (CRUD, filters, schema, sync)
│   ├── ui/                           #   Component tests (forms, dialogs, bulk ops)
│   ├── sync/                         #   Sync engine tests (push/pull, conflicts, errors)
│   ├── fixtures/                     #   Test data factories
│   └── utils/                        #   Test utilities
│
├── .github/workflows/                # CI/CD
│   ├── claude.yml                    #   Claude Code GitHub Action
│   ├── claude-code-review.yml        #   Automated code review
│   └── security-audit.yml           #   Security scanning
│
├── next.config.ts                    # Static export, typed routes, React Compiler
├── tailwind.config.ts                # Class-based dark mode, quadrant theme colors
├── tsconfig.json                     # Strict TypeScript, @/ path alias
├── vitest.config.ts                  # jsdom environment, 80% coverage thresholds
└── package.json                      # Bun workspace root (v7.2.4)
```

---

## 3. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                      │
│         Browser (PWA)              │          Claude Desktop             │
└────────────┬───────────────────────┼────────────────────┬───────────────┘
             │                       │                    │
             ▼                       │                    ▼
┌────────────────────────┐           │     ┌──────────────────────────────┐
│   FRONTEND (Static)    │           │     │   MCP SERVER (Node.js)       │
│                        │           │     │                              │
│  Next.js 16 App Router │           │     │  20 Tools (Read/Write/       │
│  React 19 + Tailwind 4 │           │     │  Analytics/System)           │
│  Client-side only      │           │     │  stdio transport (JSON-RPC)  │
│                        │           │     │                              │
│  ┌──────────────────┐  │           │     │  ┌────────────────────────┐  │
│  │ Dexie (IndexedDB)│  │           │     │  │ PocketBase JS SDK      │  │
│  │ Local-first data  │  │           │     │  │ + TTL Cache            │  │
│  │ 10 tables, v13   │  │           │     │  │ + Retry w/ backoff     │  │
│  └──────────────────┘  │           │     │  └───────────┬────────────┘  │
│           │             │           │     │              │               │
└───────────┼─────────────┘           │     └──────────────┼───────────────┘
            │                         │                    │
            │ Optional Cloud Sync     │                    │
            │ (Push/Pull + SSE)       │                    │
            ▼                         ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     POCKETBASE (Self-Hosted)                            │
│                     https://api.vinny.io                                │
│                                                                         │
│  ┌─────────────────┐  ┌───────────────┐  ┌───────────────────────────┐ │
│  │ tasks collection │  │ devices       │  │ OAuth2 Providers          │ │
│  │ (SQLite)         │  │ collection    │  │ (Google, GitHub)          │ │
│  │                  │  │               │  │                           │ │
│  │ Row-level ACL:   │  │ Multi-device  │  │ Built-in auth system      │ │
│  │ owner = auth.id  │  │ tracking      │  │ with authStore            │ │
│  └─────────────────┘  └───────────────┘  └───────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ SSE (Server-Sent Events) — Realtime subscriptions                │  │
│  │ Echo filtering via device_id comparison                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     HOSTING (AWS)                                       │
│                                                                         │
│  ┌──────────────┐  ┌───────────────────┐  ┌─────────────────────────┐  │
│  │ S3 Bucket    │  │ CloudFront CDN    │  │ EC2 Instance            │  │
│  │ Static site  │  │ + Edge Function   │  │ PocketBase server       │  │
│  │ hosting      │  │ (URL rewriting)   │  │ (api.vinny.io)          │  │
│  └──────────────┘  └───────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Components

### 4.1 Frontend — Next.js Static PWA

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Privacy-first Eisenhower matrix task manager |
| **Framework** | Next.js 16 App Router (static export, no SSR) |
| **UI** | React 19, Tailwind CSS 4, Radix UI primitives, Lucide icons |
| **State** | Dexie `useLiveQuery` for reactive IndexedDB reads |
| **Drag & Drop** | dnd-kit library for quadrant reordering |
| **Command Palette** | cmdk library (⌘K / Ctrl+K) |
| **Charts** | Recharts for analytics dashboard |
| **Validation** | Zod 4 for all data schemas |
| **Deployment** | Static export → S3 + CloudFront CDN |

**Key Features:**
- Eisenhower matrix (4 quadrants: Do, Schedule, Delegate, Eliminate)
- Smart views with keyboard shortcuts (1-9, 0 to clear; max 5 pinned)
- Recurring tasks (daily, weekly, monthly) with auto-creation on completion
- Task dependencies with circular dependency detection (BFS)
- Time tracking with start/stop controls per task
- Subtask management with nested completion tracking
- Bulk operations (multi-select → delete, complete, move, tag)
- Tag-based organization with analytics
- Browser notifications with quiet hours
- Auto-archive (30/60/90 days after completion)
- JSON import/export for data portability

### 4.2 Cloud Sync Engine

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Optional multi-device sync for task data |
| **Protocol** | Last-Write-Wins (LWW) via `client_updated_at` timestamps |
| **Transport** | REST API (push/pull) + SSE (realtime subscriptions) |
| **Backend** | PocketBase v0.23+ (self-hosted) |
| **Auth** | PocketBase OAuth2 (Google, GitHub providers) |

**Architecture:**
- **Sync Coordinator** orchestrates the full push → pull → realtime lifecycle
- **Push** throttles at 100ms between requests; batch-fetches remote IDs to avoid N+1
- **Pull** fetches remote changes and applies LWW resolution locally
- **Realtime** SSE subscriptions auto-reconnect; echo filtering skips own-device changes
- **Health Monitor** detects connection issues and triggers automatic retries
- **Retry Manager** applies exponential backoff for transient failures
- **Error Categorizer** classifies failures as retryable vs. permanent
- **Background Sync** runs periodic sync as a safety net

### 4.3 MCP Server — Claude Desktop Integration

| Attribute | Detail |
|-----------|--------|
| **Purpose** | AI-powered task management via natural language |
| **Runtime** | Node.js 18+, TypeScript |
| **Transport** | stdio (JSON-RPC 2.0) for Claude Desktop |
| **Package** | `packages/mcp-server/` (v0.9.0) |
| **SDK** | `@modelcontextprotocol/sdk` |

**20 Tools across 4 categories:**

| Category | Tools | Description |
|----------|-------|-------------|
| **Read (7)** | `list_tasks`, `get_task`, `search_tasks`, `get_sync_status`, `list_devices`, `get_task_stats`, `get_token_status` | Query tasks and system state |
| **Write (5)** | `create_task`, `update_task`, `complete_task`, `delete_task`, `bulk_update_tasks` | Mutate tasks (all support `dryRun` mode) |
| **Analytics (5)** | `get_productivity_metrics`, `get_quadrant_analysis`, `get_tag_analytics`, `get_upcoming_deadlines`, `get_task_insights` | Productivity analysis |
| **System (3)** | `validate_config`, `get_help`, `get_cache_stats` | Configuration and diagnostics |

**Features:** Zod schema validation, TTL result caching, retry with exponential backoff, circular dependency validation, dry-run mode for safe previews.

---

## 5. Data Stores

### 5.1 IndexedDB (Client — via Dexie)

| Attribute | Detail |
|-----------|--------|
| **Type** | IndexedDB (browser-native) |
| **Library** | Dexie 4.3.0 |
| **Database Name** | `GsdTaskManager` |
| **Schema Version** | 13 (with migration chain) |
| **Purpose** | Primary local-first data store |

**Tables:**

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `tasks` | Active task records | id, quadrant, completed, dueDate, *tags, *dependencies, [quadrant+completed] |
| `archivedTasks` | Completed archived tasks | id, quadrant, completed |
| `smartViews` | Saved filter configurations | id |
| `notificationSettings` | User notification preferences | id |
| `appPreferences` | UI preferences (pinned views) | id |
| `syncQueue` | Pending sync operations | id |
| `syncMetadata` | PocketBase sync configuration | id |
| `deviceInfo` | Multi-device tracking | id |
| `syncHistory` | Sync operation audit log | id |
| `archiveSettings` | Auto-archive configuration | id |

### 5.2 PocketBase (Server — SQLite)

| Attribute | Detail |
|-----------|--------|
| **Type** | PocketBase v0.23+ (embedded SQLite) |
| **Host** | `https://api.vinny.io` (AWS EC2) |
| **Purpose** | Optional cloud sync backend |

**Collections:**

| Collection | Purpose | API Rules |
|------------|---------|-----------|
| `tasks` | Synced task records (snake_case fields) | `@request.auth.id != "" && owner = @request.auth.id` |
| `devices` | Registered device tracking | Auth-gated |
| `_superusers` | PocketBase admin auth (v0.23+) | System |

**Key Constraints:**
- System fields (`created`, `updated`) cannot be used in `sort` or `filter` — use `client_updated_at`
- Custom indexes cannot reference system columns
- Admin auth via `/api/collections/_superusers/auth-with-password`

---

## 6. External Integrations

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **PocketBase** | Cloud sync backend, auth, realtime | PocketBase JS SDK (v0.26.8) — REST API + SSE |
| **Google OAuth** | User authentication (sync) | PocketBase built-in OAuth2 provider |
| **GitHub OAuth** | User authentication (sync) | PocketBase built-in OAuth2 provider |
| **AWS S3** | Static site hosting | AWS CLI (`aws s3 sync`) |
| **AWS CloudFront** | CDN with edge function for SPA routing | AWS CLI + CloudFront Functions (cloudfront-js-2.0) |
| **Claude Desktop** | AI-powered task management | MCP Server (stdio, JSON-RPC 2.0) |

---

## 7. Deployment & Infrastructure

### Cloud Provider: AWS

| Service | Purpose |
|---------|---------|
| **S3** | Static site hosting (Next.js static export) |
| **CloudFront** | CDN distribution with edge function for URL rewriting |
| **CloudFront Functions** | SPA routing (`/dashboard/` → `/dashboard/index.html`) |
| **EC2** | Self-hosted PocketBase server (`api.vinny.io`) |

### CI/CD Pipeline

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `claude.yml` | `@claude` mentions in issues/PRs | Claude Code GitHub Action for AI-assisted development |
| `claude-code-review.yml` | Pull requests | Automated code review |
| `security-audit.yml` | Scheduled / on-demand | Security vulnerability scanning |

### Build & Deployment Flow

```
bun install
  → bun run build (generates static export with build info)
    → aws s3 sync (upload to S3 bucket)
      → CloudFront cache invalidation (/*)
        → CloudFront Function handles SPA routing
```

### Monitoring & Observability

- **Structured Logging** (`lib/logger.ts`): JSON-formatted logs with correlation IDs, context labels (SYNC_ENGINE, TASK_CRUD, etc.), and automatic secret sanitization
- **Sync Health Monitor**: Detects connection issues, tracks sync success/failure rates
- **Build Info**: Version, git hash, and timestamp embedded in each build (`.build-info.json`)
- **PWA Update Toast**: Notifies users of new versions via service worker lifecycle

---

## 8. Security Considerations

### Authentication

| Method | Context |
|--------|---------|
| **PocketBase OAuth2** | Cloud sync login via Google or GitHub providers |
| **PocketBase authStore** | Token persistence in localStorage with auto-refresh |
| **No auth required** | Local-only mode (default) — no account needed |

### Authorization

- **Row-Level Security**: PocketBase API rules enforce `owner = @request.auth.id` on all task operations
- **MCP Server**: Authenticated via `GSD_AUTH_TOKEN` environment variable
- **Client-side**: No server-side authorization (static site); all data gated by browser origin

### Data Protection

| Layer | Method |
|-------|--------|
| **In-Transit** | HTTPS (CloudFront TLS, PocketBase TLS) |
| **At-Rest (Client)** | IndexedDB (browser-managed encryption) |
| **At-Rest (Server)** | PocketBase SQLite on EC2 (user-controlled) |
| **Secrets in Logs** | Automatic sanitization of tokens, passwords, emails |
| **Input Validation** | Zod schemas on all data mutations (strict mode) |
| **XSS Prevention** | DOMPurify for user-generated content |

### Security Tooling

- **Dependency Auditing**: `bun audit` with `overrides` in `package.json` for transitive vulnerability patches
- **CI Security Scanning**: `security-audit.yml` GitHub Actions workflow
- **Code Review**: `claude-code-review.yml` for automated PR review
- **Schema Validation**: Strict Zod schemas prevent malformed data from entering the system

---

## 9. Development & Testing

### Local Setup

```bash
# Prerequisites: Bun (https://bun.sh), Node.js 18+

# 1. Clone and install
git clone https://github.com/vscarpenter/gsd-task-manager.git
cd gsd-task-manager
bun install

# 2. Configure environment (optional — only for cloud sync)
cp .env.example .env.local
# Set NEXT_PUBLIC_POCKETBASE_URL=https://api.vinny.io

# 3. Start development server
bun dev
# → http://localhost:3000

# 4. Run checks
bun run test          # Vitest (CI mode)
bun run test:watch    # Vitest (watch mode)
bun typecheck         # TypeScript strict
bun lint              # ESLint
```

### Testing Framework

| Tool | Purpose |
|------|---------|
| **Vitest 4** | Test runner (jsdom environment) |
| **@testing-library/react** | Component rendering & interaction |
| **@testing-library/jest-dom** | Custom DOM matchers |
| **@testing-library/user-event** | Simulated user interactions |
| **fake-indexeddb** | IndexedDB mock for data layer tests |

**Coverage Thresholds:**
- Statements: 80%
- Lines: 80%
- Functions: 80%
- Branches: 75%

**Test Organization:**
- `tests/data/` — Data layer (CRUD, filters, schema validation, dependencies)
- `tests/ui/` — Component tests (forms, dialogs, bulk operations)
- `tests/sync/` — Sync engine (push/pull, conflict resolution, error handling)
- `tests/fixtures/` — Test data factories
- `tests/utils/` — Shared test utilities

### Code Quality Tools

| Tool | Purpose |
|------|---------|
| **TypeScript 5.9** (strict mode) | Static type checking with typed routes |
| **ESLint 10** | Code linting (`eslint-config-next`) |
| **Tailwind CSS 4** | Utility-first CSS with class-based dark mode |
| **React Compiler** | Automatic memoization (Next.js 16 experimental) |
| **Zod 4** | Runtime schema validation |

### Pre-commit Checklist

```bash
bun run test      # All tests pass
bun typecheck     # No type errors
bun lint          # No lint warnings
```

---

## 10. Future Considerations

### Known Technical Debt

- **Database schema at v13**: Migration chain from v1–v13 carries complexity; a schema consolidation could simplify onboarding
- **Service worker caching**: Current network-first strategy with iOS cache-busting workarounds may benefit from Workbox migration
- **Sync engine complexity**: 17 files in `lib/sync/` with retry, queue, health monitor, and error categorization — could benefit from a state machine abstraction
- **`eslint-config-next` version coupling**: Must stay pinned in sync with `next` version; automated checks would prevent drift
- **Dependency overrides**: Multiple transitive vulnerability patches in `package.json` overrides need periodic review

### Planned Migrations

- **PocketBase upgrades**: Currently on v0.23+ with known gotchas around system fields and admin auth — future versions may resolve these
- **Next.js App Router evolution**: Currently using route groups `(matrix)`, `(dashboard)`, etc. — may adopt parallel routes or intercepting routes as they stabilize

### Potential Roadmap Items

- **Collaborative sync**: Multi-user task sharing (currently single-user with multi-device)
- **Native mobile apps**: `packages/native/` directory exists as a placeholder
- **Offline-first conflict UI**: Surface LWW conflicts to users instead of silent resolution
- **MCP Server expansion**: Additional tools for time tracking, smart view management, and notification control

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **BFS** | Breadth-First Search — algorithm used for circular dependency detection in task relationships |
| **Dexie** | Minimalistic IndexedDB wrapper providing reactive live queries and schema versioning |
| **Eisenhower Matrix** | Prioritization framework classifying tasks by urgency and importance into 4 quadrants |
| **GSD** | Get Stuff Done — the project's namesake philosophy |
| **IndexedDB** | Browser-native key-value database for structured client-side storage |
| **LWW** | Last-Write-Wins — conflict resolution strategy where the most recent `client_updated_at` timestamp wins |
| **MCP** | Model Context Protocol — Anthropic's protocol for connecting AI models to external tools |
| **PocketBase** | Open-source Go backend providing REST API, realtime SSE, auth, and SQLite storage |
| **PWA** | Progressive Web App — web application with offline support, installability, and native-like behavior |
| **Q1–Q4** | Quadrant 1 through 4 in the Eisenhower matrix (Do, Schedule, Delegate, Eliminate) |
| **SSE** | Server-Sent Events — HTTP-based protocol for server-to-client realtime push notifications |
| **Smart View** | Saved filter configuration that can be pinned to the header and accessed via keyboard shortcuts |
| **stdio transport** | Communication method where the MCP server reads/writes JSON-RPC messages via standard input/output |
| **View Transitions API** | Browser API for animated transitions between DOM states during client-side navigation |
