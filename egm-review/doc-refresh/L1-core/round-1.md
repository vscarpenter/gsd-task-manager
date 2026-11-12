# Doc refresh: L1-core, round 1

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A (egm-codebase-details) | README.md (1-176, 300-308), ARCHITECTURE.md, CONTRIBUTING.md | ran |
| Accuracy B (egm-codebase-details) | PRODUCT.md, AGENTS.md, CLAUDE.md | ran |
| Accuracy C (egm-codebase-details) | coding-standards.md, docs/agents/*.md | ran |
| Accuracy D (egm-codebase-details) | .claude/README.md | ran |
| Style 1 (egm-style) | README.md, ARCHITECTURE.md, CONTRIBUTING.md, PRODUCT.md, AGENTS.md, CLAUDE.md, coding-standards.md | ran |
| Style 2 (egm-style) | .claude/README.md, docs/agents/*.md | ran |

Both style reviewers read some files after the accuracy fixes had landed. Their line numbers refer to the partly fixed text.

## Findings

### L1-core-1-1 [Accuracy A] Severity: Major
* Target: README.md lines 76-79
* Finding: README says Saved works in the iPhone, iPad, and Mac app. The linked `tasks/saved-tasks/spec.md:20-23` and `tasks/saved-tasks/verification.md:104-106` say iOS does not support Saved yet.
* Decision: CONTEST
* Reason: The iOS source has Saved: `gsd-iosapp/GSDKit/Sources/GSDModel/SavedPlacement.swift`, and `saved_at` in `GSDWire/TaskWireMapper.swift`. The README is right. The spec and verification file are the stale side, and they sit outside this batch.
* Edit: none

### L1-core-1-2 [Accuracy A] Severity: Nit
* Target: README.md lines 129-130
* Finding: "defaults to localhost:8090". `lib/env-config.ts:60-78` returns `http://127.0.0.1:8090`, chosen at runtime on a development host.
* Decision: PROPOSE FIX
* Reason: Confirmed in `resolvePocketBaseUrl`.
* Edit: Sentence now reads "A plain local build served on localhost defaults to `http://127.0.0.1:8090`".

### L1-core-1-3 [Accuracy A] Severity: Nit
* Target: README.md lines 119-126
* Finding: CI (`.github/workflows/ci.yml:165-172`) runs `test:pwa` before `test:csp` and passes a browser per matrix job.
* Decision: DECLINE
* Reason: The block gives a local equivalent. Order and flags do not change the result.
* Edit: none

### L1-core-1-4 [Accuracy A] Severity: Nit
* Target: README.md lines 151-153
* Finding: The release workflow also accepts a `repository_dispatch` event and checks the tag against `package.json`.
* Decision: DECLINE
* Reason: Extra detail, not an error.
* Edit: none

### L1-core-1-5 [Accuracy A] Severity: Nit
* Target: README.md lines 154-155
* Finding: `scripts/deploy-prod.sh:9` calls `npm run build`, so the script needs npm.
* Decision: DECLINE
* Reason: The README claim is accurate as written.
* Edit: none

### L1-core-1-6 [Accuracy B] Severity: Major
* Target: CLAUDE.md line 185
* Finding: "one `CONTEXT.md` + `docs/adr/` at the root". No root `CONTEXT.md` exists.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls`. A path fact.
* Edit: Line now says `docs/adr/` at the root, plus one root `CONTEXT.md` once it exists (none yet).

### L1-core-1-7 [Accuracy B] Severity: Major
* Target: AGENTS.md lines 3-5 and 13-14; CLAUDE.md lines 35-46
* Finding: AGENTS.md says CLAUDE.md documents `bun dev` and `bun run build`. CLAUDE.md listed neither.
* Decision: PROPOSE FIX
* Reason: Both scripts exist (`package.json:11,15`). Adding the two commands to CLAUDE.md makes the AGENTS.md pointer true.
* Edit: CLAUDE.md Core Commands gained `bun dev` and `bun run build`.

### L1-core-1-8 [Accuracy B] Severity: Major
* Target: CLAUDE.md line 62; AGENTS.md lines 17-18
* Finding: "All components use `"use client"`". `app/(matrix)/page.tsx`, `app/layout.tsx`, and several components carry no directive.
* Decision: PROPOSE FIX
* Reason: Confirmed. No `route.ts` and no `app/api` exist, so "no runtime server, no API routes" holds.
* Edit: Both files now say the app is a static export with no runtime server, interactive components use the directive, and a few pages prerender at build time.

### L1-core-1-9 [Accuracy B] Severity: Major
* Target: CLAUDE.md line 90
* Finding: "the compiled backend". `package.json:16` only sets `NEXT_PUBLIC_POCKETBASE_URL` for the build.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: "compiled backend" became "compiled-in backend URL".

### L1-core-1-10 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 71
* Finding: The sw-cache rule globs omit `components/pwa-register.tsx` and `public/manifest.json` (`.claude/rules/sw-cache.md:4-9`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Glob list now matches the rule file.

### L1-core-1-11 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 72
* Finding: The pocketbase-sync rule also loads on `lib/schema.ts` and `scripts/setup-pocketbase-collections.sh`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `.claude/rules/pocketbase-sync.md:4-7`.
* Edit: Glob list now matches the rule file.

### L1-core-1-12 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 110
* Finding: `useVirtualizer` appears only in the archive and sync-history pages.
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg`.
* Edit: "large task lists" became "the archive and sync-history lists".

### L1-core-1-13 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 112
* Finding: `recharts` is imported only by `components/dashboard/completion-chart.tsx`.
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg`.
* Edit: Parenthesis now names the completion trend chart only.

### L1-core-1-14 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 116
* Finding: `generateId()` has no smart-view caller.
* Decision: PROPOSE FIX
* Reason: Callers are tasks, subtasks, sync queue, sync history, and feedback.
* Edit: Now "tasks, subtasks, and other local records (`lib/id-generator.ts`)".

### L1-core-1-15 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 48
* Finding: "every extensionless path" skips `/api` and `/_` (`cloudfront-function-url-rewrite.cjs:47-54`).
* Decision: DECLINE
* Reason: The exception does not affect an App Router route, which is the paragraph's subject.
* Edit: none

### L1-core-1-16 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 31
* Finding: `app/css/inkwell-components.css` says version 1.3.1. The tokens and theme files say 1.4.0.
* Decision: DECLINE
* Reason: The tokens file sets the system version. The components header may be the stale one.
* Edit: none

### L1-core-1-17 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 91
* Finding: Specs request the `clearIndexedDB` fixture, and the fixture seeds the launch flag.
* Decision: DECLINE
* Reason: The reviewer did not confirm it. Not worth a change.
* Edit: none

### L1-core-1-18 [Accuracy B] Severity: Nit
* Target: CLAUDE.md line 65
* Finding: The shortcut list is shorter than the code's.
* Decision: DECLINE
* Reason: The line defers to the help drawer.
* Edit: none

### L1-core-1-19 [Accuracy C] Severity: Blocker
* Target: coding-standards.md lines 15 and 148
* Finding: Names Biome as formatter and linter. The repo has no Biome. It lints with ESLint (`package.json:18`, `.claude/hooks/lint-on-edit.sh:20`).
* Decision: ESCALATE
* Reason: A stated rule against the repo's tooling. The owner decides which side moves.
* Edit: none

### L1-core-1-20 [Accuracy C] Severity: Blocker
* Target: coding-standards.md lines 15, 88, and 149
* Finding: "commitlint via `commit-msg` hook". No commitlint config, dependency, or tracked git hook exists.
* Decision: ESCALATE
* Reason: Rule against tooling.
* Edit: none

### L1-core-1-21 [Accuracy C] Severity: Blocker
* Target: coding-standards.md line 154
* Finding: "Magic numbers, None, Lint rule". No such rule in `eslint.config.mjs` or `scripts/check-code-shape.cjs`.
* Decision: ESCALATE
* Reason: Rule against tooling.
* Edit: none

### L1-core-1-22 [Accuracy C] Severity: Blocker
* Target: docs/agents/README.md line 6
* Finding: The index calls `builder.md` a live operating spec. `builder.md`, `scripts/builder-run.sh:18-19`, and `.claude/commands/build-next.md` say the builder is retired.
* Decision: PROPOSE FIX
* Reason: Confirmed in all three files.
* Edit: Bullet now says the builder is retired and both entry points refuse to run.

### L1-core-1-23 [Accuracy C] Severity: Blocker
* Target: docs/agents/README.md line 7
* Finding: The index says the night shift triages failing checks. `scripts/triage-run.sh` only counts candidates.
* Decision: PROPOSE FIX
* Reason: Confirmed in the script.
* Edit: Bullet now says the night shift is discovery-only.

### L1-core-1-24 [Accuracy C] Severity: Major
* Target: coding-standards.md lines 151-153
* Finding: Size limits are not ESLint rules. `bun run quality:shape` applies them as a ratchet with a debt ledger, on production code only.
* Decision: ESCALATE
* Reason: Rule against tooling.
* Edit: none

### L1-core-1-25 [Accuracy C] Severity: Major
* Target: coding-standards.md line 156
* Finding: "80% floor". The branch threshold is 75 (`vitest.config.ts:61-66`).
* Decision: ESCALATE
* Reason: Rule against tooling.
* Edit: none

### L1-core-1-26 [Accuracy C] Severity: Major
* Target: coding-standards.md line 157
* Finding: "weekly audit routine". The scheduled audit runs daily (`.github/workflows/security-audit.yml:8-10`).
* Decision: ESCALATE
* Reason: Rule against tooling. The weekly routine may live outside the repo.
* Edit: none

### L1-core-1-27 [Accuracy C] Severity: Major
* Target: coding-standards.md line 155
* Finding: No lint rule requires explicit signatures, bans `object`, or checks for a justification comment.
* Decision: ESCALATE
* Reason: Rule against tooling.
* Edit: none

### L1-core-1-28 [Accuracy C] Severity: Major
* Target: coding-standards.md line 13
* Finding: `CLAUDE-core.md` does not exist in the repo.
* Decision: ESCALATE
* Reason: It may be a file in the owner's global config.
* Edit: none

### L1-core-1-29 [Accuracy C] Severity: Major
* Target: coding-standards.md line 150
* Finding: No pre-push hook exists. The repo does have `.claude/hooks/no-main-commits.sh`, which the table omits.
* Decision: ESCALATE
* Reason: Rule against tooling.
* Edit: none

### L1-core-1-30 [Accuracy C] Severity: Major
* Target: coding-standards.md line 200
* Finding: "Read-only agents use `haiku`". Both repo agents are read-only and use `sonnet`.
* Decision: ESCALATE
* Reason: Rule against the repo's agent files.
* Edit: none

### L1-core-1-31 [Accuracy C] Severity: Major
* Target: docs/agents/domain.md lines 21-23
* Finding: "(12 ADRs)". `docs/adr/` holds 20.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls`.
* Edit: Removed the count, so the tree cannot drift again.

### L1-core-1-32 [Accuracy C] Severity: Major
* Target: docs/agents/domain.md lines 7, 19, and 24
* Finding: The tree shows `CONTEXT.md` and `src/`. Neither exists.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Tree now lists `app/, components/, lib/, packages/`. A dated sentence says the repo has no `CONTEXT.md` yet.

### L1-core-1-33 [Accuracy C] Severity: Major
* Target: docs/agents/night-shift.md lines 8-13
* Finding: The list omits the `claude/` branch test, the `triage:paused` kill switch, the disabled state, and that output is a count.
* Decision: PROPOSE FIX
* Reason: Confirmed in `scripts/failing-agent-prs.cjs:12-14,48,69-71` and `scripts/triage-run.sh:29-43`. The four override variables stay out, because that inventory would drift.
* Edit: Added the branch bullet and one paragraph on the count, the disabled state, and the kill switch.

### L1-core-1-34 [Accuracy C] Severity: Major
* Target: docs/agents/triage-labels.md lines 5-11
* Finding: `scripts/setup-labels.sh` creates none of the five labels. `ready-for-agent` conflicts with `builder.md:22-24`.
* Decision: PROPOSE FIX
* Reason: Confirmed in the script. Whether the five labels exist on GitHub needs `gh`, which this run may not call. See L1-core-1-97.
* Edit: Added a paragraph: no agent acts on `ready-for-agent`, and the script creates only the pipeline labels.

### L1-core-1-35 [Accuracy C] Severity: Major
* Target: docs/agents/README.md line 5
* Finding: `docs/pipeline-summary.html:193-195,352` still shows the builder and night shift as live.
* Decision: PROPOSE FIX
* Reason: Confirmed. The HTML page is outside this batch.
* Edit: The index bullet now warns that the page shows the July 2026 pipeline.

### L1-core-1-36 [Accuracy C] Severity: Nit
* Target: coding-standards.md line 203
* Finding: Hooks parse stdin with `node -e`, not `jq`.
* Decision: DECLINE
* Reason: Owner's standards document. Recorded for the owner with the other mismatches.
* Edit: none

### L1-core-1-37 [Accuracy C] Severity: Nit
* Target: coding-standards.md line 202
* Finding: The repo also uses `PreToolUse`.
* Decision: DECLINE
* Reason: The line gives examples.
* Edit: none

### L1-core-1-38 [Accuracy C] Severity: Nit
* Target: coding-standards.md lines 14, 180, 198
* Finding: `.claude/commands/` also holds `release.md`, `build-next.md`, and `triage-prs.md`.
* Decision: DECLINE
* Reason: The line names the prompt commands and says "and successors".
* Edit: none

### L1-core-1-39 [Accuracy C] Severity: Nit
* Target: coding-standards.md line 156
* Finding: `/qcheck` has no acceptance-criteria step.
* Decision: ESCALATE
* Reason: Rule against tooling.
* Edit: none

### L1-core-1-40 [Accuracy C] Severity: Nit
* Target: coding-standards.md line 121
* Finding: No difference. The file does not name the package manager.
* Decision: DECLINE
* Reason: Not a difference.
* Edit: none

### L1-core-1-41 [Accuracy C] Severity: Nit
* Target: docs/agents/night-shift.md line 11
* Finding: "exact" login. The match ignores case (`failing-agent-prs.cjs:31-32`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Bullet now says the match ignores case.

### L1-core-1-42 [Accuracy C] Severity: Nit
* Target: docs/agents/night-shift.md line 13
* Finding: "failing" is not defined.
* Decision: DECLINE
* Reason: The code owns the list.
* Edit: none

### L1-core-1-43 [Accuracy C] Severity: Nit
* Target: docs/agents/builder.md lines 3-5
* Finding: Accurate. `.agents/skills/source-command-build-next/SKILL.md` and `source-command-triage-prs/SKILL.md` still hold the live builder text.
* Decision: DECLINE
* Reason: No error in this file. The `.agents/skills` copies sit outside this batch.
* Edit: none

### L1-core-1-44 [Accuracy C] Severity: Nit
* Target: docs/agents/domain.md lines 11 and 31
* Finding: `/grill-with-docs` exists only under `.agents/skills/`.
* Decision: PROPOSE FIX
* Reason: Confirmed. Also raised as L1-core-1-89.
* Edit: Line 11 now gives the skill's path.

### L1-core-1-45 [Accuracy C] Severity: Nit
* Target: docs/agents/issue-tracker.md line 8
* Finding: No runnable command for the `jq` filter.
* Decision: PROPOSE FIX
* Reason: Also raised as L1-core-1-91.
* Edit: See L1-core-1-91.

### L1-core-1-46 [Accuracy D] Severity: Blocker
* Target: .claude/README.md lines 147-155
* Finding: "5 servers" including `aws-mcp`. `.mcp.json.example` defines four and has no `aws-mcp`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Count is 4, tied to the template. Removed the `aws-mcp` row.

### L1-core-1-47 [Accuracy D] Severity: Blocker
* Target: .claude/README.md lines 68-72 and 239-241
* Finding: The Stop hook also runs ESLint, prints 40 lines on failure, and exits 2 (`.claude/settings.json:40-44`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Rewrote the Stop section and added ESLint to the troubleshooting line. Removed the unverified "~3-5s".

### L1-core-1-48 [Accuracy D] Severity: Blocker
* Target: .claude/README.md line 209
* Finding: `tests/data/sync-*.test.ts` matches one file. Sync tests live in `tests/data/sync/`.
* Decision: PROPOSE FIX
* Reason: Confirmed by `ls`.
* Edit: Path corrected.

### L1-core-1-49 [Accuracy D] Severity: Major
* Target: .claude/README.md line 49
* Finding: "Three hooks". `settings.json` registers five commands.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now "Five hooks: three scripts and two inline `Stop` commands".

### L1-core-1-50 [Accuracy D] Severity: Major
* Target: .claude/README.md lines 47-80
* Finding: `no-main-commits.sh` is undocumented.
* Decision: PROPOSE FIX
* Reason: Confirmed in the script and `settings.json:24-31`.
* Edit: Added a short section for it.

### L1-core-1-51 [Accuracy D] Severity: Major
* Target: .claude/README.md line 172
* Finding: "6 entries". The allowlist has 16.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Count and summary corrected.

### L1-core-1-52 [Accuracy D] Severity: Major
* Target: .claude/README.md line 104
* Finding: "The three commands". The folder holds six.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Intro now names six, the three-step workflow, `/release`, and the two retired commands.

### L1-core-1-53 [Accuracy D] Severity: Major
* Target: .claude/README.md lines 132-141
* Finding: Two skills listed. `.gitignore:58-68` shares 10.
* Decision: PROPOSE FIX
* Reason: Confirmed. An inventory would drift, so the text points at the folder.
* Edit: Added a lead paragraph that states the count and names `verify-frontend-change`.

### L1-core-1-54 [Accuracy D] Severity: Major
* Target: .claude/README.md line 35
* Finding: Not every skill is checked in.
* Decision: PROPOSE FIX
* Reason: `.gitignore:57` ignores `.claude/skills/*`.
* Edit: Row now says "partly".

### L1-core-1-55 [Accuracy D] Severity: Major
* Target: .claude/README.md lines 29-41
* Finding: `.claude/rules/` is missing.
* Decision: PROPOSE FIX
* Reason: Five tracked rule files exist.
* Edit: Added a table row.

### L1-core-1-56 [Accuracy D] Severity: Major
* Target: .claude/README.md line 96
* Finding: "all 10 gotchas from `CLAUDE.md`". The agent has 16 checks and cites `.claude/rules/pocketbase-sync.md`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `.claude/agents/pb-sync-reviewer.md`.
* Edit: Source and count corrected.

### L1-core-1-57 [Accuracy D] Severity: Major
* Target: .claude/README.md line 95
* Finding: Scope omits import/export and MCP write paths.
* Decision: PROPOSE FIX
* Reason: Confirmed in the agent file line 14.
* Edit: Scope extended.

### L1-core-1-58 [Accuracy D] Severity: Major
* Target: .claude/README.md line 90
* Finding: WCAG baseline cited to `coding-standards.md` Part 2, which has no WCAG text.
* Decision: PROPOSE FIX
* Reason: `.claude/agents/a11y-reviewer.md:8` cites `CLAUDE.md` Design Context.
* Edit: Source corrected.

### L1-core-1-59 [Accuracy D] Severity: Major
* Target: .claude/README.md line 123
* Finding: "Definition of Done" does not exist.
* Decision: PROPOSE FIX
* Reason: `.claude/commands/qcheck.md:21` uses Part 7.
* Edit: Now "the tiered exit checklists in `coding-standards.md` Part 7".

### L1-core-1-60 [Accuracy D] Severity: Major
* Target: .claude/README.md line 310
* Finding: "10 parts, ~600 lines". The file has Parts 0 to 7 and 236 lines.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now "(Parts 0 through 7)".

### L1-core-1-61 [Accuracy D] Severity: Major
* Target: .claude/README.md lines 266-277
* Finding: The artifact list is incomplete.
* Decision: PROPOSE FIX
* Reason: The list records the initial setup PR, so it stays. A reader needs to know it is a baseline.
* Edit: Added a sentence after the list that names the later additions and `git ls-files .claude`.

### L1-core-1-62 [Accuracy D] Severity: Nit
* Target: .claude/README.md line 54
* Finding: The `.env*` pattern is narrower than "any environment file".
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L1-core-1-63 [Accuracy D] Severity: Nit
* Target: .claude/README.md lines 55-57
* Finding: Patterns need a directory prefix.
* Decision: DECLINE
* Reason: Small. Possible code defect, listed in the summary.
* Edit: none

### L1-core-1-64 [Accuracy D] Severity: Nit
* Target: .claude/README.md hooks section
* Finding: Hooks need `node` and `bun` on PATH.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L1-core-1-65 [Accuracy D] Severity: Nit
* Target: .claude/README.md line 90
* Finding: The check list omits toasts.
* Decision: DECLINE
* Reason: The agent file owns the list.
* Edit: none

### L1-core-1-66 [Accuracy D] Severity: Nit
* Target: .claude/README.md lines 140-141
* Finding: `ui-ux-pro-max` is also manual-invoke.
* Decision: PROPOSE FIX
* Reason: Confirmed in its `SKILL.md:4`.
* Edit: Heading now says "(user-only, not checked in)".

### L1-core-1-67 [Accuracy D] Severity: Nit
* Target: .claude/README.md lines 173 and 190
* Finding: "~101 entries". The local file has 83.
* Decision: PROPOSE FIX
* Reason: A count of a personal file is not a team fact.
* Edit: Removed "Currently ~101 entries". The prune baseline on line 190 stays. See L1-core-1-72.

### L1-core-1-68 [Accuracy D] Severity: Nit
* Target: .claude/README.md line 200
* Finding: `commit-push-pr` is not in the team allowlist.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now names the `commit-commands:commit-push-pr` skill with no allowlist claim.

### L1-core-1-69 [Accuracy D] Severity: Nit
* Target: .claude/README.md lines 5, 190, 286-290
* Finding: The 2026-05-25 reminder is in the past.
* Decision: ESCALATE
* Reason: The owner's schedule. "Last reviewed" now reads 2026-11-11.
* Edit: Review date only.

### L1-core-1-70 [Style 2] Severity: Blocker
* Target: .claude/README.md, whole file
* Finding: The document states stale counts as current.
* Decision: PROPOSE FIX
* Reason: Same ground as L1-core-1-46 to 1-61.
* Edit: Covered by those edits.

### L1-core-1-71 [Style 2] Severity: Major
* Target: .claude/README.md lines 35, 141, 289
* Finding: `ui-ux-pro-max` is described three ways.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Covered by L1-core-1-54 and 1-66.

### L1-core-1-72 [Style 2] Severity: Major
* Target: .claude/README.md line 190
* Finding: "Baseline as of last prune: 101 entries" has no referent for other readers.
* Decision: ESCALATE
* Reason: The owner's own maintenance note in a `.claude/` file.
* Edit: none

### L1-core-1-73 [Style 2] Severity: Major
* Target: .claude/README.md line 190
* Finding: The calendar reminder names no calendar and a past date.
* Decision: ESCALATE
* Reason: Same as L1-core-1-69.
* Edit: none

### L1-core-1-74 [Style 2] Severity: Major
* Target: .claude/README.md line 200
* Finding: Allowlist claim contradicts line 172.
* Decision: PROPOSE FIX
* Reason: Same as L1-core-1-68.
* Edit: Covered there.

### L1-core-1-75 [Style 2] Severity: Major
* Target: .claude/README.md lines 134-138, 187, 302
* Finding: `Skill(pb-collection)` is not something a user types.
* Decision: ESCALATE
* Reason: Wording in a `.claude/` file, and the right form is Claude Code runtime behavior the repo cannot show.
* Edit: none

### L1-core-1-76 [Style 2] Severity: Major
* Target: .claude/README.md lines 76-80, 241
* Finding: The "disable a hook" text and its JSON example disagree.
* Decision: ESCALATE
* Reason: Runtime behavior, not checkable in the repo.
* Edit: none

### L1-core-1-77 [Style 2] Severity: Major
* Target: .claude/README.md line 59
* Finding: The sentence on editing a blocked file cannot be followed.
* Decision: ESCALATE
* Reason: Guidance, not a fact.
* Edit: none

### L1-core-1-78 [Style 2] Severity: Major
* Target: .claude/README.md line 96
* Finding: "10 gotchas" followed by eight items.
* Decision: PROPOSE FIX
* Reason: The list is a sample.
* Edit: The list now starts with "including".

### L1-core-1-79 [Style 2] Severity: Major
* Target: .claude/README.md lines 89 and 115
* Finding: `a11y-reviewer` scope differs between the two lines.
* Decision: CONTEST
* Reason: Both match the code. `.claude/agents/a11y-reviewer.md:3` covers `components/` and `app/`. `.claude/commands/tdd.md:41` auto-invokes it for `components/` only.
* Edit: none

### L1-core-1-80 [Style 2] Severity: Major
* Target: .claude/README.md lines 147-155, 172, 205
* Finding: `claude-in-chrome` is never introduced.
* Decision: ESCALATE
* Reason: It is a tool outside the repo. Line 205 no longer mentions it.
* Edit: none

### L1-core-1-81 [Style 2] Severity: Major
* Target: docs/agents/README.md line 3
* Finding: "autonomous delivery pipeline" contradicts the bullets.
* Decision: PROPOSE FIX
* Reason: Follows from L1-core-1-22 and 1-23.
* Edit: Dropped "autonomous" and added "Neither agent executes code unattended today."

### L1-core-1-82 [Style 2] Severity: Major
* Target: docs/agents/README.md lines 6-7
* Finding: "cycle B" and "cycle D" have no referent.
* Decision: PROPOSE FIX
* Reason: The terms come from the pipeline page.
* Edit: Now "cycle B in the pipeline page" and "cycle D in the pipeline page".

### L1-core-1-83 [Style 2] Severity: Major
* Target: docs/agents/README.md line 5
* Finding: "the two files below" is followed by five.
* Decision: PROPOSE FIX
* Reason: My round 1 wording.
* Edit: Names `builder.md` and `night-shift.md`.

### L1-core-1-84 [Style 2] Severity: Major
* Target: docs/agents/builder.md lines 22-24
* Finding: The closing sentence implies labels regain execution authority once the controls exist.
* Decision: ESCALATE
* Reason: A security policy statement. The owner words it.
* Edit: none

### L1-core-1-85 [Style 2] Severity: Major
* Target: docs/agents/builder.md lines 15-17
* Finding: "risk and plan bytes", "the dispatcher", and "the worker" are undefined.
* Decision: ESCALATE
* Reason: A design that does not exist in code yet.
* Edit: none

### L1-core-1-86 [Style 2] Severity: Major
* Target: docs/agents/builder.md line 1; docs/agents/night-shift.md line 1
* Finding: The titles can be read backwards.
* Decision: ESCALATE
* Reason: The brief keeps headings. The owner may retitle.
* Edit: none

### L1-core-1-87 [Style 2] Severity: Major
* Target: docs/agents/builder.md line 17
* Finding: "mode-0600 immutable snapshot" is inconsistent.
* Decision: ESCALATE
* Reason: A design requirement with no code.
* Edit: none

### L1-core-1-88 [Style 2] Severity: Major
* Target: docs/agents/domain.md lines 11, 27, 29-33
* Finding: The glossary section assumes a `CONTEXT.md` the repo lacks.
* Decision: PROPOSE FIX
* Reason: My round 1 note exposed it.
* Edit: The note now adds "The glossary rules below apply once it exists."

### L1-core-1-89 [Style 2] Severity: Major
* Target: docs/agents/domain.md lines 3, 11, 33
* Finding: "the engineering skills" and `/grill-with-docs` have no referent.
* Decision: PROPOSE FIX
* Reason: The skill lives at `.agents/skills/grill-with-docs/`.
* Edit: Line 11 gives the path.

### L1-core-1-90 [Style 2] Severity: Major
* Target: docs/agents/domain.md lines 8-9, 15
* Finding: Multi-context guidance has no referent in this repo.
* Decision: CONTEST
* Reason: The text is conditional ("if it exists", "In multi-context repos"). The layout heading says "Single-context repo", and `CLAUDE.md` line 187 says the same.
* Edit: none

### L1-core-1-91 [Style 2] Severity: Major
* Target: docs/agents/issue-tracker.md line 8
* Finding: The read instruction cannot run as written.
* Decision: PROPOSE FIX
* Reason: The command had no `--json` or `--jq` flag.
* Edit: Now gives the base command and the `--json title,body,labels,comments` form.

### L1-core-1-92 [Style 2] Severity: Major
* Target: docs/agents/issue-tracker.md line 9
* Finding: The command already holds `--state open`, then asks for a `--state` filter.
* Decision: PROPOSE FIX
* Reason: Confirmed in the text.
* Edit: Now "Add `--label` filters and change `--state` as needed."

### L1-core-1-93 [Style 2] Severity: Major
* Target: docs/agents/night-shift.md lines 4-8, 16
* Finding: "discovery" names both the run and the candidate test.
* Decision: PROPOSE FIX
* Reason: The list is the candidate test (`failingAgentPRs`).
* Edit: List intro now reads "A pull request counts as a candidate only when it has all of:".

### L1-core-1-94 [Style 2] Severity: Major
* Target: docs/agents/night-shift.md lines 22-25
* Finding: "trusted bot receipt" and "separately reviewed handoff" are undefined.
* Decision: ESCALATE
* Reason: A future design with no code.
* Edit: none

### L1-core-1-95 [Style 2] Severity: Major
* Target: docs/agents/night-shift.md and triage-labels.md
* Finding: "triage" means pull-request triage in one file and issue triage in the other.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: triage-labels.md now says `triage:paused` belongs to the night shift, which triages pull requests.

### L1-core-1-96 [Style 2] Severity: Major
* Target: docs/agents/triage-labels.md line 15
* Finding: "the right-hand column" is the Meaning column.
* Decision: PROPOSE FIX
* Reason: The label strings sit in the middle column.
* Edit: Now "the middle column".

### L1-core-1-97 [Style 2] Severity: Major
* Target: docs/agents/triage-labels.md lines 3, 17
* Finding: The reader cannot tell whether the five labels exist.
* Decision: ESCALATE
* Reason: Only GitHub can answer, and this run makes no network calls.
* Edit: The note now tells the reader to confirm with `gh label list`.

### L1-core-1-98 [Style 2] Severity: Major
* Target: docs/agents/triage-labels.md lines 3, 5, 13
* Finding: The example role "AFK-ready" matches no row.
* Decision: PROPOSE FIX
* Reason: The Meaning column maps it to `ready-for-agent`.
* Edit: The example now names `ready-for-agent`.

### L1-core-1-99 [Style 1] Severity: Major
* Target: README.md lines 76-79
* Finding: "the iPhone, iPad, and Mac app" has no referent.
* Decision: PROPOSE FIX
* Reason: The README never introduces the native app.
* Edit: Now "the native iPhone, iPad, and Mac app (a separate repository)".

### L1-core-1-100 [Style 1] Severity: Major
* Target: README.md lines 128-129
* Finding: "feedback tests" refers to a feature the section never introduces.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now "Tests for the in-app feedback form".

### L1-core-1-101 [Style 1] Severity: Major
* Target: PRODUCT.md lines 17 and 34
* Finding: The iOS references have no referent.
* Decision: ESCALATE
* Reason: PRODUCT.md is facts only.
* Edit: none

### L1-core-1-102 [Style 1] Severity: Major
* Target: PRODUCT.md line 17
* Finding: "all data lives in the browser" sits beside optional sync.
* Decision: ESCALATE
* Reason: Product positioning.
* Edit: none

### L1-core-1-103 [Style 1] Severity: Major
* Target: PRODUCT.md line 17; CLAUDE.md lines 11, 79; README.md lines 48-50
* Finding: "self-hosted" means the owner's server in two files and the user's own server in README.
* Decision: ESCALATE
* Reason: A term choice across owner documents.
* Edit: none

### L1-core-1-104 [Style 1] Severity: Major
* Target: PRODUCT.md lines 3-5
* Finding: "Register: product" is unexplained.
* Decision: ESCALATE
* Reason: A design-tool field.
* Edit: none

### L1-core-1-105 [Style 1] Severity: Major
* Target: PRODUCT.md lines 23, 54, 58
* Finding: "paper" and "canvas" merge on line 23 and split on line 58.
* Decision: ESCALATE
* Reason: Design vocabulary.
* Edit: none

### L1-core-1-106 [Style 1] Severity: Major
* Target: AGENTS.md lines 5-6
* Finding: "only adds Cursor Cloud caveats", yet the file has two more sections.
* Decision: ESCALATE
* Reason: AGENTS.md is facts only, and this is framing.
* Edit: none

### L1-core-1-107 [Style 1] Severity: Major
* Target: AGENTS.md lines 49-53
* Finding: `next build` rewrites `next-env.d.ts`, yet "the build itself writes only gitignored files".
* Decision: ESCALATE
* Reason: Needs a build run to settle.
* Edit: none

### L1-core-1-108 [Style 1] Severity: Major
* Target: AGENTS.md line 30
* Finding: "`bun lint` is expected to run" is unclear.
* Decision: ESCALATE
* Reason: Wording.
* Edit: none

### L1-core-1-109 [Style 1] Severity: Major
* Target: CLAUDE.md lines 7 and 11
* Finding: Same as L1-core-1-102.
* Decision: ESCALATE
* Reason: Product positioning.
* Edit: none

### L1-core-1-110 [Style 1] Severity: Major
* Target: CLAUDE.md line 92
* Finding: The dev-warnings sentence skips its premise.
* Decision: ESCALATE
* Reason: Wording.
* Edit: none

### L1-core-1-111 [Style 1] Severity: Major
* Target: CLAUDE.md line 135
* Finding: "which also lists custom views" is ambiguous.
* Decision: ESCALATE
* Reason: Wording.
* Edit: none

### L1-core-1-112 [Style 1] Severity: Major
* Target: CLAUDE.md line 114
* Finding: "React-native API" reads as React Native.
* Decision: ESCALATE
* Reason: Wording.
* Edit: none

### L1-core-1-113 [Style 1] Severity: Major
* Target: coding-standards.md lines 3 and 16
* Finding: "applies to every session" against "Loaded: Never". CLAUDE.md imports the file.
* Decision: ESCALATE
* Reason: Owner's standards document.
* Edit: none

### L1-core-1-114 [Style 1] Severity: Major
* Target: coding-standards.md line 13
* Finding: Same as L1-core-1-28.
* Decision: ESCALATE
* Reason: Same.
* Edit: none

### L1-core-1-115 [Style 1] Severity: Major
* Target: coding-standards.md lines 15, 148, 149
* Finding: Same as L1-core-1-19 and 1-20.
* Decision: ESCALATE
* Reason: Same.
* Edit: none

### L1-core-1-116 [Style 1] Severity: Major
* Target: coding-standards.md line 156
* Finding: Same as L1-core-1-25.
* Decision: ESCALATE
* Reason: Same.
* Edit: none

### L1-core-1-117 [Style 1] Severity: Major
* Target: coding-standards.md lines 33, 94, 96, 220, 230
* Finding: The handoff rules disagree on the ledger and on tiers.
* Decision: ESCALATE
* Reason: Process rules.
* Edit: none

### L1-core-1-118 [Style 1] Severity: Major
* Target: coding-standards.md line 113
* Finding: ">2x the code" has no base.
* Decision: ESCALATE
* Reason: Owner's rule.
* Edit: none

### L1-core-1-119 [Style 1] Severity: Nit
* Target: coding-standards.md line 188
* Finding: The "no exit conditions" example reads as an exit condition.
* Decision: DECLINE
* Reason: Reviewer marked it borderline.
* Edit: none

### L1-core-1-120 [Style 1] Severity: Nit
* Target: CONTRIBUTING.md lines 48, 56-60
* Finding: "both browser suites" names no second suite.
* Decision: DECLINE
* Reason: The file names `test:e2e` and the export suite a few lines apart.
* Edit: none

### L1-core-1-121 [Style 1] Severity: Nit
* Target: README.md lines 20, 62; CLAUDE.md
* Finding: "Add a task bar" against "capture bar".
* Decision: DECLINE
* Reason: UI label against code name.
* Edit: none
