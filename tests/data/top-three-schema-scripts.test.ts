import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Top three spec section 10: both schema scripts add focus_date and focus_rank with top-level
 * validators, because PocketBase 0.40.4 ignores an `options` block without an error. Each script
 * runs for real against a fake PocketBase on loopback, so PB_URL never reaches production.
 */

const UPDATE_SCRIPT = "scripts/update-pocketbase-tasks-schema.sh";
const SETUP_SCRIPT = "scripts/setup-pocketbase-collections.sh";
const DATE_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";
const FOCUS_DATE = { name: "focus_date", type: "text", required: false, system: false, max: 10, pattern: DATE_PATTERN };
const FOCUS_RANK = { name: "focus_rank", type: "number", required: false, system: false, min: 0, max: 3, onlyInt: true };

interface PbField {
  name: string;
  [key: string]: unknown;
}

interface Collection {
  fields: PbField[];
  [key: string]: unknown;
}

interface SeenRequest {
  method: string;
  path: string;
  body: unknown;
}

/** What the fake server stores when the update script sends its PATCH. */
type Store = (patch: Collection) => Collection;

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
});

function storedTasks(extra: PbField[] = []): Collection {
  return {
    id: "pbc_tasks",
    name: "tasks",
    type: "base",
    system: false,
    fields: [
      { id: "text1", name: "task_id", type: "text" },
      { id: "bool1", name: "notification_sent", type: "bool" },
      { id: "text2", name: "last_notification_at", type: "text", max: 50 },
      { id: "text3", name: "snoozed_until", type: "text", max: 50 },
      ...extra,
    ],
    indexes: ["CREATE INDEX idx_tasks_owner ON tasks (owner)"],
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : null;
}

function reply(seen: SeenRequest, stored: Collection, store: Store): unknown {
  const route = `${seen.method} ${seen.path}`;
  if (route === "POST /api/collections/_superusers/auth-with-password") return { token: "fake-token" };
  if (route === "GET /api/collections/tasks") return stored;
  if (route === "PATCH /api/collections/tasks") return store(seen.body as Collection);
  if (route === "POST /api/collections") return { id: "pbc_created", ...(seen.body as object) };
  return undefined;
}

async function fakePocketBase(stored: Collection, store: Store = (patch) => patch) {
  const requests: SeenRequest[] = [];
  const server = createServer(async (request, response) => {
    const seen = { method: request.method ?? "", path: request.url ?? "", body: await readJson(request) };
    requests.push(seen);
    const body = reply(seen, stored, store);
    response.writeHead(body ? 200 : 404, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body ?? { message: "not found" }));
  });
  servers.push(server);
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const sent = (method: string, path: string) => requests.find((r) => r.method === method && r.path === path)?.body as Collection;
  return { url, sent };
}

function runScript(script: string, url: string): Promise<{ code: number | null; output: string }> {
  // Both scripts default PB_URL to production. Refuse anything but the fake server.
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PB_URL: url, PB_ADMIN_EMAIL: "admin@example.test", PB_ADMIN_PASSWORD: "fixture" };
    const child = spawn("bash", [script], { env });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

const named = (fields: PbField[], name: string) => fields.filter((field) => field.name === name);

describe("update-pocketbase-tasks-schema.sh", () => {
  it("merges both focus fields into the fetched collection with top-level validators", async () => {
    const stored = storedTasks();
    const pb = await fakePocketBase(stored);

    const run = await runScript(UPDATE_SCRIPT, pb.url);

    expect(run.code, run.output).toBe(0);
    const patch = pb.sent("PATCH", "/api/collections/tasks");
    expect(named(patch.fields, "focus_date")).toEqual([FOCUS_DATE]);
    expect(named(patch.fields, "focus_rank")).toEqual([FOCUS_RANK]);
    // A merge can't drop or change a field the server already holds.
    expect(patch.fields.slice(0, stored.fields.length)).toEqual(stored.fields);
  });

  it("keeps a focus field the server already has and adds the missing one", async () => {
    const existing = { id: "text9", ...FOCUS_DATE };
    const pb = await fakePocketBase(storedTasks([existing]));

    const run = await runScript(UPDATE_SCRIPT, pb.url);

    expect(run.code, run.output).toBe(0);
    const patch = pb.sent("PATCH", "/api/collections/tasks");
    expect(named(patch.fields, "focus_date")).toEqual([existing]);
    expect(named(patch.fields, "focus_rank")).toEqual([FOCUS_RANK]);
  });

  it("fails when the server doesn't store a validator", async () => {
    // What 0.40.4 does with a validator sent under `options`: it stores the zero value.
    const dropsRankMax: Store = (patch) => ({
      ...patch,
      fields: patch.fields.map((field) => (field.name === "focus_rank" ? { ...field, max: 0 } : field)),
    });
    const pb = await fakePocketBase(storedTasks(), dropsRankMax);

    const run = await runScript(UPDATE_SCRIPT, pb.url);

    expect(run.code).not.toBe(0);
    expect(run.output).toContain("focus_rank");
  });
});

describe("setup-pocketbase-collections.sh", () => {
  it("creates both focus fields with top-level validators", async () => {
    const pb = await fakePocketBase(storedTasks());

    const run = await runScript(SETUP_SCRIPT, pb.url);

    expect(run.code, run.output).toBe(0);
    const created = pb.sent("POST", "/api/collections");
    expect(named(created.fields, "focus_date")).toEqual([FOCUS_DATE]);
    expect(named(created.fields, "focus_rank")).toEqual([FOCUS_RANK]);
  });
});
