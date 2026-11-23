import type { Table } from "dexie";

/**
 * Read, change, and write one row in one transaction, so two writers both land.
 * `change` can't be async: an IndexedDB transaction commits while it waits on anything else.
 */
export function modifyRow<T>(
  table: Table<T, string>,
  key: string,
  change: (current: T | undefined) => NoInfer<T>,
): Promise<T> {
  return table.db.transaction("rw", table, async () => {
    const next = change(await table.get(key));
    await table.put(next);
    return next;
  });
}
