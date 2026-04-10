"use client";

import { memo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FlameIcon, CalendarIcon, UsersIcon, TrashIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import type { QuadrantMeta } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { InlineTaskForm } from "@/components/inline-task-form";
import { cn } from "@/lib/utils";

const quadrantIcons: Record<string, typeof FlameIcon> = {
  "urgent-important": FlameIcon,
  "not-urgent-important": CalendarIcon,
  "urgent-not-important": UsersIcon,
  "not-urgent-not-important": TrashIcon
};

interface MatrixColumnProps {
  quadrant: QuadrantMeta;
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
  onStartTimer?: (taskId: string) => Promise<void>;
  onStopTimer?: (taskId: string) => Promise<void>;
  selectionMode?: boolean;
  selectedTaskIds?: Set<string>;
  onToggleSelect?: (task: TaskRecord) => void;
  taskRefs?: React.MutableRefObject<Map<string, HTMLElement>>;
  highlightedTaskId?: string | null;
  onQuickCreate?: (title: string, description: string, tags: string[]) => void;
  availableTags?: string[];
}

function MatrixColumnComponent({
  quadrant,
  tasks,
  allTasks,
  onEdit,
  onDelete,
  onToggleComplete,
  onShare,
  onDuplicate,
  onSnooze,
  onStartTimer,
  onStopTimer,
  selectionMode,
  selectedTaskIds,
  onToggleSelect,
  taskRefs,
  highlightedTaskId,
  onQuickCreate,
  availableTags
}: MatrixColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: quadrant.id
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [inlineFormOpen, setInlineFormOpen] = useState(false);

  // React Compiler handles optimization automatically
  const taskIds = tasks.map((task) => task.id);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "matrix-card transition-all",
        quadrant.bgClass,
        isOver && "ring-2 ring-accent ring-offset-2 animate-drop-zone-pulse"
      )}
    >
      <header className="matrix-card__header">
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = quadrantIcons[quadrant.id];
            return Icon ? <Icon className={cn("h-5 w-5 shrink-0", quadrant.iconColor)} /> : null;
          })()}
          <div>
            <h2 className="matrix-card__title">{quadrant.title}</h2>
            <p className="matrix-card__subtitle">{quadrant.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold tabular-nums", quadrant.accentClass)}>
            {tasks.length}
          </span>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="md:hidden rounded-lg p-1.5 text-foreground-muted hover:bg-background-muted/50 transition-colors"
            aria-label={isCollapsed ? `Expand ${quadrant.title}` : `Collapse ${quadrant.title}`}
            aria-expanded={!isCollapsed}
          >
            <ChevronDownIcon className={cn("h-4 w-4 transition-transform duration-200", isCollapsed && "-rotate-90")} />
          </button>
        </div>
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={cn(
          "space-y-3 transition-all duration-200 overflow-hidden",
          isCollapsed && "max-h-0 opacity-0 md:max-h-none md:opacity-100"
        )}>
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-8 text-center">
              <span className="mb-3 block text-4xl" role="img" aria-hidden="true">{quadrant.emptyEmoji}</span>
              <p className="text-sm font-semibold text-foreground">{quadrant.emptyHeadline}</p>
              <p className="mx-auto mt-1.5 max-w-[280px] text-xs text-foreground-muted leading-relaxed">{quadrant.emptyDescription}</p>
              {onQuickCreate && (
                <button
                  type="button"
                  onClick={() => setInlineFormOpen(true)}
                  className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-background-muted"
                >
                  <PlusIcon className="h-4 w-4" />
                  {quadrant.emptyCta}
                </button>
              )}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                allTasks={allTasks}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
                onShare={onShare}
                onDuplicate={onDuplicate}
                onSnooze={onSnooze}
                onStartTimer={onStartTimer}
                onStopTimer={onStopTimer}
                selectionMode={selectionMode}
                isSelected={selectedTaskIds?.has(task.id)}
                onToggleSelect={onToggleSelect}
                taskRef={(el) => {
                  if (el && taskRefs) {
                    taskRefs.current.set(task.id, el);
                  }
                }}
                isHighlighted={highlightedTaskId === task.id}
              />
            ))
          )}
        </div>
      </SortableContext>

      {onQuickCreate && (
        <div className="mt-3">
          <InlineTaskForm
            onSubmit={onQuickCreate}
            iconColor={quadrant.iconColor}
            availableTags={availableTags}
            isOpen={inlineFormOpen}
            onOpenChange={setInlineFormOpen}
          />
        </div>
      )}
    </section>
  );
}

// Memoize the component to prevent re-renders when tasks haven't changed
export const MatrixColumn = memo(MatrixColumnComponent, (prevProps, nextProps) => {
  // Only re-render if tasks array reference changed or length differs
  return (
    prevProps.quadrant.id === nextProps.quadrant.id &&
    prevProps.tasks.length === nextProps.tasks.length &&
    prevProps.tasks === nextProps.tasks && // Reference equality check
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.selectedTaskIds === nextProps.selectedTaskIds &&
    prevProps.allTasks.length === nextProps.allTasks.length
  );
});
