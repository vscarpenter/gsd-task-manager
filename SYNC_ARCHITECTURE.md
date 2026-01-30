# GSD Task Manager - Sync Architecture

This document provides comprehensive diagrams of the sync engine architecture, including state machines, data flows, and conflict resolution mechanisms.

---

## Overview

The sync system implements a **zero-knowledge architecture** with end-to-end encryption. The server (Cloudflare Worker) stores only encrypted blobs and cannot decrypt task content. Synchronization uses **vector clocks** for distributed conflict detection and resolution.

---

## Sync Engine State Machine

The `SyncEngine` class (`lib/sync/engine/coordinator.ts`) orchestrates sync operations through a 6-phase state machine:

```mermaid
stateDiagram-v2
    [*] --> Idle: Initial State

    Idle --> Validating: sync() called
    Validating --> Backoff: Auto sync + in backoff period
    Validating --> Preparing: Config valid

    Backoff --> Idle: Return error

    Preparing --> Pushing: Prerequisites ready
    Preparing --> AuthError: Token invalid

    AuthError --> Idle: Return error (re-auth required)

    Pushing --> Pulling: Push complete
    Pushing --> Retrying401: Unauthorized (401)

    Retrying401 --> Pushing: Token refreshed
    Retrying401 --> AuthError: Refresh failed

    Pulling --> Resolving: Pull complete
    Pulling --> Retrying401: Unauthorized (401)

    Resolving --> Finalizing: Conflicts resolved
    Resolving --> ManualConflict: Strategy = manual

    ManualConflict --> Idle: Return conflicts

    Finalizing --> Notifying: Metadata updated
    Notifying --> Idle: Return success

    note right of Validating
        Phase 1: Config + backoff check
    end note

    note right of Preparing
        Phase 2: Token, queue, crypto
    end note

    note right of Pushing
        Phase 3: Encrypt & upload
    end note

    note right of Pulling
        Phase 4: Download & decrypt
    end note

    note right of Resolving
        Phase 5: Auto-resolve conflicts
    end note

    note right of Finalizing
        Phase 6: Update metadata
    end note
```

---

## Sync Operation Flow

Detailed sequence diagram showing the complete sync operation:

```mermaid
sequenceDiagram
    autonumber
    participant UI as React UI
    participant SE as SyncEngine
    participant TM as TokenManager
    participant QO as QueueOptimizer
    participant CM as CryptoManager
    participant PH as PushHandler
    participant PLH as PullHandler
    participant CR as ConflictResolver
    participant API as API Client
    participant W as Worker API

    UI->>SE: sync('user')

    Note over SE: Phase 1: Validation
    SE->>SE: Check isRunning flag
    SE->>SE: Load sync config
    SE->>SE: Check backoff status

    Note over SE: Phase 2: Prerequisites
    SE->>TM: ensureValidToken()
    TM-->>SE: Token valid

    SE->>QO: consolidateAll()
    Note right of QO: Merge multiple updates<br/>to same task
    QO-->>SE: Removed N redundant ops

    SE->>CM: isInitialized()
    CM-->>SE: true

    Note over SE: Phase 3: Push
    SE->>PH: pushLocalChanges(config, context)

    loop For each queued operation
        PH->>CM: encrypt(taskData)
        CM-->>PH: encryptedBlob
    end

    PH->>API: POST /api/sync/push
    API->>W: Push encrypted blobs
    W-->>API: {accepted, rejected, conflicts, serverVC}
    API-->>PH: Response
    PH-->>SE: PushResult

    Note over SE: Phase 4: Pull
    SE->>PLH: pullRemoteChanges(config, context)
    PLH->>API: POST /api/sync/pull
    API->>W: Request changes since lastSync
    W-->>API: {tasks, deletedIds, serverVC}
    API-->>PLH: Encrypted tasks

    loop For each remote task
        PLH->>CM: decrypt(encryptedBlob)
        CM-->>PLH: taskData
        PLH->>PLH: Merge with local (vector clock)
    end

    PLH-->>SE: PullResult

    Note over SE: Phase 5: Conflict Resolution
    alt Conflicts exist & strategy = last_write_wins
        SE->>CR: autoResolveConflicts(conflicts)
        CR-->>SE: conflictsResolved count
    else strategy = manual
        SE-->>UI: Return conflicts for UI
    end

    Note over SE: Phase 6: Finalize
    SE->>SE: updateSyncMetadata()
    SE->>SE: recordSuccess() (retry manager)
    SE->>SE: recordSyncHistory()
    SE-->>UI: SyncResult
```

