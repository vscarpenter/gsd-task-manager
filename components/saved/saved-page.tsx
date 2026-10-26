"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BookmarkIcon } from "lucide-react";
import { useSavedActions } from "./use-saved-actions";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { SavedItem } from "./saved-item";
import { filterTasks } from "@/components/matrix-simplified/matrix-view";
import { useTasks } from "@/lib/use-tasks";

export default function SavedPage() {
  const { saved, isLoading } = useTasks();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const visible = filterTasks(saved, query);

  const { saveNotes, returnItem, removeItem } = useSavedActions(searchRef);

  return (
    <AppShell title="Saved" caption={isLoading ? undefined : `${saved.length} saved item${saved.length === 1 ? "" : "s"}`}>
      <div className="mx-auto max-w-3xl">
        <p className="mb-6 max-w-prose text-base leading-relaxed text-foreground-muted">Reading, ideas, and reference to keep for later. Return an item to the matrix when you are ready to act.</p>
        <div className="mb-8">
          <label htmlFor="saved-search" className="mb-2 block text-sm font-medium">Search saved items</label>
          <input ref={searchRef} id="saved-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, notes, or tags" className="touch-target w-full rounded-md border border-border bg-card px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </div>
        {isLoading ? <p className="py-8 text-foreground-muted">Loading saved items…</p> : saved.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
            <BookmarkIcon className="mx-auto mb-4 h-6 w-6 text-foreground-muted" aria-hidden="true" />
            <h2 className="text-h2">Keep it for later</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-foreground-muted">Choose Move to Saved on a task to keep its links and notes here, outside your active list.</p>
            <Link href="/" className="touch-target mt-5 inline-flex items-center text-sm font-medium text-accent underline underline-offset-4">Go to matrix</Link>
          </div>
        ) : visible.length === 0 ? <p role="status" className="py-8 text-foreground-muted">No saved items match your search.</p> : (
          <ul className="rounded-lg border border-border bg-card p-5 sm:p-7">
            {visible.map((task) => <SavedItem key={task.id} task={task} onNotes={saveNotes} onReturn={returnItem} onDelete={removeItem} />)}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
