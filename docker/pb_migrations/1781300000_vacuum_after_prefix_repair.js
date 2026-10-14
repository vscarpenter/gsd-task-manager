/// <reference path="../pb_data/types.d.ts" />
// 1781200000 rewrote marker-prefixed task fields through raw SQL but did not
// re-arm the one-shot vacuum marker that 1781100000 had already consumed on a
// database upgraded in two steps. SQLite can keep the replaced plaintext in
// free pages until a vacuum, so schedule one more. The bootstrap hook in
// pb_hooks/migration_cleanup.pb.js runs it before the API accepts traffic.
// Historical migrations stay immutable because deployed databases record
// their filenames.
migrate((app) => {
  const table = new DynamicModel({ count: 0 });
  app.db()
    .newQuery("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
    .one(table);
  if (table.count === 0) return;

  app.db()
    .newQuery("CREATE TABLE IF NOT EXISTS _gsd_security_state (id TEXT PRIMARY KEY NOT NULL)")
    .execute();
  app.db()
    .newQuery("INSERT OR REPLACE INTO _gsd_security_state (id) VALUES ('vacuum_after_task_encryption')")
    .execute();
}, (_app) => {
  // Down migration intentionally does not undo secure cleanup.
});
