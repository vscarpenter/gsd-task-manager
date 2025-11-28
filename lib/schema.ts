import { z } from "zod";
import { SCHEMA_LIMITS } from "./constants/schema";

export const quadrantIdSchema = z.enum([
	"urgent-important",
	"not-urgent-important",
	"urgent-not-important",
	"not-urgent-not-important",
]);

export const recurrenceTypeSchema = z.enum([
	"none",
	"daily",
	"weekly",
	"monthly",
]);

export const subtaskSchema = z.object({
	id: z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH),
	title: z.string().min(1).max(SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH),
	completed: z.boolean(),
});

export const taskDraftSchema = z.object({
	title: z.string().min(1).max(SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH),
	description: z.string().max(SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH).default(""),
	urgent: z.boolean(),
	important: z.boolean(),
	dueDate: z.string().datetime({ offset: true }).optional(),
	recurrence: recurrenceTypeSchema.default("none"),
	tags: z.array(z.string().min(1).max(SCHEMA_LIMITS.TAG_MAX_LENGTH)).default([]),
	subtasks: z.array(subtaskSchema).default([]),
	dependencies: z.array(z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH)).default([]), // IDs of tasks that must be completed first
	notifyBefore: z.number().int().min(0).optional(), // minutes before due date
	notificationEnabled: z.boolean().default(true),
});

export const taskRecordSchema = taskDraftSchema
	.extend({
		id: z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH),
		quadrant: quadrantIdSchema,
		completed: z.boolean(),
		completedAt: z.string().datetime({ offset: true }).optional(),
		createdAt: z.string().datetime({ offset: true }),
		updatedAt: z.string().datetime({ offset: true }),
		parentTaskId: z.string().min(4).optional(),
		notificationSent: z.boolean().default(false),
		lastNotificationAt: z.string().datetime({ offset: true }).optional(),
		snoozedUntil: z.string().datetime({ offset: true }).optional(),
		vectorClock: z.record(z.string(), z.number()).default({}),
	})
	.strict();

export const importPayloadSchema = z.object({
	tasks: z.array(taskRecordSchema),
	exportedAt: z.string().datetime({ offset: true }),
	version: z.string(),
});

export const notificationSettingsSchema = z.object({
	id: z.literal("settings").default("settings"),
	enabled: z.boolean().default(true),
	defaultReminder: z.number().int().min(0).default(15), // minutes before due date
	soundEnabled: z.boolean().default(true),
	quietHoursStart: z.string().optional(), // HH:mm format
	quietHoursEnd: z.string().optional(), // HH:mm format
	permissionAsked: z.boolean().default(false),
	updatedAt: z.string().datetime({ offset: true }),
});
