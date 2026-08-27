# Implementation notes — anonymous feedback

## Deviation: no honeypot field

`tasks/spec-anonymous-feedback.md` lists "a honeypot field rejected by the
collection rule" under abuse controls. It is not implemented, and the field does
not exist in `scripts/setup-pocketbase-feedback-collection.sh`.

A honeypot works by putting a decoy input in the rendered form that a human
never sees and a form-scraping bot fills in. This endpoint is a JSON API, and
anything abusing it will POST to `/api/collections/feedback/records` directly,
never touching the DOM. The decoy would cost a schema field and a rule
expression while deterring nothing in the actual threat model.

What is protecting the endpoint instead: PocketBase rate limiting on the create
route (a manual step the setup script prints), server-side field maxes mirroring
the client's, and the unique `submission_id` index that collapses replays of the
same request.

Vinny's call on whether to revisit. Not contract drift — inputs, outputs, and
acceptance criteria are unchanged.

## `client_submitted_at` is the last-edit time, not the button-press time

The payload is built from state so that the disclosure and the request body are
the same object, which means the timestamp is set when the draft last changed
rather than when Send is pressed. For a form people send moments after typing,
the gap is seconds; the field exists for ordering, since PocketBase's own
`created` cannot be sorted or filtered in this codebase.

Building it at send time instead would have made the preview a description of
the payload rather than the payload itself, which is the one property this
feature is built around.

## `NEXT_PUBLIC_BUILD_NUMBER` falls back to "unknown"

`components/settings/about-section.tsx:11` falls back to a hardcoded `"6.1.1"`,
which is now nine minor versions stale and would report a fiction. The feedback
payload falls back to `"unknown"` instead. The about-section fallback is
pre-existing and out of scope here, but it is wrong and worth a follow-up.
