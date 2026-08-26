# Status — 2026-08-25

## Remove the PWA install feature — DONE (committed)

Branch `chore/remove-pwa-install-prompt`. Tier: Non-trivial (coordinated
changes across route contract, service worker, sitemap, and copy). Scope was
approved by the user up front, so spec → plan → implementation runs in one pass
per the standing correction in the global CLAUDE.md.

**Why:** the project now ships a native mobile app, so nudging users to install
the web build as a PWA is a competing, worse install path.

**Decided scope (user-approved):**
- Remove the install *prompt* and the `/install` how-to route.
- KEEP `public/manifest.json`, `public/sw.js` offline shell, and
  `components/pwa-register.tsx`. The app stays a working offline PWA; a browser
  can still install it from its own menu. We just stop advertising it.
- Rewrite the install-sell copy around offline, with no mobile-app link (no
  store URL was supplied, and inventing one is worse than silence).

### Tasks

- [x] ① Red — update/delete the specs that assert install behavior
- [x] ② Delete `components/install-pwa-prompt.tsx` + its mount in `app/layout.tsx`
- [x] ③ Delete `app/(pwa)/install/page.tsx` (and the `(pwa)` group if empty)
- [x] ④ Drop `INSTALL` from `lib/routes.ts` (ROUTES + ROUTE_VARIANTS)
- [x] ⑤ Drop `/install/` from `public/sw.js` precache
- [x] ⑥ Drop `/install` from `public/sitemap.xml` and `lib/sentry.ts` allowlist
- [x] ⑦ Drop `/install` from `onboarding-gate.tsx` SUPPRESS_PREFIXES
- [x] ⑧ Rewrite copy: `about/features-section.tsx`, `matrix-simplified/help-drawer.tsx`
- [x] ⑨ Strip install-dismissal workarounds from e2e page object + fixtures
- [x] ⑩ Refresh `scripts/code-shape-baseline.json`
- [x] ⑪ Version trio bump 12.2.5 → 12.3.0 (package.json + README:7 + sw.js)
- [x] ⑫ Verify: `bun run test`, `bun typecheck`, `bun lint`
- [x] ⑬ Verify live via `/verify-frontend-change`
- [ ] ⑭ Commit → push → PR

### Verification

- `bun run test` — 2767 passed, 1 skipped, 0 failed.
- `bun typecheck`, `bun lint`, `bun run quality:shape` — all clean.
- `bunx playwright test` — 285 passed across chromium, firefox, and webkit.
- `bun run build` — static export succeeds; the route table no longer lists
  `/install`, and `out/` contains no install directory.
- Live browser (dev, no SW registered, console clean): the about card renders
  "Works Offline" with the new copy, the help drawer no longer pitches PWA
  install, no install banner mounts, and `/install/` 404s.

### Traps found

- **Two unit suites failed for an unrelated reason.** `editorial-theme` could
  not resolve `sharp` and `dependency-license-policy` counted 60 SBOM
  components instead of 100+. Both traced to an incomplete `node_modules`
  behind the dirty `bun.lock`, not to this change. `bun install` fixed both and
  cleaned the lockfile.
- **Repairing `.build-info.json` caused the version drift it was meant to
  prevent.** `scripts/generate-build-info.cjs` resets to `package.json` only
  when the two versions *differ*; when they match it increments the patch. I
  set the stale file to 12.3.0 to match, so the build produced 12.3.1 and wrote
  it into `sw.js`. Leave that untracked file stale and let the build reset it.
- **`self.addEventListener("install")` in `public/sw.js` is the Service Worker
  lifecycle event, not the install prompt.** A blind find-and-replace on
  "install" breaks the offline cache.

### Follow-ups (not done, deliberately)

- CloudFront's SPA function rewrites unknown paths to `index.html`, so
  `gsd.vinny.dev/install` will serve the app shell with a 200 after deploy
  rather than a real 404. The S3 object itself goes away because
  `scripts/deploy-app.sh` syncs with `--delete`.
- `docs/adr/0004-pwa-architecture.md` still lists limited install
  discoverability as a consequence. Left as-is; the PWA architecture it
  describes is unchanged. Worth a short ADR if the reasoning should be durable.
