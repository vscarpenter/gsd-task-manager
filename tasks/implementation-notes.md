# Security remediation implementation notes — 2026-09-04

The user approved resolution of 21 review comments. Every candidate was rechecked
against current repository files at `e7ae02d7`; prior scan memory was used only
for orientation.

Implementation is grouped by trust boundary so each commit is independently
reviewable. Tests are written or changed before production code. The existing
`bun.lock` modification is user-owned and excluded from every commit.

Key fail-closed choices:

- no untrusted branch execution on the maintainer host;
- no agent issue execution without trusted immutable attestation;
- no OIDC in repository build/package jobs;
- no destructive reconciliation from partial or malformed indexes;
- no remote write/delete when an existing record lacks a usable version;
- no anonymous feedback writes before verified controls;
- no superuser token in the account-scoped MCP server.

Verification evidence and deviations will be appended as each boundary lands.
