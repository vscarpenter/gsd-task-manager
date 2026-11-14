import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function harness() {
  const loadedModule: { exports: { conditionalWrite?: (event: unknown, operation: string) => unknown } } = { exports: {} };
  vm.runInNewContext(readFileSync(resolve("docker/pb_hooks/task-write-contract.js"), "utf8"), {
    module: loadedModule, ApiError,
    BadRequestError: class extends ApiError { constructor(message: string) { super(400, message); } },
    NotFoundError: class extends ApiError { constructor() { super(404, "Not found"); } },
  });
  let inTransaction = false;
  const fields: Record<string, unknown> = { owner: "owner-one", task_id: "task-one", title: "Original", client_updated_at: "v1" };
  const record = {
    getString: (key: string) => String(fields[key] ?? ""),
    load: (patch: Record<string, unknown>) => Object.assign(fields, patch),
  };
  const save = vi.fn(() => { expect(inTransaction).toBe(true); });
  const remove = vi.fn(() => { expect(inTransaction).toBe(true); });
  const event = (expected = "v1", data: Record<string, unknown> = { title: "Updated", client_updated_at: "v2" }, owner = "owner-one") => ({
    auth: { id: owner }, request: { pathValue: () => "record-one" },
    requestInfo: () => ({ body: { expected_version: expected, data } }),
    app: { runInTransaction: (run: (app: unknown) => void) => {
      inTransaction = true;
      try { run({ findRecordById: () => { expect(inTransaction).toBe(true); return record; }, save, delete: remove }); }
      finally { inTransaction = false; }
    } },
    noContent: (status: number) => status,
  });
  return { run: loadedModule.exports.conditionalWrite!, event, fields, save, remove };
}

describe("atomic task write contract", () => {
  it("permits only one mutation of a version and rejects a stale update or delete", () => {
    const h = harness();
    expect(h.run(h.event(), "update")).toBe(204);
    expect(() => h.run(h.event("v1", { title: "Stale" }), "update")).toThrow("changed");
    expect(() => h.run(h.event("v1"), "delete")).toThrow("changed");
    expect(h.fields.title).toBe("Updated");
    expect(h.save).toHaveBeenCalledOnce();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("deletes only the matched version", () => {
    const h = harness();
    expect(h.run(h.event(), "delete")).toBe(204);
    expect(h.remove).toHaveBeenCalledOnce();
  });

  it("hides another owner's record and rejects immutable/unknown fields", () => {
    const h = harness();
    expect(() => h.run(h.event("v1", {}, "owner-two"), "update")).toThrow("Not found");
    expect(() => h.run(h.event("v1", { owner: "owner-two" }), "update")).toThrow();
    expect(() => h.run(h.event("v1", { task_id: "another-task" }), "update")).toThrow();
    expect(() => h.run(h.event("v1", { arbitrary: "value" }), "update")).toThrow();
    expect(h.save).not.toHaveBeenCalled();
  });

  it("requires an explicit expected version", () => {
    const h = harness();
    const event = { ...h.event(), requestInfo: () => ({ body: {} }) };
    expect(() => h.run(event, "delete")).toThrow();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("requires every update to change the version", () => {
    const h = harness();
    expect(() => h.run(h.event("v1", { title: "Unversioned change" }), "update")).toThrow();
    expect(() => h.run(h.event("v1", { client_updated_at: "v1", title: "Same version" }), "update")).toThrow();
    expect(h.save).not.toHaveBeenCalled();
  });
});
