# Feedback

## Overview

This package backs the anonymous, opt-in feedback form. It builds the outgoing payload, keeps the unsent draft in `localStorage`, decides when the Review page may invite feedback, and makes the one network call.

`feedback-payload.ts` is the single place that decides what leaves the device.

## Interface

- `feedback-payload.ts:MAX_MESSAGE_LENGTH`. The message limit, 1000.
- `feedback-payload.ts:SENTIMENTS` and `feedback-payload.ts:CATEGORIES`. `["up", "down"]` and `["idea", "praise", "gripe", "bug"]`.
- `feedback-payload.ts:Sentiment`, `feedback-payload.ts:Category`. Union types of those values.
- `feedback-payload.ts:FeedbackDraft`. Interface with `sentiment`, `category`, `message`, and `votes`.
- `feedback-payload.ts:PAYLOAD_FIELDS`. The seven payload keys.
- `feedback-payload.ts:feedbackPayloadSchema`. Strict Zod schema for the payload.
- `feedback-payload.ts:FeedbackPayload`, `feedback-payload.ts:BuildPayloadOptions`. Payload type and the injected `submissionId`, `appVersion`, `submittedAt`.
- `feedback-payload.ts:emptyDraft(): FeedbackDraft`. Returns a blank draft.
- `feedback-payload.ts:isDraftEmpty(draft): boolean`. True when there is nothing worth sending.
- `feedback-payload.ts:buildPayload(draft, options): FeedbackPayload`. Builds and validates the outgoing payload.
- `feedback-store.ts:FEEDBACK_DRAFT_KEY`, `feedback-store.ts:FEEDBACK_LAST_SENT_KEY`, `feedback-store.ts:FEEDBACK_NUDGE_DISMISSED_KEY`. Storage keys `"gsd:feedback:draft"`, `"gsd:feedback:last-sent"`, and `"gsd:feedback:nudge-dismissed"`.
- `feedback-store.ts:readDraft()`, `feedback-store.ts:writeDraft(draft)`, `feedback-store.ts:clearDraft()`. Read, write, and clear the stored draft.
- `feedback-store.ts:toggleVote(draft, slug): FeedbackDraft`. Adds or removes a vote and returns a new draft.
- `feedback-store.ts:readLastSentAt()`, `feedback-store.ts:writeLastSentAt(isoTimestamp)`. Read and write the last send time.
- `feedback-store.ts:readNudgeDismissedAt()`, `feedback-store.ts:writeNudgeDismissedAt(isoTimestamp)`. Read and write the last "Not now" time.
- `feedback-store.ts:FeedbackState`. Snapshot interface with `draft`, `lastSentAt`, `nudgeDismissedAt`, `submissionId`, and `builtAt`.
- `feedback-store.ts:subscribeToFeedback(listener)`, `feedback-store.ts:getFeedbackSnapshot()`, `feedback-store.ts:getServerFeedbackSnapshot()`. The three parts of a `useSyncExternalStore` store.
- `feedback-store.ts:updateDraft(draft)`. Persists a draft edit and notifies subscribers.
- `feedback-store.ts:recordNudgeDismissed(dismissedAt)`. Records a "Not now" and notifies subscribers.
- `feedback-store.ts:recordSend(sentAt)`. Records a successful send, clears the draft, and mints a new submission id.
- `feedback-store.ts:resetFeedbackState()`. Clears every stored and in-memory value.
- `nudge-eligibility.ts:NUDGE_THRESHOLDS`. Thresholds and cooldowns for the invitation.
- `nudge-eligibility.ts:EngagementSummary`, `nudge-eligibility.ts:NudgeDecisionInput`. Input interfaces.
- `nudge-eligibility.ts:summarizeEngagement(tasks, now): EngagementSummary`. Derives tenure days, completions, and completion days from tasks.
- `nudge-eligibility.ts:shouldShowFeedbackNudge(input): boolean`. Decides whether to show the invitation.
- `roadmap-items.ts:RoadmapItem`. Interface with `slug`, `label`, and `description`.
- `roadmap-items.ts:ROADMAP_ITEMS`. The seven features users can vote for.
- `roadmap-items.ts:isRoadmapSlug(slug): boolean`. True when this build ships the slug.
- `submit-feedback.ts:submitFeedback(payload): Promise<SubmitOutcome>`. Posts the payload to PocketBase.
- `submit-feedback.ts:SubmitOutcome`, `submit-feedback.ts:SubmitFailureReason`. Result types. Reasons are `"offline"`, `"rate-limited"`, `"rejected"`, and `"server"`.

