import { z } from "zod";

export const quadrantIdSchema = z.enum([
  "urgent-important",
  "not-urgent-important",
  "urgent-not-important",
  "not-urgent-not-important"
]);

export const recurrenceTypeSchema = z.enum(["none", "daily", "weekly", "monthly"]);

export const subtaskSchema = z.object({
  id: z.string().min(4),
  title: z.string().min(1).max(100),
  completed: z.boolean()
});

export const taskDraftSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(300).default(""),
  urgent: z.boolean(),
  important: z.boolean(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  recurrence: recurrenceTypeSchema.default("none"),
  tags: z.array(z.string().min(1).max(30)).default([]),
  subtasks: z.array(subtaskSchema).default([])
});

export const taskRecordSchema = taskDraftSchema
  .extend({
    id: z.string().min(4),
    quadrant: quadrantIdSchema,
    completed: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    parentTaskId: z.string().min(4).optional()
  })
  .strict();

export const importPayloadSchema = z.object({
  tasks: z.array(taskRecordSchema),
  exportedAt: z.string().datetime({ offset: true }),
  version: z.string()
});
