import { describe, expect, it, beforeEach, vi } from "vitest";
import {
	calculateMetrics,
	getCompletionTrend,
	getStreakData,
	calculateTagStatistics,
	getRecurrenceBreakdown,
	getQuadrantPerformance,
} from "@/lib/analytics";
import type { TaskRecord } from "@/lib/types";

describe("Analytics module", () => {
	// Helper to create test tasks
	const createTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
		id: `task-${Math.random()}`,
		title: "Test Task",
		description: "",
		urgent: false,
		important: false,
		quadrant: "not-urgent-not-important",
		completed: false,
		dueDate: undefined,
		recurrence: "none",
		tags: [],
		subtasks: [],
		dependencies: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		notificationEnabled: false,
		notificationSent: false,
		...overrides,
	});

	beforeEach(() => {
		// Reset system time to a known date for consistent testing
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
	});

	describe("calculateMetrics", () => {
		it("should return zero metrics for empty task array", () => {
			const metrics = calculateMetrics([]);

			expect(metrics.completedToday).toBe(0);
			expect(metrics.completedThisWeek).toBe(0);
			expect(metrics.completedThisMonth).toBe(0);
			expect(metrics.activeStreak).toBe(0);
			expect(metrics.longestStreak).toBe(0);
			expect(metrics.completionRate).toBe(0);
			expect(metrics.activeTasks).toBe(0);
			expect(metrics.completedTasks).toBe(0);
			expect(metrics.totalTasks).toBe(0);
			expect(metrics.overdueCount).toBe(0);
			expect(metrics.dueTodayCount).toBe(0);
			expect(metrics.dueThisWeekCount).toBe(0);
			expect(metrics.noDueDateCount).toBe(0);
			expect(metrics.tagStats).toEqual([]);
		});

		it("should calculate completion counts correctly", () => {
			const tasks = [
				// Completed today
				createTask({ completed: true, updatedAt: "2025-01-15T10:00:00Z" }),
				createTask({ completed: true, updatedAt: "2025-01-15T11:00:00Z" }),
				// Completed this week but not today
				createTask({ completed: true, updatedAt: "2025-01-13T10:00:00Z" }),
				// Completed this month but not this week
				createTask({ completed: true, updatedAt: "2025-01-05T10:00:00Z" }),
				// Not completed
				createTask({ completed: false }),
			];

			const metrics = calculateMetrics(tasks);

			expect(metrics.completedToday).toBe(2);
			expect(metrics.completedThisWeek).toBe(3);
			expect(metrics.completedThisMonth).toBe(4);
			expect(metrics.completedTasks).toBe(4);
			expect(metrics.activeTasks).toBe(1);
			expect(metrics.totalTasks).toBe(5);
		});

		it("should calculate completion rate correctly", () => {
			const tasks = [
				createTask({ completed: true }),
				createTask({ completed: true }),
				createTask({ completed: true }),
				createTask({ completed: false }),
			];

			const metrics = calculateMetrics(tasks);

			expect(metrics.completionRate).toBe(75); // 3/4 = 75%
		});

		it("should calculate quadrant distribution for active tasks only", () => {
			const tasks = [
				createTask({ quadrant: "urgent-important", completed: false }),
				createTask({ quadrant: "urgent-important", completed: false }),
				createTask({ quadrant: "not-urgent-important", completed: false }),
				createTask({ quadrant: "urgent-not-important", completed: false }),
				// Completed tasks should not be counted
				createTask({ quadrant: "urgent-important", completed: true }),
			];

			const metrics = calculateMetrics(tasks);

			expect(metrics.quadrantDistribution["urgent-important"]).toBe(2);
			expect(metrics.quadrantDistribution["not-urgent-important"]).toBe(1);
			expect(metrics.quadrantDistribution["urgent-not-important"]).toBe(1);
			expect(metrics.quadrantDistribution["not-urgent-not-important"]).toBe(0);
		});

		it("should count overdue tasks correctly", () => {
			const tasks = [
				// Overdue (past)
				createTask({ completed: false, dueDate: "2025-01-10T10:00:00Z" }),
				createTask({ completed: false, dueDate: "2025-01-14T23:59:00Z" }),
				// Due today (also counts in dueThisWeek because it's after start of day)
				createTask({ completed: false, dueDate: "2025-01-15T10:00:00Z" }),
				// Due this week (5 days from now)
				createTask({ completed: false, dueDate: "2025-01-20T10:00:00Z" }),
				// No due date
				createTask({ completed: false, dueDate: undefined }),
				// Completed (should not count as overdue)
				createTask({ completed: true, dueDate: "2025-01-10T10:00:00Z" }),
			];

			const metrics = calculateMetrics(tasks);

			expect(metrics.overdueCount).toBe(2);
			expect(metrics.dueTodayCount).toBe(1);
			// Note: dueThisWeekCount includes the "due today" task because it's after startOfDay(today)
			expect(metrics.dueThisWeekCount).toBe(2);
			expect(metrics.noDueDateCount).toBe(1);
		});

		it("should include tag statistics", () => {
			const tasks = [
				createTask({ tags: ["work", "urgent"], completed: false }),
				createTask({ tags: ["work"], completed: true }),
				createTask({ tags: ["personal"], completed: false }),
			];

			const metrics = calculateMetrics(tasks);

			expect(metrics.tagStats.length).toBeGreaterThan(0);
			const workTag = metrics.tagStats.find((s) => s.tag === "work");
			expect(workTag).toBeDefined();
			expect(workTag!.count).toBe(2);
		});
	});

	describe("getCompletionTrend", () => {
		it("should return correct number of data points", () => {
			const tasks = [createTask()];

			const trend7 = getCompletionTrend(tasks, 7);
			const trend30 = getCompletionTrend(tasks, 30);

			expect(trend7).toHaveLength(7);
			expect(trend30).toHaveLength(30);
		});

		it("should count completed tasks on correct dates", () => {
			const tasks = [
				createTask({ completed: true, updatedAt: "2025-01-15T10:00:00Z" }), // Today
				createTask({ completed: true, updatedAt: "2025-01-15T14:00:00Z" }), // Today
				createTask({ completed: true, updatedAt: "2025-01-14T10:00:00Z" }), // Yesterday
				createTask({ completed: false, updatedAt: "2025-01-13T10:00:00Z" }), // Not completed
			];

			const trend = getCompletionTrend(tasks, 3);

			// Find today's data point (last in array)
			const todayData = trend[trend.length - 1];
			expect(todayData.completed).toBe(2);

			// Find yesterday's data point
			const yesterdayData = trend[trend.length - 2];
			expect(yesterdayData.completed).toBe(1);
		});

		it("should count created tasks on correct dates", () => {
			const tasks = [
				createTask({ createdAt: "2025-01-15T10:00:00Z" }), // Today
				createTask({ createdAt: "2025-01-14T10:00:00Z" }), // Yesterday
				createTask({ createdAt: "2025-01-14T16:00:00Z" }), // Yesterday
			];

			const trend = getCompletionTrend(tasks, 3);

			const todayData = trend[trend.length - 1];
			expect(todayData.created).toBe(1);

			const yesterdayData = trend[trend.length - 2];
			expect(yesterdayData.created).toBe(2);
		});

		it("should format dates as YYYY-MM-DD", () => {
			const tasks = [createTask()];
			const trend = getCompletionTrend(tasks, 1);

			expect(trend[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		it("should return zero counts for days with no activity", () => {
			const tasks: TaskRecord[] = [];
			const trend = getCompletionTrend(tasks, 7);

			expect(trend.every((d) => d.completed === 0 && d.created === 0)).toBe(
				true,
			);
		});
	});

	describe("getStreakData", () => {
		it("should return zero streak for empty task array", () => {
			const streak = getStreakData([]);

			expect(streak.current).toBe(0);
			expect(streak.longest).toBe(0);
			expect(streak.lastCompletionDate).toBeNull();
		});

		it("should return zero streak for no completed tasks", () => {
			const tasks = [createTask({ completed: false })];
			const streak = getStreakData(tasks);

			expect(streak.current).toBe(0);
			expect(streak.longest).toBe(0);
			expect(streak.lastCompletionDate).toBeNull();
		});

		it("should calculate current streak correctly", () => {
			const tasks = [
				// Today
				createTask({ completed: true, updatedAt: "2025-01-15T10:00:00Z" }),
				// Yesterday
				createTask({ completed: true, updatedAt: "2025-01-14T10:00:00Z" }),
				// Day before yesterday
				createTask({ completed: true, updatedAt: "2025-01-13T10:00:00Z" }),
				// Gap here (2025-01-12 missing)
				createTask({ completed: true, updatedAt: "2025-01-11T10:00:00Z" }),
			];

			const streak = getStreakData(tasks);

			expect(streak.current).toBe(3); // Today + yesterday + day before
			expect(streak.longest).toBeGreaterThanOrEqual(3);
		});

		it("should calculate longest streak correctly", () => {
			const tasks = [
				// Recent short streak (2 days)
				createTask({ completed: true, updatedAt: "2025-01-15T10:00:00Z" }),
				createTask({ completed: true, updatedAt: "2025-01-14T10:00:00Z" }),
				// Gap
				// Longer past streak (3 days)
				createTask({ completed: true, updatedAt: "2025-01-10T10:00:00Z" }),
				createTask({ completed: true, updatedAt: "2025-01-09T10:00:00Z" }),
				createTask({ completed: true, updatedAt: "2025-01-08T10:00:00Z" }),
			];

			const streak = getStreakData(tasks);

			expect(streak.longest).toBe(3);
			expect(streak.current).toBe(2);
		});

		it("should return last completion date", () => {
			const tasks = [
				createTask({ completed: true, updatedAt: "2025-01-15T10:00:00Z" }),
				createTask({ completed: true, updatedAt: "2025-01-14T10:00:00Z" }),
			];

			const streak = getStreakData(tasks);

			expect(streak.lastCompletionDate).toBe("2025-01-15");
		});

		it("should handle multiple tasks completed on same day", () => {
			const tasks = [
				createTask({ completed: true, updatedAt: "2025-01-15T09:00:00Z" }),
				createTask({ completed: true, updatedAt: "2025-01-15T10:00:00Z" }),
				createTask({ completed: true, updatedAt: "2025-01-15T11:00:00Z" }),
				createTask({ completed: true, updatedAt: "2025-01-14T10:00:00Z" }),
			];

			const streak = getStreakData(tasks);

			expect(streak.current).toBe(2); // 2 unique days
		});

		it("should break streak on missing day", () => {
			const tasks = [
				// Today
				createTask({ completed: true, updatedAt: "2025-01-15T10:00:00Z" }),
				// Skip yesterday (2025-01-14)
				// Day before yesterday
				createTask({ completed: true, updatedAt: "2025-01-13T10:00:00Z" }),
			];

			const streak = getStreakData(tasks);

			expect(streak.current).toBe(1); // Only today
		});
	});

	describe("calculateTagStatistics", () => {
		it("should return empty array for tasks with no tags", () => {
			const tasks = [createTask({ tags: [] })];
			const stats = calculateTagStatistics(tasks);

			expect(stats).toEqual([]);
		});

		it("should aggregate tag counts correctly", () => {
			const tasks = [
				createTask({ tags: ["work", "urgent"] }),
				createTask({ tags: ["work"] }),
				createTask({ tags: ["personal"] }),
			];

			const stats = calculateTagStatistics(tasks);

			const workTag = stats.find((s) => s.tag === "work");
			const urgentTag = stats.find((s) => s.tag === "urgent");
			const personalTag = stats.find((s) => s.tag === "personal");

			expect(workTag).toBeDefined();
			expect(workTag!.count).toBe(2);
			expect(urgentTag).toBeDefined();
			expect(urgentTag!.count).toBe(1);
			expect(personalTag).toBeDefined();
			expect(personalTag!.count).toBe(1);
		});

		it("should calculate completion rates for tags", () => {
			const tasks = [
				createTask({ tags: ["work"], completed: true }),
				createTask({ tags: ["work"], completed: true }),
				createTask({ tags: ["work"], completed: false }),
				createTask({ tags: ["personal"], completed: false }),
				createTask({ tags: ["personal"], completed: false }),
			];

			const stats = calculateTagStatistics(tasks);

			const workTag = stats.find((s) => s.tag === "work");
			const personalTag = stats.find((s) => s.tag === "personal");

			expect(workTag!.completionRate).toBe(67); // 2/3 ≈ 67%
			expect(workTag!.completedCount).toBe(2);
			expect(personalTag!.completionRate).toBe(0); // 0/2 = 0%
			expect(personalTag!.completedCount).toBe(0);
		});

		it("should sort tags by count descending", () => {
			const tasks = [
				createTask({ tags: ["rare"] }),
				createTask({ tags: ["common"] }),
				createTask({ tags: ["common"] }),
				createTask({ tags: ["common"] }),
				createTask({ tags: ["uncommon"] }),
				createTask({ tags: ["uncommon"] }),
			];

			const stats = calculateTagStatistics(tasks);

			expect(stats[0].tag).toBe("common");
			expect(stats[0].count).toBe(3);
			expect(stats[1].tag).toBe("uncommon");
			expect(stats[1].count).toBe(2);
			expect(stats[2].tag).toBe("rare");
			expect(stats[2].count).toBe(1);
		});

		it("should handle tasks with multiple tags", () => {
			const tasks = [createTask({ tags: ["a", "b", "c"] })];

			const stats = calculateTagStatistics(tasks);

			expect(stats).toHaveLength(3);
			expect(stats.every((s) => s.count === 1)).toBe(true);
		});
	});

	describe("getRecurrenceBreakdown", () => {
		it("should return zero for all types when no tasks", () => {
			const breakdown = getRecurrenceBreakdown([]);

			expect(breakdown.none).toBe(0);
			expect(breakdown.daily).toBe(0);
			expect(breakdown.weekly).toBe(0);
			expect(breakdown.monthly).toBe(0);
		});

		it("should count active tasks by recurrence type", () => {
			const tasks = [
				createTask({ recurrence: "none", completed: false }),
				createTask({ recurrence: "daily", completed: false }),
				createTask({ recurrence: "daily", completed: false }),
				createTask({ recurrence: "weekly", completed: false }),
				createTask({ recurrence: "monthly", completed: false }),
			];

			const breakdown = getRecurrenceBreakdown(tasks);

			expect(breakdown.none).toBe(1);
			expect(breakdown.daily).toBe(2);
			expect(breakdown.weekly).toBe(1);
			expect(breakdown.monthly).toBe(1);
		});

		it("should exclude completed tasks", () => {
			const tasks = [
				createTask({ recurrence: "daily", completed: false }),
				createTask({ recurrence: "daily", completed: true }),
				createTask({ recurrence: "weekly", completed: true }),
			];

			const breakdown = getRecurrenceBreakdown(tasks);

			expect(breakdown.daily).toBe(1);
			expect(breakdown.weekly).toBe(0);
		});
	});

	describe("getQuadrantPerformance", () => {
		it("should return performance data for all quadrants", () => {
			const tasks = [createTask({ quadrant: "urgent-important" })];
			const performance = getQuadrantPerformance(tasks);

			expect(performance).toHaveLength(4);
			expect(
				performance.every((p) =>
					[
						"urgent-important",
						"not-urgent-important",
						"urgent-not-important",
						"not-urgent-not-important",
					].includes(p.quadrantId),
				),
			).toBe(true);
		});

		it("should calculate completion rates correctly", () => {
			const tasks = [
				// Urgent-Important: 2/3 completed
				createTask({ quadrant: "urgent-important", completed: true }),
				createTask({ quadrant: "urgent-important", completed: true }),
				createTask({ quadrant: "urgent-important", completed: false }),
				// Not-Urgent-Important: 1/2 completed
				createTask({ quadrant: "not-urgent-important", completed: true }),
				createTask({ quadrant: "not-urgent-important", completed: false }),
			];

			const performance = getQuadrantPerformance(tasks);

			const urgentImportant = performance.find(
				(p) => p.quadrantId === "urgent-important",
			);
			const notUrgentImportant = performance.find(
				(p) => p.quadrantId === "not-urgent-important",
			);

			expect(urgentImportant!.completionRate).toBe(67); // 2/3 ≈ 67%
			expect(urgentImportant!.totalTasks).toBe(3);
			expect(urgentImportant!.completedTasks).toBe(2);

			expect(notUrgentImportant!.completionRate).toBe(50); // 1/2 = 50%
			expect(notUrgentImportant!.totalTasks).toBe(2);
			expect(notUrgentImportant!.completedTasks).toBe(1);
		});

		it("should return 0% completion for quadrants with no tasks", () => {
			const tasks = [createTask({ quadrant: "urgent-important" })];
			const performance = getQuadrantPerformance(tasks);

			const emptyQuadrant = performance.find(
				(p) => p.quadrantId === "urgent-not-important",
			);
			expect(emptyQuadrant!.completionRate).toBe(0);
			expect(emptyQuadrant!.totalTasks).toBe(0);
		});

		it("should sort by completion rate descending", () => {
			const tasks = [
				createTask({ quadrant: "urgent-important", completed: true }),
				createTask({ quadrant: "urgent-important", completed: true }),
				createTask({ quadrant: "not-urgent-important", completed: true }),
				createTask({ quadrant: "not-urgent-important", completed: false }),
				createTask({ quadrant: "urgent-not-important", completed: false }),
			];

			const performance = getQuadrantPerformance(tasks);

			// Should be sorted from highest to lowest completion rate
			expect(performance[0].completionRate).toBeGreaterThanOrEqual(
				performance[1].completionRate,
			);
			expect(performance[1].completionRate).toBeGreaterThanOrEqual(
				performance[2].completionRate,
			);
			expect(performance[2].completionRate).toBeGreaterThanOrEqual(
				performance[3].completionRate,
			);
		});

		it("should handle 100% completion rate", () => {
			const tasks = [
				createTask({ quadrant: "urgent-important", completed: true }),
				createTask({ quadrant: "urgent-important", completed: true }),
			];

			const performance = getQuadrantPerformance(tasks);
			const urgentImportant = performance.find(
				(p) => p.quadrantId === "urgent-important",
			);

			expect(urgentImportant!.completionRate).toBe(100);
		});
	});
});