## Invariants

- `feedback-payload.ts:PAYLOAD_FIELDS` lists exactly seven keys: `submission_id`, `sentiment`, `category`, `message`, `votes`, `app_version`, `client_submitted_at`. A test pins the list, so a new field fails instead of leaking.
- `feedback-payload.ts:feedbackPayloadSchema` is `.strict()`. `submission_id` is 1 to 64 characters, `message` is at most 1000, `app_version` is at most 20, and `votes` is at most `ROADMAP_ITEMS.length`.
- `feedback-payload.ts:buildPayload` is pure. The preview shown before Send is the same object that goes into the request body.
- `feedback-payload.ts` reads no task database, sync config, or auth store. `tests/data/feedback-payload.test.ts` asserts this.
- `feedback-payload.ts:buildPayload` drops duplicate votes and votes for slugs this build does not ship. It throws when the result fails the schema.
- `roadmap-items.ts:RoadmapItem.slug` is a stable identifier. Never reuse a retired slug.
- `roadmap-items.ts:ROADMAP_ITEMS` is a hardcoded constant, so the Settings page makes no network read and works offline.
- `feedback-store.ts:coerceDraft` rebuilds a stored draft field by field and clamps the message to `MAX_MESSAGE_LENGTH`. An unclamped message would crash the section on every reload.
- `feedback-store.ts:readDraft` uses the in-memory copy only after a write failed. Clearing site data must not bring back a discarded draft.
- `feedback-store.ts:getFeedbackSnapshot` caches its result, because `useSyncExternalStore` compares by reference. `updateDraft`, `recordNudgeDismissed`, `recordSend`, `clearDraft`, and `resetFeedbackState` clear the cache and notify. `writeDraft`, `writeLastSentAt`, and `writeNudgeDismissedAt` write storage and do neither.
- `feedback-store.ts:getServerFeedbackSnapshot` returns a frozen empty state, so the first client render matches the prerendered page.
- `feedback-store.ts:FeedbackState.submissionId` is minted once per submission, reused by a retry, and replaced after a success.
- `submit-feedback.ts:submitFeedback` uses bare `fetch`, not the PocketBase SDK, and sets `credentials: "omit"`. The SDK would attach an auth token.
- `submit-feedback.ts:submitFeedback` never throws. Every failure returns a reason.
- `submit-feedback.ts:isDuplicateSubmission` treats a 400 with `submission_id.code === "validation_not_unique"` as success. The earlier request already landed.
- `submit-feedback.ts:submitFeedback` logs only the status code. What the user wrote must never appear in a log line.
- `nudge-eligibility.ts:shouldShowFeedbackNudge` requires 14 tenure days, 10 completions, and 3 distinct completion days. It stays quiet for 90 days after a send, 180 days after a dismissal, and while a draft exists.
- `nudge-eligibility.ts:withinCooldown` treats a missing or unparseable timestamp as an event that never happened.

## Side Effects

- `feedback-store.ts` reads and writes three `localStorage` keys. Each access is wrapped and falls back to a module-level value when storage throws.
- `feedback-store.ts:subscribeToFeedback` adds a `storage` listener on `window` for the first subscriber and removes it after the last.
- `feedback-store.ts:getFeedbackSnapshot` and `feedback-store.ts:recordSend` call `generateId()` from `lib/id-generator.ts`.
- `submit-feedback.ts:submitFeedback` sends `POST {ENV_CONFIG.pocketBaseUrl}/api/collections/feedback/records` with a JSON body and no credentials.
- `submit-feedback.ts:submitFeedback` logs warnings through the `FEEDBACK` logger.
- `feedback-payload.ts`, `nudge-eligibility.ts`, and `roadmap-items.ts`: None.

## Verification

- Run: `bun run test`
