# GSD Task Manager - Worker Architecture

This document provides comprehensive diagrams of the Cloudflare Worker backend, including OAuth/OIDC flows, sync handlers, and API structure.

---

## Overview

The backend is built on **Cloudflare Workers** with:
- **Hono Router** (via itty-router) for API routing
- **D1 (SQLite)** for structured data (users, devices, vector clocks)
- **R2** for encrypted blob storage (task data)
- **KV** for session cache and OAuth state

---

## System Architecture

```mermaid
flowchart TB
    subgraph "Clients"
        PWA[PWA Browser]
        MCP[MCP Server<br/>Claude Desktop]
    end

    subgraph "Edge (Cloudflare)"
        CF[CloudFront/CDN]
        WORKER[Cloudflare Worker<br/>Hono Router]

        subgraph "Storage"
            D1[(D1 SQLite<br/>Users, Devices,<br/>Vector Clocks)]
            R2[(R2 Bucket<br/>Encrypted Task Blobs)]
            KV[(Workers KV<br/>Sessions, OAuth State,<br/>Rate Limits)]
        end

        WORKER --> D1
        WORKER --> R2
        WORKER --> KV
    end

    subgraph "OAuth Providers"
        GOOGLE[Google OIDC]
        APPLE[Apple Sign In]
    end

    PWA -->|HTTPS| CF
    MCP -->|HTTPS| CF
    CF --> WORKER

    WORKER <-->|OAuth| GOOGLE
    WORKER <-->|OAuth| APPLE

    style WORKER fill:#FF9800,color:white
    style D1 fill:#2196F3,color:white
    style R2 fill:#4CAF50,color:white
    style KV fill:#9C27B0,color:white
```

---

## API Route Structure

```mermaid
flowchart TD
    subgraph "Worker Router (worker/src/index.ts)"
        ROOT[/] --> HEALTH[GET /health]

        ROOT --> AUTH[/api/auth/*]
        ROOT --> SYNC[/api/sync/*]
        ROOT --> DEVICES[/api/devices/*]
        ROOT --> STATS[GET /api/stats]

        subgraph "OAuth Routes (No Auth)"
            AUTH --> START[GET /api/auth/oauth/:provider/start]
            AUTH --> CALLBACK[POST/GET /api/auth/oauth/callback]
            AUTH --> RESULT[GET /api/auth/oauth/result]
        end

        subgraph "Auth Routes (JWT Required)"
            AUTH --> SALT_GET[GET /api/auth/encryption-salt]
            AUTH --> SALT_POST[POST /api/auth/encryption-salt]
            AUTH --> LOGOUT[POST /api/auth/logout]
            AUTH --> REFRESH[POST /api/auth/refresh]
        end

        subgraph "Sync Routes (JWT + Rate Limit)"
            SYNC --> PUSH[POST /api/sync/push]
            SYNC --> PULL[POST /api/sync/pull]
            SYNC --> RESOLVE[POST /api/sync/resolve]
            SYNC --> STATUS[GET /api/sync/status]
        end

        subgraph "Device Routes (JWT Required)"
            DEVICES --> LIST_DEV[GET /api/devices]
            DEVICES --> REVOKE[DELETE /api/devices/:id]
        end
    end

    style START fill:#4CAF50,color:white
    style CALLBACK fill:#4CAF50,color:white
    style PUSH fill:#2196F3,color:white
    style PULL fill:#2196F3,color:white
```

---

## Middleware Pipeline

```mermaid
flowchart LR
    REQ([Incoming Request]) --> CORS

    subgraph "Middleware Stack"
        CORS[CORS Handler<br/>Preflight + Headers] --> ROUTE{Route Type}

        ROUTE -->|Public| RATE[Rate Limiter]
        ROUTE -->|Protected| AUTH[Auth Middleware]

        AUTH --> JWT{JWT Valid?}
        JWT -->|No| REJECT[401 Unauthorized]
        JWT -->|Yes| REVOKE{Session Revoked?}

        REVOKE -->|Yes| REJECT
        REVOKE -->|No| RATE

        RATE --> LIMIT{Under Limit?}
        LIMIT -->|No| TOO_MANY[429 Too Many Requests]
        LIMIT -->|Yes| HANDLER[Route Handler]
    end

    HANDLER --> RESP([Response])
    REJECT --> RESP
    TOO_MANY --> RESP

    style AUTH fill:#FF9800,color:white
    style RATE fill:#9C27B0,color:white
```

