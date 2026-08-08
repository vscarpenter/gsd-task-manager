# Implementation Notes

## 2026-08-05 — Rescan High and Medium remediation

- The user confirmed the production server at `api.vinny.io` runs PocketBase
  0.39.10. Treat that as live deployment evidence; align repository Docker
  assets without probing or mutating production.
- Historical-secret deletion remains outside current authority. Close
  recurrence with a blocking full-history Gitleaks baseline; retain the report's
  destructive-history cleanup as a separately approved manual gate.
- Preserve inherited modifications to `coding-standards.md`,
  `docs/codebase-analysis-report.html`, and `public/sw.js`, plus all three
  pre-existing stashes.
- PocketBase release checksums verified from the official 0.39.10 checksum file:
  Linux amd64 `67f68c8041dbb6a35fd7af5997ffc5063a7a7b96bf9df810360788f9e9975408`;
  Linux arm64 `5bad497eaf2522418673eacfcc90e75106036f19b4aeeac6e59bc48503c01ddf`.

## Implementation decisions

- Docker now runs `pocketbase migrate up --automigrate=false` before serving
  with automigration disabled. The shipped backfill remains byte-for-byte
  unchanged; fresh volumes record its name through a no-op compatibility
  migration because no tasks table exists. Existing volumes receive a later
  forward-only remediation and one-shot vacuum marker.
- The remediation preserves IDs, owners, server/client timestamps, repairs
  legacy JSON ciphertext produced from PocketBase byte arrays with strict UTF-8
  validation, and schedules a vacuum even when every logical value was already
  encrypted. The system harness creates a real accented/CJK/emoji fixture under
  PocketBase 0.26.6, applies the legacy migration separately, then proves the
  later remediation under 0.39.10.
- MCP cache keys are namespaced by a SHA-256 digest of backend plus auth token,
  and the shared PocketBase client clears auth when either principal input
  changes. The system path proves user 2 cannot receive user 1's cached task.
- The hydration fix keeps the schedule count unknown until mount/data load.
  Firefox's supported `autocomplete=off` button attribute prevents it from
  restoring a stale dynamic disabled state before React hydrates.
- The automatic Playwright runtime guard exposed an invalid meta-delivered
  `frame-ancestors` directive; it was removed from the meta CSP while retained
  in CloudFront/Caddy response headers. Fixed sleeps were replaced with
  user-visible state, including bounded drag activation and first-visit state.

## Verification evidence

- Red proof: 10 root failures plus 2 MCP dispatcher failures landed on the
  intended gaps before implementation.
- Root coverage: 175 files passed / 1 skipped; 2,561 tests passed / 1 skipped;
  88.41% statements, 82.14% branches, 88.31% functions, 89.44% lines.
- MCP coverage: 25 files passed / 2 skipped; 225 tests passed / 2 skipped;
  84.64% statements, 77.42% branches, 86.39% functions, 84.82% lines.
- PocketBase system tests passed both the fresh authenticated isolation path
  and the 0.26.6-to-0.39.10 encrypted upgrade path (2/2).
- The final full Playwright sweep passed 269/270 across Chromium, Firefox, and
  WebKit with automatic page-error and unexpected-console-error capture. Its
  sole Firefox keyboard-dialog failure passed 3/3 immediate repetitions (the
  full design-lab file passed 30/30); all changed drag-and-drop paths passed in
  every engine. An earlier full sweep in this pass was 270/270.
- The 15-route production static build, root typecheck, MCP build, zero-warning
  lint, code-shape ratchet, shell syntax, workflow/config regression tests,
  `git diff --check`, and `bun audit` all passed.
- Gitleaks scanned all 668 commits with no unbaselined findings. Its committed
  exceptions contain fingerprints only.
- The required WCAG and PocketBase/sync specialist reviews both returned zero
  blocking findings and zero suggestions after their requested corrections.
- The code-shape baseline records 42 complexity, 4 depth, 0 file-length, and
  121 function-length violations and rejects any per-file count or maximum
  regression.

## Remaining authority boundary

- The expired historical JWT object remains in shared Git history. The new
  blocking full-history gate prevents unbaselined recurrence, but erasing the
  historical object still requires separately approved rewrite/force-push
  coordination.
