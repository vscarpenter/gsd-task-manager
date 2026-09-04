# Spec — Anonymous Opt-In Feedback

**Date:** 2026-08-27
**Status:** Approved → implementing
**Author:** Vinny (with Claude)

## Goal

Give users a way to tell Vinny what they think of GSD and what they want built next,
without weakening the local-first privacy guarantee that makes people choose the app.

The mechanism is **captured locally, sent only on an explicit tap, and anonymous with
no identifier of any kind**. Nothing reaches the network until the user presses Send,
and before they do they can see the exact payload that will leave their device.

## Inputs / Outputs

**Inputs**

- Roadmap poll: the user toggles a thumbs-up on any of a fixed list of candidate features.
- Sentiment: one optional thumbs-up / thumbs-down on the app overall.
- Category: one optional label — `idea`, `praise`, `gripe`, or `bug`.
- Message: one optional free-text note, capped at 1000 characters.

**Outputs**

- While drafting: every input persists to `localStorage` only. Zero network activity.
- On Send: exactly one `POST` to `https://api.vinny.io/api/collections/feedback/records`
  carrying the payload below and nothing else.
- After Send: the local draft clears, and the section shows when feedback was last sent.

**Payload (the complete set of fields that leave the device)**

| Field | Type | Notes |
|---|---|---|
| `submission_id` | string | Fresh nanoid per submission. Idempotency only; never persisted, so it links nothing across submissions. |
| `sentiment` | `"up" \| "down" \| ""` | Optional. |
| `category` | `"idea" \| "praise" \| "gripe" \| "bug" \| ""` | Optional. |
| `message` | string, ≤1000 chars | Optional. |
| `votes` | string[] | Roadmap slugs, ≤`ROADMAP_ITEMS.length`, each a known slug. |
| `app_version` | string, ≤20 chars | From the build-time version constant. |
| `client_submitted_at` | ISO 8601 string | Untrusted client clock for context only; never used for retention or abuse controls. |

## Constraints

- **No identifier, ever.** No `deviceId`, no PocketBase user id, no email, no IP-derived
  value, no fingerprint. Signed-in sync users and anonymous users are indistinguishable
  in the collection. The existing `syncMetadata.deviceId` (`lib/db-migrations.ts:75`) must
  never be read by this feature — reusing it would make feedback joinable against sync
  traffic and sync history.
- **No task content.** No title, tag, subtask, note, due date, count, or derived statistic
  from the user's tasks may appear in the payload.
- **No auth token.** The submit path uses bare `fetch`, not the PocketBase SDK client,
  whose auth store attaches tokens automatically.
- **Server abuse controls are fail-closed.** Collection setup first sets
  `createRule` to null, verifies the checked-in PocketBase hook, installs one
  all-audience `feedback:create` rule capped at 30 creates per 60 seconds,
  enforces a transactional 10,000-record aggregate quota, and only then enables
  anonymous creation. Missing or drifted controls reject every create.
- **Server retention is authoritative.** A daily hook deletes feedback older than
  180 days using PocketBase's server-controlled `created` value. The client timestamp
  cannot extend retention. Request logs retain at most one day and record neither
  IP nor authenticated-record ID.
- **No new CSP origin.** `https://api.vinny.io` is already in `connect-src`
  (`cloudfront/response-headers-policy.json:19`); that string must not change.
- **No Dexie migration.** Local state lives in `localStorage` under `gsd:feedback:*`,
  following the `lib/preferences/` pattern. The DB stays at version 15.
- **No nagging.** No modal, no interstitial, no toast asking for feedback, no badge.
  The only surfaces are a permanent Settings section and a command-palette entry.
- **Offline-safe.** Drafting works offline. A failed send leaves the draft intact and
  surfaces a retryable error; it never silently discards the user's writing.
- WCAG 2.1 AA, per `coding-standards.md` Part 2.

## Edge Cases

- **Send pressed with an empty draft** — button is disabled; nothing is sent.
- **Send pressed twice / retried after a timeout** — the same `submission_id` is reused
  for the retry, so PocketBase's unique index collapses the duplicate.
- **Offline send** — `fetch` rejects; the draft is preserved and an inline error offers
  a retry. No queueing into the sync engine (that path is for tasks and is authenticated).
- **Rate-limited (429) or rejected (400)** — inline error, draft preserved, no console noise
  beyond the existing logger.
- **Message at exactly 1000 characters** — accepted. 1001 is refused client-side before
  the request is built, and refused again by the collection's schema.
- **Voting twice on the same feature** — the toggle is idempotent; the local store holds a
  set, so a slug cannot appear twice in `votes`.
- **A stored vote for a slug that no longer ships** — filtered out when the payload is built,
  so removing a roadmap item cannot produce an unknown slug on the server.
