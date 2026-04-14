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

type UpdateFn = (updates: Partial<FilterCriteria>) => void;

interface SectionProps {
  criteria: FilterCriteria;
  onUpdate: UpdateFn;
}

interface FilterHeaderProps {
  isExpanded: boolean;
  hasActiveFilters: boolean;
  filterDescription: string;
  onToggle: () => void;
  onClear: () => void;
  onSaveAsSmartView?: () => void;
}

function FilterHeader({ isExpanded, hasActiveFilters, filterDescription, onToggle, onClear, onSaveAsSmartView }: FilterHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <button onClick={onToggle} aria-expanded={isExpanded} className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent">
        <FilterIcon className="h-4 w-4" />
        <span>Filters</span>
        {hasActiveFilters && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">{filterDescription}</span>
        )}
      </button>
      <div className="flex items-center gap-2">
        {hasActiveFilters && (
          <Button variant="ghost" onClick={onClear} className="text-sm px-3 py-1.5">
            <XIcon className="h-4 w-4 mr-1" />Clear
          </Button>
        )}
        {isExpanded && onSaveAsSmartView && hasActiveFilters && (
          <Button variant="subtle" onClick={onSaveAsSmartView} className="text-sm px-3 py-1.5">
            <SaveIcon className="h-4 w-4 mr-1" />Save View
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterQuadrantSection({ criteria, onUpdate }: SectionProps) {
  const toggle = (id: QuadrantId) => {
    const current = criteria.quadrants || [];
    const updated = current.includes(id) ? current.filter(q => q !== id) : [...current, id];
    onUpdate({ quadrants: updated.length > 0 ? updated : undefined });
  };
  return (
    <div>
      <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Quadrants</Label>
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map((q) => (
          <button key={q.id} onClick={() => toggle(q.id)} aria-pressed={criteria.quadrants?.includes(q.id) ?? false}
            className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition ${criteria.quadrants?.includes(q.id) ? "border-accent bg-accent/10 font-medium" : "border-card-border hover:border-accent/50"}`}>
            <div className={`h-3 w-3 rounded-full ${q.colorClass}`} />
            <span className="text-xs">{q.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterStatusSection({ criteria, onUpdate }: SectionProps) {
  return (
    <div>
      <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Status</Label>
      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map((status) => (
          <button key={status} onClick={() => onUpdate({ status })} aria-pressed={(criteria.status || 'all') === status}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${(criteria.status || 'all') === status ? "border-accent bg-accent/10 font-medium" : "border-card-border hover:border-accent/50"}`}>
            {status}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterTagsSection({ criteria, onUpdate, availableTags }: SectionProps & { availableTags: string[] }) {
  const toggle = (tag: string) => {
    const current = criteria.tags || [];
    const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    onUpdate({ tags: updated.length > 0 ? updated : undefined });
  };
  return (
    <div>
      <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Tags</Label>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => (
          <button key={tag} onClick={() => toggle(tag)} aria-pressed={criteria.tags?.includes(tag) ?? false}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${criteria.tags?.includes(tag) ? "bg-accent text-white" : "bg-background-muted text-foreground-muted hover:bg-accent/20"}`}>
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterDueDatePresets({ criteria, onUpdate }: SectionProps) {
  const clear = { overdue: undefined, dueToday: undefined, dueThisWeek: undefined };
  return (
    <div className="flex gap-2">
      <button onClick={() => onUpdate({ ...clear, overdue: !criteria.overdue })} aria-pressed={criteria.overdue ?? false}
        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${criteria.overdue ? "border-red-500 bg-red-50 font-medium text-red-700" : "border-card-border hover:border-accent/50"}`}>
        Overdue
      </button>
      <button onClick={() => onUpdate({ ...clear, dueToday: !criteria.dueToday })} aria-pressed={criteria.dueToday ?? false}
        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${criteria.dueToday ? "border-amber-500 bg-amber-50 font-medium text-amber-700" : "border-card-border hover:border-accent/50"}`}>
        Due Today
      </button>
      <button onClick={() => onUpdate({ ...clear, dueThisWeek: !criteria.dueThisWeek })} aria-pressed={criteria.dueThisWeek ?? false}
        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${criteria.dueThisWeek ? "border-accent bg-accent/10 font-medium" : "border-card-border hover:border-accent/50"}`}>
        This Week
      </button>
    </div>
  );
}

function FilterDateRangeInputs({ criteria, onUpdate }: SectionProps) {
  const clearPresets = { overdue: undefined, dueToday: undefined, dueThisWeek: undefined };
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label htmlFor="date-start" className="mb-1 block text-xs">From</Label>
        <Input id="date-start" type="date" value={criteria.dueDateRange?.start?.slice(0, 10) || ''} className="h-9"
          onChange={(e) => {
            const start = e.target.value ? new Date(e.target.value).toISOString() : undefined;
            onUpdate({ dueDateRange: start || criteria.dueDateRange?.end ? { start, end: criteria.dueDateRange?.end } : undefined, ...clearPresets });
          }} />
      </div>
      <div>
        <Label htmlFor="date-end" className="mb-1 block text-xs">To</Label>
        <Input id="date-end" type="date" value={criteria.dueDateRange?.end?.slice(0, 10) || ''} className="h-9"
          onChange={(e) => {
            const end = e.target.value ? new Date(e.target.value).toISOString() : undefined;
            onUpdate({ dueDateRange: criteria.dueDateRange?.start || end ? { start: criteria.dueDateRange?.start, end } : undefined, ...clearPresets });
          }} />
      </div>
    </div>
  );
}

function FilterDueDateSection({ criteria, onUpdate }: SectionProps) {
  return (
    <div>
      <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Due Date</Label>
      <div className="space-y-2">
        <FilterDueDatePresets criteria={criteria} onUpdate={onUpdate} />
        <FilterDateRangeInputs criteria={criteria} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function FilterRecurrenceSection({ criteria, onUpdate }: SectionProps) {
  const toggle = (recurrence: RecurrenceType) => {
    const current = criteria.recurrence || [];
    const updated = current.includes(recurrence) ? current.filter(r => r !== recurrence) : [...current, recurrence];
    onUpdate({ recurrence: updated.length > 0 ? updated : undefined });
  };
  return (
    <div>
      <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide">Recurrence</Label>
      <div className="flex flex-wrap gap-2">
        {(['daily', 'weekly', 'monthly'] as RecurrenceType[]).map((r) => (
          <button key={r} onClick={() => toggle(r)} aria-pressed={criteria.recurrence?.includes(r) ?? false}
            className={`rounded-lg border px-3 py-1 text-sm capitalize transition ${criteria.recurrence?.includes(r) ? "border-accent bg-accent/10 font-medium" : "border-card-border hover:border-accent/50"}`}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterPanelComponent({ criteria, onChange, onSaveAsSmartView, availableTags }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateCriteria: UpdateFn = (updates) => onChange({ ...criteria, ...updates });
  const clearAll = () => { onChange({}); setIsExpanded(false); };

  const hasActiveFilters = !isEmptyFilter(criteria);
  const filterDescription = getFilterDescription(criteria);

  return (
    <div className="rounded-lg border border-card-border bg-card p-4 shadow-sm">
      <FilterHeader
        isExpanded={isExpanded}
        hasActiveFilters={hasActiveFilters}
        filterDescription={filterDescription}
        onToggle={() => setIsExpanded(!isExpanded)}
        onClear={clearAll}
        onSaveAsSmartView={onSaveAsSmartView}
      />
      {isExpanded && (
        <div className="mt-4 space-y-4">
          <FilterQuadrantSection criteria={criteria} onUpdate={updateCriteria} />
          <FilterStatusSection criteria={criteria} onUpdate={updateCriteria} />
          {availableTags.length > 0 && <FilterTagsSection criteria={criteria} onUpdate={updateCriteria} availableTags={availableTags} />}
          <FilterDueDateSection criteria={criteria} onUpdate={updateCriteria} />
          <FilterRecurrenceSection criteria={criteria} onUpdate={updateCriteria} />
        </div>
      )}
    </div>
  );
}

export const FilterPanel = memo(FilterPanelComponent);
