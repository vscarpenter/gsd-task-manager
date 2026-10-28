import { describe, it, expect } from "vitest";
import { checkImportFile } from "@/lib/tasks/import-check";
import { createMockTask } from "@/tests/fixtures";

function backup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tasks: [createMockTask()],
    exportedAt: "2026-10-27T12:00:00.000Z",
    version: "2.1.0",
    ...overrides,
  });
}

function reason(raw: string): string {
  const result = checkImportFile(raw);
  if (result.ok) throw new Error("expected the file to be rejected");
  return result.message;
}

describe("checkImportFile", () => {
  it("accepts a well-formed backup", () => {
    expect(checkImportFile(backup())).toEqual({ ok: true });
  });

  it("accepts a backup with no tasks", () => {
    expect(checkImportFile(backup({ tasks: [] }))).toEqual({ ok: true });
  });

  it("says text that is not JSON is not a backup", () => {
    expect(reason("not json {")).toMatch(/isn't valid JSON/i);
  });

  it.each([
    ["an unrelated object", JSON.stringify({ foo: [1, 2, 3] })],
    ["an empty array", "[]"],
    ["a bare number", "42"],
    ["null", "null"],
  ])("says %s is not a GSD backup file", (_label, raw) => {
    expect(reason(raw)).toBe("This is not a GSD backup file.");
  });

  it("names the task, field, and limit when a title is too long", () => {
    const long = createMockTask({ id: "long-one", title: "x".repeat(10_000) });
    const message = reason(backup({ tasks: [createMockTask(), long] }));
    expect(message).toBe("Task 2: the title is too long (80 characters at most).");
  });

  it("rejects a file over the 10,000 task cap with the cap in words", () => {
    const tasks = Array.from({ length: 10_001 }, (_, i) => createMockTask({ id: `task-${i}` }));
    expect(reason(backup({ tasks }))).toMatch(/maximum of 10,000 tasks/i);
  });

  it("counts archived and trashed tasks toward the cap", () => {
    const tasks = Array.from({ length: 5_000 }, (_, i) => createMockTask({ id: `task-${i}` }));
    const archived = Array.from({ length: 5_001 }, (_, i) =>
      createMockTask({ id: `arch-${i}`, archivedAt: "2026-10-01T00:00:00.000Z" } as never)
    );
    expect(reason(backup({ tasks, archivedTasks: archived }))).toMatch(/maximum of 10,000 tasks/i);
  });

  it("names a missing exportedAt instead of a generic failure", () => {
    const raw = JSON.stringify({ tasks: [createMockTask()], version: "2.1.0" });
    expect(reason(raw)).toMatch(/exportedAt/);
  });
});
