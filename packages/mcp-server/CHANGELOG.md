# Changelog

All notable changes to the GSD MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.4] - 2025-10-26 🐛

### Fixed
- **CRITICAL**: Added validation of Worker push response rejected array
  - MCP server was not checking if Worker rejected operations
  - Only checked HTTP status (200 OK) and conflicts array
  - Worker can reject operations and still return 200 OK with rejected array
  - Now throws detailed error if any operations are rejected
  - **Impact**: v0.4.0-0.4.3 appeared to succeed but tasks were silently rejected

### Technical Details
- Updated `pushToSync()` to parse full `PushResponse` structure
- Added check for `rejected` array in Worker response
- Throws error with detailed rejection reasons (taskId, reason, details)
- Now properly validates that `accepted` array contains the task IDs
- This will surface the actual rejection reason from Worker

## [0.4.3] - 2025-10-26 🐛

### Fixed
- **CRITICAL**: Added missing checksum calculation for write operations
  - Worker requires SHA-256 checksum of plaintext JSON for create/update operations
  - Added `hash()` method to `CryptoManager` using Web Crypto API
  - Updated all write operations to calculate and include checksum
  - **Impact**: Tasks created without checksum were silently rejected by Worker (appeared successful but not stored)

### Technical Details
- Added `CryptoManager.hash()` method using `webcrypto.subtle.digest('SHA-256')`
- Updated `createTask()` to calculate checksum before push
- Updated `updateTask()` to calculate checksum before push
- Updated `bulkUpdateTasks()` to calculate checksums for all operations
- Checksum is SHA-256 hash of plaintext JSON (before encryption)
- Worker validates checksum on line 125 of `worker/src/handlers/sync.ts`
- Schema says checksum is optional, but Worker code requires it for create/update

## [0.4.2] - 2025-10-26 🐛

### Fixed
- **CRITICAL**: Fixed JWT payload schema mismatch between MCP server and Worker
  - Changed `user_id` → `sub` (JWT standard subject field)
  - Changed `device_id` → `deviceId` (camelCase to match Worker)
  - Added `email` and `jti` fields to match Worker's JWT structure
  - Added `getUserIdFromToken()` helper function
  - **Impact**: JWT parsing was failing with "user_id and device_id are missing" error, preventing all operations

### Technical Details
- Updated `jwtPayloadSchema` in `src/jwt.ts` to match `worker/src/utils/jwt.ts`
- Worker generates JWT with standard `sub` field (RFC 7519), not custom `user_id`
- Worker uses camelCase `deviceId`, not snake_case `device_id`
- MCP server now correctly parses tokens from actual Worker OAuth flow

## [0.4.1] - 2025-10-26 🐛

### Fixed
- **CRITICAL**: Fixed write operations payload structure to match Worker API schema
  - Changed `tasks` array to `operations` array in push requests
  - Changed `vectorClock` to `clientVectorClock` in push payload
  - Added required `type` field to all operations ('create', 'update', 'delete')
  - Changed operation field `id` to `taskId` to match Worker schema
  - Removed `deleted` boolean field in favor of `type: 'delete'`
  - Added per-operation `vectorClock` field (empty object, server-managed)
  - **Impact**: Write operations were 100% non-functional in v0.4.0 due to schema mismatch causing 400 errors from Worker

### Technical Details
- Updated `pushToSync()` function signature to accept `SyncOperation[]` instead of custom task structure
- Added `SyncOperation` interface matching Worker's `syncOperationSchema` (from `worker/src/schemas.ts`)
- Updated all write operation callers:
  - `createTask()` - passes `type: 'create'`
  - `updateTask()` - passes `type: 'update'`
  - `deleteTask()` - passes `type: 'delete'`
  - `bulkUpdateTasks()` - passes appropriate type for each bulk operation
- All operations now conform to Zod schema validation in `pushRequestSchema`

## [0.4.0] - 2025-10-26 🔥

### ⚠️ BREAKING CHANGES
- MCP server is **no longer read-only** - can now create, update, and delete tasks
- Requires `GSD_ENCRYPTION_PASSPHRASE` for all write operations
- Security model updated to support both read and write encryption