---

## Push Handler Flow

The push handler encrypts and uploads local changes:

```mermaid
flowchart TD
    subgraph "Push Handler (lib/sync/engine/push-handler.ts)"
        START([Start Push]) --> LOAD[Load sync queue]
        LOAD --> CHECK{Queue empty?}

        CHECK -->|Yes| EMPTY[Return empty result]
        CHECK -->|No| GROUP[Group by task ID]

        GROUP --> LOOP[For each task operation]

        LOOP --> ENCRYPT[Encrypt task data<br/>AES-256-GCM]
        ENCRYPT --> BUILD[Build push payload]
        BUILD --> NEXT{More tasks?}

        NEXT -->|Yes| LOOP
        NEXT -->|No| SEND[POST /api/sync/push]

        SEND --> RESPONSE{Response status}

        RESPONSE -->|200 OK| PROCESS[Process results]
        RESPONSE -->|401| AUTH_ERR[Throw auth error]
        RESPONSE -->|Other| ERR[Throw sync error]

        PROCESS --> ACCEPTED[Clear accepted from queue]
        ACCEPTED --> REJECTED{Rejected ops?}

        REJECTED -->|Yes| LOG_REJ[Log rejections]
        REJECTED -->|No| CONFLICTS{Conflicts?}

        LOG_REJ --> CONFLICTS

        CONFLICTS -->|Yes| LOG_CONF[Mark for resolution]
        CONFLICTS -->|No| DONE

        LOG_CONF --> DONE([Return PushResult])
        EMPTY --> DONE
    end

    style ENCRYPT fill:#F44336,color:white
    style SEND fill:#2196F3,color:white
```

---

## Pull Handler Flow

The pull handler downloads and decrypts remote changes:

```mermaid
flowchart TD
    subgraph "Pull Handler (lib/sync/engine/pull-handler.ts)"
        START([Start Pull]) --> REQ[POST /api/sync/pull<br/>with lastSyncAt, deviceId, vectorClock]

        REQ --> RESP{Response OK?}
        RESP -->|No| ERR[Throw error]
        RESP -->|Yes| PARSE[Parse response]

        PARSE --> TASKS[Extract encrypted tasks]
        TASKS --> DELETED[Extract deleted IDs]

        DELETED --> DEL_LOOP{Deleted tasks?}
        DEL_LOOP -->|Yes| DEL_LOCAL[Delete from local DB]
        DEL_LOOP -->|No| TASK_LOOP
        DEL_LOCAL --> TASK_LOOP

        TASK_LOOP[For each remote task] --> DECRYPT[Decrypt task data<br/>AES-256-GCM]

        DECRYPT --> LOCAL{Local version exists?}

        LOCAL -->|No| INSERT[Insert new task]
        LOCAL -->|Yes| COMPARE[Compare vector clocks]

        INSERT --> NEXT{More tasks?}

        COMPARE --> VC_RESULT{Clock comparison}

        VC_RESULT -->|Remote newer| UPDATE[Update local task]
        VC_RESULT -->|Local newer| SKIP[Keep local version]
        VC_RESULT -->|Concurrent| CONFLICT[Add to conflicts]

        UPDATE --> NEXT
        SKIP --> NEXT
        CONFLICT --> NEXT

        NEXT -->|Yes| TASK_LOOP
        NEXT -->|No| DONE([Return PullResult])
    end

    style DECRYPT fill:#F44336,color:white
    style REQ fill:#2196F3,color:white
    style CONFLICT fill:#FF9800,color:white
```

---

## Vector Clock Comparison

Vector clocks enable distributed conflict detection without central coordination:

```mermaid
flowchart TD
    subgraph "Vector Clock Comparison Algorithm"
        START([Compare VC_A vs VC_B]) --> INIT[Initialize counters<br/>aGreater = 0, bGreater = 0]

        INIT --> UNION[Get all device IDs from both clocks]

        UNION --> LOOP[For each device ID]

        LOOP --> GET[Get version from A and B<br/>default to 0 if missing]

        GET --> CMP{Compare versions}

        CMP -->|A > B| INC_A[aGreater++]
        CMP -->|B > A| INC_B[bGreater++]
        CMP -->|A == B| EQUAL[Continue]

        INC_A --> NEXT{More devices?}
        INC_B --> NEXT
        EQUAL --> NEXT

        NEXT -->|Yes| LOOP
        NEXT -->|No| EVALUATE

        EVALUATE{Evaluate result}

        EVALUATE -->|aGreater > 0<br/>bGreater == 0| A_WINS[A is strictly newer]
        EVALUATE -->|bGreater > 0<br/>aGreater == 0| B_WINS[B is strictly newer]
        EVALUATE -->|both > 0| CONCURRENT[Concurrent modifications<br/>CONFLICT]
        EVALUATE -->|both == 0| IDENTICAL[Identical versions]

        A_WINS --> DONE([Return comparison result])
        B_WINS --> DONE
        CONCURRENT --> DONE
        IDENTICAL --> DONE
    end

    style CONCURRENT fill:#FF9800,color:white
```

---

## Conflict Resolution Strategies

```mermaid
flowchart TD
    subgraph "Conflict Resolution (lib/sync/engine/conflict-resolver.ts)"
        CONFLICT([Conflict Detected]) --> STRATEGY{Resolution Strategy}

        STRATEGY -->|last_write_wins| AUTO[Auto-resolve]
        STRATEGY -->|manual| MANUAL[Return to UI]

        AUTO --> COMPARE[Compare updatedAt timestamps]

        COMPARE --> NEWER{Which is newer?}

        NEWER -->|Local| KEEP_LOCAL[Keep local version]
        NEWER -->|Remote| ACCEPT_REMOTE[Accept remote version]
        NEWER -->|Same timestamp| USE_DEVICE[Use device ID as tiebreaker]

        KEEP_LOCAL --> MERGE_VC[Merge vector clocks]
        ACCEPT_REMOTE --> MERGE_VC
        USE_DEVICE --> MERGE_VC

        MERGE_VC --> INCREMENT[Increment local device counter]
        INCREMENT --> SAVE[Save resolved task]
        SAVE --> QUEUE[Queue for sync<br/>to propagate resolution]

        QUEUE --> DONE([Resolution Complete])

        MANUAL --> UI[Display conflict UI]
        UI --> USER_CHOICE{User selects version}

        USER_CHOICE -->|Keep local| KEEP_LOCAL
        USER_CHOICE -->|Accept remote| ACCEPT_REMOTE
        USER_CHOICE -->|Merge fields| CUSTOM[Custom merge]

        CUSTOM --> MERGE_VC
    end

    style CONFLICT fill:#FF9800,color:white
    style AUTO fill:#4CAF50,color:white
    style MANUAL fill:#2196F3,color:white
```

---

## Queue Optimization

The queue optimizer consolidates redundant operations before sync:

```mermaid
flowchart LR
    subgraph "Before Optimization"
        Q1[Create Task A]
        Q2[Update Task A]
        Q3[Update Task A]
        Q4[Update Task B]
        Q5[Delete Task A]
        Q6[Update Task B]
    end

    subgraph "Queue Optimizer"
        direction TB
        ANALYZE[Group by task ID] --> CONSOLIDATE

        CONSOLIDATE[Apply rules:<br/>1. Create + Updates = Create<br/>2. Updates merged to latest<br/>3. Any + Delete = Delete<br/>4. Delete removes prior ops]
    end

    subgraph "After Optimization"
        R1[Delete Task A]
        R2[Update Task B]
    end

    Q1 --> ANALYZE
    Q2 --> ANALYZE
    Q3 --> ANALYZE
    Q4 --> ANALYZE
    Q5 --> ANALYZE
    Q6 --> ANALYZE

    CONSOLIDATE --> R1
    CONSOLIDATE --> R2

    style CONSOLIDATE fill:#4CAF50,color:white
```