---

## OAuth/OIDC Complete Flow

### Desktop Browser Flow (Popup)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as GSD App
    participant Popup as OAuth Popup
    participant W as Worker
    participant KV as KV Store
    participant G as Google/Apple
    participant D1 as D1 Database

    U->>App: Click "Sign in with Google"
    App->>W: GET /api/auth/oauth/google/start

    Note over W: Generate state + PKCE
    W->>KV: Store {state, codeVerifier, appOrigin, sessionId}
    W-->>App: {authUrl, state} + Set-Cookie

    App->>Popup: window.open(authUrl)
    Popup->>G: Authorization Request

    U->>G: Consent to permissions
    G->>Popup: Redirect to /api/auth/oauth/callback?code=...&state=...

    Popup->>W: GET /callback?code&state
    W->>KV: Retrieve state data
    W->>KV: Delete used state

    W->>G: Exchange code for tokens (PKCE)
    G-->>W: {access_token, id_token, refresh_token}

    W->>W: Verify id_token signature
    W->>D1: Find or create user
    W->>D1: Create device record
    W->>KV: Store session

    W->>KV: Store OAuth result for polling
    W-->>Popup: Redirect to /oauth-callback.html?state=...

    Popup->>App: postMessage / BroadcastChannel
    App->>W: GET /api/auth/oauth/result?state=...
    W->>KV: Retrieve result
    W-->>App: {token, userId, email, encryptionSalt}

    App->>App: Initialize encryption
    App->>App: Start sync

    Note over App: User authenticated!
```

### PWA Flow (Full Redirect)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant PWA as GSD PWA
    participant W as Worker
    participant KV as KV Store
    participant G as Google/Apple

    U->>PWA: Click "Sign in with Google"
    PWA->>W: GET /api/auth/oauth/google/start

    Note over W: Generate state + PKCE
    W->>KV: Store {state, codeVerifier, appOrigin}
    W-->>PWA: {authUrl, state}

    Note over PWA: Full page navigation
    PWA->>G: Navigate to authUrl

    U->>G: Consent to permissions
    G->>W: Redirect to callback

    Note over W: Process OAuth callback
    W->>KV: Retrieve & validate state
    W->>G: Exchange code for tokens
    W->>W: Create user/device/session
    W->>KV: Store OAuth result

    W-->>PWA: Redirect to app origin with state

    PWA->>W: GET /api/auth/oauth/result?state=...
    W-->>PWA: {token, userId, email}

    Note over PWA: Resume app state
    PWA->>PWA: Initialize encryption & sync
```

---

## OAuth State Machine

```mermaid
stateDiagram-v2
    [*] --> Initiated: User clicks OAuth button

    Initiated --> StateStored: Worker generates state + PKCE
    StateStored --> ProviderAuth: Redirect to provider

    ProviderAuth --> CallbackReceived: Provider redirects back
    ProviderAuth --> Cancelled: User cancels
    ProviderAuth --> ProviderError: Provider error

    Cancelled --> [*]: Return to app
    ProviderError --> ErrorStored: Store error in KV
    ErrorStored --> [*]: Redirect with error

    CallbackReceived --> StateValidated: State matches KV
    CallbackReceived --> StateExpired: State not found (TTL)
    CallbackReceived --> StateMismatch: State invalid

    StateExpired --> ErrorRedirect: Redirect with friendly error
    StateMismatch --> ErrorRedirect
    ErrorRedirect --> [*]

    StateValidated --> TokenExchange: Exchange code for tokens
    TokenExchange --> TokenVerified: Verify ID token
    TokenExchange --> ExchangeError: Exchange failed

    ExchangeError --> ErrorStored

    TokenVerified --> UserResolved: Find/create user
    UserResolved --> SessionCreated: Create device + session
    SessionCreated --> ResultStored: Store result in KV

    ResultStored --> SuccessRedirect: Redirect to app
    SuccessRedirect --> ResultPolled: App polls for result
    ResultPolled --> Complete: App receives credentials
    Complete --> [*]

    note right of StateStored
        KV TTL: 5 minutes
        PKCE: S256 challenge
    end note

    note right of SessionCreated
        JWT: 7-day expiration
        Device: UUID generated
    end note
```

