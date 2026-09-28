# 0017: Remove Sentry error telemetry

| Field | Value |
|---|---|
| Date | 2026-09-28 |
| Status | Accepted |
| Deciders | Vinny Carpenter |
| Related | ADR 0001 (client-side only IndexedDB), `SECURITY.md` |

## Context

The web app shipped `@sentry/browser`, and the MCP server shipped
`@sentry/node`. Both were opt-in: the browser SDK only initialised when
`NEXT_PUBLIC_SENTRY_DSN` was set at build time, and the server only when the
user exported `GSD_SENTRY_DSN`.

Keeping that path safe cost more than it returned. `lib/sentry.ts` grew to
roughly 550 lines of `beforeSend` sanitisation, a metadata allowlist, and
route and error-type vocabularies, and it was the largest single entry in the
code-shape debt ledger. Two privacy audits flagged the capture path in
`lib/error-logger.ts` as safe only by caller discipline. The CSP had to carry
a `*.ingest.us.sentry.io` origin that every privacy-minded reader of
`SECURITY.md` had to be talked through. The product promise is that task data
never leaves the device unless the user turns on sync, and a third-party
telemetry origin in the policy undercut that promise even when it was idle.

## Decision

**Remove Sentry from both packages and ship no error-reporting SDK.**

Runtime errors are logged to the browser console (web) or to stderr as
structured JSON (MCP server). The existing secret masking in `lib/logger.ts`
stays, because console output can still end up in a bug report. The CSP
`connect-src` names only the sync backend and the OAuth providers.

## Consequences

Easier: the privacy story is one sentence, the CSP has no telemetry origin,
and the code-shape ledger loses its largest file. First-load JavaScript drops
by the size of the browser SDK.

Harder: there is no aggregate view of production errors. Diagnosis relies on
user bug reports with console output, and the in-app feedback form.

Out of scope: any replacement telemetry. If aggregate error visibility is
wanted later, it should be self-hosted and reasoned about in a new ADR.

## Alternatives

- **Keep Sentry opt-in and leave the DSN empty.** Rejected: the SDK still
  shipped in every bundle, the CSP still named the origin, and the
  sanitisation code still had to be maintained and audited.
- **Replace with a self-hosted collector.** Rejected for now: no evidence yet
  that the error volume justifies running one.
