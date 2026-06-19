# AGENTS.md

Operating notes for AI agents working in this repository. General project
guidance, architecture, and the canonical command list live in `CLAUDE.md` and
`coding-standards.md` — read those first. This file only adds Cursor Cloud
environment caveats.

## Cursor Cloud specific instructions

**Runtime / package manager.** This project uses **Bun** (lockfile `bun.lock`,
Bun workspaces include `packages/*`). Bun is installed by the startup update
script (it is not on the base image) and is on `PATH` via `~/.bashrc`. The
standard dev/test/build commands are documented in `CLAUDE.md` (`bun dev`,
`bun run test`, `bun typecheck`, `bun lint`, `bun run build`). Use `bun run test`
(not `bun test`, which invokes Bun's own runner instead of Vitest).

**Dev server.** `bun dev` serves at http://localhost:3000. The app is 100%
client-side (every component is `"use client"`; no SSR/API routes; static
export). On first load the root URL redirects to `/about` (onboarding); enter the
matrix via the onboarding "Open App" CTA. All data lives in the browser's
IndexedDB (Dexie), so a fresh browser profile starts empty — there is no backend
to seed for basic task CRUD.

**Optional backend (PocketBase) is NOT required for local dev.** Cloud sync,
realtime SSE, OAuth, and the `packages/mcp-server` workspace only matter when a
PocketBase instance is reachable (`NEXT_PUBLIC_POCKETBASE_URL`, defaults to
`http://127.0.0.1:8090` on localhost). The core product runs and is testable
fully local-only without it.

**`bun lint` is currently broken on `main` (pre-existing, also red in CI).**
`@typescript-eslint/utils@8.53.1` references ESLint's removed `FlatESLint`
export, so ESLint 10 throws `Class extends value undefined`. This is a repo
dependency issue, not an environment setup problem — do not try to fix it as
part of environment work. `bun typecheck`, `bun run test`, and `bun run build`
all pass.

**Build is self-contained.** `bun run build` first runs
`scripts/generate-build-info.cjs`, which generates the gitignored `.build-env.sh`
that the build then sources — so a missing `.build-env.sh` is normal and the
build does not need any manual setup. CI builds with `NEXT_DISABLE_SWC_BINARY=1`
and a writable `NEXT_CACHE_DIR`; mirror that if a build behaves oddly.

**Generated files to leave uncommitted.** `next dev`/`next build` rewrite
`next-env.d.ts` (toggling `.next/types` vs `.next/dev/types`) and bump
`lib/build-info.json` / the service-worker version. Revert these unless the
change is intentional.

**Verifying frontend changes.** The PWA service worker can serve stale JS chunks
and data surfaces render empty on a fresh load — use the `verify-frontend-change`
skill rather than a naive screenshot (see `CLAUDE.md`).
