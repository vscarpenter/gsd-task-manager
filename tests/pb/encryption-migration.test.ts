import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

type FakeRecord = ReturnType<typeof fakeRecord>;
type MigrationFn = (app: FakeApp) => void;

interface FakeApp {
  findAllRecords: ReturnType<typeof vi.fn<() => FakeRecord[]>>;
  save: ReturnType<typeof vi.fn<(record: FakeRecord) => void>>;
}

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docker/pb_migrations/1781000000_encrypt_existing_tasks.js",
);

function fakeRecord(initial: Record<string, unknown>) {
  const data = { ...initial };

  return {
    get: vi.fn((field: string) => data[field]),
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
  const app: FakeApp = {
    findAllRecords: vi.fn(() => records),
    save: vi.fn(),
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
    $security: { encrypt },
  });

  vm.runInContext(source, context, { filename: migrationPath });

  if (!migrateUp) {
    throw new Error("Migration did not register an up migration");
  }

  return {
    app,
    encrypt,
    run: () => migrateUp(app),
  };
}

describe("task encryption backfill migration", () => {
  it("fails closed before reading rows when the encryption key is invalid", () => {
    const record = fakeRecord({ title: "Plaintext task" });
    const migration = loadMigration("too-short", [record]);

    expect(() => migration.run()).toThrow("GSD_TASKS_ENC_KEY");
    expect(migration.app.findAllRecords).not.toHaveBeenCalled();
    expect(migration.app.save).not.toHaveBeenCalled();
    expect(migration.encrypt).not.toHaveBeenCalled();
  });

  it("encrypts plaintext task text and JSON fields before saving each row", () => {
    const key = "x".repeat(32);
    const record = fakeRecord({
      title: "Buy milk",
      description: "",
      tags: ["errand", "home"],
      subtasks: [{ id: "s1", title: "Check fridge", completed: false }],
      time_entries: [{ start: "2026-06-20T10:00:00Z", end: null }],
    });
    const migration = loadMigration(key, [record]);

    migration.run();

    expect(record.data.title).toBe("enc:v1:cipher(xxxx:Buy milk)");
    expect(record.data.description).toBe("");
    expect(record.data.tags).toBe(
      'enc:v1:cipher(xxxx:["errand","home"])',
    );
    expect(record.data.subtasks).toBe(
      'enc:v1:cipher(xxxx:[{"id":"s1","title":"Check fridge","completed":false}])',
    );
    expect(record.data.time_entries).toBe(
      'enc:v1:cipher(xxxx:[{"start":"2026-06-20T10:00:00Z","end":null}])',
    );
    expect(migration.app.save).toHaveBeenCalledOnce();
    expect(migration.app.save).toHaveBeenCalledWith(record);
  });

  it("does not double-encrypt values that already carry the encryption prefix", () => {
    const key = "x".repeat(32);
    const record = fakeRecord({
      title: "enc:v1:already-title",
      description: "enc:v1:already-description",
      tags: "enc:v1:already-tags",
      subtasks: "enc:v1:already-subtasks",
      time_entries: undefined,
    });
    const migration = loadMigration(key, [record]);

    migration.run();

    expect(record.data).toEqual({
      title: "enc:v1:already-title",
      description: "enc:v1:already-description",
      tags: "enc:v1:already-tags",
      subtasks: "enc:v1:already-subtasks",
      time_entries: undefined,
    });
    expect(migration.encrypt).not.toHaveBeenCalled();
    expect(migration.app.save).toHaveBeenCalledOnce();
  });
});
