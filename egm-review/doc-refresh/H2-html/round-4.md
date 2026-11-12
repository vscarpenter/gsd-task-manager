# Doc refresh: H2-html, round 4

Status: resolved
Clean round: yes

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm:egm-codebase-details | docs/privacy-data-flow.html | ran |
| egm:egm-codebase-details | docs/pipeline-summary.html | ran |

No Blocker or Major from either reviewer.

## Findings

### H2-html-4-1 [codebase-details] Severity: Nit
* Target: pipeline-summary.html, banner, night-shift list, Gate 2 card
* Finding: The banner says the script counts pull requests without the `GSD_TRIAGE_BOT_LOGIN` condition (`scripts/triage-run.sh:29-32`); "prints its status to the terminal" is stdout, which launchd redirects to a file; the rollback command prints only when an earlier tag exists (`deploy-production-release.yml:103-112`).
* Decision: PROPOSE FIX
* Reason: Confirmed; each is a phrase.
* Edit: Banner adds "when `GSD_TRIAGE_BOT_LOGIN` is set"; "standard output"; "When an earlier release tag exists, the workflow prints the rollback command."

### H2-html-4-2 [codebase-details] Severity: Nit
* Target: pipeline-summary.html, delivery-loop box and heading ("through both gates"); risk-label sentence
* Finding: The loop box and section heading still say two gates in the present tense; an issue filed without the form body gets no risk label (`apply-risk-label.yml:32-36`).
* Decision: DECLINE
* Reason: The caption under the delivery diagram says Gate 1 does not run, and the heading is the owner's framing (see H2-html-1-32). The label case needs an issue created outside the form.
* Edit: none

### H2-html-4-3 [codebase-details] Severity: Nit
* Target: privacy-data-flow.html, section note; row 21
* Finding: A third request needs neither sync nor MCP: `prepareOAuthLogin` fetches auth methods on hover or focus of the sign-in buttons (`components/sync/oauth-buttons.tsx:178`, `lib/sync/pb-auth.ts:59-79`). Row 21 omits the word "external" before the three origins.
* Decision: DECLINE
* Reason: The hover request carries no task data and sits with the flow-coverage question already escalated (H2-html-1-14, 2-11). Row 21 is read with the footnote and the claim bullet, which both say "external".
* Edit: none

### H2-html-4-4 [codebase-details] Severity: Nit (outside the batch)
* Target: `.github/ISSUE_TEMPLATE/change_request.yml:57-58`
* Finding: The live issue form still says the risk tier "Drives how deep a plan the builder writes and whether it stops for human approval."
* Decision: ESCALATE
* Reason: Not a batch file. Confirmed by reading the form. Listed in the return summary.
* Edit: none
