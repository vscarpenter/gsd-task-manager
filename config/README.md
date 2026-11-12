# config

## Overview
`csp.cjs` is the one definition of the app's production Content-Security-Policy. It holds an ordered directive list and exports one builder function. `csp.d.cts` declares its types.

## Interface
- `buildCsp(target: CspTarget): string` (`csp.cjs`, the only export): returns the policy string for a deployment target.
- `CspTarget` (`csp.d.cts`): `"cloudfront" | "selfhost"`.
- `DIRECTIVES` (`csp.cjs`, private): ordered array of `{ name, sources, extra? }`. `extra[target]` adds sources for one target only.
- Consumers: `scripts/lib/static-export-server.cjs` requires `buildCsp`, and `tests/data/csp-single-source.test.ts` imports it.

## Invariants
- Directive order is part of the contract. A comment above `DIRECTIVES` says the copies match it byte for byte.
- The CloudFront policy JSON and `docker/Caddyfile` each keep a copy. The header comment says `tests/data/csp-single-source.test.ts` fails when either copy drifts.
- `buildCsp` throws an `Error` when `target` is not in `TARGETS` (`cloudfront`, `selfhost`).
- `buildCsp` writes each directive as `name sources;` and joins directives with one space.
- No directive in `DIRECTIVES` has an `extra.selfhost` entry, so `selfhost` gets the base sources only.
- For `cloudfront`, `extra` adds `data:` to `font-src`, `blob:` to `worker-src`, and the API and OAuth origins to `connect-src`.

## Side Effects
- None

## Verification
- Run: `bun run test`
