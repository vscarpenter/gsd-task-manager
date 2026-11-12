# Doc refresh: L2-security, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| accuracy-A (egm-codebase-details) | SECURITY.md lines 1-218 | ran |
| accuracy-B (egm-codebase-details) | SECURITY.md lines 219-520 | ran |
| accuracy-C (egm-codebase-details) | docs/security-trust-boundaries.md, packages/mcp-server/README-SECURITY.md, .claude/claude-security-guidance.md | ran |
| style (egm-style) | SECURITY.md, docs/security-trust-boundaries.md, packages/mcp-server/README-SECURITY.md | ran |

## Findings

### L2-security-2-1 [accuracy-A] Severity: Major
* Target: SECURITY.md lines 157-159
* Finding: "renews one during a sync or health check". `lib/sync/health-monitor.ts:108-113` calls `ensureValidAuth` only when the token is already invalid, so only a sync renews.
* Decision: PROPOSE FIX
* Reason: Confirmed. The error came from my round 1 fix.
* Edit: Removed the health check from the sentence.

### L2-security-2-2 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 178-179
* Finding: The MCP server reads `GSD_AUTH_TOKEN` from the environment, not the config file (`packages/mcp-server/src/server/config.ts:94-99`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Reworded.

### L2-security-2-3 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 180-182
* Finding: URL rule also refuses userinfo, query, and fragment.
* Decision: PROPOSE FIX
* Reason: Confirmed in `isSafePocketBaseUrl`.
* Edit: Added the clause.

### L2-security-2-4 [accuracy-A] Severity: Nit
* Target: SECURITY.md line 204
* Finding: Excerpt key `gsd-taskmanager` differs from the README and wizard (`gsd-tasks`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `packages/mcp-server/README.md:168`.
* Edit: Changed the key.

### L2-security-2-5 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 231-234
* Finding: Local PocketBase origins are added only under `NODE_ENV=development` (`app/layout.tsx:39-51`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Reworded.

### L2-security-2-6 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 223-225, 239-243
* Finding: Self-host CSP differs in three directives; the doc does not list them.
* Decision: DECLINE
* Reason: `config/csp.cjs` owns the detail and the doc points there.
* Edit: none

### L2-security-2-7 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 327-328
* Finding: Workflow also waits on the audit and an environment approval.
* Decision: PROPOSE FIX
* Reason: Confirmed in `deploy-cloudfront-infra.yml:44-53`.
* Edit: Added one sentence.

### L2-security-2-8 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 368-370
* Finding: CI passes a file path to the checker; it does not pipe.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Changed the verb.

### L2-security-2-9 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 508-510
* Finding: `braces` arrives transitively through `eslint-config-next`.
* Decision: DECLINE
* Reason: "Only through" holds.
* Edit: none

### L2-security-2-10 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 17
* Finding: Only `1781200000` repairs prefixes; `1781100000` and `1781300000` set the vacuum marker.
* Decision: PROPOSE FIX
* Reason: Confirmed by the marker inserts in both files.
* Edit: Reworded the control with the migration numbers.

### L2-security-2-11 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 19
* Finding: `redactPocketBaseHost` redacts every host, not only private ones.
* Decision: PROPOSE FIX
* Reason: Per the helper's README.
* Edit: Changed to "the PocketBase host".

### L2-security-2-12 [accuracy-C] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 42-44
* Finding: "That check runs before any write". `deleteTask` with no dependents never calls `getAuthInfo` or `requireUsersPrincipal` (`packages/mcp-server/src/write-ops/task-operations.ts:398-431`).
* Decision: ESCALATE
* Reason: The document and `.claude/rules/mcp-server.md` state the rule; one write path lacks the explicit check. Listed under possible code defects.
* Edit: none

### L2-security-2-13 [accuracy-C] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 47-49, 57-58
* Finding: The 30-day migration only raises the duration.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-2-14 [accuracy-C] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 8-9
* Finding: `test-in-claude.sh` matches the ignored pattern and holds no token.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-2-15 [accuracy-C] Severity: Major
* Target: .claude/claude-security-guidance.md lines 21-23
* Finding: System fields "CANNOT be used in sort, filter". `docker/pb_hooks/feedback_controls.pb.js:78-88` filters and sorts on `created`.
* Decision: ESCALATE
* Reason: A rule in a facts-only file, and PocketBase behavior is not checkable from the repo. Listed under possible code defects.
* Edit: none

### L2-security-2-16 [accuracy-C] Severity: Nit
* Target: .claude/claude-security-guidance.md lines 53-56
* Finding: Redaction list is incomplete.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L2-security-2-17 [accuracy-C] Severity: Nit
* Target: .claude/claude-security-guidance.md line 53
* Finding: `lib/error-logger.ts` also masks.
* Decision: DECLINE
* Reason: Rule statement; small.
* Edit: none

### L2-security-2-18 [accuracy-C] Severity: Nit
* Target: .claude/claude-security-guidance.md line 96
* Finding: Token also sits in the setup file.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L2-security-2-19 [accuracy-C] Severity: Nit
* Target: .claude/claude-security-guidance.md lines 105-106
* Finding: Hook also blocks `gitleaks-report.json`.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L2-security-2-20 [accuracy-C] Severity: Nit
* Target: .claude/claude-security-guidance.md line 34
* Finding: The 10,000 cap counts live, archived, and trashed records.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-2-21 [style] Severity: Major
* Target: SECURITY.md lines 315-346
* Finding: Deployment options are not alternatives; the first script run fails by design.
* Decision: PROPOSE FIX
* Reason: Valid, at the scope of my round 1 rewrite.
* Edit: Dropped the option numbering, stated the first-run order, merged the console steps.

### L2-security-2-22 [style] Severity: Major
* Target: SECURITY.md lines 148-151
* Finding: Route is described as blocked and active.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "Left enabled, that route would hand the code..."

### L2-security-2-23 [style] Severity: Major
* Target: SECURITY.md lines 80-81 vs 134-135
* Finding: Apple is a provider but has no CSP origin.
* Decision: ESCALATE
* Reason: `config/csp.cjs` marks the OAuth origins as an owner decision. Carried from round 1.
* Edit: none

### L2-security-2-24 [style] Severity: Major
* Target: SECURITY.md lines 89-93
* Finding: "The two" is ambiguous.
* Decision: PROPOSE FIX
* Reason: Valid, in my round 1 text.
* Edit: Named both.

### L2-security-2-25 [style] Severity: Major
* Target: SECURITY.md lines 368-371, 40
* Finding: "which decides" has no object; line 40 reads as a bare gate.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Stated what the checker does and added a pointer at line 40.

### L2-security-2-26 [style] Severity: Major
* Target: SECURITY.md lines 501-503
* Finding: "separately approved manual gate" is ambiguous.
* Decision: ESCALATE
* Reason: `tests/data/security-hardening-scripts.test.ts:312` pins this exact string.
* Edit: none

### L2-security-2-27 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 16
* Finding: "hook marker" has no referent.
* Decision: PROPOSE FIX
* Reason: `docker/Caddyfile:83-87` describes the marker route.
* Edit: Added a gloss.

### L2-security-2-28 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 13
* Finding: Cursor terms undefined.
* Decision: PROPOSE FIX
* Reason: `.claude/rules/pocketbase-sync.md` and `lib/sync/pb-pull.ts` define them.
* Edit: Spelled out the skew cap and the overlap.

### L2-security-2-29 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 17
* Finding: "the vacuum they mark" is unclear.
* Decision: PROPOSE FIX
* Reason: Same edit as the accuracy Nit.
* Edit: Reworded.

### L2-security-2-30 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 10
* Finding: "duplicate input" is ambiguous.
* Decision: PROPOSE FIX
* Reason: `lib/tasks/crud/create.ts` derives the quadrant from the flags.
* Edit: Reworded.

### L2-security-2-31 [style] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 38-59
* Finding: "the server" means two things.
* Decision: PROPOSE FIX
* Reason: Valid, in my round 1 text.
* Edit: Named the MCP server and PocketBase.

### L2-security-2-32 [style] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 39-46
* Finding: Exit reads as unconditional; "that check" is ambiguous.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Added the condition and named the check.

### L2-security-2-33 [style] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md line 7 vs 34
* Finding: Whether a populated `claude-config.json` should exist.
* Decision: ESCALATE
* Reason: Owner's working practice; not settled by code.
* Edit: none
