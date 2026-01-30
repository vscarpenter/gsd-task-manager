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
  description: "End-to-end encrypted sync with vector clock-based conflict resolution",
  diagrams: [
    {
      id: "sync-state-machine",
      title: "Sync Engine State Machine",
      description: "6-phase state flow from idle through push/pull to completion",
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

    Resolving --> Finalizing: Conflicts resolved
    Resolving --> Manual: Strategy = manual

    Manual --> Idle: Return conflicts

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
        EA --> PA[Push to Worker]
    end

    subgraph Worker[Cloudflare Worker]
        PA --> AUTH[Auth Middleware]
        AUTH --> PUSH[Push Handler]
        PUSH --> D1[(D1 SQLite)]
        PUSH --> R2[(R2 Storage)]
        PULL[Pull Handler] --> D1
        PULL --> R2
    end

    subgraph DeviceB[Device B]
        PLB[Pull] --> DB[Decrypt]
        DB --> MB[Merge Local]
        MB --> VB[Update View]
    end

    PULL --> PLB`,
    },
    {
      id: "vector-clock",
      title: "Vector Clock Comparison",
      description: "Distributed conflict detection algorithm",
      code: `flowchart TD
    START([Compare VC_A vs VC_B]) --> INIT[Initialize counters]
    INIT --> UNION[Get all device IDs]
    UNION --> LOOP[For each device ID]
    LOOP --> GET[Get versions from A and B]
    GET --> CMP{Compare}

    CMP -->|A > B| INC_A[aGreater++]
    CMP -->|B > A| INC_B[bGreater++]
    CMP -->|Equal| NEXT

    INC_A --> NEXT{More devices?}
    INC_B --> NEXT

    NEXT -->|Yes| LOOP
    NEXT -->|No| EVAL{Evaluate}

    EVAL -->|aGreater only| A_WINS[A is newer]
    EVAL -->|bGreater only| B_WINS[B is newer]
    EVAL -->|Both > 0| CONFLICT[CONFLICT]
    EVAL -->|Both = 0| SAME[Identical]`,
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

export const workerArchitectureDiagrams: DiagramSection = {
  id: "worker",
  title: "Worker Backend Architecture",
  description: "Cloudflare Workers with D1, R2, and KV storage",
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

    subgraph Edge[Cloudflare Edge]
        WORKER[Worker - Hono Router]

        subgraph Storage
            D1[(D1 SQLite)]
            R2[(R2 Bucket)]
            KV[(Workers KV)]
        end

        WORKER --> D1
        WORKER --> R2
        WORKER --> KV
    end

    subgraph OAuth[OAuth Providers]
        GOOGLE[Google OIDC]
        APPLE[Apple Sign In]
    end

    PWA --> WORKER
    MCP --> WORKER
    WORKER <--> GOOGLE
    WORKER <--> APPLE`,
    },
    {
      id: "api-routes",
      title: "API Route Structure",
      description: "All API endpoints organized by category",
      code: `flowchart TD
    ROOT[/] --> HEALTH[GET /health]
    ROOT --> AUTH[/api/auth/*]
    ROOT --> SYNC[/api/sync/*]
    ROOT --> DEVICES[/api/devices/*]

    subgraph OAuth[OAuth - No Auth]
        AUTH --> START[GET /oauth/:provider/start]
        AUTH --> CALLBACK[POST /oauth/callback]
        AUTH --> RESULT[GET /oauth/result]
    end

    subgraph Protected[Auth Required]
        AUTH --> SALT[GET/POST /encryption-salt]
        AUTH --> LOGOUT[POST /logout]
        AUTH --> REFRESH[POST /refresh]
    end

    subgraph SyncRoutes[Sync - JWT + Rate Limit]
        SYNC --> PUSH[POST /push]
        SYNC --> PULL[POST /pull]
        SYNC --> STATUS[GET /status]
    end

    subgraph DeviceRoutes[Devices]
        DEVICES --> LIST[GET /]
        DEVICES --> REVOKE[DELETE /:id]
    end`,
    },
    {
      id: "oauth-flow",
      title: "OAuth Desktop Flow",
      description: "Popup-based authentication sequence",
      code: `sequenceDiagram
    participant User
    participant App
    participant Popup
    participant Worker
    participant KV
    participant Google

    User->>App: Click Sign in
    App->>Worker: GET /oauth/google/start
    Worker->>KV: Store state + PKCE
    Worker-->>App: authUrl + state

    App->>Popup: window.open(authUrl)
    Popup->>Google: Authorization Request
    User->>Google: Consent
    Google->>Popup: Redirect with code

    Popup->>Worker: GET /callback?code&state
    Worker->>KV: Validate state
    Worker->>Google: Exchange code for tokens
    Google-->>Worker: tokens
    Worker->>KV: Store result
    Worker-->>Popup: Redirect to callback.html

    Popup->>App: postMessage
    App->>Worker: GET /oauth/result
    Worker-->>App: token + userId`,
    },
    {
      id: "middleware-pipeline",
      title: "Middleware Pipeline",
      description: "Request processing through CORS, Auth, and Rate Limiting",
      code: `flowchart LR
    REQ([Request]) --> CORS[CORS Handler]

    CORS --> ROUTE{Route Type}
    ROUTE -->|Public| RATE[Rate Limiter]
    ROUTE -->|Protected| AUTH[Auth Middleware]

    AUTH --> JWT{JWT Valid?}
    JWT -->|No| REJECT[401]
    JWT -->|Yes| REVOKE{Revoked?}

    REVOKE -->|Yes| REJECT
    REVOKE -->|No| RATE

    RATE --> LIMIT{Under Limit?}
    LIMIT -->|No| TOO_MANY[429]
    LIMIT -->|Yes| HANDLER[Route Handler]

    HANDLER --> RESP([Response])`,
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
      description: "Claude Desktop to GSD Worker data flow",
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
            API[API Client]
            CRYPTO[CryptoManager]
            CACHE[TTL Cache]
        end

        TRANSPORT --> ROUTER
        ROUTER --> HANDLERS
        HANDLERS --> API
        HANDLERS --> CRYPTO
        HANDLERS --> CACHE
    end

    subgraph Backend[GSD Backend]
        WORKER[Cloudflare Worker]
    end

    AI <--> CLIENT
    CLIENT <--> TRANSPORT
    API <--> WORKER`,
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
      description: "Tool call processing from Claude to API response",
      code: `sequenceDiagram
    participant Claude
    participant Transport as stdio
    participant Router
    participant Handler
    participant Cache
    participant API
    participant Crypto
    participant Worker

    Claude->>Transport: JSON-RPC Request
    Transport->>Router: Parse & route
    Router->>Handler: Dispatch

    Handler->>Handler: Validate args (Zod)

    alt Cache hit
        Handler->>Cache: Check cache
        Cache-->>Handler: Return cached
    end

    Handler->>Crypto: encrypt(data)
    Crypto-->>Handler: encrypted
    Handler->>API: HTTPS + JWT
    API->>Worker: Request
    Worker-->>API: Response
    API-->>Handler: Encrypted response
    Handler->>Crypto: decrypt(blob)
    Crypto-->>Handler: decrypted
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
    ENCRYPT --> API_CALL[Call Worker API]

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
  workerArchitectureDiagrams,
  mcpArchitectureDiagrams,
];
