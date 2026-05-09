# Lessons Learned

Project-specific learnings, gotchas, and patterns. Review at the start of every session.

---

## PocketBase v0.23+ Gotchas

- System fields (`created`, `updated`) **cannot** be used in `sort` or `filter` — use custom fields like `client_updated_at` instead.
- Custom indexes cannot reference system columns (`updated`, `created`).
- The `_pb_users_auth_` placeholder doesn't work as a `collectionId` for relation fields — use `text` type for owner FK or look up the real collection ID.
- Admin auth endpoint is `/api/collections/_superusers/auth-with-password` (not `/api/admins/auth-with-password`).

## Import/Export Schema

- Import schema uses `.strip()` (not `.strict()`) to accept legacy exports with extra fields (e.g., `vectorClock` from the old Cloudflare sync system).
- Export schema still uses `.strict()` to ensure clean outgoing data.

## Sync Engine

- Push operations are throttled (100ms between requests) to avoid PocketBase 429 errors.
- `fetchRemoteTaskIndex()` pre-fetches all remote task IDs in one request instead of N individual lookups.
- SSE subscriptions auto-reconnect; periodic sync runs as safety net.
- Echo filtering skips own-device changes via `device_id` comparison.

## Testing

- Use `bun run test` (not `bun test`) — the latter invokes bun's built-in runner, not Vitest.
- Mock IndexedDB with `fake-indexeddb` for data layer tests.
- The sync module (`lib/sync/`) has no tests yet — critical gap for multi-device features.

## Build & Deploy

- Static export mode means no API routes or SSR.
- CloudFront Function needed for SPA routing (S3 doesn't auto-serve `index.html` for directory paths).
- Run `deploy-cloudfront-function.sh` after adding new App Router routes.

## Coding Standards Compliance (April 2026 audit)

- Removed unused `dompurify` / `@types/dompurify` — React handles XSS natively.
- Pinned `canvas-confetti` from `^1.9.4` to exact `1.9.4`.
- Migrated `.parse()` to `.safeParse()` in user-input paths (import, create).
- Refactored `clearIndexedDB()` and `checkAndNotify()` for function length compliance.

## Inkwell Design System Migration (2026-05-08)

- **Token-bridging is the right move when adopting a new palette.** The app has 71 component files referencing GSD's existing token names (`bg-background`, `text-foreground`, `border-border`, etc.). Replacing token *values* in `app/globals.css` while keeping token *names* unchanged migrates the entire utility surface in one file. Vanilla-class adoption would have been a 71-file rewrite for no functional gain.
- **Don't `@import inkwell.css` directly.** Inkwell's stylesheet ships its own `body { background: var(--ivory) }` and a `prefers-color-scheme: dark` block keyed on `:root:not([data-theme="light"])`. Both fight `next-themes`'s class-based dark mode and produce flicker. Cherry-pick utility classes (`.t-h1`, `.eyebrow`) into `globals.css` under `@layer utilities` instead.
- **Hard-coded hex inside scoped blocks won't follow root token swaps.** `.redesign-scope { --q1: #c2410c; ... }` lives in the v9 matrix surface. Forgetting to update it would have left the most-visible UI showing old colors while the rest of the app went Inkwell — visible inconsistency.
- **Concatenated alpha hex (`${a}14`) breaks when `a` becomes a CSS var.** `lib/quadrants.ts` exported hex values like `#c2410c`, then components did `backgroundColor: \`${a}14\`` for alpha tinting. Switching `a` to `var(--q1)` makes that string an invalid `var(--q1)14`. Fix: `color-mix(in srgb, ${a} 8%, transparent)` — accepts CSS vars and is the modern equivalent.
- **WCAG AA on tinted bands needs mode-specific accent values.** Light mode quadrant labels need *deeper* hues (`#9A3F3F`, `#3D5577`) to clear 4.5:1 against the soft tint headers; dark mode needs *brighter* lifted hues (`#E89788`, `#9CB8DA`) over the 20%-wash dark headers. A single hex value that "looks right" can't win both contests — split into `:root` vs `.dark` `--qN` definitions.
- **Tokens must be defined globally if matrix code reads them globally.** `--q1`..`--q4` were originally only inside `.redesign-scope`, but the v9 matrix grid lives outside that scope. Inline `style={{ color: 'var(--q1)' }}` returned empty without a global definition. Add to `:root` and `.dark`, not just to scoped blocks.
