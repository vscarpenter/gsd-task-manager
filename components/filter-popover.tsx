"use client";

import { useState } from "react";
import { ChevronDownIcon, SaveIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TagMultiselect } from "@/components/tag-multiselect";
import type { FilterCriteria, QuadrantId, RecurrenceType } from "@/lib/filters";
import { quadrants } from "@/lib/quadrants";

interface FilterPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteria: FilterCriteria;
  onChange: (criteria: FilterCriteria) => void;
  onSaveAsSmartView?: () => void;
  availableTags: string[];
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-card-border last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-3 text-sm font-semibold uppercase tracking-wide text-foreground hover:text-accent"
      >
        {title}
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && <div className="pb-4">{children}</div>}
    </div>
  );
}

export function FilterPopover({
  open,
  onOpenChange,
  criteria,
  onChange,
  onSaveAsSmartView,
  availableTags
}: FilterPopoverProps) {
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

  const toggleRecurrence = (recurrence: RecurrenceType) => {
    const current = criteria.recurrence || [];
    const updated = current.includes(recurrence)
      ? current.filter(r => r !== recurrence)
      : [...current, recurrence];
    updateCriteria({ recurrence: updated.length > 0 ? updated : undefined });
  };

  const hasActiveFilters =
    (criteria.quadrants && criteria.quadrants.length > 0) ||
    (criteria.status && criteria.status !== 'all') ||
    (criteria.tags && criteria.tags.length > 0) ||
    criteria.overdue ||
    criteria.dueToday ||
    criteria.dueThisWeek ||
    criteria.noDueDate ||
    criteria.dueDateRange ||
    (criteria.recurrence && criteria.recurrence.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>

        <div className="space-y-0 divide-y divide-card-border">
          {/* Quadrants Section */}
          <CollapsibleSection title="Quadrants" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-2">
              {quadrants.map((quadrant) => (
                <button
                  key={quadrant.id}
                  onClick={() => toggleQuadrant(quadrant.id)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition ${
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
          </CollapsibleSection>

          {/* Status Section */}
          <CollapsibleSection title="Status" defaultOpen={true}>
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
          </CollapsibleSection>

          {/* Tags Section */}
          {availableTags.length > 0 && (
            <CollapsibleSection title="Tags" defaultOpen={false}>
              <TagMultiselect
                availableTags={availableTags}
                selectedTags={criteria.tags || []}
                onChange={(tags) => updateCriteria({ tags: tags.length > 0 ? tags : undefined })}
              />
            </CollapsibleSection>
          )}

          {/* Due Date Section */}
          <CollapsibleSection title="Due Date" defaultOpen={false}>
            <div className="space-y-3">
              {/* Quick Filters */}
              <div className="flex gap-2">
                <button
                  onClick={() => updateCriteria({
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
                  onClick={() => updateCriteria({
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
                  onClick={() => updateCriteria({
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
                  onClick={() => updateCriteria({
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
                        updateCriteria({
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
                        updateCriteria({
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
          </CollapsibleSection>

          {/* Recurrence Section */}
          <CollapsibleSection title="Recurrence" defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {(['daily', 'weekly', 'monthly'] as RecurrenceType[]).map((recurrence) => (
                <button
                  key={recurrence}
                  onClick={() => toggleRecurrence(recurrence)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${
                    criteria.recurrence?.includes(recurrence)
                      ? "border-accent bg-accent/10 font-medium"
                      : "border-card-border hover:border-accent/50"
                  }`}
                >
                  {recurrence}
                </button>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-card-border">
          <Button
            variant="ghost"
            onClick={() => onChange({})}
            className="text-sm px-3 py-1.5"
          >
            Clear All
          </Button>

          <div className="flex items-center gap-2">
            {onSaveAsSmartView && hasActiveFilters && (
              <Button
                variant="subtle"
                onClick={() => {
                  onSaveAsSmartView();
                  onOpenChange(false);
                }}
                className="gap-2 text-sm px-3 py-1.5"
              >
                <SaveIcon className="h-4 w-4" />
                Save View
              </Button>
            )}
            <Button
              onClick={() => onOpenChange(false)}
              className="text-sm px-4 py-1.5"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