- **`localStorage` unavailable or full** (private browsing, quota) — the section still renders
  and still sends; only draft persistence is lost. Reads and writes are wrapped, never thrown.
- **A user who sends, then immediately drafts again** — allowed. Repeat submissions are
  separate records; there is no identifier with which to deduplicate them, by design.

## Out of Scope

- The "earned moment" inline prompt after N completed tasks. Independently shippable,
  and the piece most likely to read as naggy — it gets its own review.
  **Shipped separately 2026-09-02** as one dismissible sentence under the Review page's
  stat rail (`components/dashboard/feedback-nudge.tsx`), gated by
  `lib/feedback/nudge-eligibility.ts`: tenure ≥14 days, ≥10 completions over ≥3 days,
  quiet for 90 days after a send and 180 after "Not now". Still no modal, toast, or badge.
- The public privacy-policy page at `gsdtaskmanager.com/privacy` (different repo).
- Any read path from the `feedback` collection into the app. Vote totals are not shown
  back to users; the collection is write-only from the client's perspective.
- Fetching roadmap candidates from the server. The list is a hardcoded constant.
- Moderation tooling, email replies, or a feedback inbox UI. Reading happens in the
  PocketBase admin UI at `/_/`.
- Sentry changes. Bug reports here are a user-authored category, not a crash pipeline.

## Roadmap Candidates (initial list — Vinny to curate)

Seeded from gaps confirmed against the codebase, not guesses. Editing this list is a
one-line change to `lib/feedback/roadmap-items.ts`.

| Slug | Label |
|---|---|
| `natural-language-dates` | Natural-language due dates in the capture bar |
| `calendar-sync` | Two-way calendar sync |
| `task-templates` | Reusable task templates |
| `weekly-review` | A guided weekly review |
| `focus-timer` | Focus timer for a single task |
| `task-notes` | Longer notes and attachments on a task |
| `ios-widgets` | iOS home-screen widgets |
| `shared-lists` | Share one list with one other person |

`natural-language-dates` is a real gap: `lib/capture-parser.ts` parses tags and the
urgent/important flags, but no dates.

## Acceptance Criteria

1. A user can open Settings → Feedback, vote on roadmap items, pick a sentiment and
   category, write a note, and send — in one pass, with no account and no sign-in.
2. Before sending, a disclosure shows the exact payload. The preview is rendered from the
   same `buildPayload()` output that is serialized into the request body, so it cannot drift.
3. `buildPayload()` output contains no task content and no identifier, proven by a test that
   runs it against a populated task database and a fully-filled draft.
4. Drafting produces zero network requests; exactly one request is made, on Send.
5. A failed send preserves the draft and shows a retryable inline error.
6. Voting is one-per-feature per device, enforced by the local store.
7. The command palette exposes "Send feedback" and routes to the Settings section.
8. `components/about/privacy-section.tsx` acknowledges that opt-in feedback exists.
9. The `feedback` collection accepts anonymous creates only after the setup script
   verifies the hook, 30-per-60-second rate rule, aggregate quota, retention, and
   private-log policy. It refuses list, view, update, and delete for every
   non-superuser caller.
10. `connect-src` in `cloudfront/response-headers-policy.json` is unchanged.
11. `bun run test`, `bun typecheck`, `bun lint`, and `bun run quality:shape` all pass.
12. The pinned PocketBase system test runs the real setup and proves an anonymous
    create succeeds while anonymous list and duplicate submission attempts fail.

## Test Stubs

**`tests/data/feedback-payload.test.ts`** — the load-bearing privacy test

- `buildPayload` omits every task field when the DB is populated
- `buildPayload` contains no `deviceId`, no user id, no token, no URL
- `buildPayload` drops vote slugs that are not in `ROADMAP_ITEMS`
- `buildPayload` refuses a message over 1000 characters
- payload parses against the outgoing Zod schema and has no extra keys

**`tests/data/feedback-store.test.ts`**

- vote toggle is idempotent; a slug never appears twice
- draft survives a read-after-write round trip
- a throwing `localStorage` degrades to in-memory rather than crashing
- (per `.claude/rules/testing.md`, remove `gsd:feedback:*` keys individually in
  `beforeEach` — `localStorage.clear()` no-ops under jsdom-in-Bun)

**`tests/data/submit-feedback.test.ts`**

- issues exactly one `fetch` to the feedback records path
- sends no `Authorization` header
- reuses `submission_id` across a retry of the same draft
- surfaces a typed error on 429 and on network failure

**`tests/ui/feedback-section.test.tsx`**

- Send is disabled with an empty draft, enabled once anything is set
- the preview text equals `JSON.stringify(buildPayload(...))`
- a failed send keeps the message text in the textarea
- roadmap items are keyboard-reachable and expose pressed state

**`tests/e2e/feedback.spec.ts`**

- Settings → Feedback → vote → send, with the POST stubbed; asserts one request
