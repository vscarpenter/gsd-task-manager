import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Top three spec section 10: the self-hosted Docker migration for the two focus fields. */

const DOCKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docker");
const SHIPPED = path.join(DOCKER, "pb_migrations");
const DATE_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";

type MigrationFn = (app: object) => void;

interface FakeField {
  name: string;
  [validator: string]: unknown;
}

function migrationFile(): string {
  const files = readdirSync(SHIPPED).filter((file) => /^\d+_top_three\.js$/.test(file));
  expect(files).toHaveLength(1);
  return files[0];
}

/** Runs the migration source with the PocketBase globals it uses, and returns its two halves. */
function loadMigration(): { up: MigrationFn; down: MigrationFn } {
  const file = path.join(SHIPPED, migrationFile());
  let up: MigrationFn | undefined;
  let down: MigrationFn | undefined;
  const sandbox = {
    migrate: (upFn: MigrationFn, downFn: MigrationFn) => {
      up = upFn;
      down = downFn;
    },
    DynamicModel: class {
      constructor(shape: object) {
        Object.assign(this, shape);
      }
    },
    TextField: class {
      constructor(options: object) {
        Object.assign(this, { type: "text" }, options);
      }
    },
    NumberField: class {
      constructor(options: object) {
        Object.assign(this, { type: "number" }, options);
      }
    },
  };
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file });
  expect(up).toBeTypeOf("function");
  expect(down).toBeTypeOf("function");
  return { up: up!, down: down! };
}

/** A fake app whose database holds a tasks collection with `fields`, or no tasks table at all. */
function fakeApp(fields: FakeField[] | null) {
  const list = [...(fields ?? [])];
  const collection = {
    fields: {
      list,
      getByName: (name: string) => list.find((field) => field.name === name),
      add: (field: FakeField) => list.push(field),
      removeByName: (name: string) => {
        const index = list.findIndex((field) => field.name === name);
        if (index >= 0) list.splice(index, 1);
      },
    },
  };
  const saved: unknown[] = [];
  const app = {
    db: () => ({
      newQuery: () => ({
        one: (model: { count: number }) => {
          model.count = fields ? 1 : 0;
        },
      }),
    }),
    findCollectionByNameOrId: (name: string) => {
      if (name !== "tasks" || !fields) throw new Error("sql: no rows in result set");
      return collection;
    },
    save: (saving: unknown) => saved.push(saving),
  };
  return { app, list, saved };
}

const named = (list: FakeField[], name: string) => list.filter((field) => field.name === name);

describe("top three migration", () => {
  it("adds focus_date and focus_rank with the spec's validators", () => {
    const { app, list, saved } = fakeApp([{ name: "saved_at" }]);

    loadMigration().up(app);

    expect(named(list, "focus_date")).toEqual([{ type: "text", name: "focus_date", max: 10, pattern: DATE_PATTERN }]);
    expect(named(list, "focus_rank")).toEqual([{ type: "number", name: "focus_rank", min: 0, max: 3, onlyInt: true }]);
    expect(saved).toHaveLength(1);
  });

  it("keeps fields that already exist instead of adding them twice", () => {
    const focusDate = { name: "focus_date", max: 10 };
    const focusRank = { name: "focus_rank", max: 3 };
    const { app, list } = fakeApp([focusDate, focusRank]);

    loadMigration().up(app);

    expect(list).toEqual([focusDate, focusRank]);
    expect(list[0]).toBe(focusDate);
  });

  it("does nothing before the tasks collection exists", () => {
    const { app, saved } = fakeApp(null);

    loadMigration().up(app);

    expect(saved).toEqual([]);
  });

  it("removes both fields on the way down and keeps the rest", () => {
    const { app, list } = fakeApp([{ name: "saved_at" }]);
    const migration = loadMigration();
    migration.up(app);

    migration.down(app);

    expect(list.map((field) => field.name)).toEqual(["saved_at"]);
  });

  it("ships after every earlier migration, with no draft left behind", () => {
    const file = migrationFile();
    const stamp = (name: string) => Number(name.split("_")[0]);
    const earlier = readdirSync(SHIPPED).filter((name) => name !== file);

    for (const name of earlier) expect(stamp(file), name).toBeGreaterThan(stamp(name));
    // The fresh set copies every shipped migration (docker/lib/migrations.sh), so it needs no copy.
    expect(readdirSync(path.join(DOCKER, "pb_fresh_migrations")).filter((name) => name.includes("top_three"))).toEqual([]);
    const drafts = path.join(DOCKER, "pb_migration_drafts");
    expect(existsSync(drafts) ? readdirSync(drafts).filter((name) => name.includes("top_three")) : []).toEqual([]);
  });
});
