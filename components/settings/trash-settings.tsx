"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  TRASH_RETENTION_DAYS,
  deleteFromTrashForever,
  emptyTrash,
  listTrashedTasks,
  restoreFromTrash,
} from "@/lib/trash";
import type { TaskRecord } from "@/lib/types";
import { SettingsRow } from "./shared-components";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days remaining before the retention sweep takes this row. */
function daysLeft(deletedAt: string | undefined): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / MS_PER_DAY;
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsed));
}

// Pure handlers — no component state, so they sit at module scope.
async function handleRestore(task: TaskRecord): Promise<void> {
  await restoreFromTrash(task.id);
  toast.success(`Restored “${task.title}”`);
}

async function handleDeleteForever(task: TaskRecord): Promise<void> {
  await deleteFromTrashForever(task.id);
  toast.success("Deleted permanently");
}

async function handleEmptyTrash(): Promise<void> {
  const count = await emptyTrash();
  toast.success(`Deleted ${count} task${count === 1 ? "" : "s"} permanently`);
}

/**
 * Trash — deleted tasks awaiting the retention sweep (ADR 0015).
 *
 * The countdown is the substance of this screen, not decoration. Trash is only
 * a safety net if the user can see what is in it and how long they have; a
 * store they cannot browse is just a delayed delete.
 */
export function TrashSettings() {
  const trashed = useLiveQuery(() => listTrashedTasks());
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);

  const items = trashed ?? [];

  const handleEmpty = async () => {
    setConfirmingEmpty(false);
    await handleEmptyTrash();
  };

  return (
    <>
      <SettingsRow
        label="Retention"
        description={`Deleted tasks are kept for ${TRASH_RETENTION_DAYS} days, then removed automatically.`}
      >
        <span className="text-sm tabular-nums text-foreground-muted">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </SettingsRow>

      <TrashList items={items} />

      {items.length > 0 ? (
        <EmptyTrashControl
          count={items.length}
          confirming={confirmingEmpty}
          onAsk={() => setConfirmingEmpty(true)}
          onCancel={() => setConfirmingEmpty(false)}
          onConfirm={handleEmpty}
        />
      ) : null}
    </>
  );
}

/** The trash contents, or an explanation of why there aren't any. */
function TrashList({ items }: { items: TaskRecord[] }) {
  if (items.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-foreground-muted">
        Trash is empty. Deleted tasks appear here for {TRASH_RETENTION_DAYS} days.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {items.map((task) => (
        <TrashRow
          key={task.id}
          task={task}
          onRestore={handleRestore}
          onDeleteForever={handleDeleteForever}
        />
      ))}
    </ul>
  );
}

/** One trashed task: what it was, how long is left, and the two ways out. */
function TrashRow({
  task,
  onRestore,
  onDeleteForever,
}: {
  task: TaskRecord;
  onRestore: (task: TaskRecord) => void;
  onDeleteForever: (task: TaskRecord) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{task.title}</p>
        <p className="text-xs tabular-nums text-foreground-muted">
          {daysLeft(task.deletedAt)} days left
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRestore(task)}
        aria-label={`Restore ${task.title}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-pane-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-background-muted"
      >
        <RotateCcwIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Restore
      </button>
      <button
        type="button"
        onClick={() => onDeleteForever(task)}
        aria-label={`Delete ${task.title} forever`}
        className="rounded-lg px-2 py-1 text-xs font-medium text-rust-d transition-colors hover:bg-status-overdue-muted"
      >
        Delete
      </button>
    </li>
  );
}

/** Empty-trash, behind a confirmation because it cannot be undone. */
function EmptyTrashControl({
  count,
  confirming,
  onAsk,
  onCancel,
  onConfirm,
}: {
  count: number;
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-3">
      {confirming ? (
        <ConfirmEmpty count={count} onCancel={onCancel} onConfirm={onConfirm} />
      ) : (
        <button
          type="button"
          onClick={onAsk}
          className="rounded-lg border border-pane-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-muted"
        >
          Empty trash
        </button>
      )}
    </div>
  );
}

function ConfirmEmpty({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted hover:text-foreground"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="inline-flex items-center gap-1.5 rounded-lg bg-danger-fill px-3 py-1.5 text-sm font-medium text-on-danger"
      >
        <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
        Delete {count} task{count === 1 ? "" : "s"} forever
      </button>
    </>
  );
}
