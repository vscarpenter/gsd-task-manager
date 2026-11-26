# 0024: Serve the MCP server on SDK v2 for both protocol revisions

| Field | Value |
|---|---|
| Date | 2026-11-26 |
| Status | Accepted |
| Deciders | Vinny Carpenter (approved the spec), Claude Code (implementation) |
| Related | `tasks/spec.md` ("Move the MCP server to SDK v2 and protocol 2026-07-28"), PR #801 |

## Context

`gsd-mcp-server` ran on `@modelcontextprotocol/sdk` 1.32.2, whose newest
protocol revision is 2025-11-25. MCP 2026-07-28 replaced the initialize
handshake with self-describing requests and moved server-to-client requests,
such as elicitation, to multi round-trip requests (MRTR). Claude Code reads
skills from MCP servers and runs MCP tasks only on 2026-07-28 connections,
while Claude Desktop and older clients still open with a 2025 `initialize`.
The server runs as a local stdio process for all of them.

Only the TypeScript SDK v2 (`@modelcontextprotocol/server`) implements
2026-07-28. Even on v2, a `Server` connected straight to
`StdioServerTransport` speaks only the 2025 protocol.

## Decision

- **Transport.** `startMcpServer` calls
  `serveStdio(() => createGsdServer(config), { legacy: 'serve' })`. The
  connection's opening message picks the revision: a 2025 `initialize` gets a
  2025-11-25 server, and any other opening gets 2026-07-28. One factory builds
  both, so tools, prompts, and results don't depend on the revision.
- **Server shape.** The factory builds a low-level `Server` with GSD's handlers
  registered by method string, so the advertised tool and prompt schemas stay
  byte-identical to v1.5.0. When skills arrive, it switches to an `McpServer`,
  because `SkillsExtension.attach()` needs one, and declares `tools` and
  `prompts` through `mcp.server.registerCapabilities()` so `McpServer` installs
  no tool or prompt handlers of its own. A spike on 2026-11-26 confirmed this
  shape on both revisions.
- **Delete confirmation.** A `delete_task`, or a bulk delete, with
  `dryRun: false` asks a person through form elicitation before any write,
  when the client declares form elicitation. The handler returns
  `inputRequired(...)`. On 2026-07-28 the client answers and retries; on
  2025-11-25 the SDK's legacy shim sends a real `elicitation/create` and
  re-enters the handler, so one handler serves both. A client that doesn't
  declare elicitation keeps the v1.5.0 behavior.
- **Delete only what was confirmed.** The confirmation round mints a
  `requestState` holding each task's `updatedAt`, signed by
  `createRequestStateCodec` with a 32-byte key made once per process. The
  codec's `verify` runs before the handler on every round, and the retried
  call deletes only tasks whose stamp still matches.
- **Node floor.** `engines.node` is `>=22`, the version CI tests. v2 needs at
  least 20.

## Consequences

- Current clients, including Claude Code's v2 runtime, connect on 2026-07-28,
  which the skills extension and MRTR need. 2025-era clients see the v1.5.0
  wire contract, which `src/__tests__/server/wire-contract.test.ts` pins.
- Deletes gain a confirmation the model can't give for the user: it comes only
  from the client's form, and no tool schema has a confirmation argument.
- A per-process codec key works only because one stdio process serves every
  round of a flow. Serving over HTTP from more than one instance would need a
  shared key.
- The SDK's install footprint drops from 94 packages to 2, which also retired
  nine root `overrides` that patched only the v1 SDK's HTTP stack.
- The package needs Node 22, a breaking change for its users, so it ships in a
  major release.
- On 2026-07-28 a tool result carries `_meta` naming the server, so tests that
  compare revisions compare `content` and `isError`.

## Alternatives

- **Stay on SDK v1.** v1 is maintained, but it stops at 2025-11-25, so skills
  and MRTR would stay out of reach.
- **Rewrite the tools with `McpServer.registerTool`.** Idiomatic, but the SDK
  would validate inputs with its own schemas ahead of GSD's Zod checks, and the
  advertised schemas could drift from v1.5.0. `registerTool` with
  `fromJsonSchema` stays the fallback if the low-level shape stops working.
- **Confirm with `elicitInput()`.** It works only on 2025 connections and
  throws on 2026-07-28 requests, so it would need a second code path.
- **Refuse deletes from clients without elicitation.** Safer for those clients,
  but it would break deletes where no form can be shown. The owner chose to keep
  the v1.5.0 flow for them.
- **Adopt the Tasks extension.** GSD has no long-running work, and a stdio task
  ends with its process.
