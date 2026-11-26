# Implementation notes: MCP v2 migration (spec of 2026-11-26)

Tactical deviations from the approved spec in `tasks/spec.md`, logged per `coding-standards.md` Phase 2. When the plan finishes, distill this file into `tasks/lessons.md` and delete it.

## PR 2 (`refactor/mcp-sdk-v2`)

- **Root overrides removed.** Dropping `@modelcontextprotocol/sdk` 1.32.2 took its Express and Hono stack out of `bun.lock`, which orphaned nine root `overrides`: `@hono/node-server`, `body-parser`, `express-rate-limit`, `fast-uri`, `hono`, `ip-address`, `path-to-regexp`, `proxy-addr`, and `qs`. `tests/data/dependency-pins.test.ts` requires every override to target an installed package, so PR 2 removes all nine, plus the seven matching assertions in `tests/data/security-hardening-scripts.test.ts`. The spec didn't anticipate this.
- **Rules-file line moves to PR 3.** The root `package.json` made PR 2 sixteen files, one over the PR-shape limit, so the Node and SDK line in `.claude/rules/mcp-server.md` lands in PR 3, which rewrites that file's server description for `serveStdio` anyway.
- **`getPromptMessage` returns `PromptMessage`.** v2 types each method's result, so a `role: string` message no longer compiles for `prompts/get`. The function returns the same values; only its declared return type changed.
