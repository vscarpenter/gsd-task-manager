# Doc refresh: H2-html, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm:egm-codebase-details | docs/privacy-data-flow.html | ran |
| egm:egm-codebase-details | docs/pipeline-summary.html | ran |
| egm:egm-style | both FIX files | ran |
| egm:egm-codebase-details | docs/codebase-analysis-report.html, banner line only | ran |

## Findings: docs/pipeline-summary.html

### H2-html-2-1 [codebase-details] Severity: Major
* Target: Gate 2 card
* Finding: "build provenance the workflow has checked" before approval. The `gh attestation verify` step sits in the `deploy` job, which carries `environment: production` (`deploy-production-release.yml:202-209,236`), so it runs after approval.
* Decision: PROPOSE FIX
* Reason: Confirmed in the workflow. The verify step also precedes the AWS credential step (line 297).
* Edit: The card now says the workflow checks tag, commit, and version and signs the build before the gate, and the deploy job verifies the signature after approval.

### H2-html-2-2 [codebase-details] Severity: Major
* Target: Distribution section
* Finding: A fourth path changes production with no release tag: `deploy-cloudfront-infra.yml` runs on a push to `main` that touches five paths, behind the `cloudfront-infra` Environment (lines 3-15, 52-53).
* Decision: PROPOSE FIX
* Reason: Confirmed in the workflow.
* Edit: "Of these three, only the two channels ..." and one closing sentence naming the workflow.

### H2-html-2-3 [codebase-details] Severity: Major
* Target: banner and key-components rows
* Finding: `.agents/skills/source-command-build-next/SKILL.md` and `.agents/skills/source-command-triage-prs/SKILL.md` still hold the full builder and night-shift procedures, while `.claude/commands/` holds refusal tombstones.
* Decision: ESCALATE
* Reason: Confirmed: both files are tracked and last changed on 2026-07-23. The page's claims about `scripts/builder-run.sh` and `/build-next` are true. The stale skills are a possible code defect, since `docs/agents/builder.md` says the builder must not run. The page should not bless them.
* Edit: none

### H2-html-2-4 [codebase-details] Severity: Nit
* Target: N1, N2, N3, N5, N6, N9 (first item)
* Finding: "comments on each pull request" is not verifiable from the workflow; the triage script prints three lines; `triage:paused` is read only when `GSD_TRIAGE_BOT_LOGIN` is set; Docker Hub is pushed only when its secret is set (`publish-docker.yml:56-63`); tokens per PR cannot be read from GitHub history.
* Decision: PROPOSE FIX
* Reason: Each confirmed and each a one-phrase change.
* Edit: "runs on each pull request" (two places); "prints its status to the terminal"; "when `GSD_TRIAGE_BOT_LOGIN` is set"; "GHCR, plus Docker Hub when its secret is set. Ships with no approval once the security audit job passes"; "Read what you can from".

### H2-html-2-5 [codebase-details] Severity: Nit
* Target: N4, N7, N8, N9 (rest)
* Finding: The candidate list in one sentence omits the branch prefix and failing check that the caption gives; the MCP publish also has a manual dispatch and the deploy a rollback dispatch; "no rollback path, no approval" is reviewer policy; `claude.yml` answers mentions.
* Decision: DECLINE
* Reason: None is wrong as written, and `docs/ops/gate2.md` owns the dispatch and rollback detail.
* Edit: none

### H2-html-2-6 [style] Severity: Major
* Target: lede, banner, Gate 1 card, loop summary, separation prose, kill-switch heading (style 1, 2, 3, 4, 6, 8)
* Finding: "the human gates remain" against a caption that says Gate 1 does not run; the Gate 1 card is present tense with no history marker; "By now the plan was approved" has no referent; "No single actor can move ..." is stated as current; "The maintenance loop keeps the delivery loop unclogged" contradicts the caption above it; "Each loop" promises three kill switches; "enabled" is undefined.
* Decision: PROPOSE FIX
* Reason: Each is an internal contradiction my round 1 edits left or created. All settle with a tense or a named gate.
* Edit: Lede names "the PR gate and Gate 2"; banner adds "Gate 1 went with it"; the Gate 1 card opens "Gate 1 does not run today. This is why the design put it here."; Gate 2 card drops the plan clause; "In the design, no single actor could move ..."; "was built to keep"; "Each agent loop"; the bot-login variable replaces "enabled"; the idea paragraph says "With the builder retired and the night shift reduced to a count".

