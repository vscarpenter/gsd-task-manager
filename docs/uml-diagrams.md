# GSD Task Manager — UML Diagrams

Mermaid-based UML diagrams documenting the system architecture, data model, and key flows.

---

## 1. System Component Diagram

High-level architecture showing major subsystems and their relationships.

```mermaid
graph TB
    subgraph "Browser (PWA)"
        direction TB
        subgraph "UI Layer"
            AppShell[App Shell]
            MatrixGrid[Matrix Grid]
            CaptureBar[Capture Bar]
            EditDrawer[Edit Drawer]
            Dashboard[Dashboard]
            Settings[Settings Page]
            TaskCard[Task Card]
        end

        subgraph "State & Hooks"
            UseTasks["useTasks() Hook"]
            UseViewTransition["useViewTransition()"]
            LiveQuery["useLiveQuery()"]
        end

        subgraph "Core Library"
            Tasks[Task CRUD]
            BulkOps[Bulk Operations]
            Quadrants[Quadrant Logic]
            Dependencies[Dependency Graph]
            Filters[Filters & Smart Views]
            Schema[Zod Validation]
        end

        subgraph "Analytics & Notifications"
            Metrics[Metrics]
            Streaks[Streaks]
            Trends[Trends]
            NotifDisplay[Notification Display]
            NotifPerms[Notification Permissions]
        end

        subgraph "Data Layer"
            Dexie[(IndexedDB via Dexie v4)]
        end

        subgraph "Sync Layer"
            SyncCoord[Sync Coordinator]
            SyncEngine[PB Sync Engine]
            PBRealtime[PB Realtime SSE]
            PBAuth[PB Auth OAuth]
            TaskMapper[Task Mapper]
            PBClient[PocketBase Client]
        end
    end

    subgraph "External Services"
        PocketBase["PocketBase Server\n(api.vinny.io)"]
        OAuth["OAuth Providers\n(Google / GitHub)"]
    end

    subgraph "AI Integration"
        MCPServer["MCP Server\n(packages/mcp-server)"]
        Claude["Claude Desktop"]
    end

    %% UI → Hooks
    AppShell --> UseTasks
    MatrixGrid --> UseTasks
    CaptureBar --> Tasks
    EditDrawer --> Tasks
    Dashboard --> Metrics

    %% Hooks → Core
    UseTasks --> LiveQuery
    LiveQuery --> Dexie

    %% Core → Data
    Tasks --> Schema
    Tasks --> Dexie
    Tasks --> Dependencies
    Tasks --> Quadrants
    BulkOps --> Dexie
    Filters --> Dexie
    Filters --> Dependencies

    %% Sync
    SyncCoord --> SyncEngine
    SyncEngine --> PBClient
    SyncEngine --> TaskMapper
    PBRealtime --> PBClient
    PBAuth --> PBClient
    PBClient --> PocketBase
    PBAuth --> OAuth
    SyncEngine --> Dexie

    %% MCP
    Claude --> MCPServer
    MCPServer --> PocketBase
```

---

## 2. Class Diagram — Data Model

Core domain types and their relationships.

