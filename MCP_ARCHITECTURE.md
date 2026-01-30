# GSD Task Manager - MCP Server Architecture

This document provides comprehensive diagrams of the Model Context Protocol (MCP) server, enabling Claude Desktop to interact with GSD tasks through natural language.

---

## Overview

The MCP server (`packages/mcp-server/`) is a standalone Node.js package that exposes **20 tools** for task management through the MCP protocol. It communicates with the GSD Worker API, handling encryption/decryption locally.

---

## System Architecture

```mermaid
flowchart TB
    subgraph "Claude Desktop"
        CLAUDE[Claude AI]
        MCP_CLIENT[MCP Client]
    end

    subgraph "MCP Server (packages/mcp-server/)"
        TRANSPORT[stdio Transport<br/>JSON-RPC 2.0]
        ROUTER[Tool Router]
        HANDLERS[Tool Handlers]

        subgraph "Core Services"
            API[API Client<br/>Retry Logic]
            CRYPTO[Crypto Manager<br/>AES-256-GCM]
            CACHE[TTL Cache]
        end

        TRANSPORT --> ROUTER
        ROUTER --> HANDLERS
        HANDLERS --> API
        HANDLERS --> CRYPTO
        HANDLERS --> CACHE
    end

    subgraph "GSD Backend"
        WORKER[Cloudflare Worker]
        D1[(D1 Database)]
        R2[(R2 Storage)]
    end

    CLAUDE <-->|Natural Language| MCP_CLIENT
    MCP_CLIENT <-->|JSON-RPC| TRANSPORT

    API <-->|HTTPS + JWT| WORKER
    WORKER --> D1
    WORKER --> R2

    CRYPTO -.->|Encrypt/Decrypt| API

    style CLAUDE fill:#9C27B0,color:white
    style CRYPTO fill:#F44336,color:white
    style WORKER fill:#FF9800,color:white
```

---

## Tool Organization

The MCP server provides 20 tools organized into 4 categories:

```mermaid
flowchart TD
    subgraph "MCP Tools (20 total)"
        subgraph "Read Tools (7)"
            R1[list_tasks<br/>Filter and list tasks]
            R2[get_task<br/>Get single task by ID]
            R3[search_tasks<br/>Full-text search]
            R4[get_sync_status<br/>Sync state info]
            R5[list_devices<br/>Connected devices]
            R6[get_task_stats<br/>Task counts by quadrant]
            R7[get_token_status<br/>JWT expiration info]
        end

        subgraph "Write Tools (5)"
            W1[create_task<br/>Create new task]
            W2[update_task<br/>Modify existing task]
            W3[complete_task<br/>Mark task done]
            W4[delete_task<br/>Remove task]
            W5[bulk_update_tasks<br/>Batch operations]
        end

        subgraph "Analytics Tools (5)"
            A1[get_productivity_metrics<br/>Completion rates, streaks]
            A2[get_quadrant_analysis<br/>Distribution insights]
            A3[get_tag_analytics<br/>Tag usage patterns]
            A4[get_upcoming_deadlines<br/>Due date analysis]
            A5[get_task_insights<br/>AI-powered insights]
        end

        subgraph "System Tools (3)"
            S1[validate_config<br/>Check configuration]
            S2[get_help<br/>Tool documentation]
            S3[get_cache_stats<br/>Cache metrics]
        end
    end

    style R1 fill:#4CAF50,color:white
    style W1 fill:#2196F3,color:white
    style A1 fill:#FF9800,color:white
    style S1 fill:#9C27B0,color:white
```

---

