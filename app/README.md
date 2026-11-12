# app

## Overview
This is the Next.js App Router root. `layout.tsx` defines the page metadata, the viewport, the Newsreader font, and the provider tree. `global-error.tsx` is the root error fallback, and `not-found.tsx` is the 404 page. Each route lives in a child directory.

## Interface
- `RootLayout` (`layout.tsx`, default export): renders `<html>` and `<body>`, and wraps `children` in the private `AppProviders`.
- `metadata` (`layout.tsx`, named export): title, description, manifest, icons, `openGraph`, and `twitter`. `metadataBase` uses `NEXT_PUBLIC_BASE_URL` or `https://gsd.vinny.dev`.
- `viewport` (`layout.tsx`, named export): device width, `maximumScale: 5`, `userScalable: true`, and light and dark theme colors.
- `AppProviders` (`layout.tsx`, private) nests `ErrorBoundary`, `ThemeProvider`, `ToastProvider`, then `TooltipProvider`.
- Inside `TooltipProvider`, `ResetLockGate` holds `ClientLayout`, `FirstTimeRedirect`, `OnboardingGate`, and `WebMcpRegister`.
- `PwaRegister`, `PwaUpdateToast`, `GlobalErrorListener`, and `ThemedToaster` render beside the gate.
- `GlobalError({ error, reset })` (`global-error.tsx`, default export): client fallback that renders its own `<html>` with inline styles.
- `NotFound` (`not-found.tsx`, default export): client 404 page with a `Link` to `/`.

Routes:
- [(archive)](<./(archive)/README.md>): layout that provides react-query to the archive page.
- [(dashboard)](<./(dashboard)/README.md>): the weekly review page.
- [(matrix)](<./(matrix)/README.md>): a page that renders `MatrixSimplified`.
- [(sync)](<./(sync)/README.md>): layout that provides react-query to the sync history page.
- [about](./about/README.md): the about page and its metadata.
- [auth](./auth/README.md): the OAuth callback page.
- [saved](./saved/README.md): re-exports `SavedPage`.
- [settings](./settings/README.md): renders `SettingsPage`.
- [sweep](./sweep/README.md): re-exports `SweepPage`.

## Invariants
- Anything that reads or writes task data stays inside `ResetLockGate`. A comment in `AppProviders` says a pending reset keeps it unmounted.
- `DevelopmentCspMeta` returns `null` when `NODE_ENV` is `production`. A comment at `isDevelopment` says the hosting layer supplies the strict policy in production.
- The three `localFont` calls keep the order vietnamese, latin-ext, latin. A comment in `layout.tsx` says the last rule wins where unicode ranges overlap.
- `configuredPocketBaseOrigin` returns `null` unless `NEXT_PUBLIC_POCKETBASE_URL` parses as an `http:` or `https:` URL.
- `global-error.tsx` must not depend on app CSS. Its header comment says the root layout, which loads `globals.css`, may have crashed.
- `useGlobalErrorFallback` sets `data-theme` only when the stored value is exactly `light` or `dark`. Its storage read sits in a try/catch.
- The "Go home" button in `GlobalError` uses `window.location.href`. A comment says the client router may not be usable.
- `not-found.tsx`: None

## Side Effects
- `layout.tsx` reads `NODE_ENV`, `NEXT_PUBLIC_POCKETBASE_URL`, and `NEXT_PUBLIC_BASE_URL` when the module loads.
- `RootLayout` always emits `<link rel="preconnect" href="https://api.vinny.io" />`. It emits a `Content-Security-Policy` meta tag outside production.
- `layout.tsx` imports `./globals.css` and registers three Newsreader font files through `localFont`.
- `useGlobalErrorFallback` reads `localStorage` key `gsd-theme`, may set `document.documentElement.dataset.theme`, and focuses the fallback.
- `GlobalError` sets `window.location.href = "/"` on "Go home" and calls `reset` on "Try again".
- `not-found.tsx`: None

## Verification
- Run: `bun run test`
- Run: `bun run build` (produces the static export)
