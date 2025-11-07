"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/task-card";
import { listArchivedTasks, restoreTask, deleteArchivedTask } from "@/lib/archive";
import type { TaskRecord } from "@/lib/types";
import { toast } from "sonner";

export default function ArchivePage() {
	const router = useRouter();
	const [archivedTasks, setArchivedTasks] = useState<TaskRecord[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const loadArchivedTasks = async () => {
		setIsLoading(true);
		try {
			const tasks = await listArchivedTasks();
			// Sort by archivedAt date (newest first)
			tasks.sort((a, b) => {
				const aDate = a.archivedAt || "";
				const bDate = b.archivedAt || "";
				return bDate.localeCompare(aDate);
			});
			setArchivedTasks(tasks);
		} catch (err) {
			const errorMsg =
				err instanceof Error ? err.message : "Failed to load archived tasks";
			toast.error(errorMsg);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		loadArchivedTasks();
	}, []);

	const handleRestore = async (task: TaskRecord) => {
		try {
			await restoreTask(task.id);
			await loadArchivedTasks(); // Refresh list
			toast.success(`Restored "${task.title}"`);
		} catch (err) {
			const errorMsg =
				err instanceof Error ? err.message : "Failed to restore task";
			toast.error(errorMsg);
		}
	};

	const handleDelete = async (task: TaskRecord) => {
		if (
			!confirm(
				`Permanently delete "${task.title}"? This cannot be undone.`
			)
		) {
			return;
		}

		try {
			await deleteArchivedTask(task.id);
			await loadArchivedTasks(); // Refresh list
			toast.success(`Deleted "${task.title}"`);
		} catch (err) {
			const errorMsg =
				err instanceof Error ? err.message : "Failed to delete task";
			toast.error(errorMsg);
		}
	};

	return (
		<div className="min-h-screen bg-background">
			<header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur px-6 py-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							onClick={() => router.push("/")}
							className="gap-2"
						>
							<ArrowLeftIcon className="h-4 w-4" />
							Back
						</Button>
						<div>
							<h1 className="text-2xl font-semibold tracking-tight text-foreground">
								Archived Tasks
							</h1>
							<p className="text-sm text-foreground-muted">
								{archivedTasks.length} archived task{archivedTasks.length !== 1 ? "s" : ""}
							</p>
						</div>
					</div>
				</div>
			</header>

			<main className="px-6 py-8">
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
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{archivedTasks.map((task) => (
							<div key={task.id} className="relative group">
								<TaskCard
									task={task}
									allTasks={archivedTasks}
									onEdit={() => {}}
									onDelete={() => {}}
									onToggleComplete={() => {}}
								/>

								{/* Archive-specific actions overlay */}
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
											variant="subtle"
											onClick={() => handleDelete(task)}
											className="gap-2 text-sm h-auto py-1 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
										>
											<Trash2Icon className="h-3 w-3" />
											Delete
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