## Request Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant Claude as Claude Desktop
    participant Transport as stdio Transport
    participant Router as Tool Router
    participant Handler as Tool Handler
    participant Cache as TTL Cache
    participant API as API Client
    participant Crypto as CryptoManager
    participant Worker as GSD Worker

    Claude->>Transport: JSON-RPC Request<br/>{method: "tools/call", params: {name, arguments}}

    Transport->>Router: Parse & route

    Router->>Router: Validate tool name
    Router->>Handler: Dispatch to handler

    Handler->>Handler: Validate arguments (Zod)

    alt Read operation with cache
        Handler->>Cache: Check cache key
        Cache-->>Handler: Cache hit? Return cached
    end

    Handler->>API: Build API request

    alt Requires encryption
        Handler->>Crypto: encrypt(taskData)
        Crypto-->>Handler: encryptedBlob
    end

    API->>Worker: HTTPS request + JWT

    alt 401 Unauthorized
        Worker-->>API: 401 response
        API->>API: Token expired, return error
    else Success
        Worker-->>API: Response data
    end

    alt Requires decryption
        API-->>Handler: Encrypted response
        Handler->>Crypto: decrypt(blob)
        Crypto-->>Handler: decryptedData
    end

    Handler->>Cache: Store in cache (if cacheable)

    Handler-->>Router: Tool result
    Router-->>Transport: JSON-RPC Response
    Transport-->>Claude: Display to user
```

---

## Tool Handler Architecture

```mermaid
flowchart TB
    subgraph "Tool Handlers (packages/mcp-server/src/tools/handlers/)"
        INDEX[index.ts<br/>handleToolCall dispatcher]

        READ[read-handlers.ts<br/>list_tasks, get_task,<br/>search_tasks, get_sync_status,<br/>list_devices, get_task_stats,<br/>get_token_status]

        WRITE[write-handlers.ts<br/>create_task, update_task,<br/>complete_task, delete_task,<br/>bulk_update_tasks]

        ANALYTICS[analytics-handlers.ts<br/>get_productivity_metrics,<br/>get_quadrant_analysis,<br/>get_tag_analytics,<br/>get_upcoming_deadlines,<br/>get_task_insights]

        SYSTEM[system-handlers.ts<br/>validate_config,<br/>get_help, get_cache_stats]
    end

    subgraph "Tool Schemas (packages/mcp-server/src/tools/schemas/)"
        READ_SCHEMA[read-schemas.ts]
        WRITE_SCHEMA[write-schemas.ts]
        ANALYTICS_SCHEMA[analytics-schemas.ts]
        SYSTEM_SCHEMA[system-schemas.ts]
    end

    INDEX --> READ
    INDEX --> WRITE
    INDEX --> ANALYTICS
    INDEX --> SYSTEM

    READ -.-> READ_SCHEMA
    WRITE -.-> WRITE_SCHEMA
    ANALYTICS -.-> ANALYTICS_SCHEMA
    SYSTEM -.-> SYSTEM_SCHEMA

    style INDEX fill:#FF9800,color:white
```

---

## Write Operation Flow (with Dry Run)

```mermaid
flowchart TD
    START([Write Tool Called]) --> PARSE[Parse arguments]

    PARSE --> VALIDATE[Validate with Zod schema]
    VALIDATE --> DRY{dryRun mode?}

    DRY -->|Yes| SIMULATE[Simulate operation]
    SIMULATE --> PREVIEW[Generate preview]
    PREVIEW --> RESPONSE_DRY[Return preview result<br/>No actual changes]

    DRY -->|No| DEPS{Has dependencies?}

    DEPS -->|Yes| CHECK_CIRCULAR[Check circular dependencies]
    CHECK_CIRCULAR --> CIRCULAR{Would create cycle?}

    CIRCULAR -->|Yes| ERROR[Return validation error]
    CIRCULAR -->|No| ENCRYPT

    DEPS -->|No| ENCRYPT[Encrypt task data]

    ENCRYPT --> API_CALL[Call Worker API]

    API_CALL --> SUCCESS{Success?}

    SUCCESS -->|No| RETRY{Retryable error?}
    RETRY -->|Yes| BACKOFF[Exponential backoff]
    BACKOFF --> API_CALL
    RETRY -->|No| ERROR

    SUCCESS -->|Yes| INVALIDATE[Invalidate cache]
    INVALIDATE --> RESPONSE[Return success result]

    RESPONSE_DRY --> DONE([Complete])
    RESPONSE --> DONE
    ERROR --> DONE

    style DRY fill:#FF9800,color:white
    style ENCRYPT fill:#F44336,color:white
