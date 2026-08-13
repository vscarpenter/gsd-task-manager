import { z } from "@/lib/zod";
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

export const timeEntrySchema = z.object({
	id: z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH),
	startedAt: z.iso.datetime({ offset: true }),
	endedAt: z.iso.datetime({ offset: true }).optional(),
	notes: z.string().max(SCHEMA_LIMITS.TIME_ENTRY_NOTES_MAX_LENGTH).optional(),
});

export const taskDraftSchema = z.object({
	title: z.string().min(1).max(SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH),
	description: z.string().max(SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH).default(""),
	urgent: z.boolean(),
	important: z.boolean(),
	dueDate: z.iso.datetime({ offset: true }).optional(),
	recurrence: recurrenceTypeSchema.default("none"),
	tags: z.array(z.string().min(1).max(SCHEMA_LIMITS.TAG_MAX_LENGTH)).max(SCHEMA_LIMITS.MAX_TAGS).default([]),
	subtasks: z.array(subtaskSchema).max(SCHEMA_LIMITS.MAX_SUBTASKS).default([]),
	dependencies: z.array(z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH)).max(SCHEMA_LIMITS.MAX_DEPENDENCIES).default([]), // IDs of tasks that must be completed first
	notifyBefore: z.number().int().min(0).optional(), // minutes before due date
	notificationEnabled: z.boolean().default(true),
	estimatedMinutes: z.preprocess(
		(value) => value === 0 ? undefined : value,
		z.number().int().min(1).max(10080).optional()
	), // Max 7 days = 10080 minutes
});

export const taskRecordSchema = taskDraftSchema
	.extend({
		id: z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH),
		quadrant: quadrantIdSchema,
		completed: z.boolean(),
		completedAt: z.iso.datetime({ offset: true }).optional(),
		createdAt: z.iso.datetime({ offset: true }),
		updatedAt: z.iso.datetime({ offset: true }),
		parentTaskId: z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH).optional(),
		notificationSent: z.boolean().default(false),
		lastNotificationAt: z.iso.datetime({ offset: true }).optional(),
		snoozedUntil: z.iso.datetime({ offset: true }).optional(),
		// Time tracking fields
		timeSpent: z.number().int().min(0).optional(), // Total minutes spent (calculated)
		timeEntries: z.array(timeEntrySchema).max(SCHEMA_LIMITS.MAX_TIME_ENTRIES).default([]),
	})
	.strict();

/**
 * Lenient task-record schema that strips unknown fields (e.g. vectorClock from the
 * old Cloudflare sync system) instead of rejecting them. Used both for importing
 * legacy exports and for validating records read back from IndexedDB, so a record
 * carrying a harmless extra field is kept rather than quarantined as corrupt.
 */
export const storedTaskRecordSchema = taskDraftSchema
	.extend({
		id: z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH),
		quadrant: quadrantIdSchema,
		completed: z.boolean(),
		completedAt: z.iso.datetime({ offset: true }).optional(),
		createdAt: z.iso.datetime({ offset: true }),
		updatedAt: z.iso.datetime({ offset: true }),
		parentTaskId: z.string().min(SCHEMA_LIMITS.ID_MIN_LENGTH).optional(),
		notificationSent: z.boolean().default(false),
		lastNotificationAt: z.iso.datetime({ offset: true }).optional(),
		snoozedUntil: z.iso.datetime({ offset: true }).optional(),
		timeSpent: z.number().int().min(0).optional(),
		timeEntries: z.array(timeEntrySchema).max(SCHEMA_LIMITS.MAX_TIME_ENTRIES).default([]),
	})
	.strip();

/**
 * An archived task is a task record plus the moment it was archived.
 *
 * `archivedAt` is declared in no other schema, and `taskRecordSchema` is
 * `.strict()` — so validating archived rows with the plain record schema rejects
 * every one of them. That failure is silent (records are skipped, not thrown),
 * which is exactly how the archive stayed out of backups in the first place.
 */
export const archivedTaskRecordSchema = taskRecordSchema
	.extend({ archivedAt: z.iso.datetime({ offset: true }).optional() })
	.strict();

/** Trash rows (ADR 0015). Same shape, different timestamp. */
export const storedTrashedTaskRecordSchema = storedTaskRecordSchema
	.extend({ deletedAt: z.iso.datetime({ offset: true }).optional() })
	.strip();

export const trashedTaskRecordSchema = taskRecordSchema
	.extend({ deletedAt: z.iso.datetime({ offset: true }).optional() })
	.strict();

/** Lenient counterpart for reading archived rows back in. */
export const storedArchivedTaskRecordSchema = storedTaskRecordSchema
	.extend({ archivedAt: z.iso.datetime({ offset: true }).optional() })
	.strip();

export const archiveSettingsSchema = z.object({
	id: z.literal("settings").default("settings"),
	enabled: z.boolean(),
	archiveAfterDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
});

export const appPreferencesSchema = z.object({
	id: z.literal("preferences").default("preferences"),
	pinnedSmartViewIds: z.array(z.string()).default([]),
	maxPinnedViews: z.number().int().min(0),
	smartViewsEnabled: z.boolean(),
});

/** Custom smart views only — built-ins are derived at read time, never stored. */
export const smartViewSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	icon: z.string().optional(),
	criteria: z.record(z.string(), z.unknown()),
	isBuiltIn: z.boolean().default(false),
	createdAt: z.iso.datetime({ offset: true }),
	updatedAt: z.iso.datetime({ offset: true }),
});


export const notificationSettingsSchema = z.object({
	id: z.literal("settings").default("settings"),
	enabled: z.boolean().default(true),
	defaultReminder: z.number().int().min(0).default(SCHEMA_LIMITS.DEFAULT_NOTIFY_MINUTES), // minutes before due date
	soundEnabled: z.boolean().default(true),
	quietHoursStart: z.string().optional(), // HH:mm format
	quietHoursEnd: z.string().optional(), // HH:mm format
	permissionAsked: z.boolean().default(false),
	updatedAt: z.iso.datetime({ offset: true }),
});

/**
 * Backup envelope (ADR 0014). Version 2.0.0 is a structural superset of 1.0.0 —
 * every store beyond `tasks` is optional, so one parser reads both and a legacy
 * export needs no migration. An absent key means "this backup says nothing about
 * that store", which is different from an empty array.
 */
export const importPayloadSchema = z.object({
	tasks: z.array(storedTaskRecordSchema),
	exportedAt: z.iso.datetime({ offset: true }),
	version: z.string(),
	archivedTasks: z.array(storedArchivedTaskRecordSchema).optional(),
	deletedTasks: z.array(storedTrashedTaskRecordSchema).optional(),
	smartViews: z.array(smartViewSchema).optional(),
	notificationSettings: notificationSettingsSchema.optional(),
	archiveSettings: archiveSettingsSchema.optional(),
	appPreferences: appPreferencesSchema.optional(),
});
