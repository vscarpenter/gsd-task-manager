# ADR 0020: Pull contract 4 carries top three without clearing anyone's pick

Status: accepted 2026-11-07 (sprint 2, WEB-C4). Spec: `tasks/spec-top-three.md` section 6
(C4-1 to C4-8) and section 7. Builds on ADR 0019. iOS and Android ship their own contract 4
in IOS-C4 and AND-C4.

## Context
Top three adds two synced fields, `focus_date` and `focus_rank`. ADR 0019's backfill, one
full pull with a same-version merge, was enough to bring `saved_at` to rows an older build
stored without it. It wasn't enough to keep the field safe on the way back out. The `saved_at`
exposure (owner item 7, `sprint/findings/saved-at-exposure.md`) showed three ways an upgraded
web build cleared another device's value:

- `fullSync` pushed before it pulled, so a queued edit went out before the backfill ran.
- A local row newer than the server skipped the backfill, and its push sent the field empty.
- Sign-in wrote a literal contract `2`, and sign-out stamped the current one without a pull.

A pick has the same shape as a Save, so contract 4 had to close all three first. WEB-SAVED
closed them at contract 3, and this change carries the same rules to the focus pair.

## Decision
`SYNC_CONFIG.PULL_CURSOR_VERSION` moves to 4. A device owes a backfill when its stored
version is missing or below that, and only a completed pull stamps one. Sign-in and sign-out
keep whatever is stored (C4-1, C4-3).

This narrows ADR 0019, which backfilled whenever the stored version differed from the
build's. A version above the build's means a newer build stamped it, for example a newer
tab beside an older cached bundle. Its rows already hold every field this build reads, so a
backfill there only costs a full listing on every sync. The write side doesn't change: a
completed pull stamps this build's own version, never the highest one seen. When an older
bundle rewrites rows without a newer field, its lower stamp is what makes the newer tab
backfill and repair them.

While a backfill is owed, `fullSync` pulls, then pushes. A pull that fails or comes back
unauthenticated pushes nothing and stamps nothing (C4-2). On that pull, a remote stamped past
the skew ceiling doesn't overwrite a row whose write is still queued, which matches iOS and
Android (S-SPEC-01).

When the local copy wins the backfill, it keeps its version and takes only the fields its
build never read (C4-4). Top three's `unreadFieldsToCopy` decides: the focus pair when the
stored version is below `FOCUS_CONTRACT_VERSION` (4), and `saved_at` when it's below
`SAVED_AT_CONTRACT_VERSION` (3). The engine drops the `saved_at` half when the row is
completed or timing, because a newer completion outranks an older Save. Nothing is queued.

Push reads `saved_at` and the focus pair from the row as it is now, not the queued payload.
A row that's gone sends none of those keys, so the server keeps its values (C4-6). On the
wire an unset pair is `""` and `0`, and an invalid pair becomes neither field without
rejecting the record. The backup envelope moves to 2.2.0 with the same pair on live,
archived, and trashed rows.

## Consequences
Every signed-in web client pulls everything once on its first sync after this release, as
ADR 0019 described. That sync also pushes after it pulls, so its own writes come back in the
next pull's overlap window. Older builds can't clear a pick, because they don't send the keys
and PocketBase keeps a stored value when a key is left out (C4-8). Hosted needs both fields
before any client or MCP release reads them, which is a release gate in the sprint's merge
order.

The MCP mapper reads and writes the pair too, because `pb-record-shape.json` pins both mappers
against one key list. Two edges are accepted in the spec. A device with no stored version
treats a null `savedAt` as unread, so a Return that never pushed comes back Saved. And a pick
then un-pick on this device before the first sync finishes can come back picked.

## Alternatives
A per-row "read" flag for each new field would also tell "never read" from "read and empty".
It needs a Dexie migration and a flag per field, and the stored contract version already
carries that fact for every row at once. Withholding a field from the push while a backfill
is owed, without copying it in, keeps the server safe but leaves this device showing the task
unpicked. Its next ordinary edit would then clear the pick. Pushing first and pulling second
with a same-version merge alone is ADR 0019's design, and the `saved_at` exposure is the
evidence against it.
