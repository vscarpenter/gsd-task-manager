import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAllTags } from "@/lib/use-all-tags";
import { addTask } from "@/lib/tasks";
import { getDb } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";

describe("useAllTags", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.tasks.clear();
  });

  it("returns empty array when no tasks exist", async () => {
    const { result } = renderHook(() => useAllTags());

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });

  it("returns unique tags from all tasks", async () => {
    await addTask({
      title: "Task 1",
      urgent: false,
      important: false,
      tags: ["work", "urgent"],
      subtasks: [],
      dependencies: [],
    });

    await addTask({
      title: "Task 2",
      urgent: false,
      important: false,
      tags: ["personal", "work"],
      subtasks: [],
      dependencies: [],
    });

    const { result } = renderHook(() => useAllTags());

    await waitFor(() => {
      expect(result.current).toHaveLength(3);
      expect(result.current).toContain("work");
      expect(result.current).toContain("urgent");
      expect(result.current).toContain("personal");
    });
  });

  it("returns sorted tags alphabetically", async () => {
    await addTask({
      title: "Task 1",
      urgent: false,
      important: false,
      tags: ["zebra", "apple", "mango"],
      subtasks: [],
      dependencies: [],
    });

    const { result } = renderHook(() => useAllTags());

    await waitFor(() => {
      expect(result.current).toEqual(["apple", "mango", "zebra"]);
    });
  });

  it("deduplicates tags across tasks", async () => {
    await addTask({
      title: "Task 1",
      urgent: false,
      important: false,
      tags: ["work", "urgent"],
      subtasks: [],
      dependencies: [],
    });

    await addTask({
      title: "Task 2",
      urgent: false,
      important: false,
      tags: ["work", "urgent"],
      subtasks: [],
      dependencies: [],
    });

    const { result } = renderHook(() => useAllTags());

    await waitFor(() => {
      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual(["urgent", "work"]);
    });
  });

  it("handles tasks with no tags", async () => {
    await addTask({
      title: "Task 1",
      urgent: false,
      important: false,
      tags: [],
      subtasks: [],
      dependencies: [],
    });

    await addTask({
      title: "Task 2",
      urgent: false,
      important: false,
      tags: ["work"],
      subtasks: [],
      dependencies: [],
    });

    const { result } = renderHook(() => useAllTags());

    await waitFor(() => {
      expect(result.current).toEqual(["work"]);
    });
  });
});