```

---

## Caching Strategy

```mermaid
flowchart TB
    subgraph "Cache Layer"
        direction TB

        REQ([API Request]) --> KEY[Generate cache key<br/>tool + args hash]

        KEY --> CHECK{Cache hit?}

        CHECK -->|Hit| VALID{TTL valid?}

        VALID -->|Yes| RETURN[Return cached data]
        VALID -->|No| FETCH

        CHECK -->|Miss| FETCH[Fetch from API]

        FETCH --> STORE[Store in cache]
        STORE --> RETURN_NEW[Return fresh data]
    end

    subgraph "TTL Settings"
        T1[list_tasks: 30s]
        T2[get_task: 60s]
        T3[get_sync_status: 10s]
        T4[get_task_stats: 60s]
        T5[analytics: 120s]
    end

    subgraph "Cache Invalidation"
        WRITE_OP[Write operation] --> CLEAR[Clear related keys]
        MANUAL[get_cache_stats clear=true] --> CLEAR_ALL[Clear all]
    end

    style STORE fill:#4CAF50,color:white
```

---

## Retry Logic with Exponential Backoff

```mermaid
stateDiagram-v2
    [*] --> Request: API call initiated

    Request --> Success: 200 OK
    Request --> Retry1: Network/5xx error

    Success --> [*]: Return response

    Retry1 --> Wait1: Attempt 1 failed
    Wait1 --> Request2: Wait 1000ms

    Request2 --> Success
    Request2 --> Retry2: Still failing

    Retry2 --> Wait2: Attempt 2 failed
    Wait2 --> Request3: Wait 2000ms

    Request3 --> Success
    Request3 --> Retry3: Still failing

    Retry3 --> Wait3: Attempt 3 failed
    Wait3 --> Request4: Wait 4000ms

    Request4 --> Success
    Request4 --> Failed: Max retries exceeded

    Failed --> [*]: Return error

    note right of Wait1
        Exponential backoff:
        1s → 2s → 4s
        Max 3 retries
    end note

    note right of Request
        Retryable errors:
        - Network failures
        - 5xx server errors
        - Timeout

        Non-retryable:
        - 4xx client errors
        - Validation errors
    end note
```

---

## Encryption/Decryption Flow

```mermaid
sequenceDiagram
    participant Tool as Tool Handler
    participant CM as CryptoManager
    participant Config as Config
    participant API as API Client

    Note over Tool,API: Initialization (once at startup)
    Tool->>Config: Get GSD_ENCRYPTION_PASSPHRASE
    Tool->>CM: initialize(passphrase, salt)
    CM->>CM: PBKDF2 key derivation<br/>600,000 iterations
    CM-->>Tool: Ready

    Note over Tool,API: Write Operation
    Tool->>Tool: Build task object
    Tool->>CM: encrypt(taskData)
    CM->>CM: Generate random IV
    CM->>CM: AES-256-GCM encrypt
    CM-->>Tool: base64(iv + ciphertext)
    Tool->>API: POST with encrypted blob

    Note over Tool,API: Read Operation
    API-->>Tool: Encrypted blob from server
    Tool->>CM: decrypt(encryptedBlob)
    CM->>CM: Extract IV + ciphertext
    CM->>CM: AES-256-GCM decrypt
    CM-->>Tool: taskData object
