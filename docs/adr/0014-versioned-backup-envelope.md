# 0014 — Versioned backup envelope

| Field | Value |
|---|---|
| Date | 2026-08-12 |
| Status | Accepted |
| Deciders | Vinny Carpenter |

## Context

JSON export is the only way data leaves this app. There is no server copy by default,
and the README warns that clearing browser data erases everything. Export *is* the
backup story.

It was exporting one of ten Dexie stores.

`exportTasks()` read `db.tasks` and nothing else. On a live dataset that was 59 of 291
records — the other 232 sat in `archivedTasks` and were absent from every backup any
user had ever taken. Import mirrored the omission: it wrote `db.tasks` inside a
transaction scoped to `[db.tasks, db.syncQueue]`, so restoring a backup silently
discarded the archive.

Four stores of user-authored settings were missing too: `smartViews`,
`notificationSettings`, `archiveSettings`, `appPreferences`.

The failure is quiet in both directions. Nothing warns at export time that most of the
data is being left behind, and nothing warns at import time that the archive is gone. A
user restoring after a browser-data wipe discovers the loss only when they go looking
for something archived.

## Decision

**The backup envelope carries every user-owned store, behind a version field, and the
importer accepts both the old and new shapes.**

### Envelope shape

Top-level keys mirror the Dexie table names, and v2 is a structural *superset* of v1:

```jsonc
{
  "version": "2.0.0",
  "exportedAt": "2026-08-12T22:00:00.000Z",
  "tasks":            [ /* TaskRecord */ ],
  "archivedTasks":    [ /* TaskRecord + archivedAt */ ],
  "smartViews":       [ /* SmartView (custom only) */ ],
  "notificationSettings": { /* singleton */ },
  "archiveSettings":      { /* singleton */ },
  "appPreferences":       { /* singleton */ }
}
```

Because every new key is optional, one parser reads both versions: a v1 payload is
simply a v2 payload with the new keys absent. No branching on `version` is required to
*read* a backup. The field is bumped anyway, so the format can be identified and so a
future change has somewhere to signal from.

### What is in, and what is deliberately out

| Store | Exported | Why |
|---|---|---|
| `tasks` | yes | The user's work |
| `archivedTasks` | yes | Also the user's work; the largest omission |
| `smartViews` | yes | Custom views only — built-ins are computed at read time from `BUILT_IN_SMART_VIEWS`, never persisted |
| `notificationSettings` | yes | User-authored configuration |
| `archiveSettings` | yes | User-authored configuration |
| `appPreferences` | yes | User-authored configuration |
| `syncQueue` | **no** | Pending operations belonging to *this* device |
| `syncMetadata` | **no** | Holds `email`, `userId`, `deviceId`, `provider`, `localTaskOwnerUserId` |
| `deviceInfo` | **no** | Device identity |
| `syncHistory` | **no** | This device's operational log |

Excluding `syncMetadata` is a **privacy requirement, not tidiness**. A backup is a file
users email themselves and drop in cloud storage; it must not carry an account identity
that binds the file to a PocketBase user. Auth tokens are not at risk — the PocketBase
SDK keeps those in `localStorage`, outside IndexedDB entirely — but the account PII is.

Restoring a backup therefore never changes who you are signed in as, which device you
are, or what is queued to sync. It restores your data, not your session.

### Import semantics

Replace and merge answer different questions, so they get different scopes:

| | Replace — *"restore this backup"* | Merge — *"add these to what I have"* |
|---|---|---|
| `tasks` | Cleared and rewritten | Added; colliding ids regenerated, references remapped |
| `archivedTasks` | Cleared and rewritten | Added only when the id is absent from **both** task tables |
| `smartViews` | Cleared and rewritten | Added when the id is absent |
| Settings singletons | Applied when present | **Untouched** |

Settings are a restore-path concern. Someone merging a file is combining task lists, not
adopting another device's notification schedule, so merge leaves local configuration
alone.

### Tombstone compliance

`archivedTasks` is a conditional tombstone (ADR 0013), and import becomes a new writer to
it. Three of the four rules bind here:

- **Rule 1 (one table at a time).** Import runs as a single Dexie transaction across
  `tasks`, `archivedTasks`, `smartViews`, the three settings tables, and `syncQueue`. A
  payload that lists the same id in both `tasks` and `archivedTasks` is self-contradictory;
  the live copy wins, the archived duplicate is dropped, and the count is reported rather
  than swallowed.
- **Rule 3 (idempotent, never regress).** Archived writes use `put`, never `add`, so a
  re-import cannot throw a `ConstraintError` and abort the shared transaction.
- **Rule 4 (a shared id is not proof of resurrection).** Replace-mode import legitimately
  places a live task under a previously archived id. This was already true and is why the
  rule exists; the writer table records it.

`archivedTasks` is never synced, so archived rows enqueue nothing.

## Consequences

**Easier.** Backups are actually backups. A restore after a browser-data wipe returns the
archive and the user's settings, not just the live board. Wave E's trash store slots into
the same envelope additively.

**Harder.** Export now reads six stores instead of one, so it is slower and the file is
larger — on the measured dataset, roughly 5× the records. The Data section is a deliberate
navigation rather than a hot path, so this is an acceptable trade.

A new `archivedTaskRecordSchema` is required. `taskRecordSchema` is `.strict()` and does
not declare `archivedAt`, so validating archived records against it would reject **every
one of them** and silently drop the entire archive from the backup — reproducing the bug
this ADR exists to fix, in a form that looks like it works.

**Out of scope.** Selective restore (choosing which stores to apply), backup encryption,
and any change to what syncs. Old app versions reading a v2 file degrade gracefully: the
import schema strips unknown keys, so they import the tasks and ignore the rest.

## Alternatives considered

**A nested `stores: { … }` map.** Cleaner conceptually, but it makes v1 a different shape
rather than a subset, forcing version branching in the parser and a migration path for
every existing backup file. Rejected: the flat shape buys backward compatibility for free.

**Exporting every table.** Simplest rule to state — "back up the database" — but it puts
account PII and this device's sync cursor into a file users share, and restoring it onto a
second device would corrupt that device's sync state. Rejected on privacy and correctness.

**Leaving export alone and telling users to rely on cloud sync.** Sync is optional, off by
default, and the product's central claim is that it works without a server. A backup story
that requires an account contradicts the premise. Rejected.

**A separate archive-only export.** Two files, two restore steps, and a user who takes one
and not the other. Rejected: the failure mode is the same silent partial backup, just
harder to notice.