### Added
- **Write Operations** - Full task management capabilities
  - `create_task` - Create new tasks with all properties (title, description, quadrant, tags, subtasks, recurrence, dependencies)
  - `update_task` - Update existing tasks (any property, moves between quadrants)
  - `complete_task` - Quick toggle for task completion status
  - `delete_task` - Permanently delete tasks (cannot be undone)
  - `bulk_update_tasks` - Update up to 50 tasks at once with 6 operation types:
    - Complete/uncomplete multiple tasks
    - Move tasks between quadrants
    - Add/remove tags from multiple tasks
    - Set due dates for multiple tasks
    - Batch delete tasks

- **Encryption Module Enhancements** (`crypto.ts`)
  - Added `encrypt()` method for encrypting task data before push
  - Updated `deriveKey()` to support both encrypt and decrypt capabilities
  - Secure random nonce generation for each encryption operation
  - Full AES-256-GCM encryption/decryption round-trip support

- **Write Operations Module** (`write-ops.ts` - NEW)
  - Comprehensive write operation functions with encryption
  - `pushToSync()` helper for encrypted API push to Worker
  - Automatic task ID generation using `crypto.randomUUID()`
  - Quadrant ID derivation from urgent/important flags
  - Subtask ID generation for new tasks
  - Vector clock support for conflict resolution
  - Error handling with user-friendly messages

- **Safety Features**
  - Bulk operation limit: Maximum 50 tasks per operation
  - Input validation for all write operations
  - Clear error messages with actionable guidance
  - Transactional API push (all-or-nothing)
  - Conflict detection with warnings
  - Task existence verification before updates/deletes

### Changed
- Updated package version from `0.3.2` to `0.4.0`
- Updated MCP server version in code
- Enhanced package description to reflect write capabilities
- Security documentation updated to clarify write operations
- Help tool updated to version 0.4.0 with write operation examples
- Tool count increased from 13 to 18 (added 5 write operation tools)

### Improved
- **Developer Experience**
  - Comprehensive TypeScript types for write operations
  - Clear API contracts with Zod-style interfaces
  - Detailed JSDoc comments for all write functions
  - Example usage in README for each operation

- **User Experience**
  - Natural language task creation via Claude
  - Bulk operations save time (update 50 tasks at once)
  - Clear success/error messages with task details
  - Write operations feel native to conversation

- **Security**
  - End-to-end encryption maintained for all writes
  - Zero-knowledge server (Worker cannot decrypt task changes)
  - Local passphrase never sent to server
  - Same PBKDF2 key derivation (600k iterations)

### Technical Details
- **New Files**:
  - `src/write-ops.ts` (447 lines) - Write operation functions with encryption
- **Modified Files**:
  - `src/crypto.ts` - Added encrypt() method, updated deriveKey capabilities
  - `src/index.ts` - Added 5 write tool definitions and handlers
  - `package.json` - Version bump, description update
  - `README.md` - Comprehensive write operation documentation

- **API Integration**:
  - Calls `/api/sync/push` endpoint with encrypted task blobs
  - Handles vector clocks for conflict resolution
  - Supports batch push for bulk operations
  - Proper error handling for network failures

- **Encryption Details**:
  - Uses Node.js Web Crypto API (webcrypto)
  - AES-256-GCM with 128-bit authentication tag
  - 96-bit (12-byte) random nonce per encryption
  - Base64 encoding for ciphertext and nonce
  - PBKDF2 with 600,000 iterations (OWASP 2023)

## [0.3.2] - 2025-10-26

### Added
- **MCP Prompts Support** - 6 pre-configured conversation starters
  - `daily-standup` - Daily task review with overdue items and productivity summary
  - `weekly-review` - Weekly productivity analysis with completion stats and trends
  - `focus-mode` - Get urgent and important tasks (Q1: Do First) to work on now
  - `upcoming-deadlines` - Show all overdue, due today, and due this week tasks
  - `productivity-report` - Comprehensive report with metrics, streaks, and insights
  - `tag-analysis` - Analyze task distribution and completion rates by tags/projects
  - Prompts appear as clickable buttons in Claude Desktop UI
  - Zero learning curve - users discover features as they use them

- **Comprehensive Help Tool** (`get_help`)
  - In-Claude documentation accessible via MCP tool
  - Topic-based filtering (tools, analytics, setup, examples, troubleshooting)
  - Comprehensive tool listing with descriptions
  - Usage examples for common queries
  - Troubleshooting guide with actionable solutions
  - Setup and configuration instructions
  - Version information and resource links

