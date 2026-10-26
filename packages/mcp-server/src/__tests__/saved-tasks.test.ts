import { beforeEach, describe, expect, it, vi } from "vitest";
import { listTasks, listTasksFresh } from "../tools/list-tasks.js";
import { resetTaskCache } from "../cache.js";
import { pbTaskToTask, taskToPBFields, type PBTask } from "../types.js";

describe("Saved task compatibility", () => {
  it("keeps saved placement when an MCP edit round trips the task", () => {
    const savedAt = "2026-10-26T12:00:00.000Z";
    const task = pbTaskToTask({ task_id: "saved-article", saved_at: savedAt, title: "Read an article" } as PBTask);
    expect(task.savedAt).toBe(savedAt);
    expect(taskToPBFields(task, "owner", "device").saved_at).toBe(savedAt);
  });
});

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../pocketbase-client.js", () => ({ getPocketBase: () => ({ collection: () => ({ getFullList: mocks.fetch }) }) }));
beforeEach(() => { resetTaskCache(); mocks.fetch.mockReset(); });

it("excludes Saved from MCP active lists and caches while retaining the complete dependency graph", async () => {
  const config = { pocketBaseUrl: "https://example.invalid", authToken: "test-token" };
  mocks.fetch.mockResolvedValue([
    { task_id: "active-reading", title: "Read now", tags: ["reading"] },
    { task_id: "saved-reading", title: "Read later", tags: ["reading"], saved_at: "2026-10-26T12:00:00.000Z" },
  ]);
  expect((await listTasks(config)).map((task) => task.id)).toEqual(["active-reading"]);
  expect((await listTasks(config)).map((task) => task.id)).toEqual(["active-reading"]);
  expect((await listTasks(config, { tags: ["reading"] })).map((task) => task.id)).toEqual(["active-reading"]);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect((await listTasksFresh(config)).map((task) => task.id)).toEqual(["active-reading", "saved-reading"]);
});
