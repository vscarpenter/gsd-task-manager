/**
 * Architecture diagram definitions for the documentation page
 * These diagrams visualize the GSD Task Manager system architecture
 */

export interface DiagramDefinition {
  id: string;
  title: string;
  description?: string;
  code: string;
}

export interface DiagramSection {
  id: string;
  title: string;
  description: string;
  diagrams: DiagramDefinition[];
}

export const syncArchitectureDiagrams: DiagramSection = {
  id: "sync",
  title: "Sync Engine Architecture",
  description: "PocketBase-powered sync with last-write-wins conflict resolution",
  diagrams: [
    {
      id: "sync-state-machine",
      title: "Sync Engine State Machine",
      description: "State flow from idle through push/pull to completion",
      code: `stateDiagram-v2
    [*] --> Idle: Initial State

    Idle --> Validating: sync() called
    Validating --> Backoff: Auto sync + in backoff
    Validating --> Preparing: Config valid

    Backoff --> Idle: Return error

    Preparing --> Pushing: Prerequisites ready
    Preparing --> AuthError: Token invalid

    AuthError --> Idle: Return error

    Pushing --> Pulling: Push complete
    Pushing --> Retrying: Unauthorized (401)

    Retrying --> Pushing: Token refreshed
    Retrying --> AuthError: Refresh failed

    Pulling --> Resolving: Pull complete

    Resolving --> Finalizing: Conflicts resolved (LWW)

    Finalizing --> Idle: Return success`,
    },
    {
      id: "sync-data-flow",
      title: "Complete Sync Data Flow",
      description: "End-to-end view of sync across multiple devices via PocketBase",
      code: `flowchart TB
    subgraph DeviceA[Device A]
        UA[User Action] --> TA[Task Modified]
        TA --> QA[Add to Sync Queue]
        QA --> PA[Push to PocketBase]
    end

    subgraph PB[PocketBase Server]
        PA --> AUTH[Auth Check]
        AUTH --> STORE[Store Task Record]
        STORE --> DB[(SQLite Database)]
        SSE[SSE Realtime Events] --> DB
    end

    subgraph DeviceB[Device B]
        SSE --> RB[Receive SSE Event]
        RB --> ECHO{Echo filter}
        ECHO -->|Own device| SKIP[Skip]
        ECHO -->|Other device| MB[Merge via LWW]
        MB --> VB[Update View]
    end`,
    },
    {
      id: "lww-resolution",
      title: "Last-Write-Wins Conflict Resolution",
      description: "Conflict resolution using client_updated_at timestamps",
      code: `flowchart TD
    START([Compare Local vs Remote]) --> GET[Get client_updated_at from both]
    GET --> CMP{Compare timestamps}

    CMP -->|Local newer| LOCAL[Keep local version]
    CMP -->|Remote newer| REMOTE[Accept remote version]
    CMP -->|Equal| REMOTE_SAFE[Accept remote - safe default]

    LOCAL --> PUSH[Push local to PocketBase]
    REMOTE --> APPLY[Apply remote to IndexedDB]
    REMOTE_SAFE --> APPLY`,
    },
    {
      id: "realtime-sse",
      title: "Realtime SSE Subscription",
      description: "PocketBase Server-Sent Events for instant cross-device updates",
      code: `sequenceDiagram
    participant DevA as Device A
    participant PB as PocketBase
    participant DevB as Device B

    DevA->>PB: Subscribe to tasks collection
    DevB->>PB: Subscribe to tasks collection

    DevA->>PB: Update task (push)
    PB->>DevA: SSE event (filtered by device_id)
    PB->>DevB: SSE event
    DevB->>DevB: Apply remote change via LWW

    Note over DevA: Echo filtered - own changes skipped
    Note over DevB: Auto-reconnect on disconnect`,
    },
  ],
};

export const backendArchitectureDiagrams: DiagramSection = {
  id: "backend",
  title: "PocketBase Backend Architecture",
  description: "Self-hosted PocketBase with OAuth, API rules, and realtime",
  diagrams: [
    {
      id: "system-overview",
      title: "System Architecture",
      description: "Overall system components and data flow",
      code: `flowchart TB
    subgraph Clients
        PWA[PWA Browser]
        MCP[MCP Server]
    end

    subgraph Server[PocketBase Server]
        API[REST API]
        RT[Realtime SSE]
        OAUTH[OAuth2 Providers]

        subgraph Data
            DB[(SQLite Database)]
        end

        API --> DB
        RT --> DB
    end

    subgraph OAuth[OAuth Providers]
        GOOGLE[Google OAuth]
        GITHUB[GitHub OAuth]
    end

    PWA --> API
    PWA --> RT
    MCP --> API
    OAUTH --> GOOGLE
    OAUTH --> GITHUB`,
    },
    {
      id: "api-rules",
      title: "API Rules & Access Control",
      description: "PocketBase collection-level security rules",
      code: `flowchart TD
    REQ([API Request]) --> AUTH{Authenticated?}
    AUTH -->|No| REJECT[401 Unauthorized]
    AUTH -->|Yes| RULE{API Rule Check}

    RULE --> TASKS[Tasks Collection]
    TASKS --> OWNER{"owner = auth.id?"}
    OWNER -->|No| FORBIDDEN[403 Forbidden]
    OWNER -->|Yes| ALLOW[Allow Access]

    RULE --> DEVICES[Devices Collection]
    DEVICES --> DEV_OWNER{"owner = auth.id?"}
    DEV_OWNER -->|No| FORBIDDEN
    DEV_OWNER -->|Yes| ALLOW`,
    },
    {
      id: "oauth-flow",
      title: "OAuth Authentication Flow",
      description: "PocketBase SDK-managed OAuth popup flow",
      code: `sequenceDiagram
    participant User
    participant App
    participant SDK as PocketBase SDK
    participant PB as PocketBase
    participant Google

    User->>App: Click Sign In
    App->>SDK: authWithOAuth2('google')
    SDK->>PB: Initiate OAuth flow
    PB-->>SDK: Auth URL
    SDK->>SDK: Open popup window
    SDK->>Google: Authorization Request
    User->>Google: Consent
    Google->>SDK: Redirect with code
    SDK->>PB: Exchange code for tokens
    PB-->>SDK: Auth record + token
    SDK->>SDK: Store in authStore (localStorage)
    SDK-->>App: Authenticated user`,
    },
  ],
};

