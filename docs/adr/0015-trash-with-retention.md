# 0015 — Trash with 30-day retention

| Field | Value |
|---|---|
| Date | 2026-08-12 |
| Status | Accepted |
| Deciders | Vinny Carpenter |
| Supersedes | Extends ADR 0013 from two lifecycle states to three |

## Context

Deleting a task destroyed it. The only recovery was an Undo button on a toast that
lived for five seconds.

That window is not a safety net, it is a coin flip. It closes if the user looks away,
if the tab is switched, if the page reloads, if enough other toasts arrive to push it
out of the stack, or simply if they are slow. Nothing about the guarantee is written
down anywhere; it exists only as long as a React component happens to be mounted.

The review that prompted this work put it exactly right: deletion was **timing-dependent
rather than structurally safe**. It also reported that a delete during a pending sync
became permanent while the UI still showed Undo. That specific claim could not be
reproduced from the code — the undo closure captures the whole record and was hardened
in `438d811` — but the diagnosis underneath it holds regardless of whether that
particular sequence occurs. A recovery path that depends on a toast still being on
screen is not a recovery path.

The app already had the answer in front of it. `archivedTasks` has been a durable
holding area for completed work since ADR 0013, with its own store, its own restore
path, and its own retention policy. Deletion needed the same shape.

## Decision

**Deleting a task moves it to a `deletedTasks` store, where it stays for 30 days.**

### The store

A new Dexie table (schema v16) holding a full `TaskRecord` plus `deletedAt`. Mirrors
`archivedTasks` deliberately: same shape, same restore semantics, same "never synced"
rule, so there is one pattern to understand rather than two.

### The invariant, now three-state

ADR 0013 said an id lives in `tasks` or `archivedTasks`, never both. That becomes:

> **An id lives in exactly one of `tasks`, `archivedTasks`, or `deletedTasks`.**

Every move between them runs in a single Dexie transaction scoped to all tables
involved, plus `syncQueue` when it enqueues. The four original rules carry over
unchanged; `deletedTasks` is simply a third seat at the same table.

`deletedTasks` suppresses re-creation from a remote source for the same reason
`archivedTasks` does: a second device holding a stale copy must not push the task
back. And for the same reason, the suppression is **conditional** — a remote edit
newer than `deletedAt` means someone deliberately worked on that task after this
device deleted it, and their edit wins.

### Retention

Rows older than 30 days are purged on app start, alongside the existing auto-archive
sweep. Retention is deliberately not configurable: a second knob next to the archive's
30/60/90 setting would imply the two are the same kind of decision. Archiving is a
workflow preference. Trash retention is a safety floor.

### What deletion still does to sync

The remote copy is deleted, exactly as before. Trash is local to the device that did
the deleting. Restoring re-enqueues a create.

This is the same choice the archive made, and it has the same consequence: emptying
trash on one device does not empty it on another. That is acceptable — trash is a
per-device undo buffer, not shared state — but it is a real limitation and is recorded
here rather than discovered later.

### Permanent deletion

Still exists, in two forms: "Delete forever" on a single item, and "Empty trash".
Both are genuinely irreversible and are labelled that way. The 30-day sweep is the
third form, and the only one that happens without the user asking.

## Consequences

**Easier.** Deletion stops being a moment of risk. The Undo toast still works and is
still the fastest path, but it is now a convenience over a durable store rather than
the only thing standing between the user and permanent loss. The unreproducible
sync-toast claim becomes moot: even if the toast is preempted, the task is in trash.

**Harder.** A third store means a third place a task can be, and every future writer to
any of the three has to respect a three-way invariant instead of a two-way one. This is
the main cost, and it is why the rule file is updated in the same change rather than
afterwards.

Storage grows. A user who deletes heavily now carries up to 30 days of deleted tasks.
The Settings storage figure counts them, so the cost is visible rather than mysterious.

**Backup.** `deletedTasks` joins the envelope as another optional key — additive,
exactly as ADR 0014 anticipated when it sequenced this work second. A restored backup
brings the trash back with its original `deletedAt`, so the retention clock resumes
where it left off instead of restarting.

**Out of scope.** Cross-device trash, configurable retention, and undo for "Empty
trash" (a confirmation guards it instead — an undo for an explicit permanent-delete
action is a contradiction).

## Alternatives considered

**A `deletedAt` flag on `tasks`.** No migration of records between tables, and restore
is a field update. Rejected: every query in the app would need `where deletedAt is
null`, and the first one that forgot would leak deleted tasks into the matrix, a smart
view, or the export. The separate table makes the default safe — code that does not
know about trash cannot accidentally see it.

**Keeping the toast and lengthening it to 30 seconds.** Cheapest possible change.
Rejected: it moves the coin flip without removing it, and a 30-second toast is its own
kind of annoying.

**Deleting straight to `archivedTasks`.** One fewer store, and the archive already has
a restore path. Rejected: it conflates two different user intentions. "I finished this"
and "I want this gone" mean opposite things, and merging them would make the archive —
which users browse — fill up with noise they deliberately discarded.

**No retention, keep deleted tasks forever.** Simplest rule, and the safest against data
loss. Rejected: an unbounded store on a device with no server backing it is a leak, and
"deleted" that never deletes is dishonest.
