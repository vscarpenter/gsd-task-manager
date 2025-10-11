"use client";

import type { FilterCriteria } from "@/lib/filters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FilterDueDateProps {
  criteria: FilterCriteria;
  onChange: (updates: Partial<FilterCriteria>) => void;
}

/**
 * Due date filter section
 *
 * Provides quick filters (overdue, today, this week, no deadline)
 * and a custom date range picker
 */
export function FilterDueDate({ criteria, onChange }: FilterDueDateProps) {
  return (
    <div className="space-y-3">
      {/* Quick Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => onChange({
            overdue: !criteria.overdue,
            dueToday: undefined,
            dueThisWeek: undefined,
            noDueDate: undefined,
            dueDateRange: undefined
          })}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
            criteria.overdue
              ? "border-red-500 bg-red-50 font-medium text-red-700"
              : "border-card-border hover:border-accent/50"
          }`}
        >
          Overdue
        </button>
        <button
          onClick={() => onChange({
            dueToday: !criteria.dueToday,
            overdue: undefined,
            dueThisWeek: undefined,
            noDueDate: undefined,
            dueDateRange: undefined
          })}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
            criteria.dueToday
              ? "border-amber-500 bg-amber-50 font-medium text-amber-700"
              : "border-card-border hover:border-accent/50"
          }`}
        >
          Today
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onChange({
            dueThisWeek: !criteria.dueThisWeek,
            overdue: undefined,
            dueToday: undefined,
            noDueDate: undefined,
            dueDateRange: undefined
          })}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
            criteria.dueThisWeek
              ? "border-accent bg-accent/10 font-medium"
              : "border-card-border hover:border-accent/50"
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => onChange({
            noDueDate: !criteria.noDueDate,
            overdue: undefined,
            dueToday: undefined,
            dueThisWeek: undefined,
            dueDateRange: undefined
          })}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
            criteria.noDueDate
              ? "border-accent bg-accent/10 font-medium"
              : "border-card-border hover:border-accent/50"
          }`}
        >
          No Deadline
        </button>
      </div>

      {/* Custom Date Range */}
      <details className="rounded-lg border border-card-border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground-muted hover:text-foreground">
          Custom date range...
        </summary>
        <div className="grid grid-cols-2 gap-2 p-3 pt-0">
          <div>
            <Label htmlFor="date-start" className="mb-1 block text-xs">From</Label>
            <Input
              id="date-start"
              type="date"
              value={criteria.dueDateRange?.start?.slice(0, 10) || ''}
              onChange={(e) => {
                const start = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                onChange({
                  dueDateRange: start || criteria.dueDateRange?.end
                    ? { start, end: criteria.dueDateRange?.end }
                    : undefined,
                  overdue: undefined,
                  dueToday: undefined,
                  dueThisWeek: undefined,
                  noDueDate: undefined
                });
              }}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="date-end" className="mb-1 block text-xs">To</Label>
            <Input
              id="date-end"
              type="date"
              value={criteria.dueDateRange?.end?.slice(0, 10) || ''}
              onChange={(e) => {
                const end = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                onChange({
                  dueDateRange: criteria.dueDateRange?.start || end
                    ? { start: criteria.dueDateRange?.start, end }
                    : undefined,
                  overdue: undefined,
                  dueToday: undefined,
                  dueThisWeek: undefined,
                  noDueDate: undefined
                });
              }}
              className="h-9"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