export const mcpArchitectureDiagrams: DiagramSection = {
  id: "mcp",
  title: "MCP Server Architecture",
  description: "Model Context Protocol server for Claude Desktop integration",
  diagrams: [
    {
      id: "mcp-system",
      title: "MCP System Architecture",
      description: "Claude Desktop to PocketBase data flow",
      code: `flowchart TB
    subgraph Claude[Claude Desktop]
        AI[Claude AI]
        CLIENT[MCP Client]
    end

    subgraph MCP[MCP Server]
        TRANSPORT[stdio Transport]
        ROUTER[Tool Router]
        HANDLERS[Tool Handlers]

        subgraph Services
            API[PocketBase Client]
            CACHE[TTL Cache]
        end

        TRANSPORT --> ROUTER
        ROUTER --> HANDLERS
        HANDLERS --> API
        HANDLERS --> CACHE
    end

    subgraph Backend[GSD Backend]
        PB[PocketBase Server]
    end

    AI <--> CLIENT
    CLIENT <--> TRANSPORT
    API <--> PB`,
    },
    {
      id: "tool-organization",
      title: "Tool Organization",
      description: "20 tools in 4 categories",
      code: `flowchart TD
    subgraph Read[Read Tools - 7]
        R1[list_tasks]
        R2[get_task]
        R3[search_tasks]
        R4[get_sync_status]
        R5[list_devices]
        R6[get_task_stats]
        R7[get_token_status]
    end

    subgraph Write[Write Tools - 5]
        W1[create_task]
        W2[update_task]
        W3[complete_task]
        W4[delete_task]
        W5[bulk_update_tasks]
    end

    subgraph Analytics[Analytics - 5]
        A1[get_productivity_metrics]
        A2[get_quadrant_analysis]
        A3[get_tag_analytics]
        A4[get_upcoming_deadlines]
        A5[get_task_insights]
    end

    subgraph System[System - 3]
        S1[validate_config]
        S2[get_help]
        S3[get_cache_stats]
    end`,
    },
    {
      id: "request-lifecycle",
      title: "Request Lifecycle",
      description: "Tool call processing from Claude to PocketBase response",
      code: `sequenceDiagram
    participant Claude
    participant Transport as stdio
    participant Router
    participant Handler
    participant Cache
    participant PB as PocketBase

    Claude->>Transport: JSON-RPC Request
    Transport->>Router: Parse & route
    Router->>Handler: Dispatch

    Handler->>Handler: Validate args (Zod)

    alt Cache hit
        Handler->>Cache: Check cache
        Cache-->>Handler: Return cached
    end

    Handler->>PB: HTTPS + Auth Token
    PB-->>Handler: JSON Response
    Handler->>Cache: Store result
    Handler-->>Router: Tool result
    Router-->>Transport: JSON-RPC Response
    Transport-->>Claude: Display`,
    },
    {
      id: "dry-run-flow",
      title: "Write Operation with Dry Run",
      description: "Preview changes before committing",
      code: `flowchart TD
    START([Write Tool Called]) --> PARSE[Parse arguments]
    PARSE --> VALIDATE[Validate with Zod]
    VALIDATE --> DRY{dryRun mode?}

    DRY -->|Yes| SIMULATE[Simulate operation]
    SIMULATE --> PREVIEW[Generate preview]
    PREVIEW --> RESP_DRY[Return preview - No changes]

    DRY -->|No| DEPS{Has dependencies?}
    DEPS -->|Yes| CHECK[Check circular deps]
    CHECK --> CIRCULAR{Would create cycle?}

    CIRCULAR -->|Yes| ERROR[Validation error]
    CIRCULAR -->|No| API_CALL

    DEPS -->|No| API_CALL[Call PocketBase API]

    API_CALL --> SUCCESS{Success?}
    SUCCESS -->|No| RETRY{Retryable?}
    RETRY -->|Yes| BACKOFF[Exponential backoff]
    BACKOFF --> API_CALL
    RETRY -->|No| ERROR

    SUCCESS -->|Yes| INVALIDATE[Invalidate cache]
    INVALIDATE --> RESP[Return success]`,
    },
  ],
};

export const allDiagramSections: DiagramSection[] = [
  syncArchitectureDiagrams,
  backendArchitectureDiagrams,
  mcpArchitectureDiagrams,
];
