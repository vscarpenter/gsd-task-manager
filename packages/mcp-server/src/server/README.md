# Server

## Overview

This directory loads and validates the PocketBase configuration from environment variables. It creates the MCP `Server`, registers its request handlers, and runs the stdio startup sequence. It reports startup failures on stderr.

## Interface

Configuration (`config.ts`):

- `loadConfig()`: parses `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` into a `GsdConfig` with `configSchema`.
- `configSchema`, `ConfigSchema`: the Zod object for `{pocketBaseUrl, authToken}` and its inferred type.
- `isSafePocketBaseUrl(url)`: true for `https`, or for `http` to `localhost`, `127.0.0.1`, or `::1`.
- `isSuperuserAuthToken(token)`: checks JWT claims offline and returns true for a PocketBase superuser token.
- `UNSAFE_POCKETBASE_URL_MESSAGE`: the error text for a URL that fails the policy.

Server setup (`setup.ts`):

- `createServer()`: returns an MCP `Server` named `gsd-task-manager` with `tools` and `prompts` capabilities.
- `registerHandlers(server, config)`: registers four request handlers.
- `ListToolsRequestSchema` handler: returns `{ tools: allTools }`.
- `ListPromptsRequestSchema` handler: returns `{ prompts: allPrompts }`.
- `GetPromptRequestSchema` handler: returns the message from `getPromptMessage(name)`.
- `CallToolRequestSchema` handler: returns `handleToolCall(name, args || {}, config)`.

Startup (`startup.ts`):

- `prepareStartup()`: runs `loadConfig`, then `removeSetupArtifact`, then `assertNonSuperuserPrincipal`, and returns the config.
- `startMcpServer()`: runs `prepareStartup`, `createServer`, and `registerHandlers`, then connects a `StdioServerTransport`.
- `reportStartupFailure(error)`: logs the error and writes recovery help to stderr.

## Invariants

- `startup.ts` module comment: the module writes only to stderr. Stdout carries JSON-RPC frames, and one stray byte there corrupts the transport.
- `startup.ts` module comment: the module does not exit the process. It throws, and `index.ts` decides how to exit.
- `startup.ts` module comment: startup depends only on local state, so a PocketBase outage does not stop tool registration.
- `startup.ts:prepareStartup`: the setup artifact is removed before the principal check, so a refusal does not leave the plaintext token behind.
- `config.ts:loadConfig`: `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` are required. A parse error is logged and rethrown.
- `config.ts:isSafePocketBaseUrl`: the hostname must match a loopback name exactly. A URL with a username, password, query, or fragment is rejected.
- `config.ts:configSchema`: `authToken` needs at least 1 character. A superuser token fails with `PocketBase superuser tokens are not accepted`.
- `config.ts:isSuperuserAuthToken`: its comment says superuser tokens are rejected before they are attached to a request.

## Side Effects

- `config.ts:loadConfig`: reads `process.env.GSD_POCKETBASE_URL` and `process.env.GSD_AUTH_TOKEN`. It logs to stderr on error.
- `startup.ts:prepareStartup`: deletes `~/.gsd-mcp-setup.json` through `removeSetupArtifact`.
- `startup.ts:startMcpServer`: connects a `StdioServerTransport`, which uses stdin and stdout for JSON-RPC. It logs a startup line to stderr.
- `startup.ts:reportStartupFailure`: writes to stderr through the logger and `process.stderr.write`.
- `setup.ts:registerHandlers`: mutates the `Server` instance with `setRequestHandler`.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