---

## Retry and Backoff Logic

```mermaid
stateDiagram-v2
    [*] --> Ready: Sync enabled

    Ready --> Syncing: Trigger sync

    Syncing --> Success: Sync completes
    Syncing --> Failure: Error occurs

    Success --> Ready: Reset failure count

    Failure --> Backoff1: 1st failure (wait 30s)
    Backoff1 --> Ready: Backoff complete
    Backoff1 --> Syncing: Manual sync (bypasses)

    Ready --> Syncing: Auto or manual trigger

    Syncing --> Backoff2: 2nd failure (wait 1m)
    Backoff2 --> Ready: Backoff complete

    Syncing --> Backoff3: 3rd failure (wait 2m)
    Backoff3 --> Ready: Backoff complete

    Syncing --> Backoff4: 4th failure (wait 5m)
    Backoff4 --> Ready: Backoff complete

    Syncing --> BackoffMax: 5+ failures (wait 15m)
    BackoffMax --> Ready: Backoff complete

    note right of Failure
        Exponential backoff:
        30s → 1m → 2m → 5m → 15m (max)
    end note

    note right of Backoff1
        User-triggered sync
        always bypasses backoff
    end note
```

---

## Encryption Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant CM as CryptoManager
    participant PBKDF2 as PBKDF2
    participant AES as AES-256-GCM

    Note over App,AES: Initialization (once per session)
    App->>CM: initialize(passphrase, salt)
    CM->>PBKDF2: deriveKey(passphrase, salt, 600000 iterations)
    PBKDF2-->>CM: 256-bit key
    CM->>CM: Store key in memory
    CM-->>App: Ready

    Note over App,AES: Encryption (per task)
    App->>CM: encrypt(taskData)
    CM->>CM: Generate random 12-byte IV
    CM->>CM: Serialize taskData to JSON
    CM->>AES: encrypt(json, key, iv)
    AES-->>CM: ciphertext
    CM->>CM: Concatenate: iv + ciphertext
    CM-->>App: base64(iv + ciphertext)

    Note over App,AES: Decryption (per task)
    App->>CM: decrypt(encryptedBlob)
    CM->>CM: base64 decode
    CM->>CM: Extract IV (first 12 bytes)
    CM->>CM: Extract ciphertext (remaining)
    CM->>AES: decrypt(ciphertext, key, iv)
    AES-->>CM: JSON string
    CM->>CM: Parse JSON to taskData
    CM-->>App: taskData
```

---

## Complete Sync Data Flow

End-to-end view of sync across devices:

```mermaid
flowchart TB
    subgraph "Device A (Browser)"
        UA[User Action] --> TA[Task Modified]
        TA --> QA[Add to Sync Queue]
        QA --> EA[Encrypt with AES-256-GCM]
        EA --> PA[Push to Worker]

        PLA[Pull from Worker] --> DA[Decrypt]
        DA --> MA[Merge with local]
        MA --> VA[Update view]
    end

    subgraph "Cloudflare Worker"
        direction TB
        PA --> AUTH[Auth Middleware<br/>JWT Validation]
        AUTH --> RATE[Rate Limiter]
        RATE --> PUSH[Push Handler]

        PUSH --> D1[(D1 SQLite<br/>Vector Clocks<br/>Task Metadata)]
        PUSH --> R2[(R2 Storage<br/>Encrypted Blobs)]

        PULL[Pull Handler] --> D1
        PULL --> R2
        PULL --> PLA
        PULL --> PLB
    end

    subgraph "Device B (Browser)"
        PB[Push to Worker] --> AUTH

        PLB[Pull from Worker] --> DB[Decrypt]
        DB --> MB[Merge with local]
        MB --> VB[Update view]

        UB[User Action] --> TB[Task Modified]
        TB --> QB[Add to Sync Queue]
        QB --> EB[Encrypt]
        EB --> PB
    end

    style EA fill:#F44336,color:white
    style DA fill:#F44336,color:white
    style EB fill:#F44336,color:white
    style DB fill:#F44336,color:white
    style D1 fill:#2196F3,color:white
    style R2 fill:#FF9800,color:white
