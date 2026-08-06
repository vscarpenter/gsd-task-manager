import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

type FakeRecord = ReturnType<typeof fakeRecord>;
type MigrationFn = (app: FakeApp) => void;

interface FakeApp {
  findAllRecords: ReturnType<typeof vi.fn<(collection: string) => FakeRecord[]>>;
  db: ReturnType<typeof vi.fn>;
}

interface ExecutedUpdate {
  sql: string;
  params: Record<string, unknown>;
}

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docker/pb_migrations/1781100000_harden_task_encryption_cleanup.js",
);

function fakeRecord(initial: Record<string, unknown>) {
  const data = { ...initial };

  return {
    get: vi.fn((field: string) => data[field]),
    getString: vi.fn((field: string) => {
      const value = data[field];
      if (typeof value === "string") return value;
      if (value === null || value === undefined) return "";
      return JSON.stringify(value);
    }),
    set: vi.fn((field: string, value: unknown) => {
      data[field] = value;
    }),
    data,
  };
}

function loadMigration(key: string | undefined, records: FakeRecord[]) {
  const source = readFileSync(migrationPath, "utf8");
  let migrateUp: MigrationFn | undefined;
  const encrypt = vi.fn((value: string, encKey: string) => {
    return `cipher(${encKey.slice(0, 4)}:${value})`;
  });
  const decrypt = vi.fn((value: string) => value.replace(/^cipher\([^:]+:/, "").slice(0, -1));
  const executedSql: string[] = [];
  const updates: ExecutedUpdate[] = [];
  const database = {
    newQuery: vi.fn((sql: string) => {
      let params: Record<string, unknown> = {};
      const query = {
        one: vi.fn((model: { count: number }) => {
          model.count = 1;
        }),
        bind: vi.fn((nextParams: Record<string, unknown>) => {
          params = nextParams;
          return query;
        }),
        execute: vi.fn(() => {
          executedSql.push(sql);
          if (sql.startsWith("UPDATE tasks SET")) updates.push({ sql, params });
        }),
      };
      return query;
    }),
  };
  const app: FakeApp = {
    findAllRecords: vi.fn((_collection: string) => records),
    db: vi.fn(() => database),
  };

  const context = vm.createContext({
    migrate: vi.fn((up: MigrationFn) => {
      migrateUp = up;
    }),
    $os: {
      getenv: vi.fn((name: string) =>
        name === "GSD_TASKS_ENC_KEY" ? key : undefined,
      ),
    },
    $security: { encrypt, decrypt },
    DynamicModel: function DynamicModel(initial: object) {
      return initial;
    },
  });

  vm.runInContext(source, context, { filename: migrationPath });

  if (!migrateUp) {
    throw new Error("Migration did not register an up migration");
  }

  return {
    app,
    encrypt,
    executedSql,
    updates,
    run: () => migrateUp(app),
  };
}

describe("task encryption backfill migration", () => {
  it("fails closed before reading rows when the encryption key is missing or invalid", () => {
    for (const invalidKey of [undefined, "too-short"]) {
      const record = fakeRecord({ title: "Plaintext task" });
      const migration = loadMigration(invalidKey, [record]);

      expect(() => migration.run()).toThrow("GSD_TASKS_ENC_KEY");
      expect(migration.app.findAllRecords).not.toHaveBeenCalled();
      expect(migration.app.db).not.toHaveBeenCalled();
      expect(migration.encrypt).not.toHaveBeenCalled();
    }
  });

  it("encrypts plaintext task text and JSON fields before saving each row", () => {
    const key = "x".repeat(32);
    const record = fakeRecord({
      id: "record-one",
      title: "Buy milk",
      description: "",
      tags: ["errand", "home"],
      subtasks: [{ id: "s1", title: "Check fridge", completed: false }],
      time_entries: [{ start: "2026-06-20T10:00:00Z", end: null }],
    });
    const secondRecord = fakeRecord({
      id: "record-two",
      title: "Call accountant",
      description: "Ask about quarterly taxes",
      tags: null,
      subtasks: [],
      time_entries: undefined,
    });
    const migration = loadMigration(key, [record, secondRecord]);

    migration.run();

    expect(migration.app.findAllRecords).toHaveBeenCalledWith("tasks");
    expect(migration.updates).toHaveLength(2);
    expect(migration.updates[0]?.params).toEqual({
      id: "record-one",
      title: "enc:v1:cipher(xxxx:Buy milk)",
      tags: 'enc:v1:cipher(xxxx:["errand","home"])',
      subtasks: 'enc:v1:cipher(xxxx:[{"id":"s1","title":"Check fridge","completed":false}])',
      time_entries: 'enc:v1:cipher(xxxx:[{"start":"2026-06-20T10:00:00Z","end":null}])',
    });
    expect(migration.updates[1]?.params).toEqual({
      id: "record-two",
      title: "enc:v1:cipher(xxxx:Call accountant)",
      description: "enc:v1:cipher(xxxx:Ask about quarterly taxes)",
      subtasks: "enc:v1:cipher(xxxx:[])",
    });
    expect(migration.executedSql).toContain("PRAGMA secure_delete = ON");
    expect(migration.executedSql).toContain(
      "INSERT OR REPLACE INTO _gsd_security_state (id) VALUES ('vacuum_after_task_encryption')",
    );
  });

  it("does not double-encrypt values that already carry the encryption prefix", () => {
    const key = "x".repeat(32);
    const record = fakeRecord({
      id: "record-one",
      title: "enc:v1:already-title",
      description: "enc:v1:already-description",
      tags: "enc:v1:already-tags",
      subtasks: "enc:v1:already-subtasks",
      time_entries: undefined,
    });
    const migration = loadMigration(key, [record]);

    migration.run();

    expect(record.data).toEqual({
      id: "record-one",
      title: "enc:v1:already-title",
      description: "enc:v1:already-description",
      tags: "enc:v1:already-tags",
      subtasks: "enc:v1:already-subtasks",
      time_entries: undefined,
    });
    expect(migration.encrypt).not.toHaveBeenCalled();
    expect(migration.updates).toEqual([]);
    expect(migration.executedSql).toContain("PRAGMA secure_delete = ON");
    expect(migration.executedSql).toContain(
      "INSERT OR REPLACE INTO _gsd_security_state (id) VALUES ('vacuum_after_task_encryption')",
    );
  });

  it("repairs JSON ciphertext produced from PocketBase byte arrays", () => {
    const key = "x".repeat(32);
    const expected = '["café","計画","🚀"]';
    const byteArray = JSON.stringify([...Buffer.from(expected)]);
    const record = fakeRecord({
      id: "record-one",
      title: "enc:v1:already-title",
      tags: `enc:v1:cipher(xxxx:${byteArray})`,
      subtasks: "enc:v1:already-subtasks",
      time_entries: undefined,
    });
    const migration = loadMigration(key, [record]);

    migration.run();

    expect(migration.updates).toHaveLength(1);
    expect(migration.updates[0]?.params.tags).toBe(
      `enc:v1:cipher(xxxx:${expected})`,
    );
  });

  it("fails closed when legacy ciphertext contains invalid UTF-8 bytes", () => {
    const key = "x".repeat(32);
    const record = fakeRecord({
      id: "record-one",
      title: "enc:v1:already-title",
      tags: "enc:v1:cipher(xxxx:[195,40])",
      subtasks: "enc:v1:already-subtasks",
      time_entries: undefined,
    });
    const migration = loadMigration(key, [record]);

    expect(() => migration.run()).toThrow("UTF-8");
    expect(migration.updates).toEqual([]);
  });
});
