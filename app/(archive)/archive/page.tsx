"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RefreshCcwIcon, Trash2Icon } from "lucide-react";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/task-card";
import { listArchivedTasks, restoreTask, deleteArchivedTask } from "@/lib/archive";
import type { TaskRecord } from "@/lib/types";
import { toast } from "sonner";
import { getDb } from "@/lib/db";

const ARCHIVED_TASKS_KEY = ["archivedTasks"] as const;
const ESTIMATED_CARD_HEIGHT = 180;
const CARD_GAP = 16;
const COLUMNS_BY_BREAKPOINT = { sm: 1, md: 2, lg: 3 } as const;

function useColumnCount(): number {
  if (typeof window === "undefined") return COLUMNS_BY_BREAKPOINT.sm;
  if (window.innerWidth >= 1024) return COLUMNS_BY_BREAKPOINT.lg;
  if (window.innerWidth >= 768) return COLUMNS_BY_BREAKPOINT.md;
  return COLUMNS_BY_BREAKPOINT.sm;
}

function sortByArchivedDate(tasks: TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((a, b) => {
    const aDate = a.archivedAt || "";
    const bDate = b.archivedAt || "";
    return bDate.localeCompare(aDate);
  });
}

export default function ArchivePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount();

  const { data: archivedTasks = [], isLoading } = useQuery({
    queryKey: ARCHIVED_TASKS_KEY,
    queryFn: async () => {
      const tasks = await listArchivedTasks();
      return sortByArchivedDate(tasks);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (task: TaskRecord) => restoreTask(task.id),
    onSuccess: (_data, task) => {
      queryClient.invalidateQueries({ queryKey: ARCHIVED_TASKS_KEY });
      toast.success(`Restored "${task.title}"`, {
        action: {
          label: "Undo",
          onClick: async () => {
            // Re-archive by moving back: delete from main tasks, add to archive
            const db = getDb();
            const restored = await db.tasks.get(task.id);
            if (restored) {
              await db.archivedTasks.add({ ...restored, archivedAt: new Date().toISOString() });
              await db.tasks.delete(task.id);
              queryClient.invalidateQueries({ queryKey: ARCHIVED_TASKS_KEY });
              toast.success("Restore undone");
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
      queryClient.invalidateQueries({ queryKey: ARCHIVED_TASKS_KEY });
      toast.success(`Deleted "${task.title}"`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const db = getDb();
            await db.archivedTasks.add(task);
            queryClient.invalidateQueries({ queryKey: ARCHIVED_TASKS_KEY });
            toast.success("Delete undone");
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

  const rowCount = Math.ceil(archivedTasks.length / columnCount);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT + CARD_GAP,
    overscan: 3,
  });

  return (
    <AppShell
      title="Archive"
      caption={`${archivedTasks.length} archived task${archivedTasks.length !== 1 ? "s" : ""}`}
    >
      <div className="pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-foreground-muted">Loading archived tasks...</p>
          </div>
        ) : archivedTasks.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-border bg-background-muted p-8 text-center">
            <h2 className="text-lg font-semibold text-foreground">
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
              Back to Tasks
            </Button>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="overflow-auto"
            style={{ height: "70vh" }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * columnCount;
                const rowTasks = archivedTasks.slice(
                  startIndex,
                  startIndex + columnCount
                );

                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {rowTasks.map((task) => (
                        <div key={task.id} className="relative group">
                          <TaskCard
                            task={task}
                            allTasks={archivedTasks}
                            onEdit={() => {}}
                            onDelete={() => {}}
                            onToggleComplete={() => {}}
                          />

                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-card via-card to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="subtle"
                                onClick={() => handleRestore(task)}
                                className="gap-2 text-sm h-auto py-1 px-2"
                              >
                                <RefreshCcwIcon className="h-3 w-3" />
                                Restore
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleDelete(task)}
                                className="gap-2 text-sm h-auto py-1 px-2"
                              >
                                <Trash2Icon className="h-3 w-3" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
