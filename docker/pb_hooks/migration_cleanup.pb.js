/// <reference path="../pb_data/types.d.ts" />
// A data-encryption backfill replaces logical column values, but SQLite can
// retain the old bytes in free pages. The migration leaves a one-shot marker;
// The container applies migrations in a separate command before `serve`.
// This bootstrap hook therefore sees the committed one-shot marker and can
// vacuum before the API starts accepting traffic.
onBootstrap((e) => {
  e.next();

  const table = new DynamicModel({ count: 0 });
  e.app.db()
    .newQuery("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = '_gsd_security_state'")
    .one(table);
  if (table.count === 0) {
    return;
  }

  const pending = new DynamicModel({ count: 0 });
  e.app.db()
    .newQuery("SELECT COUNT(*) AS count FROM _gsd_security_state WHERE id = 'vacuum_after_task_encryption'")
    .one(pending);
  if (pending.count === 0) {
    return;
  }

  e.app.vacuum();
  e.app.db()
    .newQuery("DELETE FROM _gsd_security_state WHERE id = 'vacuum_after_task_encryption'")
    .execute();
});
