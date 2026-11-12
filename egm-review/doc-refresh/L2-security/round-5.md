# Doc refresh: L2-security, round 5

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| accuracy-A (egm-codebase-details) | SECURITY.md lines 1-228 | ran |
| accuracy-B (egm-codebase-details) | SECURITY.md lines 229-533 | ran |
| accuracy-C (egm-codebase-details) | docs/security-trust-boundaries.md, packages/mcp-server/README-SECURITY.md, .claude/claude-security-guidance.md | ran |
| style | (rounds 1 and 2 only) | not scheduled |

## Findings

### L2-security-5-1 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 88-89
* Finding: The `connect-src` sentence describes the CloudFront policy only.
* Decision: PROPOSE FIX
* Reason: Confirmed in `config/csp.cjs`.
* Edit: Added "CloudFront".

### L2-security-5-2 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 172-173
* Finding: HTTPS development hosts use their own origin.
* Decision: DECLINE
* Reason: Declined in round 3.
* Edit: none

### L2-security-5-3 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 7-14
* Finding: Table of contents omits two sections.
* Decision: DECLINE
* Reason: Structure, not a fact.
* Edit: none

### L2-security-5-4 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 339-341
* Finding: Manual dispatch runs the policy script only for `both` or `policy`.
* Decision: PROPOSE FIX
* Reason: Raised twice; confirmed.
* Edit: "a manual dispatch that includes the policy".

### L2-security-5-5 [accuracy-C] Severity: Blocker
* Target: packages/mcp-server/README-SECURITY.md lines 82-83, 53
* Finding: "open the sync dialog from the sync button in the app header". For a signed-in, healthy session the button runs a sync (`components/sync/sync-button.tsx:112-129`). The dialog opens only when sync is off, on an auth error, or from the onboarding event.
* Decision: ESCALATE
* Reason: Confirmed. The route was my round 4 wording, so I removed it. No reachable route to the revoke control exists for a healthy signed-in session, which the document cannot fix. Listed under possible code defects.
* Edit: Removed the header-button route; the text now names the dialog only.

### L2-security-5-6 [accuracy-C] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md line 45
* Finding: "each call reports the connection problem". `get_sync_status` returns `healthy: false` with no message (`src/tools/sync-status.ts:23-30`), and `validate_config` reports "Token validation failed" (`src/tools/handlers/system-handlers.ts:20-33`).
* Decision: ESCALATE
* Reason: The document states the intended behavior and three tools do something else. Listed under possible code defects.
* Edit: none

### L2-security-5-7 [accuracy-C] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md line 34 vs 69-72
* Finding: Example template is not the pinned form.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L2-security-5-8 [accuracy-C] Severity: Major
* Target: docs/security-trust-boundaries.md line 12
* Finding: "remove retired query payloads before network … use" holds only once a service worker controls the page (`public/sw.js:119-135`).
* Decision: PROPOSE FIX
* Reason: Confirmed. SECURITY.md already says "controlled network request".
* Edit: Scoped the control to service-worker-controlled requests.

### L2-security-5-9 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 18
* Finding: Throttle covers delete and bulk writes only.
* Decision: PROPOSE FIX
* Reason: Confirmed in `src/write-ops/README.md`.
* Edit: Reworded.

### L2-security-5-10 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 18
* Finding: Bulk cap values are not stated.
* Decision: DECLINE
* Reason: The code owns the numbers.
* Edit: none

## Loop result

Cap reached after round 5. SECURITY.md had no Blocker or Major in round 5. The round 5 edits to the trust map and the MCP security README have not been re-reviewed.
