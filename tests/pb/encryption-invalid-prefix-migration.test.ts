import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docker/pb_migrations/1781200000_reencrypt_invalid_prefixed_task_fields.js",
);

function fakeRecord(initial: Record<string, unknown>) {
  const data = { ...initial };
  return {
    get: (field: string) => data[field],
    getString: (field: string) => {
      const value = data[field];
      return typeof value === "string" ? value : JSON.stringify(value);
    },
  };
}

describe("invalid ciphertext-prefix migration", () => {
  it("re-encrypts marker-prefixed content that cannot be authenticated", () => {
    const record = fakeRecord({
      id: "record-one",
      title: "enc:v1:user-controlled-text",
      tags: "enc:v1:user-controlled-json",
    });
    let migrateUp: ((app: object) => void) | undefined;
    const updates: Array<{ sql: string; params: Record<string, unknown> }> = [];
    const database = {
      newQuery: (sql: string) => {
        let params: Record<string, unknown> = {};
        const query = {
          one: (model: { count: number }) => { model.count = 1; },
          bind: (next: Record<string, unknown>) => {
            params = next;
            return query;
          },
          execute: () => updates.push({ sql, params }),
        };
        return query;
      },
    };
    const app = {
      db: () => database,
      findAllRecords: vi.fn(() => [record]),
    };
    const sandbox = {
      migrate: (up: (migrationApp: object) => void) => { migrateUp = up; },
      $os: { getenv: () => "x".repeat(32) },
      $security: {
        encrypt: (value: string) => `cipher(${value})`,
        decrypt: () => { throw new Error("authentication failed"); },
      },
      DynamicModel: function DynamicModel(initial: object) { return initial; },
    };

    vm.runInNewContext(readFileSync(migrationPath, "utf8"), sandbox, { filename: migrationPath });
    expect(migrateUp).toBeTypeOf("function");
    migrateUp!(app);

    expect(updates).toEqual([{
      sql: "UPDATE tasks SET title = {:title}, tags = {:tags} WHERE id = {:id}",
      params: {
        id: "record-one",
        title: "enc:v1:cipher(enc:v1:user-controlled-text)",
        tags: 'enc:v1:cipher("enc:v1:user-controlled-json")',
      },
    }]);
  });
});

/**
 * PocketBase hands a JSON column to the JSVM as a byte-backed value rather than
 * a string: `get()` returns a non-string and `getString()` returns the column's
 * raw text. The plain-string double above cannot produce that shape, which is
 * why a double-encryption bug survived unit coverage and only the PocketBase
 * system test caught it.
 */
function jsonColumnRecord(id: string, columnText: string) {
  return {
    get: (field: string): unknown => {
      if (field === "id") return id;
      return field === "tags" ? { byteBacked: true } : undefined;
    },
    getString: (field: string): string => {
      if (field === "id") return id;
      return field === "tags" ? columnText : "";
    },
  };
}

function runMigration(
  record: { get: (field: string) => unknown; getString: (field: string) => string },
  decrypt: (value: string, key: string) => string,
): Array<{ sql: string; params: Record<string, unknown> }> {
  let migrateUp: ((app: object) => void) | undefined;
  const updates: Array<{ sql: string; params: Record<string, unknown> }> = [];
  const database = {
    newQuery: (sql: string) => {
      let params: Record<string, unknown> = {};
      const query = {
        one: (model: { count: number }) => { model.count = 1; },
        bind: (next: Record<string, unknown>) => { params = next; return query; },
        execute: () => updates.push({ sql, params }),
      };
      return query;
    },
  };
  const sandbox = {
    migrate: (up: (migrationApp: object) => void) => { migrateUp = up; },
    $os: { getenv: () => "x".repeat(32) },
    $security: { encrypt: (value: string) => `cipher(${value})`, decrypt },
    DynamicModel: function DynamicModel(initial: object) { return initial; },
  };

  vm.runInNewContext(readFileSync(migrationPath, "utf8"), sandbox, { filename: migrationPath });
  expect(migrateUp).toBeTypeOf("function");
  migrateUp!({ db: () => database, findAllRecords: vi.fn(() => [record]) });
  return updates;
}

/** Authenticates only the fixture ciphertext, and returns valid JSON for it. */
function decryptValidJson(value: string): string {
  if (value !== "AUTHENTIC") throw new Error("authentication failed");
  return JSON.stringify(["café", "計画"]);
}

describe("already-encrypted JSON columns", () => {
  // 1781100000 writes ciphertext through raw SQL, so the column holds a bare
  // string that is not valid JSON. Re-encrypting it would nest one ciphertext
  // inside another and make the value unreadable through the read hook.
  it("leaves a bare ciphertext JSON column untouched", () => {
    const updates = runMigration(
      jsonColumnRecord("record-bare", "enc:v1:AUTHENTIC"),
      decryptValidJson,
    );

    expect(updates).toEqual([]);
  });

  // The runtime hook writes through record.set(), which stores the same
  // ciphertext JSON-quoted. Both shapes must be recognised as already encrypted.
  it("leaves a quoted ciphertext JSON column untouched", () => {
    const updates = runMigration(
      jsonColumnRecord("record-quoted", JSON.stringify("enc:v1:AUTHENTIC")),
      decryptValidJson,
    );

    expect(updates).toEqual([]);
  });
});
