# Doc refresh: H2-html, round 5

Status: resolved
Clean round: yes

Rounds 4 and 5 were both clean, so the two FIX files converged.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm:egm-codebase-details | docs/privacy-data-flow.html | ran |
| egm:egm-codebase-details | docs/pipeline-summary.html | ran |

No Blocker or Major from either reviewer.

## Findings

### H2-html-5-1 [codebase-details] Severity: Nit
* Target: pipeline-summary.html, separation paragraph
* Finding: The paragraph cites `docs/agents/night-shift.md` for the maintainer-credentials reason, but that file does not state it. `.claude/commands/triage-prs.md:10-12` does.
* Decision: PROPOSE FIX
* Reason: Confirmed. The citation was my round 3 edit.
* Edit: The second citation now reads `.claude/commands/triage-prs.md`.

### H2-html-5-2 [codebase-details] Severity: Nit
* Target: pipeline-summary.html, night-shift caption and list; "only counts" in four places; Docker card; CloudFront sentence; history passage naming `headRepositoryOwner`
* Finding: A failed `gh pr list` prints `NO_WORK` (`scripts/triage-run.sh:45-50,57-58`); four sentences say "only counts" without the bot-login condition; a push to `main` also publishes a `:sha-` tag and a tag push also checks the version; the CloudFront path filter includes two deploy scripts; `headRepositoryOwner` is not in today's code.
* Decision: DECLINE
* Reason: The banner and caption carry the condition, the workflow files own the trigger detail, and the `headRepositoryOwner` sentence is history. The `NO_WORK` case is listed under possible code defects.
* Edit: none

### H2-html-5-3 [codebase-details] Severity: Nit
* Target: privacy-data-flow.html rows 1, 11, 12, 16 and the local-first bullet
* Finding: Error message text is interpolated into the log prefix with token masking only (`lib/logger.ts:212-223`); "→ api.vinny.io" holds only on gsd.vinny.dev; the import dialog step is omitted; the capture bar holds one text string that `parseCapture` splits; other local writers to `tasks` exist beyond add and put.
* Decision: DECLINE
* Reason: Each row stays true at the page's level of detail, and the footer scopes the host. The logger point is listed under possible code defects.
* Edit: none
