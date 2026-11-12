# Doc refresh: L2-security, round 1

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| accuracy-A (egm-codebase-details) | SECURITY.md lines 1-198 | ran |
| accuracy-B (egm-codebase-details) | SECURITY.md lines 199-509 | ran |
| accuracy-C (egm-codebase-details) | docs/security-trust-boundaries.md | ran |
| accuracy-D (egm-codebase-details) | packages/mcp-server/README-SECURITY.md, .claude/claude-security-guidance.md | ran |
| style (egm-style) | SECURITY.md, docs/security-trust-boundaries.md, packages/mcp-server/README-SECURITY.md | ran |

## Findings

### L2-security-1-1 [accuracy-A] Severity: Major
* Target: SECURITY.md line 148
* Finding: "Tokens auto-refresh via PocketBase SDK." The app renews, only in a token's last 7 days, during a sync or health check (`lib/sync/pb-auth.ts` `ensureValidAuth`, `AUTH_REFRESH_THRESHOLD_SECONDS`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `pb-auth.ts`, `pb-sync-engine.ts:242`, `health-monitor.ts:113`.
* Edit: Replaced the bullet with the 30-day life, the 7-day renewal window, and the expired case.

### L2-security-1-2 [accuracy-A] Severity: Major
* Target: SECURITY.md lines 89-90
* Finding: "The app ships pointed at the hosted service." Only the `gsd.vinny.dev` host maps to it; other hosts use their own origin; `NEXT_PUBLIC_POCKETBASE_URL` overrides (`lib/env-config.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `resolvePocketBaseUrl` and `getEnvironmentConfig`.
* Edit: Rewrote the paragraph's second sentence and added the override.

### L2-security-1-3 [accuracy-A] Severity: Major
* Target: SECURITY.md line 122
* Finding: Offline queue replay omits sign-out clearing the queue, row retirement at `MAX_RETRIES`, and the session check added to the push (`lib/sync/pb-push.ts`, `lib/sync/config/disable.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed `db.syncQueue.clear()` in `disable.ts` and the session checks in `pb-push.ts`.
* Edit: Rewrote the bullet and added one bullet on the push session check.

### L2-security-1-4 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 136-137
* Finding: Callback page closes only on a delivered result (`app/auth/callback/page.tsx`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Reworded the bullet.

### L2-security-1-5 [accuracy-A] Severity: Nit
* Target: SECURITY.md line 114
* Finding: Update rule also refuses an owner change (`scripts/setup-pocketbase-collections.sh:89`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added one bullet.

### L2-security-1-6 [accuracy-A] Severity: Nit
* Target: SECURITY.md line 152
* Finding: "HTTPS-only" is not enforced by the web app in development (`lib/env-config.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed the `http://127.0.0.1:8090` default.
* Edit: Scoped the bullet to production.

### L2-security-1-7 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 80-81
* Finding: `connect-src` lists Google and GitHub only; Apple is a provider but absent (`config/csp.cjs`).
* Decision: PROPOSE FIX
* Reason: Confirmed `OAUTH_ORIGINS`.
* Edit: Named the two origins. Whether Apple needs an entry is left to the owner.

### L2-security-1-8 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 183-195
* Finding: Config example has no `command` or `args`.
* Decision: PROPOSE FIX
* Reason: Confirmed against `packages/mcp-server/README.md:169`.
* Edit: Added a pointer to the full entry.

### L2-security-1-9 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 161-179
* Finding: MCP startup refuses superuser tokens and unsafe URLs (`packages/mcp-server/src/server/config.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed `isSafePocketBaseUrl` and `isSuperuserAuthToken`.
* Edit: Added one bullet.

### L2-security-1-10 [accuracy-A] Severity: Nit
* Target: SECURITY.md lines 118-122
* Finding: Clock-skew guard, edit-beats-delete, and identity confirmation are not mentioned.
* Decision: DECLINE
* Reason: The trust-boundaries map owns this detail; the session check is now stated.
* Edit: none

### L2-security-1-11 [accuracy-A] Severity: Nit
* Target: SECURITY.md line 121
* Finding: Echo filtering skips when a device id is empty (`lib/sync/pb-realtime.ts:99`).
* Decision: DECLINE
* Reason: Detail below this document's level.
* Edit: none

### L2-security-1-12 [accuracy-B] Severity: Blocker
* Target: SECURITY.md lines 267-271
* Finding: Doc says `X-XSS-Protection: 1; mode=block`. The policy sets `Protection: false`, and the Caddyfile sends none.
* Decision: PROPOSE FIX
* Reason: Confirmed in `cloudfront/response-headers-policy.json`.
* Edit: Rewrote the subsection.

### L2-security-1-13 [accuracy-B] Severity: Blocker
* Target: SECURITY.md lines 312-319
* Finding: `cloudfront-security-headers.json` does not exist; the deploy script uses `--response-headers-policy-config`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Removed the hand-run CLI option (old Option 2).

### L2-security-1-14 [accuracy-B] Severity: Major
* Target: SECURITY.md lines 285-355
* Finding: Deployment section omits `scripts/deploy-cloudfront-response-headers-policy.sh` and the `deploy-cloudfront-infra` workflow, and recommends the console.
* Decision: PROPOSE FIX
* Reason: Confirmed script and workflow.
* Edit: New Option 1 describes the script. Console became Option 2, cut to attach and invalidate. Option 3 now points at the policy file.

### L2-security-1-15 [accuracy-B] Severity: Major
* Target: SECURITY.md lines 279-283
* Finding: Permissions-Policy has 18 directives, not 4.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Replaced the 4-directive block with a summary and a pointer to the policy file.

### L2-security-1-16 [accuracy-B] Severity: Major
* Target: SECURITY.md lines 201-283
* Finding: COOP and CORP headers are missing.
* Decision: PROPOSE FIX
* Reason: Confirmed in the policy file and Caddyfile.
* Edit: Added subsection 8.

### L2-security-1-17 [accuracy-B] Severity: Major
* Target: SECURITY.md lines 207-218
* Finding: The Development/Testing CSP block matches no code; dev CSP is a meta tag in `app/layout.tsx`; tests serve the production policy.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Replaced the block with a short description.

### L2-security-1-18 [accuracy-B] Severity: Major
* Target: SECURITY.md line 477
* Finding: "PocketBase 0.39.10" in the 2026-08-10 audit; the pin is 0.40.4 (`docker/Dockerfile:47`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The dated list stays as written.
* Edit: Added a short paragraph after the list.

### L2-security-1-19 [accuracy-B] Severity: Major
* Target: SECURITY.md lines 475, 361-365
* Finding: Bare `bun audit` now reports the accepted `braces` advisory; CI uses `scripts/check-audit-results.cjs` and a `--prod` pass.
* Decision: PROPOSE FIX
* Reason: Confirmed in `.github/workflows/security-audit.yml`.
* Edit: Added a note under Regular Audits and in the paragraph after the audit list.

### L2-security-1-20 [accuracy-B] Severity: Nit
* Target: SECURITY.md line 379
* Finding: Coverage thresholds are 80/80/80/75.
* Decision: PROPOSE FIX
* Reason: Confirmed in `vitest.config.ts`.
* Edit: Reworded.

### L2-security-1-21 [accuracy-B] Severity: Nit
* Target: SECURITY.md line 381
* Finding: No staging target; the check is `bun run test:csp`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `package.json`.
* Edit: Reworded.

### L2-security-1-22 [accuracy-B] Severity: Nit
* Target: SECURITY.md lines 344-350
* Finding: ETag placeholder names the wrong step.
* Decision: PROPOSE FIX
* Reason: Moot: the section was removed under the Blocker above.
* Edit: Removed with old Option 2.

### L2-security-1-23 [accuracy-C] Severity: Major
* Target: docs/security-trust-boundaries.md line 13
* Finding: Sync row has no session control (`lib/sync/sync-session.ts`, `pb-push.ts`, `config/disable.ts`, `config/get-set.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added the control to the row.

### L2-security-1-24 [accuracy-C] Severity: Major
* Target: docs/security-trust-boundaries.md line 13
* Finding: `components/sync/use-sync-auth-dialog.ts` is a missing entry point.
* Decision: PROPOSE FIX
* Reason: Confirmed `persistSyncConfig`.
* Edit: Added the entry point.

### L2-security-1-25 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 13
* Finding: Session tests are covered only by the directory reference.
* Decision: DECLINE
* Reason: `tests/data/sync/` already covers them.
* Edit: none

### L2-security-1-26 [accuracy-C] Severity: Major
* Target: docs/security-trust-boundaries.md line 19
* Finding: Row says never echo raw backend errors; `packages/mcp-server/src/api/client.ts:34-39,70` puts the raw body and network error in the message.
* Decision: ESCALATE
* Reason: The document states a rule and the code breaks it. `apiRequest` has no caller outside its directory, so it may be dead code. Listed under possible code defects.
* Edit: none

### L2-security-1-27 [accuracy-C] Severity: Major
* Target: docs/security-trust-boundaries.md line 21
* Finding: `tests/data/security-headers-policy.test.ts` has no cache assertion.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Replaced it with `service-worker-privacy.test.ts` and `service-worker-offline.test.ts`.

### L2-security-1-28 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 21
* Finding: Share-target POST is answered, not passed through (`public/sw.js:115-118`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added the exception.

### L2-security-1-29 [accuracy-C] Severity: Major
* Target: docs/security-trust-boundaries.md line 17
* Finding: Two later migrations and the vacuum hook are missing; no migration runs the vacuum.
* Decision: PROPOSE FIX
* Reason: Confirmed in `docker/pb_migrations/` and `docker/pb_hooks/migration_cleanup.pb.js`.
* Edit: Added three entry points and reworded the control. The test-pinned file names stay.

### L2-security-1-30 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 12
* Finding: Capture row lacks `use-matrix-window-events.ts` and the share-target path.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added the entry point, the clause, and the privacy test.

### L2-security-1-31 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 10
* Finding: `move.ts` writes with no Zod parse.
* Decision: DECLINE
* Reason: It derives flags from a quadrant id and takes no free input.
* Edit: none

### L2-security-1-32 [accuracy-C] Severity: Nit
* Target: docs/security-trust-boundaries.md line 20
* Finding: Only credential query values are masked; the logger does not itself keep task content out of the message.
* Decision: PROPOSE FIX
* Reason: Confirmed the pattern in `lib/logger.ts:69`. The second half states a rule, so it stays.
* Edit: Changed to "credential-bearing query values".

### L2-security-1-33 [accuracy-D] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 21-22
* Finding: Placeholder is `YOUR_AUTH_TOKEN_HERE`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `test-token.sh.example:9`.
* Edit: Corrected.

### L2-security-1-34 [accuracy-D] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 7-12
* Finding: .gitignore also has `*-token*.sh` and `*-passphrase*.sh`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added one line.

### L2-security-1-35 [accuracy-D] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 28-31
* Finding: Config path is macOS only.
* Decision: DECLINE
* Reason: The main README covers other platforms.
* Edit: none

### L2-security-1-36 [accuracy-D] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 33, 67-70
* Finding: Example config is not the pinned form.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-1-37 [accuracy-D] Severity: Nit
* Target: packages/mcp-server/README-SECURITY.md lines 38-41
* Finding: Two superuser gates exist; the doc describes one.
* Decision: DECLINE
* Reason: Which gate fires depends on token claims the repo does not show.
* Edit: none

### L2-security-1-38 [accuracy-D] Severity: Blocker
* Target: .claude/claude-security-guidance.md lines 32-35
* Finding: Five limits are wrong: title 80, description 600, tag 30, max tags 20, time entries 1,000 (`lib/constants/schema.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Corrected the numbers and named the constants file.

### L2-security-1-39 [accuracy-D] Severity: Blocker
* Target: .claude/claude-security-guidance.md lines 62-64
* Finding: localStorage allow-list: three keys are misnamed, `gsd-pwa-dismissed` does not exist, and 11 keys in use are missing.
* Decision: PROPOSE FIX
* Reason: Confirmed the three names. The list is an allow-list rule, so its membership is escalated.
* Edit: Corrected `gsd-theme`, `gsd:icon-rail-collapsed`, `gsd:show-completed`. Left the rest.

### L2-security-1-40 [accuracy-D] Severity: Major
* Target: .claude/claude-security-guidance.md lines 70-72
* Finding: `NEXT_PUBLIC_SENTRY_DSN` is gone (ADR 0017); `NEXT_PUBLIC_BASE_URL` is in use.
* Decision: PROPOSE FIX
* Reason: Confirmed in `env.d.ts` and `app/layout.tsx`. Owner should confirm `NEXT_PUBLIC_BASE_URL` belongs on the permitted list.
* Edit: Swapped the one entry.

### L2-security-1-41 [accuracy-D] Severity: Major
* Target: .claude/claude-security-guidance.md lines 46-47
* Finding: CSP allows `unsafe-inline` for styles.
* Decision: PROPOSE FIX
* Reason: Confirmed in `config/csp.cjs`.
* Edit: Scoped the claim to scripts.

### L2-security-1-42 [accuracy-D] Severity: Major
* Target: .claude/claude-security-guidance.md lines 44-45
* Finding: "MUST be set at CloudFront" omits the self-host Caddyfile.
* Decision: ESCALATE
* Reason: A rule statement in a facts-only file.
* Edit: none

### L2-security-1-43 [accuracy-D] Severity: Major
* Target: .claude/claude-security-guidance.md lines 81-83
* Finding: `public/sw.js` holds the `'dev'` placeholder; the build stamps `out/sw.js`. ADR 0012 does not mention unbounded growth.
* Decision: PROPOSE FIX
* Reason: Confirmed in `public/sw.js:1-4`. The ADR citation is left for the owner.
* Edit: Replaced "pinned constant" with the stamping fact.

### L2-security-1-44 [accuracy-D] Severity: Major
* Target: .claude/claude-security-guidance.md lines 94-96
* Finding: The MCP limiter covers delete and bulk writes only.
* Decision: PROPOSE FIX
* Reason: Confirmed in `packages/mcp-server/src/write-ops/README.md`.
* Edit: Reworded the fact and named the file.

### L2-security-1-45 [accuracy-D] Severity: Nit
* Target: .claude/claude-security-guidance.md lines 51-54
* Finding: Redaction list is a subset.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-1-46 [accuracy-D] Severity: Nit
* Target: .claude/claude-security-guidance.md lines 100-102
* Finding: Hook also blocks `gitleaks-report.json`.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-1-47 [accuracy-D] Severity: Nit
* Target: .claude/claude-security-guidance.md lines 18-19
* Finding: Update rule has an extra clause.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-1-48 [accuracy-D] Severity: Nit
* Target: .claude/claude-security-guidance.md lines 92-93
* Finding: Token also sits in `~/.gsd-mcp-setup.json` until first start.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L2-security-1-49 [style] Severity: Blocker
* Target: SECURITY.md lines 201-226, 297, 318, 355
* Finding: Deployment steps point at values the document lacks.
* Decision: PROPOSE FIX
* Reason: Same root as the two accuracy Blockers.
* Edit: Covered by the deployment rewrite.

### L2-security-1-50 [style] Severity: Major
* Target: SECURITY.md lines 126-127 vs 80-81
* Finding: Provider list contradicts the CSP.
* Decision: PROPOSE FIX
* Reason: See the `connect-src` finding.
* Edit: Covered.

### L2-security-1-51 [style] Severity: Major
* Target: SECURITY.md line 473
* Finding: "Last Audit" sits below a later entry.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Renamed the heading to "Full Audit: 2026-08-10".

### L2-security-1-52 [style] Severity: Major
* Target: SECURITY.md line 475 vs 497-503
* Finding: Audit result contradicts the accepted advisory.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Covered by the paragraph after the audit list.

### L2-security-1-53 [style] Severity: Major
* Target: SECURITY.md line 165
* Finding: "stored only in Claude Desktop config" contradicts line 147.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Reworded the bullet.

### L2-security-1-54 [style] Severity: Major
* Target: SECURITY.md lines 466-471
* Finding: Paragraph in the 2026-10-22 entry cannot be followed.
* Decision: ESCALATE
* Reason: A dated record of events I cannot verify from code.
* Edit: none

### L2-security-1-55 [style] Severity: Major
* Target: SECURITY.md lines 460-461
* Finding: "not proof of deployed exposure" is unclear.
* Decision: ESCALATE
* Reason: Same dated record; the intended meaning is the owner's.
* Edit: none

### L2-security-1-56 [style] Severity: Major
* Target: SECURITY.md lines 421-425, 450, 463-464
* Finding: Missing referents in the 2026-10-22 entry; evidence deferred to `tasks/todo.md`.
* Decision: ESCALATE
* Reason: Same dated record.
* Edit: none

### L2-security-1-57 [style] Severity: Major
* Target: SECURITY.md lines 43-44
* Finding: Dependabot sentence states no fact.
* Decision: PROPOSE FIX
* Reason: No Dependabot or Renovate config exists.
* Edit: Reworded.

### L2-security-1-58 [style] Severity: Major
* Target: SECURITY.md lines 65-69
* Finding: "this link" and "the page" are unclear.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Reworded three sentences.

### L2-security-1-59 [style] Severity: Major
* Target: SECURITY.md lines 244-246
* Finding: Residual-risk sentence is illogical.
* Decision: ESCALATE
* Reason: Security rationale written by the owner.
* Edit: none

### L2-security-1-60 [style] Severity: Major
* Target: SECURITY.md lines 29-30
* Finding: "unlinkable" to what.
* Decision: ESCALATE
* Reason: Operator policy statement.
* Edit: none

### L2-security-1-61 [style] Severity: Major
* Target: SECURITY.md lines 368-369
* Finding: TypeScript 6 package has no referent.
* Decision: PROPOSE FIX
* Reason: `package.json` pins `typescript` 6.0.3 beside `@typescript/native`.
* Edit: Named both.

### L2-security-1-62 [style] Severity: Major
* Target: SECURITY.md lines 58-62
* Finding: "nothing is captured" is ambiguous.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Reworded.

### L2-security-1-63 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 17
* Finding: Encryption row is not scoped to self-host.
* Decision: PROPOSE FIX
* Reason: SECURITY.md and ADR 0016 scope it.
* Edit: Scoped the boundary name.

### L2-security-1-64 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 15
* Finding: "export" used for the copy control.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Changed to "the copy control".

### L2-security-1-65 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 16
* Finding: Feedback clause does not say what verifies.
* Decision: PROPOSE FIX
* Reason: The setup script runs the checks.
* Edit: Named the setup script as the actor.

### L2-security-1-66 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 13
* Finding: Undefined cursor terms.
* Decision: PROPOSE FIX
* Reason: ADR 0019 defines them.
* Edit: Added the ADR path.

### L2-security-1-67 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 14
* Finding: "bounce target" vs "redirect target"; "cap" what.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Unified on "redirect" and added "the length of".

### L2-security-1-68 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 21
* Finding: "never persist capture fragments" has no referent.
* Decision: CONTEST
* Reason: `tests/data/service-worker-privacy.test.ts:133` tests exactly this case ("never caches a client-only capture fragment even if the request retains it").
* Edit: none

### L2-security-1-69 [style] Severity: Major
* Target: docs/security-trust-boundaries.md line 18
* Finding: "preflight fresh timestamps" is unclear.
* Decision: PROPOSE FIX
* Reason: `fetchSinglePBTaskFresh` in `write-ops/helpers.ts`.
* Edit: Reworded.

### L2-security-1-70 [style] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 99 vs 33, 7, 12
* Finding: Guidance on where credentials live contradicts itself.
* Decision: PROPOSE FIX
* Reason: Fixed the factual line 12. The Best Practices list is general advice, left for the owner.
* Edit: Reworded line 12.

### L2-security-1-71 [style] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 37-44
* Finding: Authentication paragraph cannot be followed.
* Decision: PROPOSE FIX
* Reason: Facts confirmed by the accuracy reviewer.
* Edit: Split into short sentences.

### L2-security-1-72 [style] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 52-58, 80
* Finding: Token key and token secret used loosely.
* Decision: PROPOSE FIX
* Reason: `session_revoke.pb.js` rotates one account's key; the collection secret covers all users.
* Edit: Clarified both.

### L2-security-1-73 [style] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 71, 101-102
* Finding: "lives permanently" vs 30 days; generic best practices.
* Decision: PROPOSE FIX
* Reason: `packages/mcp-server/README.md:525` gives the expiry step. The generic list is left for the owner.
* Edit: Reworded the bullet.

### L2-security-1-74 [style] Severity: Major
* Target: packages/mcp-server/README-SECURITY.md lines 59, 67-70
* Finding: Setup wizard and launch configuration are not introduced.
* Decision: PROPOSE FIX
* Reason: `gsd-mcp-server --setup` in `src/cli/index.ts`.
* Edit: Named the command and the generated entry.
