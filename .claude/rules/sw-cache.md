---
name: sw-cache
description: Service worker multi-cache strategy. Loads when editing SW code or PWA registration.
paths:
  - public/sw.js
  - public/sw-*.js
  - lib/sw-cache-logic.ts
  - components/pwa-register.tsx
  - public/manifest.json
---

## Cache Architecture (ADR 0012)

Three purpose-specific caches with distinct strategies:

| Cache name | Contents | Strategy | Lifecycle |
|---|---|---|---|
| `gsd-immutable-v1` | content-hashed `/_next/static/*` assets | cache-first | FIFO-pruned at 60 entries, survives deploys |
| `gsd-pages-v{version}` | HTML + RSC flight data | network-first | rotated on deploy |
| `gsd-runtime-v{version}` | icons, manifest, other static | cache-first | rotated on deploy |

## Files to Keep in Sync

- `public/sw.js` — runtime SW (loads cache logic via `importScripts()`)
- `public/sw-cache-logic.js` — pure cache routing functions
- `lib/sw-cache-logic.ts` — **canonical TypeScript source** — keep in sync with the JS copy
- `components/pwa-register.tsx` — SW registration

## Bump Cache Version

When the SW cache logic changes, bump the version constant in `public/sw.js` so old pages/runtime caches rotate. The immutable cache is content-hashed and does not need a bump.
