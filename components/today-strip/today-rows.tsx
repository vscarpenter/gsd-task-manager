"use client";

import { ChevronDownIcon, ChevronUpIcon, CircleIcon, GripVerticalIcon, XIcon } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { TaskRecord } from "@/lib/types";

const ORDINALS = ["first", "second", "third"] as const;
const POINTER_DISTANCE_PX = 4;

interface TodayRowHandlers {
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  onInspect: (task: TaskRecord) => void;
  onMove: (task: TaskRecord, direction: "up" | "down") => void;
  onRemove: (task: TaskRecord) => void;
}

const iconButton =
  "touch-target inline-flex items-center justify-center rounded p-1 text-foreground-muted hover:bg-background-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent aria-disabled:opacity-40 aria-disabled:hover:bg-transparent";

interface RowProps extends TodayRowHandlers {
  task: TaskRecord;
  index: number;
  count: number;
}

function PickRow({ task, index, count, onToggleComplete, onInspect, onMove, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined }}
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5"
    >
      <button type="button" className={cn(iconButton, "cursor-grab touch-none")} aria-label={`Reorder ${task.title}`} {...attributes} {...listeners}>
        <GripVerticalIcon className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        className={iconButton}
        aria-label={`Mark ${task.title} as complete`}
        onClick={() => void onToggleComplete(task, true)}
      >
        <CircleIcon className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className="touch-target min-w-[8rem] flex-1 truncate text-left text-small font-medium text-foreground" onClick={() => onInspect(task)}>
        {task.title}
        <span className="sr-only">, {ORDINALS[index]}</span>
      </button>
      <button type="button" className={iconButton} aria-label={`Move ${task.title} up`} aria-disabled={index === 0} onClick={() => index > 0 && onMove(task, "up")}>
        <ChevronUpIcon className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className={iconButton} aria-label={`Move ${task.title} down`} aria-disabled={index === count - 1} onClick={() => index < count - 1 && onMove(task, "down")}>
        <ChevronDownIcon className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className={iconButton} aria-label={`Remove ${task.title} from today`} onClick={() => onRemove(task)}>
        <XIcon className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

interface PickListProps extends TodayRowHandlers {
  picks: TaskRecord[];
  onReorder: (orderedIds: string[]) => void;
}

const REORDER_INSTRUCTIONS =
  "Press space to pick up, the arrow keys to move to another position, and space again to drop. Escape cancels.";

/** Names the task and its position, so a reorder reads as words and not as ids. */
function reorderAnnouncements(picks: TaskRecord[]) {
  const title = (id: string | number) => picks.find((t) => t.id === id)?.title ?? "Task";
  const place = (id: string | number | undefined) => ORDINALS[picks.findIndex((t) => t.id === id)] ?? "last";
  return {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      `Picked up ${title(active.id)}, ${place(active.id)} of ${picks.length}.`,
    onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
      over ? `${title(active.id)} is over the ${place(over.id)} position.` : undefined,
    onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
      `Dropped ${title(active.id)} in the ${place(over?.id ?? active.id)} position.`,
    onDragCancel: ({ active }: { active: { id: string | number } }) => `Reorder cancelled for ${title(active.id)}.`,
  };
}

/** Its own DndContext, so reordering today's list never reaches the matrix's quadrant drops. */
export function PickList({ picks, onReorder, ...handlers }: PickListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: POINTER_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = picks.map((t) => t.id);
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements: reorderAnnouncements(picks), screenReaderInstructions: { draggable: REORDER_INSTRUCTIONS } }}
    >
      <SortableContext items={picks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-1">
          {picks.map((task, index) => (
            <PickRow key={task.id} task={task} index={index} count={picks.length} {...handlers} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