---

## OAuth Handler Modules

```mermaid
flowchart TB
    subgraph "OIDC Handlers (worker/src/handlers/oidc/)"
        INIT[initiate.ts<br/>Generate state + PKCE<br/>Build auth URL]

        CALLBACK[callback.ts<br/>Orchestrate flow]

        subgraph "Callback Helpers"
            PARSE[request-parser.ts<br/>Extract code + state]
            VALIDATE[state-validator.ts<br/>Verify KV state]
            EXCHANGE[token-exchange.ts<br/>Code → tokens]
            VERIFY[id-verification.ts<br/>Verify ID token]
            USER[user-manager.ts<br/>Find/create user]
            SESSION[session-manager.ts<br/>Create device + session]
            RESPONSE[response-builder.ts<br/>Build redirects]
        end

        RESULT[result.ts<br/>Return OAuth result]
        HELPERS[helpers.ts<br/>PKCE + random utils]
    end

    INIT --> CALLBACK
    CALLBACK --> PARSE
    PARSE --> VALIDATE
    VALIDATE --> EXCHANGE
    EXCHANGE --> VERIFY
    VERIFY --> USER
    USER --> SESSION
    SESSION --> RESPONSE

    RESULT --> |Polling| SESSION

    style CALLBACK fill:#FF9800,color:white
    style EXCHANGE fill:#4CAF50,color:white
    style VERIFY fill:#2196F3,color:white
```

---

## Sync Push Handler

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant W as Worker
    participant D1 as D1 Database
    participant R2 as R2 Storage

    Client->>W: POST /api/sync/push<br/>{operations: [...], deviceVC}

    W->>W: Validate JWT + extract userId

    loop For each operation
        W->>D1: Get server vector clock for task

        alt Create operation
            W->>D1: Insert task metadata
            W->>R2: Store encrypted blob
            W->>W: Add to accepted[]
        else Update operation
            W->>W: Compare vector clocks

            alt Client VC dominates
                W->>D1: Update task metadata + VC
                W->>R2: Update encrypted blob
                W->>W: Add to accepted[]
            else Server VC dominates
                W->>W: Add to rejected[]
            else Concurrent
                W->>W: Add to conflicts[]
            end
        else Delete operation
            W->>D1: Mark task deleted
            W->>R2: Delete blob (or mark)
            W->>W: Add to accepted[]
        end
    end

    W->>D1: Update device last_sync_at
    W-->>Client: {accepted, rejected, conflicts, serverVC}
```

---

## Sync Pull Handler

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant W as Worker
    participant D1 as D1 Database
    participant R2 as R2 Storage

    Client->>W: POST /api/sync/pull<br/>{lastSyncAt, deviceId, clientVC}

    W->>W: Validate JWT + extract userId

    W->>D1: Query tasks modified since lastSyncAt<br/>WHERE user_id = ? AND updated_at > ?

    loop For each modified task
        W->>D1: Get task vector clock
        W->>R2: Get encrypted blob
        W->>W: Add to response tasks[]
    end

    W->>D1: Query deleted tasks since lastSyncAt
    W->>W: Add deleted IDs to response

    W->>D1: Get merged server vector clock

    W-->>Client: {tasks: [...], deletedTaskIds, serverVC}
```

---

## Database Schema (D1)

