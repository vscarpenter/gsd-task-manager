"use client";

import { useEffect } from "react";
import { createLogger } from "@/lib/logger";

const logger = createLogger("WEBMCP");

type WebMCPToolInput = {
	title?: string;
	description?: string;
	urgent?: boolean;
	important?: boolean;
	dueDate?: string;
	tags?: string[];
};

type WebMCPToolDefinition = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (input: WebMCPToolInput) => Promise<unknown>;
};

type WebMCPProvider = {
	provideContext: (context: { tools: WebMCPToolDefinition[] }) => Promise<void> | void;
};

declare global {
	interface Navigator {
		modelContext?: WebMCPProvider;
	}
}

const TOOLS: WebMCPToolDefinition[] = [
	{
		name: "create_task",
		description:
			"Create a new task in the user's local GSD Task Manager. The task is saved in IndexedDB on this device and synced if cloud sync is enabled.",
		inputSchema: {
			type: "object",
			required: ["title"],
			properties: {
				title: {
					type: "string",
					description: "Short, action-oriented title (e.g. 'Review PR #42').",
					minLength: 1,
					maxLength: 200,
				},
				description: {
					type: "string",
					description: "Optional longer notes for the task.",
					maxLength: 2000,
				},
				urgent: {
					type: "boolean",
					description: "Whether the task is time-sensitive. Defaults to false.",
				},
				important: {
					type: "boolean",
					description: "Whether the task contributes to long-term goals. Defaults to true.",
				},
				dueDate: {
					type: "string",
					format: "date-time",
					description: "Optional ISO-8601 due date with timezone offset.",
				},
				tags: {
					type: "array",
					items: { type: "string", minLength: 1, maxLength: 32 },
					description: "Optional list of lowercase, kebab-case tags.",
				},
			},
		},
		execute: async (input) => {
			// Imported lazily so the WebMCP module never blocks the main bundle.
			const { createTask } = await import("@/lib/tasks");
			const record = await createTask({
				title: (input.title ?? "").trim(),
				description: input.description ?? "",
				urgent: input.urgent ?? false,
				important: input.important ?? true,
				dueDate: input.dueDate,
				recurrence: "none",
				tags: input.tags ?? [],
				subtasks: [],
				dependencies: [],
				notificationEnabled: true,
			});
			return {
				id: record.id,
				quadrant: record.quadrant,
				createdAt: record.createdAt,
			};
		},
	},
];

export function WebMcpRegister() {
	useEffect(() => {
		if (typeof navigator === "undefined" || !navigator.modelContext?.provideContext) {
			return;
		}

		const result = navigator.modelContext.provideContext({ tools: TOOLS });
		Promise.resolve(result)
			.then(() => logger.info("WebMCP context registered", { tools: TOOLS.length }))
			.catch((error: unknown) =>
				logger.warn("WebMCP context registration failed", {
					message: error instanceof Error ? error.message : String(error),
				}),
			);
	}, []);

	return null;
}
