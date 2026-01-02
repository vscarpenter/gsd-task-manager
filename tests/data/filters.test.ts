import { describe, expect, it } from "vitest";
import { applyFilters, isEmptyFilter, getFilterDescription, BUILT_IN_SMART_VIEWS } from "@/lib/filters";
import type { FilterCriteria } from "@/lib/filters";
import type { TaskRecord } from "@/lib/types";

describe("Filter utilities", () => {
  const sampleTasks: TaskRecord[] = [
    {
      id: "1",
      title: "Urgent task",
      description: "Fix bug",
      urgent: true,
      important: true,
      quadrant: "urgent-important",
      completed: false,
      dueDate: new Date().toISOString(), // Due today
      recurrence: "none",
      tags: ["work", "bug"],
      subtasks: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notificationEnabled: true,
      notificationSent: false
    },
    {
      id: "2",
      title: "Planning task",
      description: "Review strategy",
      urgent: false,
      important: true,
      quadrant: "not-urgent-important",
      completed: false,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // Due in 5 days
      recurrence: "weekly",
      tags: ["planning"],
      subtasks: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notificationEnabled: true,
      notificationSent: false
    },
    {
      id: "3",
      title: "Completed task",
      description: "Done",
      urgent: true,
      important: false,
      quadrant: "urgent-not-important",
      completed: true,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Completed 2 days ago
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      recurrence: "none",
      tags: ["work"],
      subtasks: [],
      dependencies: [],
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // Created 10 days ago
      updatedAt: new Date().toISOString(),
      notificationEnabled: true,
      notificationSent: false
    },
    {
      id: "4",
      title: "Overdue task",
      description: "Should have done this",
      urgent: false,
      important: false,
      quadrant: "not-urgent-not-important",
      completed: false,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago (overdue)
      recurrence: "daily",
      tags: ["personal"],
      subtasks: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notificationEnabled: true,
      notificationSent: false
    },
    {
      id: "5",
      title: "No deadline task",
      description: "Someday maybe",
      urgent: false,
      important: true,
      quadrant: "not-urgent-important",
      completed: false,
      dueDate: undefined,
      recurrence: "none",
      tags: [],
      subtasks: [{ id: "sub1", title: "Subtask 1", completed: false }],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notificationEnabled: true,
      notificationSent: false
    }
  ];

  describe("applyFilters", () => {
    it("should return all tasks when no filters applied", () => {
      const criteria: FilterCriteria = {};
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(5);
    });

    it("should filter by quadrants", () => {
      const criteria: FilterCriteria = {
        quadrants: ["urgent-important", "not-urgent-important"]
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(3);
      expect(result.every(t => t.quadrant === "urgent-important" || t.quadrant === "not-urgent-important")).toBe(true);
    });

    it("should filter by active status", () => {
      const criteria: FilterCriteria = {
        status: "active"
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(4);
      expect(result.every(t => !t.completed)).toBe(true);
    });

    it("should filter by completed status", () => {
      const criteria: FilterCriteria = {
        status: "completed"
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(1);
      expect(result[0].completed).toBe(true);
    });

    it("should filter by tags", () => {
      const criteria: FilterCriteria = {
        tags: ["work"]
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(2);
      expect(result.every(t => t.tags.includes("work"))).toBe(true);
    });

    it("should filter by multiple tags (AND logic)", () => {
      const criteria: FilterCriteria = {
        tags: ["work", "bug"]
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter by overdue", () => {
      const criteria: FilterCriteria = {
        overdue: true
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("4");
    });

    it("should filter by due today", () => {
      const criteria: FilterCriteria = {
        dueToday: true
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter by due this week", () => {
      const criteria: FilterCriteria = {
        dueThisWeek: true
      };
      const result = applyFilters(sampleTasks, criteria);
      // Should include task 2 (in 5 days) and might include task 1 (today) depending on time
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(t => t.id === "2")).toBe(true);
    });

    it("should filter by recurrence types", () => {
      const criteria: FilterCriteria = {
        recurrence: ["weekly", "daily"]
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(2);
      expect(result.some(t => t.recurrence === "weekly")).toBe(true);
      expect(result.some(t => t.recurrence === "daily")).toBe(true);
    });

    it("should filter by no due date", () => {
      const criteria: FilterCriteria = {
        noDueDate: true
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("5");
      expect(result[0].dueDate).toBeUndefined();
    });

    it("should filter by search query", () => {
      const criteria: FilterCriteria = {
        searchQuery: "bug"
      };
      const result = applyFilters(sampleTasks, criteria);
      // Should match task with "bug" in description or tags
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(t => t.id === "1")).toBe(true);
    });

    it("should search in subtasks", () => {
      const criteria: FilterCriteria = {
        searchQuery: "Subtask 1"
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("5");
    });

    it("should filter by recently added (last 7 days)", () => {
      const criteria: FilterCriteria = {
        recentlyAdded: true
      };
      const result = applyFilters(sampleTasks, criteria);
      // Should include tasks 1, 2, 4, 5 (all created recently), but not task 3 (created 10 days ago)
      expect(result.length).toBe(4);
      expect(result.every(t => t.id !== "3")).toBe(true);
    });

    it("should filter by recently completed (last 7 days)", () => {
      const criteria: FilterCriteria = {
        recentlyCompleted: true
      };
      const result = applyFilters(sampleTasks, criteria);
      // Should include task 3 (completed 2 days ago)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("3");
    });

    it("should combine multiple filters (AND logic)", () => {
      const criteria: FilterCriteria = {
        quadrants: ["urgent-important"],
        status: "active",
        tags: ["work"]
      };
      const result = applyFilters(sampleTasks, criteria);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should handle date range filtering", () => {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const criteria: FilterCriteria = {
        dueDateRange: {
          start: tomorrow.toISOString(),
          end: nextWeek.toISOString()
        }
      };
      const result = applyFilters(sampleTasks, criteria);
      // Should include task 2 (due in 5 days)
      expect(result.some(t => t.id === "2")).toBe(true);
      // Should not include task 1 (due today)
      expect(result.some(t => t.id === "1")).toBe(false);
    });
  });

  describe("isEmptyFilter", () => {
    it("should return true for empty criteria", () => {
      expect(isEmptyFilter({})).toBe(true);
    });

    it("should return true for status: all", () => {
      expect(isEmptyFilter({ status: "all" })).toBe(true);
    });

    it("should return false when quadrants specified", () => {
      expect(isEmptyFilter({ quadrants: ["urgent-important"] })).toBe(false);
    });

    it("should return false when tags specified", () => {
      expect(isEmptyFilter({ tags: ["work"] })).toBe(false);
    });

    it("should return false when overdue specified", () => {
      expect(isEmptyFilter({ overdue: true })).toBe(false);
    });

    it("should return false when search query specified", () => {
      expect(isEmptyFilter({ searchQuery: "test" })).toBe(false);
    });
  });

  describe("getFilterDescription", () => {
    it("should return 'No filters' for empty criteria", () => {
      expect(getFilterDescription({})).toBe("No filters");
    });

    it("should describe quadrant filter", () => {
      const desc = getFilterDescription({ quadrants: ["urgent-important", "not-urgent-important"] });
      expect(desc).toBe("2 quadrants");
    });

    it("should describe status filter", () => {
      const desc = getFilterDescription({ status: "active" });
      expect(desc).toBe("active");
    });

    it("should describe tag filter", () => {
      const desc = getFilterDescription({ tags: ["work", "urgent"] });
      expect(desc).toBe("2 tags");
    });

    it("should describe overdue filter", () => {
      const desc = getFilterDescription({ overdue: true });
      expect(desc).toBe("overdue");
    });

    it("should describe combined filters", () => {
      const desc = getFilterDescription({
        status: "active",
        tags: ["work"],
        overdue: true,
        searchQuery: "urgent"
      });
      expect(desc).toContain("active");
      expect(desc).toContain("1 tag");
      expect(desc).toContain("overdue");
      expect(desc).toContain('"urgent"');
    });
  });

  describe("BUILT_IN_SMART_VIEWS", () => {
    it("should include expected built-in smart views", () => {
      const names = BUILT_IN_SMART_VIEWS.map(view => view.name);
      const expectedNames = [
        "Today's Focus",
        "This Week",
        "Overdue Backlog",
        "No Deadline",
        "Recently Added",
        "This Week's Wins",
        "All Completed",
        "Recurring Tasks",
        "Ready to Work",
      ];

      expectedNames.forEach(name => {
        expect(names).toContain(name);
      });
    });

    it("should all be marked as built-in", () => {
      expect(BUILT_IN_SMART_VIEWS.every(v => v.isBuiltIn)).toBe(true);
    });

    it("should have Today's Focus view", () => {
      const view = BUILT_IN_SMART_VIEWS.find(v => v.name === "Today's Focus");
      expect(view).toBeDefined();
      expect(view?.criteria.quadrants).toEqual(['urgent-important']);
      expect(view?.criteria.status).toBe('active');
    });

    it("should have This Week view", () => {
      const view = BUILT_IN_SMART_VIEWS.find(v => v.name === "This Week");
      expect(view).toBeDefined();
      expect(view?.criteria.dueThisWeek).toBe(true);
    });

    it("should have Recurring Tasks view", () => {
      const view = BUILT_IN_SMART_VIEWS.find(v => v.name === "Recurring Tasks");
      expect(view).toBeDefined();
      expect(view?.criteria.recurrence).toEqual(["daily", "weekly", "monthly"]);
    });

    it("should have No Deadline view", () => {
      const view = BUILT_IN_SMART_VIEWS.find(v => v.name === "No Deadline");
      expect(view).toBeDefined();
      expect(view?.criteria.noDueDate).toBe(true);
      expect(view?.criteria.status).toBe('active');
    });

    it("should have Recently Added view", () => {
      const view = BUILT_IN_SMART_VIEWS.find(v => v.name === "Recently Added");
      expect(view).toBeDefined();
      expect(view?.criteria.recentlyAdded).toBe(true);
      expect(view?.criteria.status).toBe('active');
    });

    it("should have This Week's Wins view", () => {
      const view = BUILT_IN_SMART_VIEWS.find(v => v.name === "This Week's Wins");
      expect(view).toBeDefined();
      expect(view?.criteria.recentlyCompleted).toBe(true);
      expect(view?.criteria.status).toBe('completed');
    });
  });
});
