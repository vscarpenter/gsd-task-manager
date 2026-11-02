import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docker/pb_migrations/1793562900_users_auth_token_30_days.js",
);

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;

interface FakeUsers {
  authToken: { duration: number; secret: string };
}

type MigrationFn = (app: object) => void;

function loadMigration(): { up: MigrationFn; down: MigrationFn } {
  let up: MigrationFn | undefined;
  let down: MigrationFn | undefined;
  const sandbox = {
    migrate: (upFn: MigrationFn, downFn: MigrationFn) => {
      up = upFn;
      down = downFn;
    },
  };
  vm.runInNewContext(readFileSync(migrationPath, "utf8"), sandbox, { filename: migrationPath });
  expect(up).toBeTypeOf("function");
  expect(down).toBeTypeOf("function");
  return { up: up!, down: down! };
}

/** A fake PocketBase app holding a users collection, or none when `users` is null. */
function fakeApp(users: FakeUsers | null) {
  const saved: FakeUsers[] = [];
  const app = {
    findCollectionByNameOrId: (name: string) => {
      if (name !== "users" || !users) throw new Error("sql: no rows in result set");
      return users;
    },
    save: (collection: FakeUsers) => saved.push(collection),
  };
  return { app, saved };
}

function usersWith(duration: number): FakeUsers {
  return { authToken: { duration, secret: "keep-this-secret" } };
}

describe("users auth token 30-day migration", () => {
  it("raises the 7-day auth token to 30 days and keeps the token secret", () => {
    const users = usersWith(SEVEN_DAYS);
    const { app, saved } = fakeApp(users);

    loadMigration().up(app);

    expect(users.authToken.duration).toBe(THIRTY_DAYS);
    // The secret signs every live token; changing it would sign everyone out.
    expect(users.authToken.secret).toBe("keep-this-secret");
    expect(saved).toEqual([users]);
  });

  it("raises PocketBase's 5-day default on a fresh self-hosted install", () => {
    const users = usersWith(5 * 24 * 60 * 60);
    const { app, saved } = fakeApp(users);

    loadMigration().up(app);

    expect(users.authToken.duration).toBe(THIRTY_DAYS);
    expect(saved).toHaveLength(1);
  });

  it("leaves a duration of 30 days or more alone", () => {
    for (const duration of [THIRTY_DAYS, 60 * 24 * 60 * 60]) {
      const users = usersWith(duration);
      const { app, saved } = fakeApp(users);

      loadMigration().up(app);

      expect(users.authToken.duration).toBe(duration);
      expect(saved).toEqual([]);
    }
  });

  it("does nothing, and does not stop startup, when there is no users collection", () => {
    const { app, saved } = fakeApp(null);

    expect(() => loadMigration().up(app)).not.toThrow();
    expect(saved).toEqual([]);
  });

  it("reverts to 7 days only when the duration is still the 30 days it set", () => {
    const users = usersWith(THIRTY_DAYS);
    const { app, saved } = fakeApp(users);

    loadMigration().down(app);

    expect(users.authToken.duration).toBe(SEVEN_DAYS);
    expect(saved).toEqual([users]);
  });

  it("leaves a duration someone changed since alone when reverting", () => {
    const users = usersWith(60 * 24 * 60 * 60);
    const { app, saved } = fakeApp(users);

    loadMigration().down(app);

    expect(users.authToken.duration).toBe(60 * 24 * 60 * 60);
    expect(saved).toEqual([]);
  });
});
