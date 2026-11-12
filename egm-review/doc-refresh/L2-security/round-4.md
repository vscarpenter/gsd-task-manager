# Doc refresh: L2-security, round 4

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| accuracy-A (egm-codebase-details) | SECURITY.md lines 1-226 | ran |
| accuracy-B (egm-codebase-details) | SECURITY.md lines 227-531 | ran |
| accuracy-C (egm-codebase-details) | docs/security-trust-boundaries.md, packages/mcp-server/README-SECURITY.md, .claude/claude-security-guidance.md | ran |
| style | (rounds 1 and 2 only) | not scheduled |

## Findings

### L2-security-4-1 [accuracy-A] Severity: Major
* Target: SECURITY.md lines 26-27
* Finding: "No background network calls in local-only mode." `app/layout.tsx:250` always emits `<link rel="preconnect" href="https://api.vinny.io">`, so every page load opens a connection to the hosted server.
* Decision: ESCALATE
* Reason: The document states a privacy promise and the code may break it. The choice between disclosing the preconnect and making it conditional is the owner's. Listed under possible code defects.
* Edit: none

### L2-security-4-2 [accuracy-A] Severity: Major
* Target: SECURITY.md line 26
* Finding: The service worker makes same-origin background requests (`components/pwa-register.tsx:19-25`, `public/sw.js`).
* Decision: PROPOSE FIX
* Reason: Confirmed. A PWA has to fetch its own origin, so the sentence needed the qualifier.
* Edit: Added the same-origin exception to the bullet.

### L2-security-4-3 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 337-339
* Finding: A manual dispatch runs the policy script only for `both` or `policy`.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-4-4 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 506-509
* Finding: "the same nine files": each commit has 13 entries, nine of them `jwt`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `.gitleaksignore`.
* Edit: Changed to "the same `jwt` entries".

### L2-security-4-5 [accuracy-C] Severity: Blocker
* Target: packages/mcp-server/README-SECURITY.md lines 53, 82-83
* Finding: "Settings → Cloud Sync → Sign out of all devices". The button lives only in the sync dialog (`components/sync/sync-auth-dialog-sections.tsx:220-241`), opened from `components/sync/sync-button.tsx`. Settings has a plain Sign out.
* Decision: PROPOSE FIX
* Reason: Confirmed by search: the label appears in no settings component.
* Edit: Pointed both passages at the sync dialog.

### L2-security-4-6 [accuracy-C] Severity: Nit
* Target: .claude/claude-security-guidance.md lines 32-35
* Finding: Import cap list omits subtask-title, notes, and smart-view bounds.
* Decision: DECLINE
* Reason: Facts-only file; the listed numbers are right.
* Edit: none
