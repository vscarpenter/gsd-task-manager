import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  canUseWebShare,
  formatTaskDescription,
  formatTaskDetails,
  formatTaskHeader,
  formatTaskMetadata,
  formatTaskSubtasks,
  isValidEmail,
} from "@/components/share-task-dialog/format-task-details";
import { createMockTask } from "@/tests/fixtures";

describe("format-task-details", () => {
  describe("formatTaskHeader", () => {
    it("emits a Task: <title> line followed by a blank line", () => {
      const task = createMockTask({ title: "Ship the share dialog" });
      expect(formatTaskHeader(task)).toEqual(["Task: Ship the share dialog", ""]);
    });
  });

  describe("formatTaskDescription", () => {
    it("returns nothing when there is no description", () => {
      const task = createMockTask({ description: "" });
      expect(formatTaskDescription(task)).toEqual([]);
    });

    it("emits a labeled block when description is present", () => {
      const task = createMockTask({ description: "Notes go here" });
      expect(formatTaskDescription(task)).toEqual(["Description:", "Notes go here", ""]);
    });
  });

  describe("formatTaskMetadata", () => {
    it("labels priority as Urgent & Important when both flags are set", () => {
      const task = createMockTask({ urgent: true, important: true });
      expect(formatTaskMetadata(task)).toContain("Priority: Urgent & Important");
    });

    it("labels priority as Low Priority when neither flag is set", () => {
      const task = createMockTask({ urgent: false, important: false });
      expect(formatTaskMetadata(task)).toContain("Priority: Low Priority");
    });

    it("omits the due-date line when there is no due date", () => {
      const task = createMockTask({ dueDate: undefined });
      expect(formatTaskMetadata(task).some((line) => line.startsWith("Due:"))).toBe(false);
    });

    it("renders status as Completed when the task is done", () => {
      const task = createMockTask({ completed: true });
      expect(formatTaskMetadata(task)).toContain("Status: Completed");
    });

    it("renders tags joined by commas when present", () => {
      const task = createMockTask({ tags: ["work", "urgent"] });
      expect(formatTaskMetadata(task)).toContain("Tags: work, urgent");
    });
  });

  describe("formatTaskSubtasks", () => {
    it("returns nothing when there are no subtasks", () => {
      const task = createMockTask({ subtasks: [] });
      expect(formatTaskSubtasks(task)).toEqual([]);
    });

    it("renders subtasks with completion glyphs", () => {
      const task = createMockTask({
        subtasks: [
          { id: "1", title: "Open", completed: false },
          { id: "2", title: "Done", completed: true },
        ],
      });
      const out = formatTaskSubtasks(task);
      expect(out).toContain("  ☐ Open");
      expect(out).toContain("  ☑ Done");
    });
  });

  describe("formatTaskDetails", () => {
    it("composes all sections into a single string", () => {
      const task = createMockTask({
        title: "T",
        description: "D",
        tags: ["a"],
        subtasks: [{ id: "s1", title: "s", completed: false }],
      });
      const text = formatTaskDetails(task);
      expect(text).toContain("Task: T");
      expect(text).toContain("Description:");
      expect(text).toContain("Priority:");
      expect(text).toContain("Subtasks:");
      expect(text).toContain("Sent from GSD Task Manager");
    });
  });

  describe("canUseWebShare", () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "share");

    afterEach(() => {
      if (original) {
        Object.defineProperty(navigator, "share", original);
      } else {
        // jsdom doesn't ship navigator.share; remove anything we added.
        delete (navigator as unknown as { share?: unknown }).share;
      }
    });

    beforeEach(() => {
      delete (navigator as unknown as { share?: unknown }).share;
    });

    it("returns false when navigator.share is unavailable", () => {
      expect(canUseWebShare()).toBe(false);
    });

    it("returns true when navigator.share is a function", () => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: () => Promise.resolve(),
      });
      expect(canUseWebShare()).toBe(true);
    });
  });

  describe("isValidEmail", () => {
    it("accepts a well-formed address", () => {
      expect(isValidEmail("alice@example.com")).toBe(true);
    });

    it.each(["", "no-at-sign", "missing@domain", "missing.tld@", "a b@c.com"])(
      "rejects the malformed value %j",
      (value) => {
        expect(isValidEmail(value)).toBe(false);
      }
    );
  });
});
