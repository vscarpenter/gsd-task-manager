# Implementation notes: MCP v2 migration (spec of 2026-11-26)

Tactical deviations from the approved spec in `tasks/spec.md`, logged per `coding-standards.md` Phase 2. When the plan finishes, distill this file into `tasks/lessons.md` and delete it.

## PR 2 (`refactor/mcp-sdk-v2`)

- **Root overrides removed.** Dropping `@modelcontextprotocol/sdk` 1.32.2 took its Express and Hono stack out of `bun.lock`, which orphaned nine root `overrides`: `@hono/node-server`, `body-parser`, `express-rate-limit`, `fast-uri`, `hono`, `ip-address`, `path-to-regexp`, `proxy-addr`, and `qs`. `tests/data/dependency-pins.test.ts` requires every override to target an installed package, so PR 2 removes all nine, plus the seven matching assertions in `tests/data/security-hardening-scripts.test.ts`. The spec didn't anticipate this.
- **Rules-file line moves to PR 3.** The root `package.json` made PR 2 sixteen files, one over the PR-shape limit, so the Node and SDK line in `.claude/rules/mcp-server.md` lands in PR 3, which rewrites that file's server description for `serveStdio` anyway.
- **`getPromptMessage` returns `PromptMessage`.** v2 types each method's result, so a `role: string` message no longer compiles for `prompts/get`. The function returns the same values; only its declared return type changed.

## PR 3 (`feat/mcp-serve-2026-07-28`)

- **D1 spike, 2026-11-26: the planned server shape holds.** A throwaway test, since deleted, confirmed on both protocols:
  - A low-level `tools/call` handler can return `inputRequired(...)` with state minted by `createRequestStateCodec`, and the codec's `verify`, passed as `ServerOptions.requestState.verify`, hands the decoded state to the re-entered handler. On 2025-11-25 the SDK's shim sends `elicitation/create`; on 2026-07-28 the client fulfils the request itself. (PR 5)
  - An `McpServer` that declares `tools` and `prompts` through `mcp.server.registerCapabilities()` keeps GSD's own handlers, and `SkillsExtension.attach()` adds `skill://` resources and the `io.modelcontextprotocol/skills` extension beside them. (PR 6)
  - A 2026-07-28 client lists tools and prompts equal to the v1.5.0 fixture. (AC3)
- **AC4 compares result payloads.** On 2026-07-28 a tool result also carries `_meta['io.modelcontextprotocol/serverInfo']`, protocol metadata the SDK adds, so the cross-protocol parity test compares `content` and `isError`, which is what the dispatcher produces.
