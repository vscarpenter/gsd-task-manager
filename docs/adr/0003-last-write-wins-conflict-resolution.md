# 0003: Last-Write-Wins Conflict Resolution

**Date:** 2024-06-15  
**Status:** Accepted  
**Deciders:** Vinny Carpenter

## Context

With multi-device sync (ADR-0002), conflicts are inevitable when the same task is edited on two devices while offline. A conflict resolution strategy was needed that balances correctness, simplicity, and user expectations.

## Decision

Use Last-Write-Wins (LWW) based on the `client_updated_at` timestamp. When a conflict is detected during sync push/pull, the record with the more recent `client_updated_at` wins. Remote wins if newer.

## Consequences

**Easier:**
- Simple to implement and reason about — no merge logic, no conflict UI.
- Deterministic — given the same timestamps, any device reaches the same state.
- Low overhead — no vector clocks, CRDTs, or operational transforms required.
- Works naturally with PocketBase's record-level updates.

**Harder:**
- Data loss is possible if two devices edit the same task field simultaneously — the earlier edit is silently overwritten.
- Clock skew between devices could cause unexpected wins (mitigated by using ISO timestamps from the client).
- No per-field merge — the entire task record is overwritten, not individual fields.
- Users have no visibility into conflicts that were auto-resolved.

## Alternatives Considered

- **CRDT (vector clocks)**: Previously implemented with the Cloudflare Workers backend. Abandoned due to: high complexity, merge anomalies with nested data (subtasks, tags), and difficult debugging. The complexity was not justified for a single-user, few-devices scenario.
- **Manual conflict resolution UI**: Shows both versions and lets the user choose. Rejected — too disruptive for the "get stuff done" philosophy. May revisit if users report data loss issues.
- **Per-field merge**: Merge at the field level instead of record level. Rejected — complex to implement with nested structures (subtasks array, tags array) and diminishing returns for the typical use case (one person, 2-3 devices).
