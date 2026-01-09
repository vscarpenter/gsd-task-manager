# Changelog

All notable changes to GSD Task Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [6.6.2] - 2025-01-09

### Changed

- **Code Modularization**: Split large files for better maintainability
  - Extracted `BUILT_IN_SMART_VIEWS` from `lib/filters.ts` to `lib/smart-views/built-in.ts` (353 → 261 lines)
  - Extracted encryption helpers from `components/sync/encryption-passphrase-dialog.tsx` to `lib/sync/encryption-helpers.ts` (389 → 288 lines)
  - Extracted React.memo comparison functions from `components/task-card.tsx` to `lib/task-card-memo.ts` (334 → 240 lines)

- **Constants Consolidation**: Created `TIME_UNITS` as single source of truth for time constants
  - Unified `MINUTES_PER_HOUR`, `MS_PER_MINUTE`, `MINUTES_PER_DAY` across all modules
  - Added `INITIAL_SYNC_DELAY_MS`, `DEFAULT_HISTORY_LIMIT`, `MAX_COMMAND_PALETTE_RESULTS` named constants

- **Structured Logging**: Migrated `console.*` calls to structured logger
  - Updated `lib/sync/background-sync.ts`, `lib/sync/encryption-helpers.ts`, `lib/sync/queue-optimizer.ts`
  - Uses contextual loggers (SYNC_ENGINE, SYNC_CRYPTO, SYNC_QUEUE) for better debugging

### Performance

- Replaced `JSON.stringify()` with element-wise array comparison in React.memo function
  - Faster comparison for tags, subtasks, and dependencies arrays
  - Avoids serialization overhead on every render

### Fixed

- Removed React-specific `MutableRefObject` type from utility module, replaced with generic `TimeoutRef` interface

### Added

- Test coverage for new utility modules:
  - `tests/data/task-card-memo.test.ts`
  - `tests/data/encryption-helpers.test.ts`
  - `tests/data/smart-views-built-in.test.ts`

## [6.6.1] - 2025-01-08

### Fixed

- Minor bug fixes and stability improvements

## [6.6.0] - 2025-01-07

### Added

- Background sync improvements
- Enhanced notification system

---

For earlier versions, see the [GitHub releases](https://github.com/vscarpenter/gsd-task-manager/releases).