```

---

## Token Lifecycle

```mermaid
stateDiagram-v2
    [*] --> NoToken: App starts

    NoToken --> Authenticating: User initiates OAuth
    Authenticating --> HasToken: OAuth success
    Authenticating --> NoToken: OAuth failed/cancelled

    HasToken --> ValidToken: Token valid (< 7 days)
    HasToken --> ExpiringSoon: Token expires in < 24h
    HasToken --> Expired: Token expired

    ValidToken --> Syncing: Sync triggered
    Syncing --> ValidToken: Sync success
    Syncing --> Refreshing: 401 Unauthorized

    ExpiringSoon --> Refreshing: Auto-refresh
    Refreshing --> ValidToken: Refresh success
    Refreshing --> NoToken: Refresh failed

    Expired --> Refreshing: Attempt refresh

    ValidToken --> LoggedOut: User logout
    LoggedOut --> NoToken: Clear credentials

    note right of HasToken
        JWT stored in IndexedDB
        7-day expiration
    end note

    note right of Refreshing
        POST /api/auth/refresh
        Issues new JWT
    end note
```

---

## Error Handling Hierarchy

```mermaid
flowchart TD
    subgraph "Error Handler (lib/sync/engine/error-handler.ts)"
        ERROR([Sync Error]) --> CLASSIFY{Error Type}

        CLASSIFY -->|Network Error| NETWORK[Transient failure]
        CLASSIFY -->|401 Unauthorized| AUTH[Authentication error]
        CLASSIFY -->|400 Bad Request| CLIENT[Client error]
        CLASSIFY -->|500 Server Error| SERVER[Server error]
        CLASSIFY -->|Encryption Error| CRYPTO[Crypto error]
        CLASSIFY -->|Unknown| UNKNOWN[Unknown error]

        NETWORK --> RETRY[Increment retry count]
        SERVER --> RETRY

        RETRY --> BACKOFF[Calculate backoff delay]
        BACKOFF --> SCHEDULE[Schedule next retry]
        SCHEDULE --> RESULT_ERR

        AUTH --> REFRESH[Attempt token refresh]
        REFRESH --> REFRESH_OK{Refresh success?}
        REFRESH_OK -->|Yes| RETRY_SYNC[Retry sync operation]
        REFRESH_OK -->|No| REQUIRE_AUTH[Require re-authentication]

        RETRY_SYNC --> RESULT_SUCCESS([Return success])
        REQUIRE_AUTH --> RESULT_ERR

        CLIENT --> LOG_CLIENT[Log error details]
        LOG_CLIENT --> RESULT_ERR

        CRYPTO --> LOG_CRYPTO[Log crypto failure]
        LOG_CRYPTO --> REQUIRE_PASS[May need passphrase re-entry]
        REQUIRE_PASS --> RESULT_ERR

        UNKNOWN --> LOG_UNKNOWN[Log full error]
        LOG_UNKNOWN --> RESULT_ERR([Return error result])
    end

    style AUTH fill:#FF9800,color:white
    style NETWORK fill:#2196F3,color:white
    style CRYPTO fill:#F44336,color:white
```

---

## Related Documentation

- **Database Architecture:** `DATABASE_ARCHITECTURE.md`
- **OAuth/OIDC Guide:** `OAUTH_OIDC_GUIDE.md`
- **Worker Architecture:** `WORKER_ARCHITECTURE.md`
- **MCP Server Architecture:** `MCP_ARCHITECTURE.md`

## Code References

- **Sync Engine:** `lib/sync/engine/coordinator.ts`
- **Push Handler:** `lib/sync/engine/push-handler.ts`
- **Pull Handler:** `lib/sync/engine/pull-handler.ts`
- **Conflict Resolver:** `lib/sync/engine/conflict-resolver.ts`
- **Crypto Manager:** `lib/sync/crypto.ts`
- **Queue Optimizer:** `lib/sync/queue-optimizer.ts`
- **Retry Manager:** `lib/sync/retry-manager.ts`
