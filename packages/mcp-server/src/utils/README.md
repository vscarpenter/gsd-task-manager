# Utils

## Overview

This directory has the structured logger. It writes one JSON object per line to stderr, so stdout stays free for the MCP JSON-RPC stream.

## Interface

- `createMcpLogger(module)` (`logger.ts`): returns `{ info, warn, error, debug }` for the named module.
- `info(message, context?)`, `warn(message, context?)`, `debug(message, context?)`: write one log entry.
- `error(message, error?, context?)`: writes one log entry with the error and a shortened stack.

## Invariants

- `logger.ts` module comment: the logger uses stderr because stdout carries JSON-RPC messages. Only stderr is safe for diagnostic output.
- `logger.ts:writeLog`: every level writes through `process.stderr.write`. Nothing in this file writes to stdout.
- `logger.ts:createMcpLogger`: `debug` writes only if `LOG_LEVEL` is `debug` or `NODE_ENV` is `development`. It checks once, when the logger is created.
- `logger.ts:createEntry`: the error stack is cut to its first 3 lines.

## Side Effects

- `logger.ts:writeLog`: writes one JSON line to stderr with a timestamp, level, module, and message.
- `logger.ts:createMcpLogger`: reads `process.env.LOG_LEVEL` and `process.env.NODE_ENV` on each call.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