```mermaid
erDiagram
    users ||--o{ devices : "has"
    users ||--o{ tasks : "owns"
    devices ||--o{ sync_logs : "generates"

    users {
        string id PK "UUID"
        string email "Unique"
        string provider "google|apple"
        string provider_user_id "OAuth sub"
        string encryption_salt "Encrypted client salt"
        timestamp created_at
        timestamp updated_at
    }

    devices {
        string id PK "UUID"
        string user_id FK
        string name "Device name"
        string provider "google|apple"
        timestamp created_at
        timestamp last_sync_at
        boolean is_active
    }

    tasks {
        string id PK "UUID"
        string user_id FK
        string encrypted_blob_key "R2 key"
        json vector_clock "{device_id: version}"
        boolean is_deleted
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    sync_logs {
        string id PK "UUID"
        string device_id FK
        string operation "push|pull|resolve"
        integer tasks_affected
        timestamp created_at
    }
```

---

## Rate Limiting Strategy

```mermaid
flowchart TD
    REQ([Request]) --> EXTRACT[Extract client identifier<br/>IP + User-Agent hash]

    EXTRACT --> CHECK[Check KV counter<br/>rate_limit:{identifier}]

    CHECK --> EXISTS{Counter exists?}

    EXISTS -->|No| CREATE[Create counter = 1<br/>TTL = window size]
    EXISTS -->|Yes| INCREMENT[Increment counter]

    CREATE --> PASS[Allow request]
    INCREMENT --> COMPARE{Counter > limit?}

    COMPARE -->|No| PASS
    COMPARE -->|Yes| BLOCK[429 Too Many Requests]

    PASS --> HANDLER[Continue to handler]
    BLOCK --> HEADERS[Set Retry-After header]

    subgraph "Rate Limits"
        direction TB
        OAUTH[OAuth endpoints<br/>10 req/min]
        SYNC_LIMIT[Sync endpoints<br/>60 req/min]
        GENERAL[Other endpoints<br/>100 req/min]
    end

    style BLOCK fill:#F44336,color:white
    style PASS fill:#4CAF50,color:white
```

---

## JWT Token Structure

```mermaid
flowchart LR
    subgraph "JWT Token"
        HEADER[Header<br/>alg: HS256<br/>typ: JWT]
        PAYLOAD[Payload]
        SIGNATURE[Signature<br/>HMAC-SHA256]
    end

    subgraph "Payload Claims"
        SUB[sub: userId]
        EMAIL[email: user@example.com]
        DEV[deviceId: uuid]
        JTI[jti: session-uuid]
        IAT[iat: issued timestamp]
        EXP[exp: expires timestamp<br/>+7 days]
    end

    HEADER --> PAYLOAD
    PAYLOAD --> SUB
    PAYLOAD --> EMAIL
    PAYLOAD --> DEV
    PAYLOAD --> JTI
    PAYLOAD --> IAT
    PAYLOAD --> EXP
    PAYLOAD --> SIGNATURE

    style SIGNATURE fill:#F44336,color:white
```

---

## Session Management

```mermaid
stateDiagram-v2
    [*] --> Created: OAuth success

    Created --> Active: Session stored in KV
    Active --> Valid: JWT validated
    Active --> Expired: Token past exp

    Valid --> Active: Request processed
    Valid --> Refreshed: Token refresh

    Refreshed --> Active: New JWT issued

    Expired --> Refreshed: Valid refresh attempt
    Expired --> Revoked: Refresh failed

    Active --> Revoked: User logout
    Active --> Revoked: Device revoked
    Active --> Revoked: Security event

    Revoked --> [*]: Session ended

    note right of Active
        KV Key: session:{userId}:{jti}
        TTL: 7 days
    end note

    note right of Revoked
        KV Key: revoked:{userId}:{jti}
        TTL: 30 days (audit)
    end note
```

---

## Scheduled Cleanup Job

