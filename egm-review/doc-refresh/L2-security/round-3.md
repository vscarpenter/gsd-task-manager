# Doc refresh: L2-security, round 3

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| accuracy-A (egm-codebase-details) | SECURITY.md lines 1-221 | ran |
| accuracy-B (egm-codebase-details) | SECURITY.md lines 222-523 | ran |
| accuracy-C (egm-codebase-details) | docs/security-trust-boundaries.md, packages/mcp-server/README-SECURITY.md, .claude/claude-security-guidance.md | ran |
| style | (rounds 1 and 2 only) | not scheduled |

## Findings

### L2-security-3-1 [accuracy-A] Severity: Major
* Target: SECURITY.md lines 26-28
* Finding: "The one outbound request is the feedback". Hovering or focusing a sign-in button calls `listAuthMethods` on the server (`components/sync/oauth-buttons.tsx:178`, `lib/sync/pb-auth.ts:59-79`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The code comment shows the prefetch is deliberate, so the document was behind. Flagged to the owner because it is a privacy claim.
* Edit: Rewrote the bullet as two user actions that send a request.

### L2-security-3-2 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 142-143
* Finding: The redirect forwards `code`, `state`, and `error`.
* Decision: PROPOSE FIX
* Reason: Confirmed in round 1 against `docker/pb_hooks/oauth-web-redirect.js`.
* Edit: Added "or error".

### L2-security-3-3 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 92-93, 165-166
* Finding: HTTPS development hosts and `*.local` hosts resolve differently.
* Decision: DECLINE
* Reason: Edge cases below this document's level.
* Edit: none

### L2-security-3-4 [accuracy-A] Severity: Nit
* Target: SECURITY.md line 193
* Finding: Deletes default to dry run.
* Decision: DECLINE
* Reason: Not wrong; the package README holds the detail.
* Edit: none

### L2-security-3-5 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 79-80
* Finding: Logger also masks task-content keys.
* Decision: DECLINE
* Reason: Omission, not an error.
* Edit: none

### L2-security-3-6 [accuracy-B] Severity: Major
* Target: SECURITY.md lines 500-503
* Finding: Only commit `e9230cb` is named. `.gitleaksignore` lists the same nine `jwt` files under `f3e5edf`.
* Decision: PROPOSE FIX
* Reason: Confirmed. Both commits carry the same release title. The test-pinned strings stay.
* Edit: Added one sentence naming `f3e5edf`.

### L2-security-3-7 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 332-334
* Finding: Workflow also runs on manual dispatch.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added "or on a manual dispatch".

### L2-security-3-8 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 234-236
* Finding: Dev CSP also allows `http://localhost:8400` and inline styles.
* Decision: DECLINE
* Reason: `app/layout.tsx` owns the list.
* Edit: none

### L2-security-3-9 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 237-238
* Finding: Other additions in the development branch; `NODE_ENV=test` case.
* Decision: DECLINE
* Reason: Same.
* Edit: none

### L2-security-3-10 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 314-315
* Finding: The Caddyfile comment says why COOP is set, not why it allows popups.
* Decision: PROPOSE FIX
* Reason: Confirmed in `docker/Caddyfile:41-43`.
* Edit: Reworded.

### L2-security-3-11 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 226-228
* Finding: Self-host CSP differences and stripped headers not listed.
* Decision: DECLINE
* Reason: Declined in round 2.
* Edit: none

### L2-security-3-12 [accuracy-C] Severity: Major
* Target: docs/security-trust-boundaries.md line 10
* Finding: Control says derive quadrant state. `deriveQuadrant` in `lib/schema.ts:22-31` keeps a supplied `quadrant` on import, and nothing checks it against the flags.
* Decision: ESCALATE
* Reason: The document states a required control and the import path does not apply it. Listed under possible code defects.
* Edit: none

### L2-security-3-13 [accuracy-C] Severity: Major
* Target: docs/security-trust-boundaries.md line 20
* Finding: Control says keep task content out of the log line. `lib/logger.ts:207-222` passes error text through a credential mask only; callers do the rest.
* Decision: ESCALATE
* Reason: A stated control the listed entry points do not enforce. Listed under possible code defects.
* Edit: none

### L2-security-3-14 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 19
* Finding: Entry points omit the handlers that map backend errors to safe codes.
* Decision: DECLINE
* Reason: Tied to the escalated row; leave for the owner.
* Edit: none

### L2-security-3-15 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 17
* Finding: `docker/pb_fresh_migrations/1781000000_encrypt_existing_tasks.js` not listed.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-3-16 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 11
* Finding: Smart views parse as `unknown` first; bounds file not listed.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-3-17 [accuracy-C] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 8, 13
* Finding: `test-in-claude.sh` holds no credential.
* Decision: DECLINE
* Reason: Declined in round 2.
* Edit: none

### L2-security-3-18 [accuracy-C] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 29-31
* Finding: macOS path only.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L2-security-3-19 [accuracy-C] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 47-48, 58
* Finding: Migration only raises the duration.
* Decision: DECLINE
* Reason: Declined in round 2.
* Edit: none

### L2-security-3-20 [accuracy-C] Severity: Nit
* Target: .claude/claude-security-guidance.md lines 18-19
* Finding: Update rule has an extra clause.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L2-security-3-21 [accuracy-C] Severity: Nit
* Target: .claude/claude-security-guidance.md line 34
* Finding: Cap counts all three record kinds; smart-view caps omitted.
* Decision: DECLINE
* Reason: Declined in round 2.
* Edit: none
