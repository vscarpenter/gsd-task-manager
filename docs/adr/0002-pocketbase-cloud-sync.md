# 0002: PocketBase for Optional Cloud Sync

**Date:** 2024-06-01  
**Status:** Accepted  
**Deciders:** Vinny Carpenter

## Context

Users requested multi-device sync. The architecture needed to preserve the privacy-first principle (ADR-0001) while enabling optional cross-device data sharing. The sync backend must be self-hostable so the user retains full data ownership.

## Decision

Use PocketBase as the optional cloud sync backend, self-hosted at `https://api.vinny.io` on AWS EC2. Authentication via PocketBase's built-in OAuth2 (Google, GitHub providers). Tasks are stored as plaintext in the PocketBase SQLite database — the user owns the server.

## Consequences

**Easier:**
- Single binary deployment — PocketBase is a Go binary with embedded SQLite.
- Built-in OAuth2, realtime SSE, and admin UI reduce custom code.
- API rules (`owner = @request.auth.id`) enforce per-user data isolation at the database level.
- PocketBase SDK handles auth token storage, refresh, and request signing automatically.

**Harder:**
- PocketBase version upgrades can introduce breaking changes (e.g., v0.23 changed admin auth endpoints and system field behavior).
- Self-hosting requires EC2 instance management, backups, and SSL certificates.
- Tasks stored as plaintext on the server — acceptable because the user owns the server, but not E2E encrypted.
- PocketBase's SSE realtime requires careful echo filtering (via `device_id`) to avoid processing own changes.

## Alternatives Considered

- **Cloudflare Workers + D1**: Initially implemented with CRDT vector clocks. Abandoned due to complexity and Cloudflare-specific lock-in.
- **Firebase/Supabase**: Managed services but not self-hostable. Users would not own their data.
- **CouchDB/PouchDB**: Native sync protocol but heavy operational overhead for a single-user scenario.
