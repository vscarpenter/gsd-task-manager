# Doc refresh: H2-html, round 3

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm:egm-codebase-details | docs/privacy-data-flow.html | ran |
| egm:egm-codebase-details | docs/pipeline-summary.html | ran |

No style reviewer (rounds 1 and 2 only). The banner file finished its NOTE loop in round 2.

## Findings

### H2-html-3-1 [codebase-details] Severity: Major
* Target: pipeline-summary.html, night-shift caption
* Finding: "Only the first box runs today, and only when `GSD_TRIAGE_BOT_LOGIN` is set" leaves out that the shipped schedule never sets it. `scripts/launchd/dev.vinny.gsd-night-shift.plist` has no `EnvironmentVariables` key, and `scripts/triage-run.sh:29-32` exits when the variable is empty.
* Decision: PROPOSE FIX
* Reason: Confirmed with `rg` on the plist (the variable appears only in a comment) and in the script.
* Edit: One sentence added to the caption.

### H2-html-3-2 [codebase-details] Severity: Major
* Target: pipeline-summary.html, Gate 2 card
* Finding: "The rule is absolute: no rollback path, no approval" reads as enforced. With no earlier tag the evidence job prints "Previous prod: none found" and continues (`deploy-production-release.yml:103-112`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Round 2 recorded this as a Nit and declined it; this reviewer rated it Major.
* Edit: "The reviewer's rule is absolute ... The workflow prints the rollback command and leaves that rule to you."

### H2-html-3-3 [codebase-details] Severity: Nit
* Target: pipeline-summary.html N1-N8
* Finding: `triage:paused` fails open on a lookup error; one sentence lists three of five candidate conditions; the audit job gates every channel; `claude.yml` answers mentions; the retirement citation names only `builder.md`; label creation still exists; key-component paths are abbreviated; two telemetry scripts remain uncalled.
* Decision: PROPOSE FIX for the citation; DECLINE the rest
* Reason: The citation fix is one phrase. The others are true as written or are detail that `docs/agents/night-shift.md` and the workflows own.
* Edit: The separation paragraph now cites both `builder.md` and `night-shift.md`.

### H2-html-3-4 [codebase-details] Severity: Major
* Target: privacy-data-flow.html, logger row
* Finding: "the 6 `console.*` sites" misses two in the service worker: `public/sw.js:96` and `public/sw.js:347`. Both bypass the logger.
* Decision: PROPOSE FIX
* Reason: Confirmed with `rg`. Line 347 prints a raw error object, listed under possible code defects.
* Edit: Row 12 scopes the count to `lib/` and names the two service-worker sites.

### H2-html-3-5 [codebase-details] Severity: Nit
* Target: privacy-data-flow.html, feedback wording and subtask row
* Finding: "sends only what the user types" contradicts row 22, which lists a submission id, app version, and timestamp; only `addSubtask` validates (`lib/tasks/subtasks.ts:35`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Section note and SVG desc now say "the user's message and no task data"; row 5 says "validate a new subtask".

### H2-html-3-6 [codebase-details] Severity: Nit
* Target: privacy-data-flow.html rows 7, 10, 11, 17, 24, 26
* Finding: `useTasks` filters rows; four pinned link labels name a file the code has since left; "over HTTPS" is not enforced in the read path.
* Decision: DECLINE
* Reason: The lede says pinned links can show older code. Repointing each label would end the pinned-evidence design, which is the owner's call.
* Edit: none
