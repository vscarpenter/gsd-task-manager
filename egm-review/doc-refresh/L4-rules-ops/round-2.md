# Doc refresh: L4-rules-ops, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A1 | the five `.claude/rules/*.md` files | ran |
| egm-codebase-details A2 | `docs/ops/gate2.md`, `github-actions-iam.md`, `pipeline-audit.md` | ran |
| egm-codebase-details A3 | `tests/e2e/README.md`, `tests/fixtures/README.md` | ran |
| egm-style S1 | all ten files | ran |

Not clean because of 2-9 (Blocker, new), and the new Majors 2-10, 2-15, 2-17, 2-18.

## Findings

### L4-rules-ops-2-1 [A1] Severity: Nit
* Target: .claude/rules/archive-tombstone.md lines 28, 49, 51, 55, 56
* Finding: four nits. Rule 4's examples are narrower than the code now (`restoreTask` deletes the archive row in the same transaction, `lib/archive.ts:163-182`). "All retry-exhausted" is slightly stricter than `lib/sync/queue.ts:65-74`. `resurrectOnSight` may also overwrite a live row (`resurrect-on-sight.ts:126-131`). Two rows omit their transaction scope.
* Decision: DECLINE
* Reason: no row is wrong. Facts-only file. Same items as 1-6.
* Edit: none

### L4-rules-ops-2-2 [A1] Severity: Nit
* Target: .claude/rules/pocketbase-sync.md line 24
* Finding: "every way out of Trash forgets the id" is false for three paths: `pb-pull.ts:168`, `pb-sync-engine.ts:134`, and replace-mode import (`import-export.ts:284`, whose transaction does not scope `syncMetadata`).
* Decision: ESCALATE
* Reason: the document states a rule and the code departs from it. Listed under possible code defects. The next `resurrectOnSight` run forgets stale ids, so the effect may be benign.
* Edit: none

### L4-rules-ops-2-3 [A1] Severity: Nit
* Target: .claude/rules/pocketbase-sync.md lines 26, 29, 44-46
* Finding: the refresh window is seven days; Apple is a third provider; `resolvePushPrincipal` is one more push check.
* Decision: DECLINE
* Reason: what the lines name is correct.
* Edit: none

### L4-rules-ops-2-4 [A1] Severity: Nit
* Target: .claude/rules/sw-cache.md lines 19-20, 31
* Finding: "every build rotates" depends on the version in `.build-info.json`. Two fresh-checkout builds of one package version stamp the same cache version (`scripts/generate-build-info.cjs:24-36`).
* Decision: ESCALATE
* Reason: the rule may state the intent and the stamp may be the gap. Not settled from the code alone.
* Edit: none

### L4-rules-ops-2-5 [A1, S1] Severity: Nit (A1), Major (S1)
* Target: .claude/rules/testing.md lines 20-25, 38-39
* Finding: the layout sends a reader to `tests/sync/` for sync tests, but most live in `tests/data/sync/`.
* Decision: PROPOSE FIX
* Reason: confirmed by listing both directories. The `tests/sync/` line came from my round 1 edit.
* Edit: the `tests/data/` line now names `tests/data/sync/`, and the `tests/sync/` line says it holds a few older tests.

### L4-rules-ops-2-6 [S1] Severity: Major
* Target: .claude/rules/archive-tombstone.md lines 18-20, 57, 68; .claude/rules/pocketbase-sync.md lines 22-23, 59
* Finding: six wording findings, all raised in round 1 (1-7, 1-14).
* Decision: ESCALATE
* Reason: already settled as escalated. Wording under `.claude/`.
* Edit: none

### L4-rules-ops-2-7 [A2] Severity: Major
* Target: docs/ops/gate2.md lines 3-5, 24; docs/ops/github-actions-iam.md lines 6-7, 24
* Finding: the local `bun run deploy` path, and `/release` tagging local HEAD.
* Decision: ESCALATE
* Reason: already settled as escalated in round 1 (1-25, 1-26).
* Edit: none

### L4-rules-ops-2-8 [A2] Severity: Nit
* Target: docs/ops/gate2.md lines 58-59; docs/ops/pipeline-audit.md line 5
* Finding: the rollback command prints only when an earlier tag exists. `scripts/triage-run.sh` is off unless `GSD_TRIAGE_BOT_LOGIN` is set.
* Decision: PROPOSE FIX
* Reason: confirmed (`deploy-production-release.yml:103-112`, `triage-run.sh:29-32`). Both sentences were mine from round 1.
* Edit: corrected both sentences.

