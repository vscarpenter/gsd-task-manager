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

## Files

- `public/sw.js`: the runtime SW, which loads the cache logic with `importScripts()`.
- `lib/sw-cache-logic.ts`: the **canonical source** for the cache routing functions. Edit only this file.
- `public/sw-cache-logic.js`: generated from the TypeScript by `node scripts/generate-sw-cache-logic.cjs`. Never edit it by hand. `tests/data/sw-cache-logic-generated.test.ts` fails when the committed copy drifts, and the fix is to rerun the generator and commit its output.
- `components/pwa-register.tsx`: SW registration.

## Cache Version

Every build rotates the pages and runtime caches on its own. `public/sw.js` keeps the placeholder `const CACHE_VERSION = 'dev';`, and `scripts/build-static-export.sh` stamps the build's version into `out/sw.js` with `scripts/update-sw-version.cjs`. Never commit a real version to `public/sw.js`: the stamp fails the build when the placeholder is missing. The immutable cache is content-hashed and does not need a version.