```mermaid
classDiagram
    class TaskRecord {
        +String id
        +String title
        +String description
        +Boolean urgent
        +Boolean important
        +QuadrantId quadrant
        +Boolean completed
        +String completedAt?
        +String dueDate?
        +String createdAt
        +String updatedAt
        +RecurrenceType recurrence
        +String[] tags
        +Subtask[] subtasks
        +String[] dependencies
        +String parentTaskId?
        +Number notifyBefore?
        +Boolean notificationEnabled
        +Boolean notificationSent
        +String lastNotificationAt?
        +String snoozedUntil?
        +Number estimatedMinutes?
        +Number timeSpent?
        +TimeEntry[] timeEntries
        +String archivedAt?
    }

    class TaskDraft {
        +String title
        +String description
        +Boolean urgent
        +Boolean important
        +String dueDate?
        +RecurrenceType recurrence
        +String[] tags
        +Subtask[] subtasks
        +String[] dependencies
        +Number notifyBefore?
        +Boolean notificationEnabled
        +Number estimatedMinutes?
    }

    class Subtask {
        +String id
        +String title
        +Boolean completed
    }

    class TimeEntry {
        +String id
        +String startedAt
        +String endedAt?
        +String notes?
    }

    class SmartView {
        +String id
        +String name
        +String description?
        +String icon?
        +FilterCriteria criteria
        +Boolean isBuiltIn
        +String createdAt
        +String updatedAt
    }

    class FilterCriteria {
        +QuadrantId[] quadrants?
        +String status?
        +String[] tags?
        +String dueDate?
        +RecurrenceType recurrence?
        +String dateRange?
        +String dependencyFilter?
        +String search?
    }

    class NotificationSettings {
        +String id
        +Boolean enabled
        +Number defaultLeadTime
        +Boolean soundEnabled
    }

    class ArchiveSettings {
        +String id
        +Boolean autoArchiveEnabled
        +Number autoArchiveDays
    }

    class AppPreferences {
        +String id
        +String theme
        +String defaultQuadrant?
        +Boolean compactMode
    }

    class SyncHistoryRecord {
        +String id
        +String timestamp
        +String type
        +String status
        +Number pushed?
        +Number pulled?
        +String error?
    }

    %% Relationships
    TaskRecord "1" *-- "0..*" Subtask : contains
    TaskRecord "1" *-- "0..*" TimeEntry : tracks
    TaskRecord "0..*" --> "0..*" TaskRecord : dependencies
    TaskRecord "0..1" --> "0..1" TaskRecord : parentTaskId
    TaskDraft ..> TaskRecord : creates
    SmartView "1" *-- "1" FilterCriteria : uses
    FilterCriteria ..> TaskRecord : filters
```

---

## 3. Class Diagram — Sync Layer

```mermaid
classDiagram
    class SyncCoordinator {
        -Boolean isRunning
        -SyncRequest[] pendingRequests
        -RetryManager retryManager
        -PBSyncResult lastResult
        +requestSync(priority) void
        +getStatus() SyncStatus
        -executeSync(priority) Promise
        -processQueue() Promise
    }

    class PBSyncEngine {
        +fullSync(triggeredBy) Promise~PBSyncResult~
        +applyRemoteChange(action, record) Promise
        -pushLocalChanges() Promise~PushResult~
        -pullRemoteChanges(lastSyncAt) Promise~PullResult~
        -reportAuthFailure() void
        -reportPartialFailure() void
        -reportSyncError(error) void
    }

    class PBSyncConfig {
        +String pocketBaseUrl
        +String authToken
        +String deviceId
        +String lastSyncAt?
        +String lastSuccessfulSyncAt?
        +Boolean autoSyncEnabled
        +Number syncIntervalMs
    }

    class SyncQueueItem {
        +String id
        +String taskId
        +String operation
        +Object payload
        +String timestamp
        +Number retryCount
        +String status
        +String lastError?
        +String failedAt?
    }

    class PBSyncResult {
        +Boolean success
        +Number pushed
        +Number pulled
        +String[] errors
        +String completedAt
    }

    class TaskMapper {
        +taskRecordToPocketBase(task) PBTask
        +pocketBaseToTaskRecord(record, existingLocal?) TaskRecord
    }

    class PBRealtime {
        +subscribe(collection) void
        +unsubscribe() void
        -handleEvent(event) void
        -filterEchos(deviceId) Boolean
    }

    class PBAuth {
        +signInWithOAuth(provider) Promise
        +signOut() Promise
        +getAuthState() AuthState
    }

    class PocketBaseClient {
        +getInstance() PocketBase
        -client: PocketBase
    }

    class DeviceInfo {
        +String key
        +String deviceId
        +String deviceName
        +String lastActiveAt
    }

    %% Relationships
    SyncCoordinator --> PBSyncEngine : orchestrates
    PBSyncEngine --> TaskMapper : maps fields
    PBSyncEngine --> PocketBaseClient : uses
    PBSyncEngine ..> PBSyncResult : returns
    PBSyncEngine ..> SyncQueueItem : processes
    PBRealtime --> PocketBaseClient : subscribes via
    PBAuth --> PocketBaseClient : authenticates via
    SyncCoordinator ..> PBSyncConfig : reads config
    TaskMapper ..> DeviceInfo : reads device
```

