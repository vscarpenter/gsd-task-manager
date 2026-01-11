"use client";

import {
  ListIcon,
  RepeatIcon,
  TagIcon,
  CheckSquareIcon,
  LinkIcon,
  CalendarIcon,
} from "lucide-react";

/**
 * Step 3: Task Management
 * Covers core task operations and advanced features
 */
export function StepTasks() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-1">
          <ListIcon className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Task Management</h2>
        <p className="text-sm text-foreground-muted">Master the essentials and unlock advanced features</p>
      </div>

      {/* Core operations */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-card-border bg-card p-3">
          <h4 className="font-semibold text-foreground text-sm mb-2">Creating Tasks</h4>
          <ul className="text-xs text-foreground-muted space-y-1">
            <li>• Press <kbd className="px-1 bg-background-muted rounded">N</kbd> to create</li>
            <li>• Use action-oriented titles</li>
            <li>• Set due dates for deadlines</li>
          </ul>
        </div>

        <div className="rounded-lg border border-card-border bg-card p-3">
          <h4 className="font-semibold text-foreground text-sm mb-2">Completing Tasks</h4>
          <ul className="text-xs text-foreground-muted space-y-1">
            <li>• Click checkmark to complete</li>
            <li>• Recurring tasks auto-create new</li>
            <li>• Toggle visibility with eye icon</li>
          </ul>
        </div>
      </div>

      {/* Advanced features */}
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-3">Advanced Features</h3>
        <div className="grid grid-cols-2 gap-2">
          <FeatureChip icon={<RepeatIcon className="h-3.5 w-3.5" />} title="Recurring" desc="Daily, weekly, monthly" />
          <FeatureChip icon={<TagIcon className="h-3.5 w-3.5" />} title="Tags" desc="#project, #context" />
          <FeatureChip icon={<CheckSquareIcon className="h-3.5 w-3.5" />} title="Subtasks" desc="Break down complex work" />
          <FeatureChip icon={<LinkIcon className="h-3.5 w-3.5" />} title="Dependencies" desc="Task B waits for A" />
          <FeatureChip icon={<CalendarIcon className="h-3.5 w-3.5" />} title="Due Dates" desc="Red overdue, amber today" />
        </div>
      </div>

      {/* Search tip */}
      <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
        <p className="text-sm text-foreground">
          <strong>Quick Search:</strong> Press{" "}
          <kbd className="px-1.5 py-0.5 bg-background-muted rounded text-xs font-mono">/</kbd>{" "}
          to focus search. Finds tasks by title, description, tags, or subtasks.
        </p>
      </div>
    </div>
  );
}

function FeatureChip({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-card-border bg-background-muted/50 p-2">
      <div className="text-accent mt-0.5">{icon}</div>
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="text-xs text-foreground-muted">{desc}</p>
      </div>
    </div>
  );
}
