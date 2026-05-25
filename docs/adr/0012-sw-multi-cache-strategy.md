# ADR 0012: Service Worker Multi-Cache Strategy

- **Date:** 2026-05-25
- **Status:** Accepted
- **Deciders:** Vinny Carpenter

## Context

The PWA service worker used a single cache (`gsd-cache-v{version}`) for all assets. Every deploy bumped the version, which deleted the entire cache during activation — including content-hashed JS chunks under `/_next/static/` that are immutable by definition (their URL changes when content changes). This forced users to re-download ~2.6MB of chunks on every deploy, even when only 1-2 files changed.

## Decision

Split the single cache into three purpose-specific caches:

| Cache | Strategy | Invalidation |
|---|---|---|
| `gsd-immutable-v1` | Cache-first | Never version-invalidated; FIFO-pruned at 60 entries |
| `gsd-pages-v{version}` | Network-first | Rotated on every deploy |
| `gsd-runtime-v{version}` | Cache-first | Rotated on every deploy |

Cache routing logic is extracted into `public/sw-cache-logic.js` (pure functions) with a canonical TypeScript source at `lib/sw-cache-logic.ts` for testing.

Classification rules:
- `/_next/static/*` → immutable (content-hashed chunks, build manifests)
- HTML (`text/html` accept header, trailing `/`, `.html`) and RSC flight data (`/__next.*`) → pages
- Same-origin GET for everything else (icons, manifest) → runtime
- Cross-origin or non-GET → passthrough (no SW interception)

## Consequences

**Easier:**
- Repeat visits after deploys only download changed chunks (~95% bandwidth reduction for typical patches)
- Cache inspection in DevTools is clearer with three labeled caches
- Cache logic is independently testable (27 unit tests)

**Harder:**
- Two files must stay in sync (`lib/sw-cache-logic.ts` and `public/sw-cache-logic.js`)
- First deploy after this change causes a one-time full re-download (old single cache is deleted)

**Out of scope:**
- Workbox integration (avoided to keep the SW dependency-free and debuggable)
- True LRU eviction (Cache Storage API has no access timestamps; FIFO is equivalent for content-hashed assets)

## Alternatives

| Alternative | Why rejected |
|---|---|
| Workbox with precache manifest | Adds build dependency and abstraction for a 230-line file |
| Single cache with selective cleanup | Cache API has no per-entry metadata to identify stale entries by build version |
| LRU eviction via IndexedDB tracking | Complexity not justified — FIFO is correct for immutable hashed assets |
