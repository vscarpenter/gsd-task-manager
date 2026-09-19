# Copy the Cloud Sync auth token

Date: 2026-09-19. Status: implemented and independently reviewed.
Tier: standard; a bounded Settings action using the existing auth store and clipboard.

## Goal and contract

Add an MCP access row after Account and before the Cloud Sync danger zone.
Use the existing SettingsRow and subtle Button with the label Copy auth token.
Description: Connect an MCP client to your cloud tasks. Treat this token like a password.

The button copies only the current raw PocketBase JWT, read from the SDK auth
store when clicked. It performs no network refresh. Missing or locally expired
credentials never reach the clipboard and produce Sign in again to copy your token.
Keep token values out of rendered markup, React state, logs and toast messages.

Show the row when an auth token exists, including an expired token so the user
can receive recovery guidance. Subscribe to auth-store changes so signing out
hides the row and a new session makes it available. Recheck validity on click
because expiry may occur without an auth-store change event.

Disable the button while a clipboard write is pending. Show Auth token copied
only after it succeeds. If the Clipboard API is unavailable or rejects, show
Couldn't copy auth token. Please try again. and allow another attempt.

Update the MCP README, quick-start, setup wizard and token-status recovery
instructions to Settings → Cloud Sync → Copy auth token. Existing credential
scope, lifetime and MCP configuration remain unchanged.

## Verification

Test first: raw-token copying, token rotation/account switch, no token in DOM or
feedback, expiry and missing auth, reactive sign-out, clipboard pending/success,
rejected/unavailable clipboard and retry. Run related Settings and MCP tests,
changed-component coverage, root tests, typecheck and lint before committing.
Verify the running Settings page with synthetic auth and intercepted backend
requests, including keyboard copying, mobile/dark layout, and console/network
checks. Get an independent review of the final diff and resolve valid findings.

## Out of scope

No backend changes, new dependencies, token minting/revocation, automatic MCP
config edits or deployment. Version bump and PR publication were authorized
in the follow-up below.

## Verification results

- Red: the new UI test failed on the absent component; MCP guidance assertions
  failed before their text changes. Green: all 10 new UI tests and 66 related
  Settings tests pass.
- New component coverage: 95.45% statements, 95.23% lines, 83.33% functions,
  100% branches. Its server snapshot is exercised by the running Next app.
- Full root suite: 3,162 passed, 1 skipped, 2 failed. Aggregate coverage passes
  configured thresholds: 88.34% statements, 89.53% lines, 89.20% functions,
  82.02% branches. The failures are unchanged baseline issues, reproduced from
  an archive of HEAD f71f37fc14ecf65a837232784a85d8b04b0fbb5d:
  README release 13.1.1 versus package 13.1.4 (documentation-currentness), and
  the legacy capture-cache assertion (service-worker-privacy).
- The existing SyncSettings component has 64.28% statement coverage; only its
  new row composition changed. Existing auto-sync error/interval paths remain
  outside the new feature's tests.
- Root TypeScript and ESLint pass. Code-shape checks report only existing
  pwa-register.tsx debt (complexity 11 to 12, function length 90 to 94), also
  reproduced at unchanged HEAD. No new code-shape violations.
- MCP workspace: 319 passed, 4 skipped; coverage thresholds and build pass.
- Browser verification: Chromium 5 passed; WebKit 4 passed, 1 skipped (native
  clipboard permissions). Firefox could not launch because its temporary
  profile folder was missing, including a retry with another TMPDIR.
- Native Chromium clipboard contents match the synthetic token, including
  after rotation; keyboard activation, expiry, denial and actual sign-out
  work. Console/runtime warnings, failed requests and unexpected API requests
  are absent. PocketBase requests are intercepted; no real account was used.
- Screenshots inspected at 1280px and 390px in light/dark themes; button has a
  44px touch target and the page has no horizontal overflow. Evidence:
  /private/tmp/gsd-token-browser-evidence/cloud-sync-{1280,390}-{light,dark}.png.
- Independent final review: no actionable findings. No live PocketBase/MCP
  end-to-end session or deployment was performed.

## Version bump and PR follow-up

The user authorized a version bump, commit, push to origin and PR on 2026-09-19.
App package, README and tracked service-worker cache versions are now 13.1.5.
Bun's root lock entry has no version field; the MCP package remains independently
versioned. Version-sensitive checks (documentation, build configuration, offline
service worker and the token row) pass: 28 tests. Lint and TypeScript pass.
The production static build passed and generated version 13.1.5. A subsequent
build artifact at 13.1.6 was observed, consistent with the existing per-build
increment; tracked source is normalized to 13.1.5. No build generator changed.

The README-version failure from the earlier full suite is fixed and its focused
regression passes. The baseline service-worker privacy test and pwa-register
code-shape issues remain. Independent review found no additional feature issues.
PR publication does not imply merge, deployment or a live-production check.