---

## 4. Class Diagram — Dependency Graph

```mermaid
classDiagram
    class DependencyModule {
        +addDependency(taskId, depId) Promise~TaskRecord~
        +removeDependency(taskId, depId) Promise~TaskRecord~
        +removeDependencyReferences(taskId) Promise
        +wouldCreateCircularDependency(taskId, depId) Promise~Boolean~
        +getBlockingTasks(taskId) Promise~TaskRecord[]~
        +getBlockedTasks(taskId) Promise~TaskRecord[]~
        +getUncompletedBlockingTasks(taskId) Promise~TaskRecord[]~
        +isTaskBlocked(taskId) Promise~Boolean~
        +isTaskBlocking(taskId) Promise~Boolean~
        +getReadyTasks() Promise~TaskRecord[]~
    }

    class TaskRecord {
        +String id
        +String[] dependencies
        +Boolean completed
    }

    class BFSCycleDetection {
        +wouldCreateCircularDependency(source, target) Boolean
        -buildAdjacencyList() Map
        -bfs(start, target) Boolean
    }

    DependencyModule --> TaskRecord : queries
    DependencyModule --> BFSCycleDetection : uses
    TaskRecord "0..*" --> "0..*" TaskRecord : depends on
```

---

## 5. Sequence Diagram — Full Sync Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Sync Button
    participant Coord as SyncCoordinator
    participant Engine as PBSyncEngine
    participant Mapper as TaskMapper
    participant DB as IndexedDB (Dexie)
    participant PB as PocketBase Server

    User->>UI: Click Sync
    UI->>Coord: requestSync('user')
    
    alt Already running
        Coord->>Coord: Queue request (dedup)
    else Idle
        Coord->>Coord: Set isRunning = true
        Coord->>Engine: fullSync('user')
        
        %% Push phase
        Engine->>DB: Read syncQueue (pending items)
        DB-->>Engine: SyncQueueItem[]
        
        loop Each queued change
            Engine->>Mapper: taskRecordToPocketBase(task)
            Mapper-->>Engine: PBTask (snake_case)
            Engine->>PB: Create/Update/Delete record
            PB-->>Engine: Success/Failure
        end
        
        Engine->>DB: Clear processed queue items

        %% Pull phase
        Engine->>DB: Read lastSyncAt cursor
        DB-->>Engine: timestamp
        Engine->>PB: GET records (filter: updated > lastSyncAt)
        PB-->>Engine: Remote records[]
        
        loop Each remote change
            Engine->>DB: Find existing local task
            DB-->>Engine: TaskRecord | null
            Engine->>Mapper: pocketBaseToTaskRecord(record, existingLocal)
            Mapper-->>Engine: TaskRecord (preserves device-local fields)
            
            alt Remote is newer (LWW)
                Engine->>DB: Upsert task
            else Local is newer
                Engine->>Engine: Skip (local wins)
            end
        end

        Engine->>DB: Update lastSyncAt cursor
        Engine-->>Coord: PBSyncResult{success, pushed, pulled}
        Coord->>Coord: Set isRunning = false
        Coord-->>UI: Notify success
        UI-->>User: Toast "Synced: 3↑ 2↓"
        
        %% Process queued requests
        Coord->>Coord: processQueue()
    end
