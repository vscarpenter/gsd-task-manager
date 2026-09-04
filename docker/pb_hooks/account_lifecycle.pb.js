/// <reference path="../pb_data/types.d.ts" />
// Account erasure and task creation share server-side transaction boundaries.
// PocketBase hook callbacks execute in isolated VMs, so every callback keeps
// its dependencies inside its own body.

routerAdd(
  "DELETE",
  "/api/gsd/account",
  (e) => {
    const userId = e.auth.id;

    e.app.runInTransaction((txApp) => {
      const user = txApp.findRecordById("users", userId);

      // Delete in bounded chunks. Offset remains zero because each pass removes
      // the rows it just found; new writes cannot commit outside this transaction.
      while (true) {
        const tasks = txApp.findRecordsByFilter(
          "tasks",
          "owner = {:owner}",
          "",
          100,
          0,
          { owner: userId },
        );
        if (tasks.length === 0) break;
        for (const task of tasks) txApp.delete(task);
      }

      txApp.delete(user);
    });

    return e.noContent(204);
  },
  $apis.requireAuth("users"),
);

onRecordCreateExecute((e) => {
  const originalApp = e.app;
  try {
    originalApp.runInTransaction((txApp) => {
      e.app = txApp;
      txApp.findRecordById("users", e.record.getString("owner"));
      e.next();
    });
  } finally {
    e.app = originalApp;
  }
}, "tasks");