### Improved
- **User Experience**
  - Reduced friction for new users (prompts guide usage)
  - Help accessible without leaving Claude
  - Better feature discoverability
  - Professional prompt formatting with clear instructions

### Changed
- Updated package version from `0.3.1` to `0.3.2`
- Updated MCP server version in code
- Enhanced README with prompts and help tool documentation
- Tool count increased from 12 to 13 (added `get_help`)

## [0.3.0] - 2025-10-26

### Added
- **Interactive Setup Wizard** (`--setup`)
  - Step-by-step guided configuration
  - Automatic API connectivity testing
  - Token validation with device count display
  - Encryption passphrase testing
  - Generated Claude Desktop config output
  - Platform-aware config file paths (macOS/Windows/Linux)

- **Configuration Validator** (`--validate`)
  - Comprehensive diagnostics for environment variables
  - API connectivity checks
  - Authentication validation
  - Encryption verification
  - Device registration status
  - Actionable error messages and recommendations

- **CLI Help System** (`--help`)
  - Detailed usage documentation
  - Example commands
  - Configuration guide
  - Platform-specific instructions

- **Analytics Tools** (6 new MCP tools)
  - `get_productivity_metrics` - Completion counts, streaks, rates, quadrant distribution
  - `get_quadrant_analysis` - Performance metrics across all 4 quadrants
  - `get_tag_analytics` - Tag usage statistics and completion rates
  - `get_upcoming_deadlines` - Tasks grouped by urgency (overdue, today, this week)
  - `get_task_insights` - AI-friendly summary with key metrics
  - `validate_config` - In-MCP configuration diagnostics

- **New Modules**
  - `cli.ts` - Interactive CLI utilities
  - `jwt.ts` - JWT parsing and token utilities
  - `analytics.ts` - Productivity metrics calculation (ported from frontend)

### Fixed
- **Critical Bug**: Hardcoded device ID in `listTasks()` causing multi-device sync issues
  - Now dynamically parses device ID from JWT token
  - Fixes `tools.ts:223` hardcoded value
  - Enables proper multi-device synchronization

### Improved
- **Enhanced Error Messages**
  - Status code-specific error messages (401, 403, 404, 500+)
  - Actionable step-by-step fix instructions
  - Links to setup wizard and validation tool
  - Network error handling with detailed context
  - Encryption-specific error guidance

- **User Experience**
  - First-run experience dramatically improved with setup wizard
  - Self-diagnosis capability with validation tool
  - Platform detection for config paths
  - Clear visual feedback (✓, ⚠, ✗ symbols)
  - Comprehensive help documentation

### Changed
- Updated package version from `0.2.1` to `0.3.0`
- Updated MCP server version from `0.2.0` to `0.3.0`
- Enhanced package description to reflect new features
- README completely rewritten with new CLI modes and tools
- Tool count increased from 6 to 12 total MCP tools

## [0.2.1] - 2025-01-XX

### Fixed
- Minor bug fixes and documentation updates

## [0.2.0] - 2025-01-XX

### Added
- Decrypted task access with encryption passphrase
- `list_tasks` - List all decrypted tasks with filtering
- `get_task` - Get single task by ID
- `search_tasks` - Search across titles, descriptions, tags, subtasks
- Encryption module (`crypto.ts`)
- Support for quadrant, status, and tag filtering

### Security
- End-to-end encryption maintained
- Zero-knowledge architecture (Worker cannot decrypt)
- Opt-in decryption with user passphrase
- Read-only access enforced

## [0.1.0] - 2024-12-XX

### Added
- Initial MCP server implementation
- `get_sync_status` - Sync health monitoring
- `list_devices` - Device management
- `get_task_stats` - Task metadata statistics
- Metadata-only access (no task content decryption)
- JWT authentication with Worker API
- Published to npm as `gsd-mcp-server`

### Documentation
- Initial README with setup instructions
- Installation guide for Claude Desktop
- API endpoint documentation

---

## Legend
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements
- `Improved` - Enhancements to existing features

[0.3.0]: https://github.com/vscarpenter/gsd-taskmanager/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/vscarpenter/gsd-taskmanager/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/vscarpenter/gsd-taskmanager/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vscarpenter/gsd-taskmanager/releases/tag/v0.1.0
