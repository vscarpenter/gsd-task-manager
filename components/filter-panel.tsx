"use client";

import { memo, useState } from "react";
import { FilterIcon, XIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { QuadrantId, RecurrenceType } from "@/lib/types";
import type { FilterCriteria } from "@/lib/filters";
import { quadrants } from "@/lib/quadrants";
import { getFilterDescription, isEmptyFilter } from "@/lib/filters";

interface FilterPanelProps {
  criteria: FilterCriteria;
  onChange: (criteria: FilterCriteria) => void;
  onSaveAsSmartView?: () => void;
  availableTags: string[];
}

function FilterPanelComponent({ criteria, onChange, onSaveAsSmartView, availableTags }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateCriteria = (updates: Partial<FilterCriteria>) => {
    onChange({ ...criteria, ...updates });
  };

  const toggleQuadrant = (quadrantId: QuadrantId) => {
    const current = criteria.quadrants || [];
    const updated = current.includes(quadrantId)
      ? current.filter(q => q !== quadrantId)
      : [...current, quadrantId];
    updateCriteria({ quadrants: updated.length > 0 ? updated : undefined });
  };

  const toggleTag = (tag: string) => {
    const current = criteria.tags || [];
    const updated = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    updateCriteria({ tags: updated.length > 0 ? updated : undefined });
  };

  const toggleRecurrence = (recurrence: RecurrenceType) => {
    const current = criteria.recurrence || [];
    const updated = current.includes(recurrence)
      ? current.filter(r => r !== recurrence)
      : [...current, recurrence];
    updateCriteria({ recurrence: updated.length > 0 ? updated : undefined });
  };

  const clearAll = () => {
    onChange({});
    setIsExpanded(false);
  };

  const hasActiveFilters = !isEmptyFilter(criteria);
  const filterDescription = getFilterDescription(criteria);

  return (
    <div className="rounded-lg border border-card-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent"
        >
          <FilterIcon className="h-4 w-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">
              {filterDescription}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearAll} className="text-sm px-3 py-1.5">
              <XIcon className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          {isExpanded && onSaveAsSmartView && hasActiveFilters && (
            <Button variant="subtle" onClick={onSaveAsSmartView} className="text-sm px-3 py-1.5">
              <SaveIcon className="h-4 w-4 mr-1" />
              Save View
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Quadrant Filters */}
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Quadrants</Label>
            <div className="grid grid-cols-2 gap-2">
              {quadrants.map((quadrant) => (
                <button
                  key={quadrant.id}
                  onClick={() => toggleQuadrant(quadrant.id)}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition ${
                    criteria.quadrants?.includes(quadrant.id)
                      ? "border-accent bg-accent/10 font-medium"
                      : "border-card-border hover:border-accent/50"
                  }`}
                >
                  <div className={`h-3 w-3 rounded-full ${quadrant.colorClass}`} />
                  <span className="text-xs">{quadrant.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Status</Label>
            <div className="flex gap-2">
              {(['all', 'active', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => updateCriteria({ status })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${
                    (criteria.status || 'all') === status
                      ? "border-accent bg-accent/10 font-medium"
                      : "border-card-border hover:border-accent/50"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Tag Filters */}
          {availableTags.length > 0 && (
            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      criteria.tags?.includes(tag)
                        ? "bg-accent text-white"
                        : "bg-background-muted text-foreground-muted hover:bg-accent/20"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Due Date Filters */}
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Due Date</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => updateCriteria({ overdue: !criteria.overdue, dueToday: undefined, dueThisWeek: undefined })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                    criteria.overdue
                      ? "border-red-500 bg-red-50 font-medium text-red-700"
                      : "border-card-border hover:border-accent/50"
                  }`}
                >
                  Overdue
                </button>
                <button
                  onClick={() => updateCriteria({ dueToday: !criteria.dueToday, overdue: undefined, dueThisWeek: undefined })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                    criteria.dueToday
                      ? "border-amber-500 bg-amber-50 font-medium text-amber-700"
                      : "border-card-border hover:border-accent/50"
                  }`}
                >
                  Due Today
                </button>
                <button
                  onClick={() => updateCriteria({ dueThisWeek: !criteria.dueThisWeek, overdue: undefined, dueToday: undefined })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                    criteria.dueThisWeek
                      ? "border-accent bg-accent/10 font-medium"
                      : "border-card-border hover:border-accent/50"
                  }`}
                >
                  This Week
                </button>
              </div>

              {/* Custom Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="date-start" className="mb-1 block text-xs">From</Label>
                  <Input
                    id="date-start"
                    type="date"
                    value={criteria.dueDateRange?.start?.slice(0, 10) || ''}
                    onChange={(e) => {
                      const start = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                      updateCriteria({
                        dueDateRange: start || criteria.dueDateRange?.end
                          ? { start, end: criteria.dueDateRange?.end }
                          : undefined,
                        overdue: undefined,
                        dueToday: undefined,
                        dueThisWeek: undefined
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
                      updateCriteria({
                        dueDateRange: criteria.dueDateRange?.start || end
                          ? { start: criteria.dueDateRange?.start, end }
                          : undefined,
                        overdue: undefined,
                        dueToday: undefined,
                        dueThisWeek: undefined
                      });
                    }}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recurrence Filters */}
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Recurrence</Label>
            <div className="flex flex-wrap gap-2">
              {(['daily', 'weekly', 'monthly'] as RecurrenceType[]).map((recurrence) => (
                <button
                  key={recurrence}
                  onClick={() => toggleRecurrence(recurrence)}
                  className={`rounded-lg border px-3 py-1 text-sm capitalize transition ${
                    criteria.recurrence?.includes(recurrence)
                      ? "border-accent bg-accent/10 font-medium"
                      : "border-card-border hover:border-accent/50"
                  }`}
                >
                  {recurrence}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const FilterPanel = memo(FilterPanelComponent);
