import { describe, expect, it } from "vitest";
import { taskDraftSchema } from "@/lib/schema";

/**
 * Pins the task field limits that the web, iOS, Android, and MCP clients all
 * enforce, at the schema the web validates drafts with. The limits are written
 * as literals on purpose: a test that read SCHEMA_LIMITS would still pass after
 * someone changed a shared limit in one place.
 */

const draft = { title: "Q4 board deck", urgent: true, important: true, estimatedMinutes: 0 };

describe("taskDraftSchema field limits", () => {
  it("accepts a minimal draft, fills its defaults, and treats a 0 estimate as unset", () => {
    expect(taskDraftSchema.parse(draft)).toEqual({
      title: "Q4 board deck",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
    });
  });

  it.each([
    ["an 80-character title", { title: "x".repeat(80) }],
    ["20 tags", { tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`) }],
    ["a 30-character tag", { tags: ["x".repeat(30)] }],
    ["a 1-minute estimate", { estimatedMinutes: 1 }],
    ["a 10080-minute estimate", { estimatedMinutes: 10080 }],
  ])("accepts %s", (_label, override) => {
    expect(taskDraftSchema.safeParse({ ...draft, ...override }).success).toBe(true);
  });

  it.each([
    ["an 81-character title", { title: "x".repeat(81) }],
    ["21 tags", { tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) }],
    ["a 31-character tag", { tags: ["x".repeat(31)] }],
    ["a 10081-minute estimate", { estimatedMinutes: 10081 }],
  ])("rejects %s", (_label, override) => {
    expect(taskDraftSchema.safeParse({ ...draft, ...override }).success).toBe(false);
  });
});
