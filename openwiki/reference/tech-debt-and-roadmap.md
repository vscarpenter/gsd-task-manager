# Tech Debt & Roadmap

> **Human-maintained page.** Unlike the rest of OpenWiki, this captures *forward-looking
> intent* rather than facts derived from current code, so `openwiki --update` does not
> regenerate it. Keep it current by hand. Migrated from the retired long-form
> `ARCHITECTURE.md`.

---

## Known technical debt

- **Schema migration chain (`/lib/db.ts`).** The Dexie schema is at **v14**; the v1→v14
  migration chain carries accumulated complexity. A consolidation pass could simplify
  onboarding, at the cost of dropping upgrade paths from very old client versions.
- **Service worker caching (`/public/sw.js`, `/lib/sw-cache-logic.ts`).** The multi-cache
  strategy (ADR-0012) plus iOS cache-busting workarounds are intricate; a Workbox migration
  could reduce hand-rolled logic.
- **Sync engine surface area (`/lib/sync/`).** The engine spans many modules — push/pull,
  realtime, health monitoring, retry, offline queue, error categorization. A state-machine
  abstraction could make the control flow easier to reason about and test.
- **`eslint-config-next` version coupling.** Must stay pinned in lockstep with `next`; an
  automated check would prevent silent drift.
- **Dependency `overrides` (`/package.json`).** Transitive vulnerability patches accumulate
  in `overrides` and need periodic review so stale pins don't linger.

---

## Planned migrations

- **PocketBase upgrades.** Currently on v0.23+ with known gotchas (system fields not
  filterable/sortable, `_superusers` admin auth). Future versions may resolve these — see
  `.claude/rules/pocketbase-sync.md`.
- **Next.js App Router evolution.** Currently uses route groups (`(matrix)`, `(dashboard)`,
  `(archive)`, `(pwa)`, `(sync)`); may adopt parallel or intercepting routes as they
  stabilize.

---

## Potential roadmap items

- **Collaborative sync.** Multi-user task sharing (today is single-user, multi-device).
- **Native mobile apps.** No native code exists yet; this would be a new workspace package.
- **Offline-first conflict UI.** Surface last-write-wins conflicts to users instead of
  resolving them silently.
- **MCP server expansion.** Additional tools (time tracking, smart-view management,
  notification control) beyond the current catalog — see [MCP server](../workflows/mcp-server.md).

---

## Related

- [Architecture overview](../architecture/overview.md) · [Domain model](../architecture/domain-model.md)
- Decision history: `/docs/adr/0001`–`0012`.
