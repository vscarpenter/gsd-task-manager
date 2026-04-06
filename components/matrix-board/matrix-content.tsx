"use client";

import { type RefObject } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { MatrixColumn } from "@/components/matrix-column";
import { MatrixEmptyState } from "@/components/matrix-empty-state";
import { MatrixSkeleton } from "@/components/matrix-skeleton";
import { KeyboardHintsToast } from "@/components/keyboard-hints-toast";
import { Button } from "@/components/ui/button";
import { quadrants } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import type { QuadrantId } from "@/lib/types";

interface MatrixContentProps {
  isLoading: boolean;
  hasTasks: boolean;
  isDoFirstEmpty: boolean;
  visibleCount: number;
  searchQuery: string;
  onClearSearch: () => void;
  onCreateTask: () => void;
  filteredQuadrants: Record<QuadrantId, TaskRecord[]>;
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => void;
  onShare: (task: TaskRecord) => void;
  onDuplicate: (task: TaskRecord) => void;
  onSnooze: (taskId: string, minutes: number) => Promise<void>;
  onStartTimer: (taskId: string) => Promise<void>;
  onStopTimer: (taskId: string) => Promise<void>;
  selectionMode: boolean;
  selectedTaskIds: Set<string>;
  onToggleSelect: (task: TaskRecord) => void;
  taskRefs: RefObject<Map<string, HTMLElement>>;
  highlightedTaskId: string | null;
}

export function MatrixContent(props: MatrixContentProps) {
  return (
    <>
      <FloatingActionButton
        hasTasks={props.hasTasks}
        isDoFirstEmpty={props.isDoFirstEmpty}
        onCreateTask={props.onCreateTask}
      />

      <main className="px-6 pb-10 md:pb-10" style={{
        paddingBottom: "max(2.5rem, calc(5rem + env(safe-area-inset-bottom)))"
      }}>
        {props.isLoading ? (
          <MatrixSkeleton />
        ) : !props.hasTasks ? (
          <MatrixEmptyState onCreateTask={props.onCreateTask} />
        ) : props.visibleCount === 0 ? (
          <NoResultsState searchQuery={props.searchQuery} onClearSearch={props.onClearSearch} />
        ) : (
          <MatrixGrid {...props} />
        )}
      </main>
      <KeyboardHintsToast />
    </>
  );
}

function FloatingActionButton({ hasTasks, isDoFirstEmpty, onCreateTask }: {
  hasTasks: boolean;
  isDoFirstEmpty: boolean;
  onCreateTask: () => void;
}) {
  return (
    <button
      onClick={onCreateTask}
      className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white transition-all duration-200 hover:bg-accent-hover hover:scale-105 active:scale-95 md:hidden touch-manipulation ${hasTasks && isDoFirstEmpty ? "animate-new-task-glow" : ""}`}
      style={{
        boxShadow: "var(--shadow-fab)",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))"
      }}
      aria-label="Create new task"
    >
      <PlusIcon className="h-6 w-6" />
    </button>
  );
}

function NoResultsState({ searchQuery, onClearSearch }: {
  searchQuery: string;
  onClearSearch: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-border/60 bg-background-muted/50 p-10 text-center backdrop-blur-sm" style={{ boxShadow: "var(--shadow-column)" }}>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
        <SearchIcon className="h-6 w-6 text-accent" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">No tasks match &ldquo;{searchQuery}&rdquo;</h2>
      <p className="mt-2 text-sm text-foreground-muted">Try a different search term or clear the filter.</p>
      <Button className="mt-5" variant="subtle" onClick={onClearSearch}>
        Clear search
      </Button>
    </div>
  );
}

function MatrixGrid(props: MatrixContentProps) {
  return (
    <div className="matrix-grid">
      {quadrants.map((quadrant) => (
        <MatrixColumn
          key={quadrant.id}
          quadrant={quadrant}
          tasks={props.filteredQuadrants[quadrant.id] ?? []}
          allTasks={props.allTasks}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
          onToggleComplete={props.onToggleComplete}
          onShare={props.onShare}
          onDuplicate={props.onDuplicate}
          onSnooze={props.onSnooze}
          onStartTimer={props.onStartTimer}
          onStopTimer={props.onStopTimer}
          selectionMode={props.selectionMode}
          selectedTaskIds={props.selectedTaskIds}
          onToggleSelect={props.onToggleSelect}
          taskRefs={props.taskRefs}
          highlightedTaskId={props.highlightedTaskId}
        />
      ))}
    </div>
  );
}
