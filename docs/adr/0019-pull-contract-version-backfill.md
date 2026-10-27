# ADR 0019: A pull contract version backfills newly synced fields

Status: accepted 2026-10-27. Paired with the iOS change on the same branch name
(`gsd-iosapp/docs/2026-10-27-synced-field-backfill.md`).

## Context
Saved placement (ADR 0018) added `saved_at` to the wire record. The web shipped it
first, then iOS. On October 27 the server held five saved records, all written by
Apple devices, and the web showed every one of them. An iPhone showed only the
items it had saved itself.

Two gaps caused that, and both clients had them. The pull cursor never rewinds on
an upgrade, so a record the previous build already consumed (and stored without
the field it did not know) is never requested again. And an equal timestamp is a
no-op: both clients apply a remote record only when it is strictly newer than the
local row, and the old build stamped the local row with the exact wire
`client_updated_at`. Clearing the cursor alone does not help, and on iOS a nil
cursor also triggers the first-sign-in seed, which would push every local row
with the field still empty and un-save the item everywhere.

## Decision
`SYNC_CONFIG.PULL_CURSOR_VERSION` is the pull contract this build speaks. The
persisted `pullCursorVersion` records which contract wrote the cursor. When the
two differ, or the config carries no version, `resolvePullCursor` returns a null
cursor with `mergeSameVersion`, and that one pull applies records at the local
row's own version through the existing merge, which keeps device-local fields.
The contract is stamped only after a completed pull. Ordinary pulls keep the
strictly-newer rule, realtime is unchanged, and push is unchanged.

The constant moves from 2 to 3 for `saved_at`. A build that is the first to read
a new synced field bumps it, and bumps the iOS `SyncCursor.contractVersion` in
the same change. The legacy 24-hour rewind for a pre-2026-06 `lastSyncAt` config
is gone: any config below the current contract pulls everything once, which is a
superset of the rewind.

## Consequences
Every signed-in web client performs one full pull on its first sync after this
release. With one page of records that is one request and one rewrite of each
row, and the sync history shows it as one pull. A device that upgraded before the
fix needs no manual step. Adding a synced field now has a required second step,
recorded in `.claude/rules/pocketbase-sync.md` and the workspace contracts table.

## Alternatives
Applying same-version records on every pull would also work, but every pull
re-applies the overlap window, which inflates pull counts in the history and
rewrites rows for nothing. Comparing content instead of timestamps was rejected
in ADR 0013 for the same reason it fails here: sync normalizes fields on the
round trip. Editing each stranded item on a current client works as a one-time
workaround, because the edit moves its `client_updated_at`, but it does not
scale past a handful of items.