```

---

## Configuration Flow

```mermaid
flowchart TD
    subgraph "Configuration Sources"
        ENV[Environment Variables]
        CLAUDE_CONFIG[Claude Desktop Config<br/>~/Library/.../claude_desktop_config.json]
    end

    subgraph "Required Config"
        BASE_URL[GSD_API_BASE_URL<br/>Worker API endpoint]
        TOKEN[GSD_AUTH_TOKEN<br/>JWT from OAuth]
        PASSPHRASE[GSD_ENCRYPTION_PASSPHRASE<br/>User's encryption key]
    end

    subgraph "Optional Config"
        DEBUG[GSD_DEBUG<br/>Enable verbose logging]
        TIMEOUT[GSD_TIMEOUT<br/>API timeout (ms)]
    end

    ENV --> BASE_URL
    ENV --> TOKEN
    ENV --> PASSPHRASE
    ENV --> DEBUG
    ENV --> TIMEOUT

    CLAUDE_CONFIG --> ENV

    subgraph "Validation (validate_config tool)"
        V1[Check URL format]
        V2[Verify token structure]
        V3[Test API connectivity]
        V4[Verify encryption works]
    end

    BASE_URL --> V1
    TOKEN --> V2
    V1 --> V3
    PASSPHRASE --> V4

    V3 --> READY{All valid?}
    V4 --> READY

    READY -->|Yes| SUCCESS[Config valid]
    READY -->|No| ERRORS[Return validation errors]

    style PASSPHRASE fill:#F44336,color:white
    style TOKEN fill:#FF9800,color:white
```

---

## Tool Input/Output Schemas

### list_tasks

```mermaid
flowchart LR
    subgraph "Input"
        I1[quadrant?: string<br/>urgent-important, etc.]
        I2[status?: active|completed|all]
        I3[tags?: string[]]
        I4[limit?: number]
        I5[includeSubtasks?: boolean]
    end

    subgraph "Output"
        O1[tasks: Task[]]
        O2[count: number]
        O3[filters: AppliedFilters]
    end

    I1 --> HANDLER[list_tasks handler]
    I2 --> HANDLER
    I3 --> HANDLER
    I4 --> HANDLER
    I5 --> HANDLER

    HANDLER --> O1
    HANDLER --> O2
    HANDLER --> O3
```

### create_task

```mermaid
flowchart LR
    subgraph "Input"
        I1[title: string (required)]
        I2[description?: string]
        I3[urgent?: boolean]
        I4[important?: boolean]
        I5[dueDate?: ISO string]
        I6[tags?: string[]]
        I7[subtasks?: string[]]
        I8[dependencies?: string[]]
        I9[dryRun?: boolean]
    end

    subgraph "Output (dryRun=false)"
        O1[task: Task]
        O2[message: string]
    end

    subgraph "Output (dryRun=true)"
        O3[preview: Task]
        O4[wouldCreate: true]
        O5[validationPassed: boolean]
    end

    I1 --> HANDLER[create_task handler]
    I2 --> HANDLER
    I3 --> HANDLER
    I4 --> HANDLER
    I5 --> HANDLER
    I6 --> HANDLER
    I7 --> HANDLER
    I8 --> HANDLER
    I9 --> HANDLER

    HANDLER -->|dryRun=false| O1
    HANDLER -->|dryRun=false| O2
    HANDLER -->|dryRun=true| O3
    HANDLER -->|dryRun=true| O4
    HANDLER -->|dryRun=true| O5

    style I9 fill:#FF9800,color:white
```

---

## Error Handling

```mermaid
flowchart TD
    ERROR([Error Occurs]) --> TYPE{Error Type}

    TYPE -->|Validation| VAL[Zod validation error]
    TYPE -->|Network| NET[Network/timeout error]
    TYPE -->|Auth| AUTH[401/403 error]
    TYPE -->|Server| SRV[5xx server error]
    TYPE -->|Crypto| CRY[Decryption failed]
    TYPE -->|Unknown| UNK[Unexpected error]

    VAL --> FORMAT_VAL[Format field errors]
    NET --> RETRY_CHECK{Retries remaining?}

    RETRY_CHECK -->|Yes| RETRY[Retry with backoff]
    RETRY_CHECK -->|No| FORMAT_NET[Format network error]

    AUTH --> FORMAT_AUTH[Token expired message<br/>Suggest re-authentication]

    SRV --> RETRY_CHECK

    CRY --> FORMAT_CRY[Passphrase may be wrong]

    UNK --> FORMAT_UNK[Generic error message]

    FORMAT_VAL --> RESPONSE
    FORMAT_NET --> RESPONSE
    FORMAT_AUTH --> RESPONSE
    FORMAT_CRY --> RESPONSE
    FORMAT_UNK --> RESPONSE

    RESPONSE[JSON-RPC Error Response<br/>{isError: true, content: [...]}]

    style AUTH fill:#FF9800,color:white
    style CRY fill:#F44336,color:white
```

---

## MCP Protocol Messages

```mermaid
sequenceDiagram
    participant Claude as Claude Desktop
    participant MCP as MCP Server

    Note over Claude,MCP: Initialization
    Claude->>MCP: initialize request
    MCP-->>Claude: {protocolVersion, capabilities, serverInfo}

    Note over Claude,MCP: List Available Tools
    Claude->>MCP: tools/list request
    MCP-->>Claude: {tools: [...20 tool definitions]}

    Note over Claude,MCP: Tool Execution
    Claude->>MCP: tools/call {name: "list_tasks", arguments: {...}}
    MCP-->>Claude: {content: [{type: "text", text: "..."}]}

    Note over Claude,MCP: Error Response
    Claude->>MCP: tools/call {name: "unknown_tool"}
    MCP-->>Claude: {content: [...], isError: true}
```

---

## File Structure

```mermaid
flowchart TD
    subgraph "packages/mcp-server/"
        PKG[package.json]
        TSCONFIG[tsconfig.json]

        subgraph "src/"
            INDEX[index.ts<br/>Server entry point]
            TOOLS[tools.ts<br/>Tool definitions]

            subgraph "tools/"
                HANDLERS_DIR[handlers/]
                SCHEMAS_DIR[schemas/]
            end

            subgraph "write-ops/"
                TASK_OPS[task-operations.ts]
                BULK_OPS[bulk-operations.ts]
            end

            subgraph "utils/"
                API_CLIENT[api-client.ts]
                CRYPTO[crypto.ts]
                CACHE[cache.ts]
                RETRY[retry.ts]
            end
        end

        subgraph "dist/"
            COMPILED[Compiled JS]
        end
    end

    PKG --> INDEX
    INDEX --> TOOLS
    TOOLS --> HANDLERS_DIR
    HANDLERS_DIR --> SCHEMAS_DIR

    INDEX --> API_CLIENT
    INDEX --> CRYPTO

    style INDEX fill:#FF9800,color:white
```

---

## Claude Desktop Integration

### Configuration Example

```json
{
  "mcpServers": {
    "gsd-tasks": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "GSD_API_BASE_URL": "https://gsd-worker.example.com",
        "GSD_AUTH_TOKEN": "eyJhbG...",
        "GSD_ENCRYPTION_PASSPHRASE": "your-secret-passphrase"
      }
    }
  }
}
```

### Usage Flow

```mermaid
flowchart TD
    USER([User]) --> CLAUDE[Ask Claude about tasks]

    CLAUDE --> UNDERSTAND[Claude understands intent]

    UNDERSTAND --> TOOL_SELECT{Select appropriate tool}

    TOOL_SELECT -->|"What tasks are due today?"| LIST[list_tasks<br/>dueToday: true]

    TOOL_SELECT -->|"Create a task to..."| CREATE[create_task<br/>title, quadrant, etc.]

    TOOL_SELECT -->|"Mark task X as done"| COMPLETE[complete_task<br/>taskId]

    TOOL_SELECT -->|"How productive was I?"| METRICS[get_productivity_metrics]

    TOOL_SELECT -->|"What are my priorities?"| ANALYSIS[get_quadrant_analysis]

    LIST --> EXECUTE[MCP Server executes]
    CREATE --> EXECUTE
    COMPLETE --> EXECUTE
    METRICS --> EXECUTE
    ANALYSIS --> EXECUTE

    EXECUTE --> RESULT[Return results]
    RESULT --> CLAUDE_RESPONSE[Claude formats response]
    CLAUDE_RESPONSE --> USER

    style CLAUDE fill:#9C27B0,color:white
```

---

## Related Documentation

- **Sync Architecture:** `SYNC_ARCHITECTURE.md`
- **Worker Architecture:** `WORKER_ARCHITECTURE.md`
- **Database Architecture:** `DATABASE_ARCHITECTURE.md`
- **Project README:** `README.md`

## Code References

- **Server Entry:** `packages/mcp-server/src/index.ts`
- **Tool Definitions:** `packages/mcp-server/src/tools.ts`
- **Handlers:** `packages/mcp-server/src/tools/handlers/`
- **Schemas:** `packages/mcp-server/src/tools/schemas/`
- **API Client:** `packages/mcp-server/src/utils/api-client.ts`
- **Crypto Manager:** `packages/mcp-server/src/utils/crypto.ts`
