"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCcwIcon, Trash2Icon } from "lucide-react";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { Button } from "@/components/ui/button";
import { TaskDescription } from "@/components/task-description";
import { QUADRANT_ACCENT_BY_ID } from "@/lib/quadrants";
import { listArchivedTasks, restoreTask, deleteArchivedTask, archiveTaskNow, reinstateArchivedTask } from "@/lib/archive";
import { compareInstants } from "@/lib/instant";
import { restoreFocusOrMainContent } from "@/lib/focus-restoration";
import type { TaskRecord } from "@/lib/types";
import { toast } from "sonner";

const ARCHIVED_TASKS_KEY = ["archivedTasks"] as const;
const PAGE_SIZE = 100;
const ARCHIVE_DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function sortByArchivedDate(tasks: TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((a, b) => compareInstants(b.archivedAt, a.archivedAt));
}

function moveFocusBeforeRemoval(id: string): void {
  const card = document.activeElement?.closest("[data-archived-task-id]");
  if (card?.getAttribute("data-archived-task-id") === id) restoreFocusOrMainContent(null);
}

interface ArchivedTaskCardProps {
  task: TaskRecord;
  onRestore: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => void;
}

function ArchivedTaskCard({ task, onRestore, onDelete }: ArchivedTaskCardProps): React.ReactElement {
  const titleId = useId();
  const archivedAt = Date.parse(task.archivedAt ?? "");
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;

  return (
    <li data-archived-task-id={task.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-card p-4">
      <h3 id={titleId} className="text-small font-semibold text-foreground [overflow-wrap:anywhere]">{task.title}</h3>
      {Number.isFinite(archivedAt) && (
        <p className="flex items-center gap-2 text-caption text-foreground-muted">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: QUADRANT_ACCENT_BY_ID[task.quadrant] }} />
          <span>Archived <time dateTime={task.archivedAt}>{ARCHIVE_DATE_FORMAT.format(archivedAt)}</time></span>
        </p>
      )}
      {task.description && (
        <p className="whitespace-pre-wrap text-caption text-foreground-muted [overflow-wrap:anywhere]">
          <TaskDescription description={task.description} />
        </p>
      )}
      {task.tags.length > 0 && <p className="text-caption text-foreground-muted [overflow-wrap:anywhere]">{task.tags.map((tag) => `#${tag}`).join(" ")}</p>}
      {task.subtasks.length > 0 && <p className="text-caption text-foreground-muted">{completedSubtasks}/{task.subtasks.length} subtasks complete</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button variant="subtle" aria-describedby={titleId} onClick={() => onRestore(task)} className="touch-target text-small">
          <RefreshCcwIcon className="size-3.5" aria-hidden="true" />
          Restore
        </Button>
        <Button variant="ghost" aria-describedby={titleId} onClick={() => onDelete(task)} className="touch-target text-small text-status-overdue-ink">
          <Trash2Icon className="size-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>
    </li>
  );
}

interface ArchivedTaskGridProps extends Omit<ArchivedTaskCardProps, "task"> {
  tasks: TaskRecord[];
}

function ArchivedTaskGrid({ tasks, onRestore, onDelete }: ArchivedTaskGridProps): React.ReactElement {
  const [requestedPage, setRequestedPage] = useState(0);
  const pageCount = Math.ceil(tasks.length / PAGE_SIZE);
  const page = Math.min(requestedPage, pageCount - 1);
  const first = page * PAGE_SIZE;
  const pageTasks = tasks.slice(first, first + PAGE_SIZE);

  return (
    <section aria-labelledby="archived-tasks">
      <h2 id="archived-tasks" className="sr-only">Archived tasks</h2>
      {pageCount > 1 && (
        <label className="mb-4 inline-flex flex-wrap items-center gap-2 text-small text-foreground-muted">
          Archive page
          <select className="input touch-target" value={page} onChange={(event) => setRequestedPage(Number(event.target.value))}>
            {Array.from({ length: pageCount }, (_, index) => (
              <option key={index} value={index}>{index + 1} of {pageCount}</option>
            ))}
          </select>
        </label>
      )}
      <ul role="list" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
        {pageTasks.map((task) => (
          <ArchivedTaskCard key={task.id} task={task} onRestore={onRestore} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}

export default function ArchivePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: archivedTasks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ARCHIVED_TASKS_KEY,
    queryFn: async () => {
      const tasks = await listArchivedTasks();
      return sortByArchivedDate(tasks);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (task: TaskRecord) => restoreTask(task.id),
    onSuccess: (_data, task) => {
      moveFocusBeforeRemoval(task.id);
      queryClient.invalidateQueries({ queryKey: ARCHIVED_TASKS_KEY });
      toast.success(`Restored "${task.title}"`, {
        action: {
          label: "Undo",
          onClick: async () => {
            // archiveTaskNow re-archives and queues the remote delete in one
            // transaction. Doing it inline here left the task in both tables if
            // either write failed, and never told other devices.
            try {
              await archiveTaskNow(task.id);
              queryClient.invalidateQueries({ queryKey: ARCHIVED_TASKS_KEY });
              toast.success("Restore undone");
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : `Failed to undo "${task.title}"`;
              toast.error(errorMsg);
            }
          },
        },
      });
    },
    onError: (err, task) => {
      const errorMsg = err instanceof Error ? err.message : `Failed to restore "${task.title}"`;
      toast.error(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (task: TaskRecord) => {
      await deleteArchivedTask(task.id);
      return task; // Return full task data for undo
    },
    onSuccess: (_data, task) => {
      moveFocusBeforeRemoval(task.id);
      queryClient.invalidateQueries({ queryKey: ARCHIVED_TASKS_KEY });
      toast.success(`Deleted "${task.title}"`, {
        action: {
          label: "Undo",
          onClick: async () => {
            // reinstateArchivedTask puts the row back idempotently, so a second
            // activation is a no-op rather than a ConstraintError escaping as an
            // unhandled rejection.
            try {
              await reinstateArchivedTask(task);
              queryClient.invalidateQueries({ queryKey: ARCHIVED_TASKS_KEY });
              toast.success("Delete undone");
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : `Failed to undo deleting "${task.title}"`;
              toast.error(errorMsg);
            }
          },
        },
      });
    },
    onError: (err, task) => {
      const errorMsg = err instanceof Error ? err.message : `Failed to delete "${task.title}"`;
      toast.error(errorMsg);
    },
  });

  const handleRestore = (task: TaskRecord) => {
    restoreMutation.mutate(task);
  };

  const handleDelete = (task: TaskRecord) => {
    deleteMutation.mutate(task);
  };

  return (
    <AppShell
      title="Archive"
      caption={isLoading || isError ? undefined : `${archivedTasks.length} archived task${archivedTasks.length !== 1 ? "s" : ""}`}
    >
      <div className="pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-foreground-muted">Loading archived tasks...</p>
          </div>
        ) : isError && archivedTasks.length === 0 ? (
          <div className="py-12 text-center">
            <p role="alert" className="text-foreground-muted">Could not load archived tasks.</p>
            <Button variant="subtle" onClick={() => void refetch()} className="touch-target mt-4">Try again</Button>
          </div>
        ) : archivedTasks.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-border bg-background-muted p-8 text-center">
            <h2 className="text-h3 text-foreground">
              No archived tasks
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Completed tasks will automatically be archived based on your
              settings.
            </p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => router.push("/")}
            >
              Open matrix
            </Button>
          </div>
        ) : (
          <ArchivedTaskGrid tasks={archivedTasks} onRestore={handleRestore} onDelete={handleDelete} />
        )}
      </div>
    </AppShell>
  );
}
