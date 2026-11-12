# Doc refresh: L1-core, round 6

Status: resolved
Clean round: no

Last round of the continuation (cap). The reviewers were told to trace behavior claims end to end, since earlier rounds had already confirmed paths, scripts, counts, and versions. All four Majors are escalated. No document changed in this round. The round 5 edits to the `Stop` hook section passed a clause-by-clause check by Reviewer C.

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A (egm-codebase-details) | README.md (outside Repository blueprint), CONTRIBUTING.md, ARCHITECTURE.md | ran |
| Accuracy B (egm-codebase-details) | CLAUDE.md, AGENTS.md, docs/agents: README.md, domain.md, issue-tracker.md, night-shift.md, triage-labels.md | ran |
| Accuracy C (egm-codebase-details) | .claude/README.md | ran |

## Findings

### L1-core-6-1 [Accuracy A] Severity: Major
* Target: README.md lines 28-29
* Finding: "user-controlled update prompts". The install handler calls `self.skipWaiting()` on its own (`public/sw.js:48`), and activation claims clients (`public/sw.js:75`). The prompt lets the user choose when to reload. It does not hold the new worker back. "Later" only hides the toast (`components/pwa-update-toast.tsx:87-89`).
* Decision: ESCALATE
* Reason: Confirmed in `public/sw.js:48,75,81-82`. The worker also keeps a `SKIP_WAITING` message handler that the toast posts to, which suggests the design meant the worker to wait for the user. The code may be the defect, so the README stays. Listed under possible code defects.
* Edit: none

### L1-core-6-2 [Accuracy A] Severity: Nit
* Target: README.md line 24
* Finding: "circular-dependency prevention" holds in the edit drawer only. See L1-core-6-7.
* Decision: DECLINE
* Reason: True for the shipped UI path. The data-layer gap is escalated under L1-core-6-7.
* Edit: none

### L1-core-6-3 [Accuracy A] Severity: Nit
* Target: README.md line 69
* Finding: A task with a running timer cannot move to Saved (`lib/tasks/saved-placement.ts:10-11`).
* Decision: DECLINE
* Reason: Small omission. The app tells the user.
* Edit: none

### L1-core-6-4 [Accuracy A] Severity: Nit
* Target: README.md lines 26-27
* Finding: The weekly sweep also shows items saved 30 or more days ago (`lib/weekly-sweep.ts:26,91-92`).
* Decision: DECLINE
* Reason: Small omission. No stated claim is false.
* Edit: none

### L1-core-6-5 [Accuracy A] Severity: Nit
* Target: ARCHITECTURE.md line 16
* Finding: The "Task domain operations" row points at `lib/tasks/`. Archive, trash, cycle checks, top three, sweep, and filters live in `lib/` root.
* Decision: DECLINE
* Reason: The page is a map and says it is not exhaustive. `lib/README.md` owns the detail.
* Edit: none

### L1-core-6-6 [Accuracy B] Severity: Major
* Target: CLAUDE.md line 66
* Finding: "All task operations validate with Zod schemas before persisting." Only create and update parse the task (`lib/tasks/crud/create.ts:33`, `update.ts:63`). Toggle, the recurring spawn, move, snooze, duplicate, restore, and the dependency writers call `db.tasks.put` or `add` with no schema parse (`lib/tasks/crud/toggle.ts:73,129`, `move.ts:34`, `snooze.ts:46`, `duplicate.ts:30`, `restore.ts:26`, `lib/tasks/dependencies.ts:24,44,65`).
* Decision: ESCALATE
* Reason: Confirmed by search of `lib/tasks/`. The line states an invariant and the code does something else. The document may be the correct side. Listed under possible code defects.
* Edit: none

### L1-core-6-7 [Accuracy B] Severity: Major
* Target: CLAUDE.md line 128
* Finding: "Always validate circular dependencies before adding relationships." `addDependency` (`lib/tasks/dependencies.ts:12-27`) and `updateTask` do not check for cycles. `validateDependencies` (`lib/dependencies.ts:165`) has no caller in `app/`, `components/`, or `lib/`. The only web check is in `components/matrix-simplified/edit-drawer-dependencies.tsx:28,219`.
* Decision: ESCALATE
* Reason: Confirmed by search. The line is a rule for whoever writes code, and the data layer does not back it. Listed under possible code defects.
* Edit: none

### L1-core-6-8 [Accuracy B] Severity: Nit
* Target: CLAUDE.md lines 15, 48-50, 65, 67, 117, 118
* Finding: The ⌘K binding lives in `lib/use-command-palette.ts:112` and `app-shell.tsx` only mounts the palette. `n` and `/` behave differently by page and modifier. The `deploy-cloudfront-infra` deploy waits on an audit job and an environment reviewer. The CloudFront function also serves `index.md` for markdown clients. Every dependency is pinned exact, not only `canvas-confetti`. `time-tracking.ts` imports `nanoid` directly. `useTasks().all` excludes saved tasks.
* Decision: DECLINE
* Reason: Each is a small omission or precision point, and none sends a reader to something that does not exist.
* Edit: none

### L1-core-6-9 [Accuracy B] Severity: Nit
* Target: AGENTS.md lines 19-20, 43-45
* Finding: The "Open App" call to action is on the About page hero (`components/about/hero-section.tsx:32`), not in the onboarding component. `generate-build-info.cjs` also writes `.build-info.json`.
* Decision: DECLINE
* Reason: Small. AGENTS.md is facts only, and a reader still finds the button.
* Edit: none

### L1-core-6-10 [Accuracy C] Severity: Major
* Target: .claude/README.md lines 9-23
* Finding: The setup steps omit `bun install`. The `Stop` typecheck runs `bunx --no-install ...` (`package.json:26`), and the lint hooks need the repo's ESLint packages.
* Decision: ESCALATE
* Reason: The `--no-install` flag is confirmed. Whether the gate fails without dependencies needs a run, which this loop does not do. Adding a setup step is onboarding guidance in a `.claude/` file, which is the owner's to word.
* Edit: none

### L1-core-6-11 [Accuracy C] Severity: Nit
* Target: .claude/README.md lines 73-77, 210, 216, 224, 230-233, 247
* Finding: The `Stop` typecheck skips `packages/` and `worker/` (`tsconfig.json:42-51`). The troubleshooting entry omits the hook's skip list and ESLint's own ignores. Line 210 gives no `components/` condition for the `a11y-reviewer` auto-invoke. "Diagnose using `pb-sync-reviewer`" overstates a checklist reviewer. Line 247 repeats the settled "comment out a JSON block" advice.
* Decision: DECLINE
* Reason: Small. Line 247 falls under the settled L1-core-1-76.
* Edit: none
