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

**Lint and TypeScript compatibility.** `bun lint` is expected to run. The root
workspace deliberately installs the TypeScript 7 CLI as `@typescript/native`
while keeping `typescript@6.0.3` for the compiler API. The `bun typecheck`
script explicitly invokes the native alias; Next.js and `typescript-eslint`
continue to import TypeScript 6. Keep both packages until those tools support
the new TypeScript API. ESLint 10 also relies on the explicit React version in
`eslint.config.mjs` because `eslint-plugin-react@7.37.5` still calls an API
ESLint 10 removed. The standalone MCP workspace has no compiler-API consumer
and uses TypeScript 7 directly. A blanket `bun update --latest` will try to
replace the root TypeScript 6 API package; use the interactive updater and leave
that package pinned. The build-config regression test enforces this split.

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

## Security review surfaces

The security-relevant trust boundaries (PocketBase sync owner-scoping, the MCP
write-ops, service-worker cache exclusions, import/export validation, the
PocketBase encryption hooks) and the controls that already bound them are mapped
in `.blume/insights/security-trust-boundaries.md` — read it before auditing or
threat-modeling those subsystems.
