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