```mermaid
flowchart TD
    CRON([Cron Trigger<br/>Daily]) --> START[runCleanup]

    START --> EXPIRED_SESSIONS[Delete expired sessions<br/>from KV]

    EXPIRED_SESSIONS --> ORPHAN_DEVICES[Find devices with<br/>no activity > 90 days]

    ORPHAN_DEVICES --> MARK_INACTIVE[Mark devices inactive]

    MARK_INACTIVE --> DELETED_TASKS[Find soft-deleted tasks<br/>older than 30 days]

    DELETED_TASKS --> PURGE_R2[Delete blobs from R2]
    PURGE_R2 --> PURGE_D1[Delete rows from D1]

    PURGE_D1 --> CONFLICT_LOGS[Delete old conflict logs<br/>older than 7 days]

    CONFLICT_LOGS --> DONE([Complete])

    subgraph "Cleanup Metrics"
        M1[deletedTasks: number]
        M2[conflictLogs: number]
        M3[inactiveDevices: number]
        M4[duration: ms]
    end

    DONE --> M1
    DONE --> M2
    DONE --> M3
    DONE --> M4
```

---

## Error Response Format

```mermaid
flowchart TD
    ERROR([Error Occurs]) --> TYPE{Error Type}

    TYPE -->|Validation| E400[400 Bad Request]
    TYPE -->|Auth| E401[401 Unauthorized]
    TYPE -->|Permission| E403[Forbidden]
    TYPE -->|Not Found| E404[Not Found]
    TYPE -->|Rate Limit| E429[Too Many Requests]
    TYPE -->|Server| E500[Internal Server Error]

    E400 --> FORMAT
    E401 --> FORMAT
    E403 --> FORMAT
    E404 --> FORMAT
    E429 --> FORMAT
    E500 --> FORMAT

    FORMAT[JSON Response]

    subgraph "Response Body"
        BODY["{<br/>  error: string,<br/>  message?: string (dev only),<br/>  stack?: string (dev only)<br/>}"]
    end

    FORMAT --> BODY

    subgraph "Headers"
        CORS_H[Access-Control-Allow-Origin]
        RETRY[Retry-After (429 only)]
    end

    FORMAT --> CORS_H
    E429 --> RETRY
```

---

## Environment Configuration

```mermaid
flowchart LR
    subgraph "Secrets (wrangler.toml)"
        JWT_SECRET[JWT_SECRET]
        GOOGLE_ID[GOOGLE_CLIENT_ID]
        GOOGLE_SEC[GOOGLE_CLIENT_SECRET]
        APPLE_ID[APPLE_CLIENT_ID]
        APPLE_SEC[APPLE_CLIENT_SECRET]
    end

    subgraph "Bindings"
        DB[DB: D1 Database]
        STORAGE[STORAGE: R2 Bucket]
        KV_BIND[KV: KV Namespace]
    end

    subgraph "Variables"
        ENV_VAR[ENVIRONMENT: dev|staging|prod]
        CALLBACK[OAUTH_CALLBACK_BASE]
        REDIRECT[OAUTH_REDIRECT_URI]
    end

    JWT_SECRET --> WORKER
    GOOGLE_ID --> WORKER
    GOOGLE_SEC --> WORKER
    APPLE_ID --> WORKER
    APPLE_SEC --> WORKER

    DB --> WORKER
    STORAGE --> WORKER
    KV_BIND --> WORKER

    ENV_VAR --> WORKER
    CALLBACK --> WORKER
    REDIRECT --> WORKER

    WORKER[Cloudflare Worker]

    style WORKER fill:#FF9800,color:white
```

---

## Related Documentation

- **Sync Architecture:** `SYNC_ARCHITECTURE.md`
- **Database Architecture:** `DATABASE_ARCHITECTURE.md`
- **OAuth/OIDC Guide:** `OAUTH_OIDC_GUIDE.md`
- **MCP Server Architecture:** `MCP_ARCHITECTURE.md`

## Code References

- **Worker Entry:** `worker/src/index.ts`
- **OIDC Handlers:** `worker/src/handlers/oidc/`
- **Sync Handlers:** `worker/src/handlers/sync/`
- **Auth Middleware:** `worker/src/middleware/auth.ts`
- **Rate Limiter:** `worker/src/middleware/rate-limit.ts`
- **JWT Utilities:** `worker/src/utils/jwt.ts`
- **Config:** `worker/src/config.ts`