```

---

## 6. Sequence Diagram — Realtime Sync (SSE)

```mermaid
sequenceDiagram
    participant PB as PocketBase Server
    participant SSE as PB Realtime (SSE)
    participant Engine as PBSyncEngine
    participant Mapper as TaskMapper
    participant DB as IndexedDB (Dexie)
    participant UI as Matrix Grid

    Note over SSE: Subscribed to 'tasks' collection

    PB->>SSE: SSE Event (create/update/delete)
    
    SSE->>SSE: Filter echo (same device_id?)
    
    alt Is echo from this device
        SSE->>SSE: Discard
    else From another device
        SSE->>Engine: applyRemoteChange(action, record)
        
        alt action = delete
            Engine->>DB: Delete task by id
        else action = create
            Engine->>DB: Check if exists
            DB-->>Engine: null (not found)
            Engine->>Mapper: pocketBaseToTaskRecord(record)
            Mapper-->>Engine: TaskRecord
            Engine->>DB: Add task
        else action = update
            Engine->>DB: Get local task
            DB-->>Engine: existing TaskRecord
            Engine->>Mapper: pocketBaseToTaskRecord(record, existingLocal)
            Mapper-->>Engine: merged TaskRecord
            
            alt Remote updatedAt > Local updatedAt
                Engine->>DB: Update task
            else Local is newer
                Engine->>Engine: Skip
            end
        end
        
        DB-->>UI: Live query triggers re-render
    end
```

---

## 7. Sequence Diagram — Task Creation

```mermaid
sequenceDiagram
    participant User
    participant Bar as Capture Bar
    participant Schema as Zod Validation
    participant CRUD as createTask()
    participant Quad as resolveQuadrantId()
    participant DB as IndexedDB (Dexie)
    participant Hook as useTasks() / LiveQuery
    participant Grid as Matrix Grid

    User->>Bar: Type title + set flags
    Bar->>Schema: taskDraftSchema.safeParse(input)
    
    alt Validation fails
        Schema-->>Bar: ZodError
        Bar-->>User: Toast error message
    else Valid
        Schema-->>Bar: TaskDraft
        Bar->>CRUD: createTask(draft)
        CRUD->>Quad: resolveQuadrantId(urgent, important)
        Quad-->>CRUD: QuadrantId
        CRUD->>CRUD: Generate id (nanoid)
        CRUD->>CRUD: Set timestamps (createdAt, updatedAt)
        CRUD->>DB: db.tasks.add(taskRecord)
        DB-->>CRUD: TaskRecord
        CRUD-->>Bar: TaskRecord
        Bar-->>User: Toast "Task created"
        
        Note over DB,Grid: Live reactivity
        DB-->>Hook: Change detected
        Hook-->>Grid: Re-render with new task
    end
```

---

## 8. Sequence Diagram — Task Completion with Recurrence

```mermaid
sequenceDiagram
    participant User
    participant Card as Task Card
    participant Toggle as toggleCompleted()
    participant Recur as handleRecurrence()
    participant CRUD as createTask()
    participant DB as IndexedDB (Dexie)

    User->>Card: Click complete checkbox
    Card->>Toggle: toggleCompleted(taskId)
    Toggle->>DB: Get task by id
    DB-->>Toggle: TaskRecord

    Toggle->>DB: Update task (completed=true, completedAt=now)
    
    alt task.recurrence !== 'none'
        Toggle->>Recur: handleRecurrence(task)
        Recur->>Recur: Calculate next dueDate
        
        Note over Recur: daily → +1 day<br/>weekly → +7 days<br/>monthly → +1 month
        
        Recur->>CRUD: createTask(nextInstanceDraft)
        CRUD->>DB: db.tasks.add(newTask)
        DB-->>CRUD: New TaskRecord
        CRUD-->>Recur: Next instance created
    end

    Toggle-->>Card: Updated TaskRecord
    Card-->>User: ✓ Animation + confetti
