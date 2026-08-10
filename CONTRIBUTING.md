# Contributing

Thanks for improving GSD Task Manager. This repository uses Bun workspaces,
Vitest, and Playwright; the app itself is a client-side Next.js static export.

## Before changing code

Read `README.md`, `CLAUDE.md`, `coding-standards.md`, and the applicable ADRs.
Security-sensitive changes also require `SECURITY.md` and
`docs/security-trust-boundaries.md`. Path-specific rules under `.claude/rules/`
cover sync, service-worker, archive, test, and MCP invariants.

Do not work directly on `main`. Preserve unrelated local changes and stage only
the paths that belong to your change.

## Development loop

Install and start the application with:

```bash
bun install
bun dev
```

Use test-driven development for behavior changes: first reproduce the gap,
then make the smallest fix, then refactor with the test green. Run Vitest via
`bun run test`; `bun test` selects Bun's different built-in runner.

## Required verification

Run checks proportionate to the change, and run the complete pre-ship set for a
non-trivial pull request:

```bash
bun run test -- --coverage
bun typecheck
bun lint
bun run quality:shape
bun run license:check
bun audit --audit-level=high
bun run build
bun run test:e2e
```

The MCP workspace also requires:

```bash
bun run --cwd packages/mcp-server test:coverage
bun run --cwd packages/mcp-server build
```

PocketBase/sync changes require the disposable authenticated system harness:

```bash
bun run test:system:pocketbase
```

Frontend changes must be verified in the running application. A source diff,
unit test, or screenshot of stale service-worker output is not runtime proof.

## Pull requests

- Keep the change focused and explain user impact and risk.
- Include red/green evidence for fixes and note any manual verification gates.
- Update documentation and trust-boundary entries when behavior or custody
  changes.
- Do not include credentials, tokens, private task data, or generated coverage
  artifacts.
- Distinguish passing source/tests, a successful build, deployment, and a live
  production check in the pull-request description.

## Security reports

Do not open a public issue for a suspected vulnerability. Follow the private
reporting process in `SECURITY.md`.
