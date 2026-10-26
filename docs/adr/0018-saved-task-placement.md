# ADR 0018: Saved is task placement independent of quadrant

Status: implemented locally; hosted rollout and iOS support pending.

## Decision
An optional `savedAt` ISO timestamp identifies an item outside the active matrix.
Keep it in `tasks` with the same id and all existing context. Quadrant and due date
remain available for a deliberate return. Reuse the existing 600-character
description for short annotations and links.

The active hook excludes saved rows while retaining all stored rows for dependency
resolution and command-palette search. Saved prerequisites still block active
work, including Ready to Work smart views. Notifications and due badges exclude
saved items. Saving never completes a task or creates a recurring instance, and
requires stopping an active timer first.

The optional field is accepted by strict exports and lenient imports. Dexie v17
adds its timestamp index without backfilling legacy rows. Save/return mutations
use the existing atomic task/sync-queue transaction. PocketBase maps it to
`saved_at`; both fresh and upgrade migration sets have an additive migration that
skips a missing collection on fresh boot. The setup script includes the field.
MCP round trips preserve the marker, active read/analytics tools exclude Saved,
and completion requires returning to the matrix. Internal dependency validation
still uses the full graph.

## Alternatives
Reusing Archive would inherit device-local tombstone/deletion semantics and
read-only historical UI. A fifth quadrant would mix placement with urgency and
importance. A separate notes store would duplicate existing task content and
complicate restoration, sync and backups.

## Rollout
Deploy the backend migration before publishing web assets; the static export
includes /saved and precaches it for offline navigation. Run the local PocketBase
system harness for fresh and existing installations. Do not count a successful
local build as deployment evidence.

Older iOS versions and already-installed older web/MCP clients do not recognize
Saved placement. The updated MCP package must ship with web rollout. Fast-follow
iOS must add the optional marker to local/wire/backup models, retain it in writes,
exclude Saved from matrix, widgets, reminders, badges and active analytics, and
add Saved with short notes and return-to-quadrant/date review. Until then the
feature has no claim of cross-client parity.
