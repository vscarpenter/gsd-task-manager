"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FilterCriteria } from "@/lib/filters";

interface FilterBarProps {
  criteria: FilterCriteria;
  onChange: (criteria: FilterCriteria) => void;
}

export function FilterBar({
  criteria,
  onChange,
}: FilterBarProps) {

  const clearAllFilters = () => {
    onChange({});
  };

  const removeFilter = (filterKey: keyof FilterCriteria) => {
    const updated = { ...criteria };
    delete updated[filterKey];
    onChange(updated);
  };

  // Get active filter chips
  const getActiveFilterChips = () => {
    const chips: { label: string; key: keyof FilterCriteria }[] = [];

    if (criteria.status && criteria.status !== 'all') {
      chips.push({ label: criteria.status, key: 'status' });
    }

    if (criteria.quadrants && criteria.quadrants.length > 0) {
      chips.push({
        label: `${criteria.quadrants.length} quadrant${criteria.quadrants.length > 1 ? 's' : ''}`,
        key: 'quadrants'
      });
    }

    if (criteria.tags && criteria.tags.length > 0) {
      chips.push({
        label: `${criteria.tags.length} tag${criteria.tags.length > 1 ? 's' : ''}`,
        key: 'tags'
      });
    }

    if (criteria.overdue) {
      chips.push({ label: 'overdue', key: 'overdue' });
    }

    if (criteria.dueToday) {
      chips.push({ label: 'due today', key: 'dueToday' });
    }

    if (criteria.dueThisWeek) {
      chips.push({ label: 'this week', key: 'dueThisWeek' });
    }

    if (criteria.noDueDate) {
      chips.push({ label: 'no deadline', key: 'noDueDate' });
    }

    if (criteria.dueDateRange) {
      chips.push({ label: 'custom date range', key: 'dueDateRange' });
    }

    if (criteria.recurrence && criteria.recurrence.length > 0) {
      chips.push({
        label: criteria.recurrence.join(', '),
        key: 'recurrence'
      });
    }

    if (criteria.searchQuery) {
      chips.push({
        label: `"${criteria.searchQuery}"`,
        key: 'searchQuery'
      });
    }

    return chips;
  };

  const activeChips = getActiveFilterChips();

  // Only render if there are active filters
  if (activeChips.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-card-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-4">
        {/* Active Filter Chips */}
        {activeChips.map((chip, index) => (
          <button
            key={`${chip.key}-${index}`}
            onClick={() => removeFilter(chip.key)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
          >
            {chip.label}
            <XIcon className="h-3 w-3" />
          </button>
        ))}

        {/* Clear All Button */}
        <Button
          variant="ghost"
          onClick={clearAllFilters}
          className="ml-auto text-sm px-3 py-1.5 text-foreground-muted hover:text-foreground"
        >
          Clear All
        </Button>
      </div>
    </div>
  );
}
