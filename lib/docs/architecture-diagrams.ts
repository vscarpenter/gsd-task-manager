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
  description: "End-to-end encrypted sync with timestamp-based LWW conflict resolution",
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

    Preparing --> Pushing: Session valid
    Preparing --> AuthError: Session expired

    AuthError --> Idle: Return error

    Pushing --> Pulling: Push complete

    Pulling --> Resolving: Pull complete

    Resolving --> Finalizing: Conflicts resolved (LWW)

    Finalizing --> Idle: Return success`,
    },
    {
      id: "sync-data-flow",
      title: "Complete Sync Data Flow",
      description: "End-to-end view of sync across multiple devices",
      code: `flowchart TB
    subgraph DeviceA[Device A]
        UA[User Action] --> TA[Task Modified]
        TA --> QA[Add to Queue]
        QA --> EA[Encrypt AES-256]
        EA --> PA[Push to Supabase]
    end

    subgraph Supabase[Supabase Backend]
        PA --> RLS[RLS Policy Check]
        RLS --> PG[(Postgres)]
        PG --> RT[Realtime Broadcast]
        PULL[PostgREST Query] --> PG
    end

    subgraph DeviceB[Device B]
        RT --> WS[WebSocket Event]
        WS --> DB[Decrypt]
        DB --> MB[Merge Local]
        MB --> VB[Update View]
    end

    PULL --> DB`,
    },
    {
      id: "encryption-flow",
      title: "Encryption Flow",
      description: "AES-256-GCM encryption with PBKDF2 key derivation",
      code: `sequenceDiagram
    participant App
    participant CM as CryptoManager
    participant PBKDF2
    participant AES as AES-256-GCM

    App->>CM: initialize(passphrase, salt)
    CM->>PBKDF2: deriveKey(600k iterations)
    PBKDF2-->>CM: 256-bit key
    CM-->>App: Ready

    App->>CM: encrypt(taskData)
    CM->>CM: Generate random IV
    CM->>AES: encrypt(json, key, iv)
    AES-->>CM: ciphertext
    CM-->>App: base64(iv + ciphertext)

    App->>CM: decrypt(blob)
    CM->>CM: Extract IV + ciphertext
    CM->>AES: decrypt(ciphertext, key, iv)
    AES-->>CM: JSON
    CM-->>App: taskData`,
    },
  ],
};

export const supabaseArchitectureDiagrams: DiagramSection = {
  id: "supabase",
  title: "Supabase Backend Architecture",
  description: "Supabase with Postgres, Auth, Realtime, and RLS",
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

    subgraph Supabase[Supabase Platform]
        AUTH[Auth - Google/Apple OAuth]
        REST[PostgREST API]
        REALTIME[Realtime WebSocket]

        subgraph Storage
            PG[(Postgres 17)]
            RLS[Row Level Security]
        end

        REST --> PG
        REALTIME --> PG
        PG --> RLS
    end

    PWA --> AUTH
    PWA --> REST
    PWA --> REALTIME
    MCP --> REST`,
    },
    {
      id: "auth-flow",
      title: "OAuth Authentication Flow",
      description: "Supabase Auth handles Google/Apple OAuth automatically",
      code: `sequenceDiagram
    participant User
    participant App
    participant Supabase as Supabase Auth
    participant Google

    User->>App: Click Sign in
    App->>Supabase: signInWithOAuth(google)
    Supabase-->>App: Redirect URL
    App->>Google: Authorization Request
    User->>Google: Consent
    Google->>Supabase: Callback with code
    Supabase->>Supabase: Exchange code, create session
    Supabase-->>App: onAuthStateChange(SIGNED_IN)
    App->>App: Check encryption salt
    App->>App: Show passphrase dialog`,
    },
    {
      id: "rls-policies",
      title: "Row Level Security",
      description: "User isolation via RLS policies on all tables",
      code: `flowchart TD
    REQ([API Request]) --> JWT[Extract JWT from header]
    JWT --> UID[auth.uid from JWT]
    UID --> RLS{RLS Policy Check}

    RLS -->|user_id = auth.uid| ALLOW[Allow Query]
    RLS -->|user_id != auth.uid| DENY[Deny - Empty Result]

    subgraph Tables[Protected Tables]
        T1[encrypted_tasks]
        T2[profiles]
        T3[devices]
        T4[sync_metadata]
        T5[conflict_log]
    end

    ALLOW --> Tables`,
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
      description: "Claude Desktop to Supabase data flow",
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
            SUPA[Supabase Client]
            CRYPTO[CryptoManager]
            CACHE[TTL Cache]
        end

        TRANSPORT --> ROUTER
        ROUTER --> HANDLERS
        HANDLERS --> SUPA
        HANDLERS --> CRYPTO
        HANDLERS --> CACHE
    end

    subgraph Backend[Supabase]
        PG[(Postgres)]
    end

    AI <--> CLIENT
    CLIENT <--> TRANSPORT
    SUPA <--> PG`,
    },
    {
      id: "tool-organization",
      title: "Tool Organization",
      description: "19 tools in 4 categories",
      code: `flowchart TD
    subgraph Read[Read Tools - 6]
        R1[list_tasks]
        R2[get_task]
        R3[search_tasks]
        R4[get_sync_status]
        R5[list_devices]
        R6[get_task_stats]
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
      description: "Tool call processing from Claude to Supabase response",
      code: `sequenceDiagram
    participant Claude
    participant Transport as stdio
    participant Router
    participant Handler
    participant Cache
    participant Supabase
    participant Crypto

    Claude->>Transport: JSON-RPC Request
    Transport->>Router: Parse & route
    Router->>Handler: Dispatch

    Handler->>Handler: Validate args (Zod)

    alt Cache hit
        Handler->>Cache: Check cache
        Cache-->>Handler: Return cached
    end

    Handler->>Supabase: Query encrypted_tasks
    Supabase-->>Handler: Encrypted blobs
    Handler->>Crypto: decrypt(blob)
    Crypto-->>Handler: decrypted task
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
    CIRCULAR -->|No| ENCRYPT

    DEPS -->|No| ENCRYPT[Encrypt task data]
    ENCRYPT --> UPSERT[Upsert to Supabase]

    UPSERT --> SUCCESS{Success?}
    SUCCESS -->|No| ERROR
    SUCCESS -->|Yes| INVALIDATE[Invalidate cache]
    INVALIDATE --> RESP[Return success]`,
    },
  ],
};

export const allDiagramSections: DiagramSection[] = [
  syncArchitectureDiagrams,
  supabaseArchitectureDiagrams,
  mcpArchitectureDiagrams,
];