### H2-html-2-7 [style] Severity: Major
* Target: learning-loop callout (style 5)
* Finding: "It found a real one." and "The same 2026-07-23 review" have no referent; the last sentence cannot be followed.
* Decision: PROPOSE FIX for the first two; ESCALATE the last sentence
* Reason: The first two settle by naming the review. The last sentence ("The escaped defect that prompted it never gets reviewed twice.") is the owner's line, shared with `docs/ops/pipeline-audit.md`.
* Edit: "A review found a real one. The 2026-07-23 security review that audited ..."

### H2-html-2-8 [style] Severity: Major
* Target: "Proven, twice" (style 7); stats "2 Human gates", "3 Separated actors", footer; "How it was built" heading
* Finding: "unattended" against the human merge; undated counts of gates and actors; heading durations that do not match the dates.
* Decision: ESCALATE
* Reason: Same as H2-html-1-32. History and framing that the code cannot settle.
* Edit: none

## Findings: docs/privacy-data-flow.html

### H2-html-2-9 [codebase-details] Severity: Major
* Target: feedback row
* Finding: The field list omits `submission_id` and `client_submitted_at` (`lib/feedback/feedback-payload.ts:38-46`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Row 22 now lists a one-time submission id and a timestamp.

### H2-html-2-10 [codebase-details] Severity: Major
* Target: OAuth row
* Finding: "Token only" understates sign-in. The app keeps the account id, email, and provider in `sync_config` (`lib/sync/pb-auth.ts:313-318`, `components/sync/use-sync-auth-dialog.ts:208-216`).
* Decision: PROPOSE FIX
* Reason: Confirmed in both files.
* Edit: Row 20 text and its Personal data cell.

### H2-html-2-11 [codebase-details] Severity: Major
* Target: table scope
* Finding: Missing flows: WebMCP `create_task`, sync delete push, account deletion, sign out everywhere, token refresh.
* Decision: ESCALATE
* Reason: Same scope question as H2-html-1-14.
* Edit: none

### H2-html-2-12 [codebase-details] Severity: Nit
* Target: footer; preconnect row
* Finding: api.vinny.io is the backend only on gsd.vinny.dev (`lib/env-config.ts:19-21,71-78`); the preconnect host is hard-coded, so a self-hosted build emits it (`app/layout.tsx:250`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: "On gsd.vinny.dev the PocketBase backend is ..."; row 23 adds one sentence.

### H2-html-2-13 [codebase-details] Severity: Nit
* Target: MCP read row "over HTTPS"; logger row "never interpolate task fields"
* Finding: The MCP config also accepts loopback `http`; error message strings get token masking only (`lib/logger.ts:207-222`).
* Decision: DECLINE for the MCP row; ESCALATE the logger point as a possible code defect
* Reason: The loopback case is a development detail. The logger comment itself says remote error text can echo task values, which may be a gap in the content mask.
* Edit: none

### H2-html-2-14 [style] Severity: Major
* Target: SVG zone tab; trackers note (style 9, 10)
* Finding: The tab still read "OPT-IN ONLY" beside flows that need no sign-in; "egress allowlist" of three origins sat beside "Apple is contacted".
* Decision: PROPOSE FIX
* Reason: The tab takes a same-length label with no geometry change. `lib/sync/pb-auth.ts:162-168` shows sign-in sets the window location, a navigation.
* Edit: Tab reads "NETWORK / SERVER · DATA OPT-IN"; the note adds one sentence on navigation and `connect-src`. This settles the tab half of H2-html-1-20.

### H2-html-2-15 [style] Severity: Major
* Target: claim 2 verdict (style 11)
* Finding: "No server-side storage ... Confirmed" against a caveat that calls hosted sync server-side storage.
* Decision: ESCALATE
* Reason: The verdict is the reviewer-owner's judgment, and the caveat states the scope. Changing the verdict changes the review's conclusion.
* Edit: none

## Findings: docs/codebase-analysis-report.html (banner only)

### H2-html-2-16 [codebase-details] Severity: Nit
* Target: banner
* Finding: "its code moved" overstates CFG-01: only the reconciliation moved to `lib/sync/sync-status-store.ts:189-204`. All other banner claims confirmed.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: "its reconciliation code moved to". NOTE loop for this file ends here: no Blocker or Major in the note.