### L4-rules-ops-2-9 [A3] Severity: Blocker
* Target: tests/fixtures/README.md lines 135-140
* Finding: the Database Mocking example mocks a `db` export. `lib/db.ts` exports only `getDb()` (line 35).
* Decision: PROPOSE FIX
* Reason: confirmed by `rg "^export" lib/db.ts`.
* Edit: the example now mocks `getDb`.

### L4-rules-ops-2-10 [A3] Severity: Major
* Target: tests/fixtures/README.md lines 252-254
* Finding: `sw-cache-rules.json` pins two web-app copies, not an app and MCP pair, and the MCP directory has three of the four tests.
* Decision: PROPOSE FIX
* Reason: confirmed by listing both `pinned-copies` test directories. The sentence was mine from round 1.
* Edit: reworded the `pinned-copies/` bullet.

### L4-rules-ops-2-11 [A3] Severity: Major
* Target: tests/fixtures/README.md lines 201-207
* Finding: `expectToReject` swallows its own failure.
* Decision: ESCALATE
* Reason: already settled as escalated in round 1 (1-61). Possible code defect.
* Edit: none

### L4-rules-ops-2-12 [A3] Severity: Nit
* Target: tests/e2e/README.md lines 133-137
* Finding: the chromium CI leg also runs `bun run test:csp` (`ci.yml:168-170`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: added one sentence.

### L4-rules-ops-2-13 [A3] Severity: Nit
* Target: tests/e2e/README.md lines 44, 82-98, 114-116, 125-126; tests/fixtures/README.md lines 32-44, 126-133, 159-188, 247
* Finding: eleven nits on unstated fixture options and example limits (`firstTimeVisitor`, `serviceWorkerEnabled`, the palette route to `/archive`, `mockDateNow` scope, two `const fetchMock` in one block, an unhelpful `urgent: true` override).
* Decision: DECLINE
* Reason: the stated claims hold. More detail would turn the guides into inventories.
* Edit: none

### L4-rules-ops-2-14 [A2] Severity: Nit
* Target: docs/ops/gate2.md lines 7, 41, 65-67; docs/ops/github-actions-iam.md lines 91, 102, 144, 158-159, 301-321
* Finding: seven nits: the workflow does not validate the rollback tag; the rollback paragraph omits the version check; "§7.5"; unused S3 permissions; the first policy run fails until the policy is attached; the function script publishes both functions; `.github/REPOSITORY_SETTINGS.md:93` words the environment policy differently.
* Decision: DECLINE
* Reason: policy statements or AWS and GitHub state that the repo cannot settle. "§7.5" is escalated (1-38).
* Edit: none

### L4-rules-ops-2-15 [S1] Severity: Major
* Target: docs/ops/github-actions-iam.md lines 11-18
* Finding: the page shows `gh workflow disable deploy-prod.yml` without saying whether to run it.
* Decision: PROPOSE FIX
* Reason: the sentence was mine from round 1, and it left the question open.
* Edit: added "It is shown here as a record. A new setup does not run it".

### L4-rules-ops-2-16 [S1] Severity: Major
* Target: docs/ops/gate2.md lines 75-76; docs/ops/github-actions-iam.md line 144; docs/ops/pipeline-audit.md lines 5, 17-21
* Finding: "the local unattended builder" and "workflow labels" have no referent in gate2.md; "§7.5"; the status block does not say which parts of the audit policy still apply; "plan-revision rate" has no source.
* Decision: ESCALATE
* Reason: already settled as escalated (1-38, 1-42). What stays in force is the owner's decision.
* Edit: none

### L4-rules-ops-2-17 [S1] Severity: Major
* Target: tests/e2e/README.md lines 100-113
* Finding: "spec" means both the document `tasks/e2e-testing-spec.md` and a Playwright test file.
* Decision: PROPOSE FIX
* Reason: my round 1 sentences added the second sense inside that section.
* Edit: the section now says "test stubs from that document" and "e2e test file".

### L4-rules-ops-2-18 [S1] Severity: Major
* Target: .claude/rules/testing.md lines 22, 38
* Finding: sync test location stated two ways.
* Decision: PROPOSE FIX
* Reason: same as 2-5.
* Edit: see 2-5.
