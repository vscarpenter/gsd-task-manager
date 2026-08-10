/**
 * Built-in Smart Views
 *
 * Pre-configured filter combinations for common workflows.
 * Extracted from lib/filters.ts for better code organization.
 */

import type { SmartView } from "@/lib/smart-views/types";

/**
 * Built-in Smart Views that come with the app
 */
export const BUILT_IN_SMART_VIEWS: Omit<SmartView, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: "Today's Focus",
    description: "All urgent and important tasks, your top priorities",
    icon: "flame",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      quadrants: ['urgent-important']
    }
  },
  {
    name: "This Week",
    description: "Tasks needing attention this week (overdue + next 7 days)",
    icon: "calendar",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      dueThisWeek: true
    }
  },
  {
    name: "Overdue Backlog",
    description: "All overdue tasks across quadrants",
    icon: "overdue",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      overdue: true
    }
  },
  {
    name: "No Deadline",
    description: "Tasks without due dates for planning",
    icon: "no-deadline",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      noDueDate: true
    }
  },
  {
    name: "Recently Added",
    description: "Tasks created in the last 7 days",
    icon: "added",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      recentlyAdded: true
    }
  },
  {
    name: "This Week's Wins",
    description: "Completed tasks from the last 7 days",
    icon: "completed-recent",
    isBuiltIn: true,
    criteria: {
      status: 'completed',
      recentlyCompleted: true
    }
  },
  {
    name: "All Completed",
    description: "All completed tasks across all time",
    icon: "completed",
    isBuiltIn: true,
    criteria: {
      status: 'completed'
    }
  },
  {
    name: "Recurring Tasks",
    description: "All tasks with recurrence enabled",
    icon: "recurring",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      recurrence: ['daily', 'weekly', 'monthly']
    }
  },
  {
    name: "Ready to Work",
    description: "Tasks with no blocking dependencies",
    icon: "ready",
    isBuiltIn: true,
    criteria: {
      status: 'active',
      readyToWork: true
    }
  }
];
