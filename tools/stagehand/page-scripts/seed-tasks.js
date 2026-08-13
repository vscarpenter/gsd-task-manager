/*
 * seed-tasks.js — inject realistic tasks into IndexedDB for browser verification.
 *
 * Paste into the page console (localhost:3000) via the browser JS tool. Defines
 * `window.gsdSeed`; call its methods in later JS-tool calls. useTasks() reads raw
 * records via Dexie liveQuery, so seeded rows surface on the next reload.
 *
 * NOTE: `window.gsdSeed` is wiped by any navigation/reload (the seeded DATA in
 * IndexedDB survives — only the helper object is lost). So either seed *before*
 * reloading to view, or re-paste this script before calling clear() afterward.
 *
 *   gsdSeed.dashboard()   // completed-history + time-tracking + deadlines
 *   gsdSeed.matrix()      // one task in each of the four quadrants
 *   gsdSeed.seed([{ title: "Ship it", urgent: true, important: true }])
 *   gsdSeed.clear()       // remove only seed-* rows; real dev tasks survive
 *
 * WHY this script writes every field:
 *   objectStore.put() BYPASSES the Zod schema (validation runs only on writes
 *   through lib/tasks.ts). So schema defaults are NOT applied — a missing
 *   `tags`/`subtasks`/`timeEntries` array crashes components that map over it.
 *   Every record is therefore fully populated below.
 *
 * TaskRecord field map (lib/schema.ts taskRecordSchema, .strict()):
 *   required: id, title, description, urgent, important, quadrant, recurrence,
 *             tags[], subtasks[], dependencies[], notificationEnabled,
 *             completed, notificationSent, timeEntries[], createdAt, updatedAt
 *   optional: dueDate, completedAt, estimatedMinutes, timeSpent, notifyBefore,
 *             parentTaskId, lastNotificationAt, snoozedUntil
 *
 *   ANALYTICS BUCKET BY updatedAt, NOT completedAt — completedToday, streaks,
 *   and trends all key off the updatedAt date (lib/analytics/). To make a task
 *   "done on day N", set BOTH updatedAt and completedAt to day N.
 */
