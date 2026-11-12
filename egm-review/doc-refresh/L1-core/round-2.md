# Doc refresh: L1-core, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A (egm-codebase-details) | README.md (outside Repository blueprint), ARCHITECTURE.md, CONTRIBUTING.md | ran |
| Accuracy B (egm-codebase-details) | PRODUCT.md, AGENTS.md, CLAUDE.md | ran |
| Accuracy C (egm-codebase-details) | coding-standards.md, docs/agents/*.md | ran |
| Accuracy D (egm-codebase-details) | .claude/README.md | ran |
| Style 1 (egm-style) | README.md, ARCHITECTURE.md, CONTRIBUTING.md | ran |
| Style 2 (egm-style) | docs/agents: README.md, domain.md, issue-tracker.md, night-shift.md, triage-labels.md | ran |
| Style 3 (egm-style) | PRODUCT.md, AGENTS.md, CLAUDE.md, coding-standards.md, .claude/README.md, docs/agents/builder.md | ran |

Each reviewer got a short list of round 1 items already escalated or declined, so it would not repeat them.

## Findings

### L1-core-2-1 [Accuracy A] Severity: Major
* Target: ARCHITECTURE.md line 15
* Finding: The row sends readers to `lib/db.ts` for IndexedDB schemas. `lib/db.ts:13-31` only declares table types. Stores, indexes, and versions are in `lib/db-migrations.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `lib/db.ts:11,28`.
* Edit: Added `lib/db-migrations.ts` to the row.

### L1-core-2-2 [Accuracy A] Severity: Major
* Target: README.md lines 113-117; CONTRIBUTING.md lines 62-66
* Finding: `bun run test:system:pocketbase` runs only the MCP server's system tests (`scripts/run-pocketbase-system-test.sh:73-76`). It downloads PocketBase first. No web `lib/sync` code runs.
* Decision: PROPOSE FIX
* Reason: Confirmed. The two system test files import no `lib/sync` code.
* Edit: Both files gained two sentences on what the harness runs. CONTRIBUTING.md points at `tests/data/sync/` for `lib/sync` coverage. The "require" rule itself is escalated as L1-core-2-22.

### L1-core-2-3 [Accuracy A] Severity: Nit
* Target: README.md lines 111-112; CONTRIBUTING.md line 27
* Finding: `bun test` no longer runs Bun's runner. `scripts/bun-test-guard.cjs` exits 1 first.
* Decision: PROPOSE FIX
* Reason: Confirmed in `bunfig.toml` and the guard script.
* Edit: Both sentences now say a guard script stops it.

### L1-core-2-4 [Accuracy A] Severity: Nit
* Target: README.md lines 152-156
* Finding: The `repository_dispatch` trigger and `npm run build` in `deploy-prod.sh`.
* Decision: DECLINE
* Reason: Declined in round 1 as L1-core-1-4 and 1-5.
* Edit: none

### L1-core-2-5 [Accuracy A] Severity: Nit
* Target: README.md lines 37-39, 62-65, 90-91
* Finding: Omitted detail on the first-run redirect, the shortcut list, and retained smart-view fields.
* Decision: DECLINE
* Reason: The claims are accurate.
* Edit: none

### L1-core-2-6 [Accuracy A] Severity: Nit
* Target: ARCHITECTURE.md line 21
* Finding: "definition of done" does not appear in `coding-standards.md`.
* Decision: PROPOSE FIX
* Reason: Part 7 is "Tiered Exit Checklists".
* Edit: Row label is now "Testing and exit checklists".

### L1-core-2-7 [Accuracy B] Severity: Major
* Target: CLAUDE.md line 165
* Finding: "`localStorage.clear()` doesn't work in jsdom-under-Bun". `vitest.setup.ts:8-21` replaces the stub with a store that implements `clear()`. `.claude/rules/testing.md:37` now says both methods work.
* Decision: PROPOSE FIX
* Reason: Confirmed in `vitest.setup.ts`.
* Edit: The TL;DR now says the setup file replaces the broken stub, so `clear()` and `removeItem()` both work.

### L1-core-2-8 [Accuracy B] Severity: Nit
* Target: AGENTS.md lines 43-44
* Finding: `prebuild` (`rimraf .next out`) runs before `generate-build-info.cjs`.
* Decision: DECLINE
* Reason: Small. "First" describes the `build` script itself.
* Edit: none

### L1-core-2-9 [Accuracy B] Severity: Nit
* Target: AGENTS.md lines 49-53
* Finding: The `next-env.d.ts` sentences conflict.
* Decision: ESCALATE
* Reason: Same as L1-core-1-107. Needs a build run.
* Edit: none

### L1-core-2-10 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 50
* Finding: `scripts/deploy-prod.sh:12` exports the id as `CLOUDFRONT_ID`, not `CLOUDFRONT_DISTRIBUTION_ID`.
* Decision: DECLINE
* Reason: The line cites the script for the id value, which is correct.
* Edit: none

### L1-core-2-11 [Accuracy C] Severity: Major
* Target: coding-standards.md lines 16 and 144
* Finding: "Loaded: Never", yet `CLAUDE.md` imports the file.
* Decision: ESCALATE
* Reason: Settled in round 1 as L1-core-1-113.
* Edit: none

### L1-core-2-12 [Accuracy C] Severity: Major
* Target: coding-standards.md lines 15 and 148
* Finding: The `PostToolUse` hook cannot enforce anything. `lint-on-edit.sh` always exits 0. The `Stop` hook is the blocking gate, and no formatter is configured.
* Decision: ESCALATE
* Reason: Rule against tooling, the same row as L1-core-1-19.
* Edit: none

### L1-core-2-13 [Accuracy C] Severity: Major
* Target: coding-standards.md lines 151-153
* Finding: Size limits are a ratchet, not absolute limits.
* Decision: ESCALATE
* Reason: Settled in round 1 as L1-core-1-24.
* Edit: none

### L1-core-2-14 [Accuracy C] Severity: Nit
* Target: coding-standards.md lines 20, 81, 157, 164-170
* Finding: Audit fails on High and Critical only. ADR 0020 has no Deciders field. Two named skills are not in the repo.
* Decision: DECLINE
* Reason: Small, and the skills are user-level.
* Edit: none

### L1-core-2-15 [Accuracy C] Severity: Major
* Target: docs/agents/night-shift.md lines 18-20
* Finding: My round 1 paragraph was incomplete. Zero candidates prints `NO_WORK` with no number. `UNKNOWN` is a third state. A failed `gh pr list` reports `NO_WORK`. The `DISABLED` line is not unique to the unset login.
* Decision: PROPOSE FIX
* Reason: Confirmed in `scripts/triage-run.sh:29-68`. Not churn: reverting the round 1 paragraph would restore L1-core-1-33.
* Edit: Paragraph rewritten to name the three outputs, the single-line disabled exit, and the `gh pr list` failure case.

### L1-core-2-16 [Accuracy C] Severity: Nit
* Target: docs/agents/night-shift.md lines 4-14
* Finding: The script appends to a local error log. "Failing" is undefined. `gh pr list` has no `--limit`. Arguments are undocumented.
* Decision: DECLINE
* Reason: Small. The pagination point is listed as a possible code defect.
* Edit: none

### L1-core-2-17 [Accuracy D] Severity: Major
* Target: .claude/README.md line 71
* Finding: "auto-fixes semicolons, quote style, unused imports". `eslint.config.mjs` configures none of those rules.
* Decision: PROPOSE FIX
* Reason: Confirmed. The only related rule is `no-unused-vars` at warn.
* Edit: Sentence now says the hook applies the fixes ESLint can make on its own.

### L1-core-2-18 [Accuracy D] Severity: Major
* Target: .claude/README.md line 101
* Finding: "batch lookups (no N+1)" was attributed to the rule file. `.claude/rules/pocketbase-sync.md:16` says the push looks up each row on its own. The wording comes from check 5 in the agent file.
* Decision: PROPOSE FIX
* Reason: Confirmed. The README now credits the agent file for the list. The agent's check 5 against the rule file is listed as a possible defect.
* Edit: Sentence reattributed to `.claude/agents/pb-sync-reviewer.md`.

### L1-core-2-19 [Accuracy D] Severity: Nit
* Target: .claude/README.md line 178
* Finding: The named items add up to 13, not 16.
* Decision: PROPOSE FIX
* Reason: Three commands have two patterns each.
* Edit: Added "(two forms each)".

### L1-core-2-20 [Accuracy D] Severity: Nit
* Target: .claude/README.md lines 60, 64, 112, 250-257, 292-299
* Finding: Loose `git commit` match, the `case` block advice, `/qspec` append behavior, the `sonnet` template, and unlisted local files.
* Decision: DECLINE
* Reason: Small. The line 60 sentence is already escalated as L1-core-1-77.
* Edit: none

### L1-core-2-21 [Style 1] Severity: Major
* Target: README.md lines 26, 71-72, 76-77, 131-132, 175
* Finding: Five sentences a reader cannot resolve: "top three" of what, what the sweep sweeps, "search Saved or the command palette", "syncs between them", "that endpoint", and a second "production static build".
* Decision: PROPOSE FIX
* Reason: Each checked against code: `lib/top-three.ts`, `lib/weekly-sweep.ts`, `components/saved/README.md`, `components/command-palette/README.md`, `package.json:15`.
* Edit: Five small rewrites. The sync sentence now says saved items sync between the web app and the native app with cloud sync on.

### L1-core-2-22 [Style 1] Severity: Major
* Target: CONTRIBUTING.md lines 62-70; README.md line 113
* Finding: Sync changes "require" a harness that does not test `lib/sync`. README calls the same harness "optional".
* Decision: ESCALATE
* Reason: The requirement is the owner's contribution rule. The facts beside it are now correct.
* Edit: none

### L1-core-2-23 [Style 1] Severity: Major
* Target: CONTRIBUTING.md lines 48-54
* Finding: "The MCP workspace also requires" states no trigger.
* Decision: ESCALATE
* Reason: A contribution rule.
* Edit: none

### L1-core-2-24 [Style 1] Severity: Major
* Target: CONTRIBUTING.md lines 56-60
* Finding: The export suite paragraph does not say when to run it, and "both browser suites" names one.
* Decision: PROPOSE FIX
* Reason: `ci.yml:165-172` runs the export suite.
* Edit: Paragraph now opens "CI runs the production-export browser suite". The last sentence names `bun run test:e2e`, the export suite, and the PWA checks.

### L1-core-2-25 [Style 2] Severity: Major
* Target: docs/agents/triage-labels.md lines 3, 5, 9, 13, 15
* Finding: "role" against "label", the unintroduced `mattpocock/skills`, the template sentence on line 15, and "AFK agent" beside "no agent acts on it".
* Decision: ESCALATE
* Reason: The table is a copy of `.agents/skills/setup-matt-pocock-skills/triage-labels.md`. Whether skills should still apply `ready-for-agent` is the owner's call.
* Edit: none

### L1-core-2-26 [Style 2] Severity: Major
* Target: docs/agents/triage-labels.md line 17
* Finding: My round 1 sentence said the night shift "triages pull requests". The night shift only counts candidates.
* Decision: PROPOSE FIX
* Reason: Confirmed against `night-shift.md`.
* Edit: Now "`triage:paused` is the night shift's kill switch for pull-request discovery. It is not an issue triage label."

### L1-core-2-27 [Style 2] Severity: Major
* Target: docs/agents/night-shift.md lines 8-11
* Finding: "A pull request ... has ... a same-repository pull request" does not parse.
* Decision: PROPOSE FIX
* Reason: The test is `isCrossRepository === false` (`failing-agent-prs.cjs:28`).
* Edit: Bullet now reads "a head branch in this repository, not a fork".

### L1-core-2-28 [Style 2] Severity: Major
* Target: docs/agents/night-shift.md lines 22-25
* Finding: "Local remediation" and "remains a refusal tombstone" assume history the file never gives.
* Decision: ESCALATE
* Reason: The owner's security note. Same paragraph as L1-core-1-94.
* Edit: none

### L1-core-2-29 [Style 2] Severity: Major
* Target: docs/agents/README.md line 3
* Finding: "Neither agent" names no agents.
* Decision: PROPOSE FIX
* Reason: My round 1 wording.
* Edit: Now "Neither the builder nor the night shift executes code unattended today."

### L1-core-2-30 [Style 2] Severity: Major
* Target: docs/agents/domain.md lines 15-33
* Finding: The tree shows `CONTEXT.md` as present, and "the glossary" is never tied to it.
* Decision: PROPOSE FIX
* Reason: Confirmed in the text.
* Edit: The note now says the tree shows the target layout and that `CONTEXT.md` is the glossary.

### L1-core-2-31 [Style 3] Severity: Major
* Target: PRODUCT.md lines 23, 33, 34, 44, 54, 58
* Finding: Design-system names, "tide", "the wash", and "the Review page" are used without introduction.
* Decision: ESCALATE
* Reason: PRODUCT.md is facts only.
* Edit: none

### L1-core-2-32 [Style 3] Severity: Major
* Target: AGENTS.md lines 49-53 and 73
* Finding: The paragraph contradicts itself, and the section says leave generated files uncommitted while line 73 says commit the generated block.
* Decision: ESCALATE
* Reason: Same ground as L1-core-1-107. Needs a build run and the owner's intent.
* Edit: none

### L1-core-2-33 [Style 3] Severity: Major
* Target: CLAUDE.md lines 10, 26, 44, 67, 92, 135, 175-187
* Finding: `/impeccable` has no referent in the repo. "v9" is undefined. The `quality:bundle` line names a third build script. "feedback requests" has no referent. The "Agent skills" heading covers things that are not skills.
* Decision: ESCALATE
* Reason: CLAUDE.md is facts only, and none of these is a wrong fact. `scripts/build-local.sh` exists.
* Edit: none

### L1-core-2-34 [Style 3] Severity: Major
* Target: coding-standards.md lines 18, 20, 34, 81, 88, 150, 157, 188, 195, 200
* Finding: Branch enforcement stated two ways. Two skills not in the repo. "style" with two meanings. The exit-condition example. "Codex `AGENTS.md`". `haiku` and the weekly audit against `.claude/README.md`.
* Decision: ESCALATE
* Reason: The owner's standards document.
* Edit: none

### L1-core-2-35 [Style 3] Severity: Major
* Target: .claude/README.md line 178
* Finding: 16 entries against 13 named, and `chrome-devtools` is not in the MCP table.
* Decision: PROPOSE FIX
* Reason: Count fixed under L1-core-2-19. The missing `chrome-devtools` introduction is recorded with L1-core-1-80 for the owner.
* Edit: Covered by L1-core-2-19.

### L1-core-2-36 [Style 3] Severity: Major
* Target: .claude/README.md lines 139, 147-148
* Finding: My round 1 sentence said "This section describes two skills" of the 10 shared ones. `ui-ux-pro-max` is not one of the 10.
* Decision: PROPOSE FIX
* Reason: `.gitignore:57-68`.
* Edit: Sentence now names `pb-collection` as shared and `ui-ux-pro-max` as local.

### L1-core-2-37 [Style 3] Severity: Major
* Target: .claude/README.md lines 58, 142, 202-204
* Finding: The hook blocks `setup-pocketbase-collections.sh`, which the `pb-collection` workflow edits. The document does not say how that step gets done.
* Decision: ESCALATE
* Reason: Workflow guidance in a `.claude/` file. The hook and the skill both exist as described.
* Edit: none

### L1-core-2-38 [Style 3] Severity: Major
* Target: docs/agents/builder.md lines 3-9
* Finding: The file never says what the builder did.
* Decision: ESCALATE
* Reason: The owner's security note. `docs/agents/README.md` now points at the pipeline page for the old design.
* Edit: none
