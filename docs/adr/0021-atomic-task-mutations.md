# ADR 0021: Compare task versions inside the server transaction

Status: accepted 2026-11-14. Contract: `tasks/spec-review-p1-p2-2026-11-14.md`.

Client preflight reads left a window before PATCH or DELETE in which another
device could save. Comparing `client_updated_at` in the browser or MCP alone
could not protect that intervening edit.

Web and MCP now send PATCH and DELETE to `/api/gsd/tasks/{recordId}` with an
explicit `expected_version`. The users-authenticated hook looks up the record,
checks its owner and version, and saves or deletes inside `runInTransaction`.
PATCH accepts only task fields, keeps identity immutable, requires a changed
version, and uses `txApp.save` so validation, encryption and realtime hooks run.
Clients break an equal timestamp by one millisecond; the next pull reconciles
that version. A mismatch returns 412. Web retains its intent without spending
a retry; the next sync re-reads the winner. MCP surfaces the rejected write.

The dedicated route fails closed on an older server. There is no fallback to
an unconditional collection mutation. Install both `task_conditional_writes.pb.js`
and `task-write-contract.js` from `docker/pb_hooks` on the backend and restart
PocketBase **before** releasing any web, MCP, iOS, or Android client that uses
the guarded route. The Docker image ships
both files. Verify with `bun run test:system:pocketbase`; it runs disposable
PocketBase 0.40.4, concurrent PATCHes, stale DELETE, identity validation, the
MCP flow, and encrypted storage checks. This change does not deploy the hooks.

The iOS and Android apps adopt the guarded route in their next releases. They
send task PATCH and DELETE to `/api/gsd/tasks/{recordId}` with
`expected_version`, as web and MCP do. Creates and Erase Everywhere stay on the
collection API. Hosted PocketBase keeps the collection `updateRule` open to
direct writes until no installed native build predates that port, because
closing it sooner would break those builds. Until then, builds that predate the
port keep their current behavior, and atomic protection applies only to clients
on the guarded route. A server rollback requires rolling back the adopting
clients first, and that now includes the native apps. Retain previous hashed
frontend assets during that rollback.

Raw conditional SQL was rejected because it would bypass field validation and
encryption hooks. Adding a collection field was unnecessary for this contract:
every guarded update must replace the version it matched.
