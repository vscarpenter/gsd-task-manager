# 0004: PWA Architecture for Offline Capability

**Date:** 2026-04-14
**Status:** Accepted
**Deciders:** Vinny Carpenter

## Context

GSD Task Manager is a client-side-only Next.js app (ADR-0001) deployed as a static export to S3/CloudFront. Users expect the app to be available and responsive even without network connectivity — tasks should be readable and editable offline. A distribution mechanism that doesn't require app store approval was also preferred.

## Decision

Implement the app as a Progressive Web App (PWA) using a Service Worker (`public/sw.js`) and a Web App Manifest (`public/manifest.json`). The Service Worker caches the static shell (HTML, JS, CSS, fonts, icons) on install and serves cached assets on subsequent requests, enabling full offline use. The Next.js static export (`bun run export`) produces a fully self-contained `out/` directory that maps cleanly to S3 object keys. A CloudFront Function (`cloudfront-function-url-rewrite.js`) rewrites directory paths to `index.html` to support client-side routing without 403/404 errors from S3.

The Service Worker caches:
- The app shell (all static assets from the Next.js build)
- Fonts from the `fonts/` directory
- The manifest and icons

IndexedDB data is not cached by the SW — Dexie manages persistence directly in the browser's storage layer, which survives SW updates and cache clears.

## Consequences

### Easier
- Installable on desktop and mobile without an app store.
- Fully offline-capable once the shell is cached on first load.
- Static export keeps hosting costs near zero and deployment simple (`bun run deploy`).
- No SSR complexity — every page is pre-rendered to a static HTML file.
- SW updates are transparent: the browser fetches a new SW in the background and activates it on next reload.

### Harder
- New App Router routes require re-running `./scripts/deploy-cloudfront-function.sh` to update the rewrite rules.
- SW cache invalidation strategy must be managed carefully — stale assets can cause subtle bugs after deploys.
- PWA install prompts are browser-controlled and not always shown, limiting discoverability.
- Testing offline behavior requires manual SW inspection in DevTools; automated tests don't exercise the SW.

## Alternatives Considered

- **Native mobile app (React Native)**: Full offline support and app store presence, but requires separate codebase, build toolchain, and app store approval cycle. Rejected — too much overhead for a solo project.
- **Electron**: Desktop-only, eliminates the mobile use case. Adds ~150MB binary overhead. Rejected.
- **No offline support**: Simplest approach, but a task manager that fails without Wi-Fi is a poor user experience. Rejected.
- **next/pwa (workbox-based)**: Considered but the additional abstraction layer and configuration complexity were not justified given the simple caching needs. A hand-written SW in `public/sw.js` gives full control over cache strategy.
