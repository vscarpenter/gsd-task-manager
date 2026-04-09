# 0001: Client-Side Only Architecture with IndexedDB

**Date:** 2024-01-15  
**Status:** Accepted  
**Deciders:** Vinny Carpenter

## Context

GSD Task Manager needed a data persistence strategy. Options ranged from a traditional server-side database to fully client-side storage. Privacy is a core product value — users should own their data without requiring an account or trusting a third-party server.

## Decision

All data is stored client-side in IndexedDB via Dexie v4. The app runs entirely in the browser as a PWA with no server-side rendering or API routes. Data portability is provided through JSON export/import.

## Consequences

**Easier:**
- Zero infrastructure cost for the base product — no database server to maintain.
- True offline-first — the app works without any network connectivity.
- Privacy by default — no data leaves the device unless the user opts into sync.
- Simpler deployment — static export to S3/CloudFront.

**Harder:**
- Cross-device sync requires a separate opt-in solution (see ADR-0002).
- No server-side search, aggregation, or backup capabilities.
- IndexedDB storage limits vary by browser (~50MB-unlimited depending on context).
- Schema migrations must be handled carefully in `lib/db.ts` (Dexie versioning).

## Alternatives Considered

- **PostgreSQL + API server**: Full control but requires infrastructure, accounts, and server maintenance. Rejected for privacy reasons.
- **SQLite via WASM**: Promising but ecosystem maturity and bundle size were concerns at decision time.
- **localStorage**: Too limited (5MB cap, no indexing, synchronous API). Rejected.
