# Doc refresh: D3-design-records, round 2

Status: resolved
Clean round: yes

Two fresh reviewers checked only the 10 status notes written in round 1. Neither raised a Blocker or Major, so the loop stops here. The Stagehand record has no note and was not reviewed again.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details E | notes in close-analysis, mcp-sentry, native-ios-app, server-side-encryption, the-contract | ran |
| egm-codebase-details F | notes in builder-gate1, night-shift, review-gate2, telemetry, tokens-per-pr | ran |

## Findings

### D3-design-records-2-1 [codebase-details E] Severity: Nit
* Target: 2026-05-25-close-analysis-open-items-design.md line 3
* Finding: the note says the listener does not log, but not that it also lacks `event.preventDefault()` (`components/global-error-listener.tsx:12-18`).
* Decision: DECLINE
* Reason: The note already says the listener only shows the toast. More detail would exceed the note's size.
* Edit: none

### D3-design-records-2-2 [codebase-details E] Severity: Nit
* Target: 2026-05-29-mcp-server-sentry-coverage-design.md line 3
* Finding: a stale local build still holds `packages/mcp-server/dist/utils/sentry.js`. `dist` is git-ignored.
* Decision: DECLINE
* Reason: The note names the source path, which is gone. Local build output is not part of the repo.
* Edit: none

### D3-design-records-2-3 [codebase-details E] Severity: Nit
* Target: 2026-05-30-native-ios-app-design.md line 3
* Finding: "added a pull contract version" reads as if no version existed before ADR 0019. ADR 0019 line 32 moves the constant from 2 to 3.
* Decision: PROPOSE FIX
* Reason: Confirmed in `lib/constants/sync.ts:60-64`, whose comment lists contract 2.
* Edit: the sentence now reads "and it now versions the pull contract (ADRs 0018, 0019, and 0020)".

### D3-design-records-2-4 [codebase-details F] Severity: Nit
* Target: 2026-07-08-night-shift-design.md line 3
* Finding: the note omits the `triage:paused` check and two of the five candidate conditions (`scripts/triage-run.sh:34-43`, `scripts/failing-agent-prs.cjs:27-28`).
* Decision: DECLINE
* Reason: The note sends the reader to `docs/agents/night-shift.md`, which lists all of them.
* Edit: none

### D3-design-records-2-5 [codebase-details F] Severity: Nit
* Target: 2026-07-08-review-gate2-design.md line 3
* Finding: "The rollback command below" could mean the design's own rollback section.
* Decision: PROPOSE FIX
* Reason: The record holds both a deploy rollback command and a "Rollback (of this change)" section.
* Edit: the note now names the `gh workflow run deploy-prod.yml` command.

### D3-design-records-2-6 [codebase-details F] Severity: Nit
* Target: same note
* Finding: the note does not say `scripts/prev-release-tag.cjs` remains with no caller but its test.
* Decision: DECLINE
* Reason: The note is at five sentences and already says the workflow computes the tag in shell.
* Edit: none