(() => {
  const DB_NAME = "GsdTaskManager";
  const STORE = "tasks";
  const ARCHIVE_STORE = "archivedTasks";
  const TRASH_STORE = "deletedTasks";
  const SEED_PREFIX = "seed-";

  // Inline copy of resolveQuadrantId (lib/quadrants.ts) — quadrant is stored
  // denormalized and indexed, so it must match urgent/important exactly.
  const resolveQuadrant = (urgent, important) => {
    if (urgent && important) return "urgent-important";
    if (!urgent && important) return "not-urgent-important";
    if (urgent && !important) return "urgent-not-important";
    return "not-urgent-not-important";
  };

  const isoDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };
  const isoInDays = (days) => isoDaysAgo(-days);

  let seedCounter = 0;
  const nextId = () => `${SEED_PREFIX}${seedCounter++}-${Date.now()}`;

  // Friendly spec -> full TaskRecord. Spec fields are all optional except title.
  //   { title, urgent, important, completed, daysAgo, dueInDays, tags,
  //     estimatedMinutes, timeSpent, running }
  const makeRecord = (spec) => {
    const urgent = !!spec.urgent;
    const important = !!spec.important;
    const completed = !!spec.completed;
    const stamp = isoDaysAgo(spec.daysAgo ?? 0);

    const record = {
      id: nextId(),
      title: spec.title ?? "Seeded task",
      description: spec.description ?? "",
      urgent,
      important,
      quadrant: resolveQuadrant(urgent, important),
      recurrence: "none",
      tags: spec.tags ?? [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      completed,
      notificationSent: false,
      timeEntries: [],
      createdAt: isoDaysAgo((spec.daysAgo ?? 0) + 1),
      updatedAt: stamp, // analytics bucket here
    };

    if (completed) record.completedAt = stamp;
    if (spec.dueInDays != null) record.dueDate = isoInDays(spec.dueInDays);
    if (spec.estimatedMinutes != null) record.estimatedMinutes = spec.estimatedMinutes;
    if (spec.timeSpent != null) record.timeSpent = spec.timeSpent;
    if (spec.running) {
      // A running timer = a timeEntries entry with no endedAt.
      record.timeEntries = [{ id: nextId(), startedAt: stamp }];
    }
    return record;
  };

  const withStore = (mode, fn, storeName = STORE) =>
    new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME); // no version => current (v14)
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          reject(new Error(
            `'${storeName}' store missing — load the app once so Dexie creates the schema, then re-run.`
          ));
          return;
        }
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = fn(store);
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });

  const seed = async (specs) => {
    const records = specs.map(makeRecord);
    await withStore("readwrite", (store) => records.forEach((r) => store.put(r)));
    const msg = `gsdSeed: wrote ${records.length} task(s). Reload to see them.`;
    console.log(msg, records.map((r) => `${r.id} [${r.quadrant}]`));
    return msg;
  };

  // Archived tasks live in their own store and are never in `tasks` — the
  // tombstone invariant (ADR 0013) is that an id is in one table or the other,
  // never both. Surfaces that report storage or archive counts read this store,
  // so seeding it is the only way to exercise them.
  const archived = async (specs) => {
    const records = specs.map((spec) => ({
      ...makeRecord(spec),
      archivedAt: isoDaysAgo(spec.archivedDaysAgo ?? 30),
    }));
    await withStore(
      "readwrite",
      (store) => records.forEach((r) => store.put(r)),
      ARCHIVE_STORE
    );
    const msg = `gsdSeed: wrote ${records.length} archived task(s). Reload to see them.`;
    console.log(msg, records.map((r) => r.id));
    return msg;
  };

  const clearStore = (storeName) => {
    let removed = 0;
    return withStore(
      "readwrite",
      (store) => {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          if (String(cursor.value.id).startsWith(SEED_PREFIX)) {
            cursor.delete();
            removed++;
          }
          cursor.continue();
        };
      },
      storeName
    ).then(() => removed);
  };

  const clear = async () => {
    const removed = await clearStore(STORE);
    const removedArchived = await clearStore(ARCHIVE_STORE);
    await clearStore(TRASH_STORE);
    const msg =
      `gsdSeed: removed ${removed} seed-* task(s) and ${removedArchived} archived. Reload to refresh.`;
    console.log(msg);
    return msg;
  };

  // --- Ready-made scenarios ---------------------------------------------

  // Dashboard: a completion history (streak + trends), time tracking, and a
  // running timer. updatedAt spread across recent days so analytics light up.
  const dashboard = () => seed([
    { title: "Done today", urgent: true, important: true, completed: true, daysAgo: 0, estimatedMinutes: 30, timeSpent: 25 },
    { title: "Done yesterday", important: true, completed: true, daysAgo: 1, estimatedMinutes: 60, timeSpent: 45 },
    { title: "Done two days ago", urgent: true, completed: true, daysAgo: 2 },
    { title: "Done three days ago", completed: true, daysAgo: 3 },
    { title: "In progress (timer running)", important: true, daysAgo: 0, estimatedMinutes: 90, running: true },
    { title: "Due soon", urgent: true, important: true, dueInDays: 2 },
    { title: "Overdue", urgent: true, important: true, dueInDays: -1 },
    { title: "Backlog item", tags: ["someday"] },
  ]);

  // Matrix: exactly one task in each quadrant so all four cells are populated.
  const matrix = () => seed([
    { title: "Q1 — do first", urgent: true, important: true },
    { title: "Q2 — schedule", important: true },
    { title: "Q3 — delegate", urgent: true },
    { title: "Q4 — eliminate" },
  ]);

  // Trash (ADR 0015): soft-deleted tasks awaiting the 30-day retention sweep.
  const trashed = async (specs) => {
    const records = specs.map((spec) => ({
      ...makeRecord(spec),
      deletedAt: isoDaysAgo(spec.deletedDaysAgo ?? 2),
    }));
    await withStore(
      "readwrite",
      (store) => records.forEach((r) => store.put(r)),
      TRASH_STORE
    );
    const msg = `gsdSeed: wrote ${records.length} trashed task(s). Reload to see them.`;
    console.log(msg, records.map((r) => r.id));
    return msg;
  };

  const trash = () =>
    trashed([
      { title: "Deleted yesterday", deletedDaysAgo: 1 },
      { title: "Deleted last week", deletedDaysAgo: 7 },
    ]);

  // Storage: live tasks plus archived ones, for surfaces that must report both
  // (Settings → Data & Storage counts every record a reset would destroy).
  const storage = async () => {
    await matrix();
    return archived([
      { title: "Archived one", completed: true },
      { title: "Archived two", completed: true },
      { title: "Archived three", completed: true },
    ]);
  };

  window.gsdSeed = { seed, archived, trashed, clear, dashboard, matrix, storage, trash, makeRecord };
  return "gsdSeed ready — try gsdSeed.dashboard(), gsdSeed.matrix(), gsdSeed.storage(), or gsdSeed.clear().";
})();
