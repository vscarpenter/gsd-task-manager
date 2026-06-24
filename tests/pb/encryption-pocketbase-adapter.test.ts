import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import core from "../../docker/pb_hooks/encryption-core.js";

const VALID_KEY = "k".repeat(32);

interface RecordDouble {
  data: Record<string, unknown>;
  get: (field: string) => unknown;
  set: (field: string, value: unknown) => void;
}

interface HookEvent {
  record: RecordDouble;
  next: () => void;
}

interface RegisteredHook {
  collection: string;
  handler: (event: HookEvent) => void;
}

interface TaskHookRuntime {
  create: RegisteredHook[];
  update: RegisteredHook[];
  enrich: RegisteredHook[];
  encrypt: ReturnType<typeof vi.fn>;
  decrypt: ReturnType<typeof vi.fn>;
}

interface MigrationRuntime {
  up: (app: MigrationAppDouble) => void;
  down: (app: MigrationAppDouble) => void;
  encrypt: ReturnType<typeof vi.fn>;
}

interface MigrationAppDouble {
  findAllRecords: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

function toCiphertext(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function fromCiphertext(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}

function encrypted(value: string): string {
  return `${core.PREFIX}${toCiphertext(value)}`;
}

function decryptStored(value: unknown): string {
  expect(typeof value).toBe("string");
  return fromCiphertext((value as string).slice(core.PREFIX.length));
}

function fakeRecord(initial: Record<string, unknown>): RecordDouble {
  const data = { ...initial };
  return {
    data,
    get: (field: string): unknown => data[field],
    set: (field: string, value: unknown): void => {
      data[field] = value;
    },
  };
}

function readDockerScript(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function loadTaskHookRuntime(key: string | undefined = VALID_KEY): TaskHookRuntime {
  const runtime: TaskHookRuntime = {
    create: [],
    update: [],
    enrich: [],
    encrypt: vi.fn((value: string) => toCiphertext(value)),
    decrypt: vi.fn((value: string) => fromCiphertext(value)),
  };
  const sandbox = {
    __hooks: "/pb-hooks",
    $os: { getenv: vi.fn(() => key) },
    $security: {
      encrypt: runtime.encrypt,
      decrypt: runtime.decrypt,
    },
    require: (request: string): typeof core => {
      expect(request).toBe("/pb-hooks/encryption-core.js");
      return core;
    },
    onRecordCreate: (handler: RegisteredHook["handler"], collection: string): void => {
      runtime.create.push({ collection, handler });
    },
    onRecordUpdate: (handler: RegisteredHook["handler"], collection: string): void => {
      runtime.update.push({ collection, handler });
    },
    onRecordEnrich: (handler: RegisteredHook["handler"], collection: string): void => {
      runtime.enrich.push({ collection, handler });
    },
  };
  vm.runInNewContext(
    readDockerScript("docker/pb_hooks/tasks_encryption.pb.js"),
    sandbox,
    { filename: "tasks_encryption.pb.js" },
  );
  return runtime;
}

function loadMigrationRuntime(key: string | undefined = VALID_KEY): MigrationRuntime {
  const runtime: Partial<MigrationRuntime> = {
    encrypt: vi.fn((value: string) => toCiphertext(value)),
  };
  const sandbox = {
    $os: { getenv: vi.fn(() => key) },
    $security: { encrypt: runtime.encrypt },
    migrate: (
      up: MigrationRuntime["up"],
      down: MigrationRuntime["down"],
    ): void => {
      runtime.up = up;
      runtime.down = down;
    },
  };
  vm.runInNewContext(
    readDockerScript("docker/pb_migrations/1781000000_encrypt_existing_tasks.js"),
    sandbox,
    { filename: "1781000000_encrypt_existing_tasks.js" },
  );
  expect(runtime.up).toBeTypeOf("function");
  expect(runtime.down).toBeTypeOf("function");
  return runtime as MigrationRuntime;
}

describe("PocketBase task encryption hooks", () => {
  it("registers_create_update_and_read_handlers_for_tasks_only", () => {
    const runtime = loadTaskHookRuntime();

    expect(runtime.create.map((hook) => hook.collection)).toEqual(["tasks"]);
    expect(runtime.update.map((hook) => hook.collection)).toEqual(["tasks"]);
    expect(runtime.enrich.map((hook) => hook.collection)).toEqual(["tasks"]);
  });

  it("encrypts_created_and_updated_task_records_before_continuing", () => {
    const runtime = loadTaskHookRuntime();
    const createRecord = fakeRecord({
      title: "Buy milk",
      description: "2%",
      tags: ["errand"],
    });
    const updateRecord = fakeRecord({
      title: "Renew passport",
      subtasks: [{ id: "s1", title: "photo", completed: false }],
    });
    const next = vi.fn();

    runtime.create[0].handler({ record: createRecord, next });
    runtime.update[0].handler({ record: updateRecord, next });

    expect(decryptStored(createRecord.data.title)).toBe("Buy milk");
    expect(decryptStored(createRecord.data.description)).toBe("2%");
    expect(JSON.parse(decryptStored(createRecord.data.tags))).toEqual(["errand"]);
    expect(decryptStored(updateRecord.data.title)).toBe("Renew passport");
    expect(JSON.parse(decryptStored(updateRecord.data.subtasks))).toEqual([
      { id: "s1", title: "photo", completed: false },
    ]);
    expect(runtime.encrypt).toHaveBeenCalledWith("Buy milk", VALID_KEY);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("decrypts_enriched_task_records_before_continuing", () => {
    const runtime = loadTaskHookRuntime();
    const record = fakeRecord({
      title: encrypted("Read later"),
      tags: encrypted(JSON.stringify(["reading", "q2"])),
    });
    const next = vi.fn();

    runtime.enrich[0].handler({ record, next });

    expect(record.data.title).toBe("Read later");
    expect(record.data.tags).toEqual(["reading", "q2"]);
    expect(runtime.decrypt).toHaveBeenCalledWith(toCiphertext("Read later"), VALID_KEY);
    expect(next).toHaveBeenCalledOnce();
  });

  it("fails_closed_with_an_invalid_key_and_does_not_continue", () => {
    const runtime = loadTaskHookRuntime("short");
    const record = fakeRecord({ title: "Plaintext task" });
    const next = vi.fn();

    expect(() => runtime.create[0].handler({ record, next })).toThrow(
      /GSD_TASKS_ENC_KEY/,
    );
    expect(record.data.title).toBe("Plaintext task");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("PocketBase task encryption migration", () => {
  it("backfills_plaintext_task_fields_and_skips_already_encrypted_values", () => {
    const runtime = loadMigrationRuntime();
    const task = fakeRecord({
      title: "Legacy task",
      description: "",
      tags: ["legacy", "sync"],
      subtasks: [{ id: "s1", title: "step", completed: false }],
      time_entries: encrypted(JSON.stringify([{ minutes: 25 }])),
    });
    const app: MigrationAppDouble = {
      findAllRecords: vi.fn(() => [task]),
      save: vi.fn(),
    };

    runtime.up(app);

    expect(app.findAllRecords).toHaveBeenCalledWith("tasks");
    expect(decryptStored(task.data.title)).toBe("Legacy task");
    expect(task.data.description).toBe("");
    expect(JSON.parse(decryptStored(task.data.tags))).toEqual(["legacy", "sync"]);
    expect(JSON.parse(decryptStored(task.data.subtasks))).toEqual([
      { id: "s1", title: "step", completed: false },
    ]);
    expect(task.data.time_entries).toBe(encrypted(JSON.stringify([{ minutes: 25 }])));
    expect(runtime.encrypt).not.toHaveBeenCalledWith(
      JSON.stringify([{ minutes: 25 }]),
      VALID_KEY,
    );
    expect(app.save).toHaveBeenCalledWith(task);
  });

  it("fails_closed_on_invalid_key_before_reading_or_saving_records", () => {
    const runtime = loadMigrationRuntime("short");
    const app: MigrationAppDouble = {
      findAllRecords: vi.fn(() => [fakeRecord({ title: "Legacy task" })]),
      save: vi.fn(),
    };

    expect(() => runtime.up(app)).toThrow(/GSD_TASKS_ENC_KEY/);
    expect(app.findAllRecords).not.toHaveBeenCalled();
    expect(app.save).not.toHaveBeenCalled();
  });
});
