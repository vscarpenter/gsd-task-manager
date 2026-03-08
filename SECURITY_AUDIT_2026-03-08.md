# Security Audit & Coding Standards Compliance Report

**Date:** 2026-03-08
**Scope:** Full codebase security review, dependency audit, and coding-standards.md compliance check
**Branch:** `claude/security-audit-dependencies-JWWaS`

---

## Executive Summary

The GSD Task Manager codebase is in **good overall security posture**. No critical vulnerabilities were found in the application code. One HIGH-severity transitive dependency vulnerability exists and is straightforward to patch. The main areas for improvement are coding standards compliance (console.log usage, function length, nesting depth) and a few medium-severity security hardening opportunities.

---

## 1. Dependency Security Audit

### 1.1 Vulnerability Found (1 HIGH)

| Package | Installed | Fixed In | Severity | Advisory |
|---|---|---|---|---|
| `express-rate-limit` | 8.2.1 | >=8.2.2 | **HIGH** | [GHSA-46wh-pxpv-q5gq](https://github.com/advisories/GHSA-46wh-pxpv-q5gq) |

**Details:** IPv4-mapped IPv6 addresses bypass per-client rate limiting on dual-stack servers. This is a transitive dependency from `@modelcontextprotocol/sdk`. The MCP server uses stdio transport (not HTTP), so the practical risk is low, but it should still be patched.

**Fix:** Add `"express-rate-limit": ">=8.2.2"` to the `overrides` section in `package.json`, then run `bun install`.

### 1.2 Critical Package Versions (All Current)

| Package | Resolved Version | Status |
|---|---|---|
| `next` | 16.1.6 | Current |
| `react` / `react-dom` | 19.2.4 | Current |
| `dexie` | 4.3.0 | Current |
| `zod` | 4.3.6 | Current |
| `pocketbase` | 0.26.8 | Current |
| `tailwindcss` | 4.2.1 | Current |
| `typescript` | 5.9.3 | Current |
| `vite` | 7.3.1 | Current |
| `vitest` | 4.0.18 | Current |
| `eslint` | 10.0.2 | Current |

### 1.3 Available Minor/Patch Updates (Non-Security)

| Package | Current | Latest | Type |
|---|---|---|---|
| `lucide-react` | ^0.575.0 | ^0.577.0 | Minor |
| `recharts` | ^3.7.0 | ^3.8.0 | Minor |
| `postcss` | ^8.5.6 | ^8.5.8 | Patch |
| `eslint` | ^10.0.2 | ^10.0.3 | Patch |
| `@types/node` | ^25.3.3 | ^25.3.5 | Patch |

### 1.4 Existing Overrides (Good Practice)

The project already has proactive security overrides for 10 transitive dependencies in `package.json` (lines 80-92), including `@hono/node-server`, `js-yaml`, `vite`, `esbuild`, `qs`, `minimatch`, `rollup`, and `ajv`. This demonstrates good security hygiene.

### 1.5 Deprecated Packages

None detected.

### 1.6 Observations

- `@modelcontextprotocol/sdk` brings a large transitive tree (Express 5, Hono, ajv, cors, jose, eventsource). Monitor closely as the SDK matures.
- `lucide-react` uses 0.x versioning (any release can break). Security risk is minimal (icon library).
- `beautiful-mermaid` is a less commonly used package — verify it remains maintained periodically.

---

## 2. Source Code Security Review

### Priority: HIGH

**H1. CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts**
- **Location:** `SECURITY_HEADERS.md` (lines 23, 77, 124, 145)
- **Risk:** If any XSS vector exists, `unsafe-eval` makes exploitation trivial
- **Recommendation:** Investigate nonce-based CSP for Next.js static exports. Remove `unsafe-eval` if feasible; at minimum document why it is required with a tracking issue

### Priority: MEDIUM

**M1. Custom SVG sanitizer instead of battle-tested library**
- **Location:** `components/docs/mermaid-diagram.tsx` (lines 52-92, rendered at line 182)
- **Risk:** Custom sanitizers may miss edge cases (SVG `<use>` with external refs, `<set>` animations, namespace tricks)
- **Recommendation:** Replace custom `sanitizeSvg()` with DOMPurify for SVG sanitization

**M2. Service worker push handler lacks payload validation**
- **Location:** `public/sw.js` (lines 165-181)
- **Risk:** `event.data.json()` output used directly without schema validation
- **Recommendation:** Add basic shape validation for push notification payloads

**M3. CloudFront Distribution ID hardcoded in tracked files**
- **Location:** `package.json` (line 17), `scripts/deploy-cloudfront-function.sh` (line 14)
- **Risk:** Reconnaissance information for targeted CDN attacks
- **Recommendation:** Source from environment variable `CLOUDFRONT_DISTRIBUTION_ID`

**M4. Remote sync data trusted without runtime validation**
- **Location:** `lib/sync/task-mapper.ts` (lines 76-100)
- **Risk:** `pocketBaseToTaskRecord()` uses TypeScript `as` assertions without Zod validation on PocketBase responses
- **Recommendation:** Add Zod validation at the sync boundary for data coming from PocketBase

### Priority: LOW

**L1. MCP test utility partially reveals auth tokens**
- **Location:** `packages/mcp-server/test-env-vars.js` (line 19)
- **Risk:** Logs first 20 characters of `GSD_AUTH_TOKEN`
- **Recommendation:** Remove partial token logging or mask entirely

**L2. Email logged during OAuth with fragile sanitization**
- **Location:** `lib/sync/pb-auth.ts` (lines 37-39)
- **Risk:** Logger sanitization only matches exact key names; variant keys would leak PII
- **Recommendation:** Expand sanitization patterns or avoid passing email to log metadata

### No Issues Found

- No hardcoded secrets in source code (all credentials from env vars)
- No injection vulnerabilities (no `eval()`, `new Function()`, SQL concatenation)
- No external CDN dependencies (all bundled)
- React auto-escaping covers all user content (only `dangerouslySetInnerHTML` is the Mermaid renderer)
- OAuth implementation delegates properly to PocketBase SDK
- Service worker correctly scopes fetch interception (excludes cross-origin)
- Import validation is solid (Zod `.strip()` for import, `.strict()` for export)
- `.gitignore` properly excludes `.env`, `.env.local`, secrets files

---

## 3. Coding Standards Compliance

### PASS

| Standard | Status |
|---|---|
| File length (<400 lines) | PASS — all source files under 400 lines |
| Type safety (strict mode) | PASS — `"strict": true` in tsconfig.json |
| `any` usage justified | PASS — all instances have eslint-disable + comments |
| Empty catch blocks | PASS — none found |
| TODO comments | PASS — none found |
| Naming conventions (kebab-case files, PascalCase components, camelCase functions) | PASS |
| Import aliases (`@/` for cross-boundary imports) | PASS |

### FAIL

**F1. Direct `console.*` calls bypassing structured logger (19 instances)**

The project has a structured logger at `lib/logger.ts` but many files use `console.error`/`console.warn` directly:

| File | Line(s) | Call |
|------|---------|------|
| `lib/notification-checker.ts` | 81, 95 | `console.error` |
| `lib/notifications/permissions.ts` | 46 | `console.error` |
| `lib/notifications/badge.ts` | 27, 42 | `console.error` |
| `lib/notifications/display.ts` | 23, 149, 185, 217 | `console.error` |
| `components/install-pwa-prompt.tsx` | 94 | `console.error` |
| `components/notification-settings-dialog.tsx` | 62, 87 | `console.error` |
| `components/error-boundary.tsx` | 26 | `console.error` |
| `components/save-smart-view-dialog.tsx` | 64 | `console.error` |
| `components/sync-debug-panel.tsx` | 19 | `console.error` |
| `components/share-task-dialog.tsx` | 160 | `console.error` |
| `components/import-dialog.tsx` | 44 | `console.error` |
| `components/smart-view-selector.tsx` | 90, 121 | `console.error` |

**Acceptable exceptions:** `lib/db.ts` (migration warnings) and `lib/notification-checker.ts:187,203` (guarded by `NODE_ENV === "development"`)

**F2. Function length violations (14+ functions over 150 lines)**

| File | Lines | Function |
|------|-------|----------|
| `components/matrix-board/index.tsx` | 301 | `MatrixBoard()` |
| `components/smart-view-selector.tsx` | 263 | `SmartViewSelector()` |
| `components/notification-settings-dialog.tsx` | 244 | `NotificationSettingsDialog()` |
| `components/filter-panel.tsx` | 242 | `FilterPanelComponent()` |
| `components/task-form/index.tsx` | 235 | `TaskForm()` |
| `components/settings-menu.tsx` | 228 | `SettingsMenu()` |
| `components/sync/sync-auth-dialog.tsx` | 225 | `SyncAuthDialog()` |
| `components/task-card.tsx` | 222 | `TaskCardComponent()` |
| `components/share-task-dialog.tsx` | 218 | `ShareTaskDialog()` |
| `components/app-header.tsx` | 210 | `AppHeader()` |
| `components/reset-everything-dialog.tsx` | 207 | `ResetEverythingDialog()` |
| `components/matrix-board/use-task-operations.ts` | 207 | `useTaskOperations()` |
| `lib/hooks/use-sync.ts` | 186 | `useSync()` |
| `lib/command-actions.ts` | 158 | `buildCommandActions()` |

**Note:** React component functions inherently include JSX, inflating line counts. Hooks and utility functions (e.g., `useSync`, `buildCommandActions`) are stronger candidates for decomposition.

**F3. Nesting depth violations (3-level max exceeded)**

| File | Max Depth | Severity |
|------|-----------|----------|
| `components/pwa-register.tsx` | 9 | High |
| `lib/db.ts` | 8 | High |
| `components/smart-view-selector.tsx` | 7 | Medium |
| `lib/use-error-handler.ts` | 6 | Medium |
| `lib/use-auto-archive.ts` | 6 | Medium |
| `lib/hooks/use-sync.ts` | 6 | Medium |
| `components/filter-panel.tsx` | 6 | Medium |
| `components/docs/mermaid-diagram.tsx` | 6 | Medium |

### MINOR

**FM1. Hardcoded time calculation**
- `lib/use-auto-archive.ts:42` uses `60 * 60 * 1000` instead of `TIME_CONSTANTS.MS_PER_HOUR` from `lib/constants.ts`

**FM2. Hardcoded default URL**
- `packages/mcp-server/src/cli/setup-wizard.ts:11` has `DEFAULT_POCKETBASE_URL = 'https://api.vinny.io'`

---

## 4. Prioritized Remediation Plan

### Priority 1: Security Fixes (Do First)

| # | Issue | Effort | Action |
|---|-------|--------|--------|
| 1a | `express-rate-limit` vulnerability | 5 min | Add `"express-rate-limit": ">=8.2.2"` to overrides in `package.json`, run `bun install` |
| 1b | Custom SVG sanitizer (M1) | 30 min | Replace `sanitizeSvg()` in `mermaid-diagram.tsx` with DOMPurify |
| 1c | Sync data validation (M4) | 1 hr | Add Zod schema validation in `task-mapper.ts` for PocketBase responses |
| 1d | CSP `unsafe-eval` (H1) | 2 hr | Research nonce-based CSP for static Next.js exports; document findings |

### Priority 2: Standards Compliance (Schedule)

| # | Issue | Effort | Action |
|---|-------|--------|--------|
| 2a | Replace 19 `console.*` calls with logger (F1) | 1 hr | Systematic replacement across 12 files |
| 2b | SW push payload validation (M2) | 15 min | Add basic shape check in `sw.js` push handler |
| 2c | CloudFront ID to env var (M3) | 15 min | Replace hardcoded ID in `package.json` and deploy script |
| 2d | Partial token logging (L1) | 5 min | Remove or fully mask token in `test-env-vars.js` |
| 2e | Use `TIME_CONSTANTS` (FM1) | 5 min | Replace inline calculation in `use-auto-archive.ts` |

### Priority 3: Code Quality (Backlog)

| # | Issue | Effort | Action |
|---|-------|--------|--------|
| 3a | Reduce nesting in `pwa-register.tsx` (depth 9) | 30 min | Extract nested callbacks into named functions |
| 3b | Reduce nesting in `db.ts` (depth 8) | 30 min | Extract migration logic into helper functions |
| 3c | Break down large components (F2) | 4+ hr | Extract sub-components from MatrixBoard, SmartViewSelector, etc. |
| 3d | Expand logger sanitization patterns (L2) | 15 min | Add variant key patterns (`userEmail`, `emailAddress`, etc.) |
| 3e | Minor dependency updates | 10 min | Run `bun update` for lucide-react, recharts, postcss, eslint, @types/node |

---

## 5. What's Working Well

- **Proactive dependency management** — 10 existing overrides show ongoing attention to transitive vulnerabilities
- **All critical packages current** — Next.js 16, React 19, TypeScript 5.9, Vite 7, Zod 4
- **No secrets in code** — proper use of environment variables throughout
- **No injection vectors** — PocketBase filter escaping, no eval/exec patterns
- **Solid input validation** — Zod schemas for all data types with import/export validation
- **Good .gitignore coverage** — excludes .env files, secrets, and build artifacts
- **TypeScript strict mode** enabled with justified `any` usage only
- **Clean naming conventions** and consistent import alias usage

---

*Report generated by Claude Code security audit*
