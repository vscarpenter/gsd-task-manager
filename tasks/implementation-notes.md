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

## PR 4 (`feat/mcp-describe-server`)

- **Instructions drop one clause of the draft.** The spec's draft ends its delete sentence with "and expect the client to ask the user to confirm." No client asks before PR 5, and under D4 a client without form elicitation never asks, so a model that trusts that line could skip asking the user itself. PR 4 ships "Deletes are permanent and skip the 30-day Trash: preview with dryRun first." PR 5 should add wording that holds for both kinds of client. Every other sentence was checked against the code on 2026-11-26: `BULK_MAX_TASKS` and `BULK_MAX_DELETES`, `normalizeTag`, the Saved-item filters in `listTasks` and `getTaskStats`, the `get_top_three` description, and `ConflictError`.

## PR 5 (`feat/mcp-confirm-deletes`)

- **The confirmation wraps the v1.5.0 handlers in the dispatcher.** `src/tools/handlers/delete-confirmation.ts` decides each round and calls `handleDeleteTask` or `handleBulkUpdateTasks` unchanged when the client can't ask or the preview finds nothing. Tests that call those handlers directly keep their result type, and `handleToolCall` gains an overload, so only a call that carries a confirmation can return `inputRequired`.
- **`bind` covers the method, not the tool name.** The codec's `bind` sees only the request context, not the call's params, so the payload's `tool` field is checked in the handler instead. A state minted for `delete_task` still can't confirm `bulk_update_tasks`. The spec said the bind covers both.
- **2025 connections read capabilities through a deprecated accessor.** On 2026-07-28 the client's capabilities come from the request's envelope. A 2025 connection declared them at `initialize`, and the SDK documents `Server.getClientCapabilities()` (marked `@deprecated`) as their source there. That one call adds one S1874 finding on new code; at this PR's size it leaves the maintainability rating at A.
- **One added test: a retry that swaps the task.** On 2026-07-28 a client could retry with another task's id while echoing the state minted for the first. `asConfirmed` refuses a task the confirmation never covered. The test was written red before the cycle 2 implementation but after that cycle's red was approved.
- **Three extractions to stay inside the shape limits.** `handleDeleteTask` sat at the 41-line baseline ceiling and `executeBulkWrite` at 40, so the two delete-message formatters, the bulk log call, and `deleteTask`'s dry-run result moved into helpers verbatim. Existing tests pin the text they produce.
- **Answers are parsed with `z.strictObject`.** The repo's lint rule forbids `z.object`. An answer with unexpected fields fails validation and counts as not confirmed.
- **A flaky tamper test, root-caused.** Flipping the signature's last base64url character between `A` and `B` sometimes changed only padding bits (a 32-byte MAC encodes to 43 characters), so the state still verified. The test now edits the signed payload's stamp and keeps the old signature.
