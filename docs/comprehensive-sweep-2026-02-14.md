# Comprehensive Codebase Improvement Sweep - 2026-02-14

## Scope
- Security vulnerabilities
- Dead code / unused symbols
- Lint errors and warnings
- Accessibility issues

## Findings and Fixes

| Category | File | Finding | Verification Before | Fix Applied | Verification After |
|---|---|---|---|---|---|
| Lint scope | eslint.config.mjs | Generated artifact folders were being linted (`.wrangler`, `dist`, `native build output`) causing noisy failures | `npm run lint` reported generated-file issues | Added `ignores` for generated folders in flat config | `npm run lint` exits 0 |
| Lint | components/oauth-callback-handler.tsx | Callback used before declaration warning (`react-hooks/immutability`) | `npx eslint components/oauth-callback-handler.tsx` warned at `93:15` | Moved `processAuthData` above subscription effect | File lint passes |
| Lint | components/sync/encryption-passphrase-dialog.tsx | Ref-in-cleanup warning (`react-hooks/exhaustive-deps`) | `npx eslint components/sync/encryption-passphrase-dialog.tsx` warned at `53:37` | Captured ref object inside effect for cleanup | File lint passes |
| Lint | components/sync/use-sync-status.ts | Effect setState warning (`react-hooks/set-state-in-effect`) | `npx eslint components/sync/use-sync-status.ts` warned at `94:9` | Replaced stateful auth flag with derived value + transition ref | File lint passes |
| Lint | components/tag-autocomplete-input.tsx | Effect setState warning (`react-hooks/set-state-in-effect`) | `npx eslint components/tag-autocomplete-input.tsx` warned at `65:5` | Removed effect reset; reset in handlers with clamped active index | File lint passes |
| Lint | lib/use-command-palette.ts | Effect setState warning (`react-hooks/set-state-in-effect`) | `npx eslint lib/use-command-palette.ts` warned at `23:7` | Introduced controlled `setOpen` wrapper that resets state on close | File lint passes |
| Security | components/settings/about-section.tsx | `window.open(..., "_blank")` without `noopener/noreferrer` | `rg -n 'window.open\("https://github.com/vscarpenter/gsd-task-manager", "_blank"\)' components/settings/about-section.tsx` matched | Replaced button+`window.open` with safe external anchor | Grep no longer matches |
| Accessibility | components/task-form-subtasks.tsx | Icon-only add button lacked accessible name | `rg` matched unlabeled add button pattern | Added `aria-label="Add subtask"` | Grep pattern no longer matches |
| Accessibility | components/task-form-tags.tsx | Icon-only add button lacked accessible name | `rg` matched unlabeled add button pattern | Added `aria-label="Add tag"` | Grep pattern no longer matches |
| Dead code | components/error-boundary.tsx | Unused `React` import | `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` failed | Removed unused default React import | Strict no-unused check passes |
| Dead code | components/sync/sync-button.tsx | Unused callback parameter `action` | strict no-unused check failed | Renamed to `_action` | Strict no-unused check passes |
| Dead code | lib/sync/engine/coordinator.ts | Unused parameter in auth retry path | strict no-unused check failed | Removed unused parameter from `handleAuthRetry` and updated call site | Strict no-unused check passes |
| Dead code | lib/sync/oauth-handshake/fetcher.ts | Unused parameter `wasSuccessful` | strict no-unused check failed | Removed parameter and updated call sites | Strict no-unused check passes |
| Dead code | lib/sync/sync-coordinator.ts | Unused `syncQueue` property/import | strict no-unused check failed | Removed property and import | Strict no-unused check passes |
| Lint | packages/mcp-server/src/index.ts | Unused `catch` binding | `npx eslint` warning | Changed `catch (error)` to `catch` | File lint passes |
| Lint | packages/mcp-server/src/tools/sync-status.ts | Unused `catch` binding | `npx eslint` warning | Changed `catch (error)` to `catch` | File lint passes |
| Lint | tests/data/analytics/metrics.test.ts | Unused `beforeEach` import and unused mock args | `npx eslint` warnings | Removed import and unused arg names | File lint passes |
| Lint | tests/data/sync/api-client.test.ts | Unused disable directives and explicit-any style issues | `npx eslint` warnings/errors | Replaced `as any` with `as unknown as Mock` and removed stale directives | File lint passes |
| Lint | tests/data/use-error-handler.test.ts | Unused local `firstHandler` | `npx eslint` warning | Removed unused local | File lint passes |
| Lint | tests/data/use-matrix-dialogs.test.ts | Unused `beforeEach` import | `npx eslint` warning | Removed import | File lint passes |

## Integration Results
- `npm run lint`: pass
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: pass
- `npm test`: pass (89/89 test files, 1713 passed)
- `worker npm test`: pass
- `packages/mcp-server npm test`: pass
- `worker npm run typecheck`: pass
- `packages/mcp-server npm run build`: pass

## Build Note
- `bun run build` and direct `next build` invocations can stall in this sandbox due environment/process constraints around build subprocess handling and SWC cache/locking behavior. Build execution was attempted repeatedly during this sweep.
