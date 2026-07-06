# Architecture

> **The living architecture documentation now lives in [`/openwiki`](openwiki/quickstart.md).**
>
> This file used to carry a long-form architecture reference, but it drifted out of date
> (it still described the pre-v9 UI). OpenWiki is generated from current source, reviewed by
> a human, and kept in sync with `main` by `.github/workflows/openwiki-update.yml`, so it is
> the source of truth. Start here:

| Topic | Where |
| --- | --- |
| System overview (layers, rendering, data flow, key dirs) | [openwiki/architecture/overview.md](openwiki/architecture/overview.md) |
| Domain model (TaskRecord, quadrants, dependencies, Dexie schema) | [openwiki/architecture/domain-model.md](openwiki/architecture/domain-model.md) |
| Cloud sync & offline (PocketBase engine, SW cache) | [openwiki/workflows/sync-and-offline.md](openwiki/workflows/sync-and-offline.md) |
| MCP server | [openwiki/workflows/mcp-server.md](openwiki/workflows/mcp-server.md) |
| Build, deploy & operations | [openwiki/operations/build-deploy-and-ops.md](openwiki/operations/build-deploy-and-ops.md) |
| Testing | [openwiki/testing/testing-guide.md](openwiki/testing/testing-guide.md) |
| Glossary | [openwiki/reference/glossary.md](openwiki/reference/glossary.md) |
| Tech debt & roadmap | [openwiki/reference/tech-debt-and-roadmap.md](openwiki/reference/tech-debt-and-roadmap.md) |
| **Security posture** | [`SECURITY.md`](SECURITY.md) |

Decision history lives in the ADRs at [`/docs/adr/`](docs/adr/).