```

---

## 9. Component Diagram — MCP Server

```mermaid
graph LR
    subgraph "Claude Desktop"
        Claude[Claude AI]
    end

    subgraph "MCP Server (packages/mcp-server)"
        CLI["CLI Entry\n(setup / validate)"]
        Server["MCP Server\n(stdio transport)"]
        
        subgraph "Tools (20)"
            Read["Read Tools (7)\nlist-tasks, get-task,\nsearch-tasks, filter-tasks,\nget-dependencies, get-stats,\nlist-devices"]
            Write["Write Tools (5)\ncreate-task, update-task,\ndelete-task, complete-task,\nbulk-update"]
            Analytics["Analytics Tools (5)\nproductivity-metrics,\ncompletion-trends,\nquadrant-distribution,\ntag-analysis, streaks"]
            System["System Tools (3)\nhealth-check, sync-status,\nget-config"]
        end

        subgraph "Write Ops"
            TaskOps[task-operations.ts]
            BulkTaskOps[bulk-operations.ts]
            DryRun["Dry-Run Mode"]
        end

        Types["types.ts\n(PBTask ↔ Task conversion)"]
    end

    subgraph "PocketBase"
        API["REST API\n(api.vinny.io)"]
    end

    Claude <-->|stdio| Server
    Server --> Read
    Server --> Write
    Server --> Analytics
    Server --> System
    Write --> TaskOps
    Write --> BulkTaskOps
    TaskOps --> DryRun
    BulkTaskOps --> DryRun
    Read --> Types
    Write --> Types
    Types --> API
    TaskOps --> API
```

---

## 10. State Diagram — Sync Coordinator

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Running : requestSync(priority)
    
    Running --> Pushing : executeSync()
    Pushing --> Pulling : push complete
    Pulling --> Success : pull complete
    Pulling --> PartialFailure : some items failed
    Pushing --> AuthFailure : 401/403 response
    Pulling --> AuthFailure : 401/403 response
    Pushing --> Error : network/server error
    Pulling --> Error : network/server error

    Success --> ProcessingQueue : check pending
    PartialFailure --> ProcessingQueue : check pending
    
    ProcessingQueue --> Running : queued request exists
    ProcessingQueue --> Idle : queue empty

    AuthFailure --> Idle : notify user
    Error --> RetryBackoff : auto-sync
    Error --> Idle : user-triggered (no retry)
    
    RetryBackoff --> Idle : max retries exceeded
    RetryBackoff --> Running : backoff elapsed + requestSync
```

---

## 11. State Diagram — Task Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft : User opens capture bar

    Draft --> Active : createTask() + validation passes
    Draft --> [*] : User cancels

    Active --> Completed : toggleCompleted(true)
    Active --> Snoozed : snoozeTask(until)
    Active --> Archived : auto-archive (N days completed)
    Active --> Active : updateTask() / moveQuadrant()

    Snoozed --> Active : clearSnooze() / snooze expires
    
    Completed --> Active : toggleCompleted(false)
    Completed --> Archived : auto-archive after N days
    Completed --> RecurrenceSpawn : if recurrence != 'none'

    RecurrenceSpawn --> Active : new instance created
    
    Archived --> Active : restoreTask()
    Archived --> [*] : permanent delete

    state Active {
        [*] --> Q1_DoFirst
        [*] --> Q2_Schedule
        [*] --> Q3_Delegate
        [*] --> Q4_Eliminate
        Q1_DoFirst --> Q2_Schedule : change flags
        Q2_Schedule --> Q1_DoFirst : change flags
        Q3_Delegate --> Q4_Eliminate : change flags
        Q4_Eliminate --> Q3_Delegate : change flags
        Q1_DoFirst --> Q3_Delegate : change flags
        Q2_Schedule --> Q4_Eliminate : change flags
    }
```

---

## Rendering

These diagrams render natively in:
- **GitHub** (README, Issues, PRs, Wiki)
- **VS Code** (with Mermaid extension)
- **Mermaid Live Editor**: [mermaid.live](https://mermaid.live)

To render locally: `npx @mermaid-js/mermaid-cli mmdc -i docs/uml-diagrams.md -o docs/uml-diagrams.svg`
