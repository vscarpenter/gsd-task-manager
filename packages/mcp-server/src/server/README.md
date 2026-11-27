# Server

## Overview

This directory loads and validates the PocketBase configuration from environment variables. It creates the `McpServer`, registers its request handlers, loads the package's skills, and runs the stdio startup sequence. It reports startup failures on stderr.

## Interface

Configuration (`config.ts`):

- `loadConfig()`: parses `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` into a `GsdConfig` with `configSchema`.
- `configSchema`, `ConfigSchema`: the Zod object for `{pocketBaseUrl, authToken}` and its inferred type.
- `isSafePocketBaseUrl(url)`: true for `https`, or for `http` to `localhost`, `127.0.0.1`, or `::1`.
- `isSuperuserAuthToken(token)`: checks JWT claims offline and returns true for a PocketBase superuser token.
- `UNSAFE_POCKETBASE_URL_MESSAGE`: the error text for a URL that fails the policy.

Server setup (`setup.ts`):

- `createServer()`: returns an `McpServer` named `gsd-task-manager`. It declares `tools` and `prompts` on `mcp.server`, so `McpServer` installs no tool or prompt handlers of its own.
- `registerHandlers(mcp, config)`: registers four request handlers on `mcp.server`.
- `tools/list` handler: returns `{ tools: allTools }`.
- `prompts/list` handler: returns `{ prompts: allPrompts }`.
- `prompts/get` handler: returns the message from `getPromptMessage(name)`.
- `tools/call` handler: returns `handleToolCall(name, args || {}, config, confirmation)`.
- `createGsdServer(config, skills?)`: runs `createServer` and `registerHandlers`, then attaches the skills catalog when one loaded.

Skills (`skills.ts`):

- `loadGsdSkills()`: loads the package's `skills/` folder, found from the module's location. It returns `undefined` when the catalog can't load.

Startup (`startup.ts`):

- `prepareStartup()`: runs `loadConfig`, then `removeSetupArtifact`, then `assertNonSuperuserPrincipal`, and returns the config.
- `startMcpServer()`: runs `prepareStartup` and `loadGsdSkills`, then serves `createGsdServer` through `serveStdio`.
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
- `skills.ts:loadGsdSkills`: a missing folder or an invalid skill logs a warning to stderr and never stops the tools. An invalid skill is skipped, and the others still load.

## Side Effects

- `config.ts:loadConfig`: reads `process.env.GSD_POCKETBASE_URL` and `process.env.GSD_AUTH_TOKEN`. It logs to stderr on error.
- `startup.ts:prepareStartup`: deletes `~/.gsd-mcp-setup.json` through `removeSetupArtifact`.
- `startup.ts:startMcpServer`: serves through `serveStdio`, which uses stdin and stdout for JSON-RPC. It logs a startup line to stderr.
- `startup.ts:reportStartupFailure`: writes to stderr through the logger and `process.stderr.write`.
- `setup.ts:registerHandlers`: mutates `mcp.server` with `setRequestHandler`.
- `skills.ts:loadGsdSkills`: reads the `skills/` folder once at startup.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
