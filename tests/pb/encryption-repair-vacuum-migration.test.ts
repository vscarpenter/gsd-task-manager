import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docker/pb_migrations/1781300000_vacuum_after_prefix_repair.js",
);

/**
 * 1781100000 scheduled the one-shot vacuum marker; 1781200000 later rewrote
 * marker-prefixed rows without scheduling it again. A database upgraded in two
 * steps had already consumed the marker, so the repaired plaintext could stay
 * in SQLite free pages. This forward migration re-arms the marker; the
 * bootstrap hook in docker/pb_hooks/migration_cleanup.pb.js does the vacuum.
 */
function runMigration(tasksTableExists: boolean): string[] {
  const executed: string[] = [];
  const database = {
    newQuery: (sql: string) => ({
      one: (model: { count: number }) => {
        model.count = tasksTableExists ? 1 : 0;
      },
      execute: () => executed.push(sql),
    }),
  };
  let migrateUp: ((app: object) => void) | undefined;
  const sandbox = {
    migrate: (up: (migrationApp: object) => void) => {
      migrateUp = up;
    },
    DynamicModel: function DynamicModel(initial: object) {
      return initial;
    },
  };
  vm.runInNewContext(readFileSync(migrationPath, "utf8"), sandbox, { filename: migrationPath });
  expect(migrateUp).toBeTypeOf("function");
  migrateUp!({ db: () => database });
  return executed;
}

describe("vacuum-after-prefix-repair migration", () => {
  it("re-arms the one-shot vacuum marker when a tasks table exists", () => {
    expect(runMigration(true)).toEqual([
      "CREATE TABLE IF NOT EXISTS _gsd_security_state (id TEXT PRIMARY KEY NOT NULL)",
      "INSERT OR REPLACE INTO _gsd_security_state (id) VALUES ('vacuum_after_task_encryption')",
    ]);
  });

  it("does nothing on a database that has no tasks table yet", () => {
    expect(runMigration(false)).toEqual([]);
  });
});
