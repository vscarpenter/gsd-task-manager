# GSD Task Manager

> Prioritize what matters with a privacy-first Eisenhower matrix.

GSD ("get stuff done") is a browser-native task manager that classifies work
into the four Eisenhower quadrants — urgent/important, important-only,
urgent-only, and neither. All data lives locally in IndexedDB. A self-hosted
PocketBase deployment is available for opt-in cloud sync across devices.

This file is the markdown rendition of <https://gsd.vinny.dev>, served when a
client sends `Accept: text/markdown`.

## Quadrants

| Quadrant | Label | Action |
| --- | --- | --- |
| Q1 | Urgent + Important | Do first |
| Q2 | Not urgent + Important | Schedule |
| Q3 | Urgent + Not important | Delegate |
| Q4 | Not urgent + Not important | Eliminate |

## Discovery surface

Agents can discover the full set of programmatic interfaces from the
following well-known resources:

- **API catalog** — <https://gsd.vinny.dev/.well-known/api-catalog>
  (`application/linkset+json`, RFC 9727)
- **OpenAPI for the sync backend** —
  <https://gsd.vinny.dev/.well-known/openapi/pocketbase.json>
- **OAuth Protected Resource Metadata** —
  <https://gsd.vinny.dev/.well-known/oauth-protected-resource>
  (RFC 9728; the authorization server is `https://api.vinny.io`)
- **MCP Server Card** —
  <https://gsd.vinny.dev/.well-known/mcp/server-card.json>
- **Agent Skills index** —
  <https://gsd.vinny.dev/.well-known/agent-skills/index.json>
- **WebMCP** — the browser app calls
  `navigator.modelContext.provideContext()` on load to expose a
  `create_task` tool to in-page agents.

## MCP server

For Claude Desktop and other MCP-aware assistants, install
`gsd-mcp-server` from npm:

```bash
npx -y gsd-mcp-server
```

Configure with the environment variables documented in the
[server card](/.well-known/mcp/server-card.json).

## Privacy

Tasks never leave the device unless the user explicitly enables sync. Sync is
last-write-wins by `client_updated_at` and uses a dedicated PocketBase
instance the maintainer operates personally.

## Source

- Code: <https://github.com/vscarpenter/gsd-taskmanager>
- License: MIT
- Maintainer: Vinny Carpenter
