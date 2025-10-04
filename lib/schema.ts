import { z } from "zod";

export const quadrantIdSchema = z.enum([
  "urgent-important",
  "not-urgent-important",
  "urgent-not-important",
  "not-urgent-not-important"
]);

export const taskDraftSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(300).default(""),
  urgent: z.boolean(),
  important: z.boolean(),
  dueDate: z.string().datetime({ offset: true }).optional()
});

export const taskRecordSchema = taskDraftSchema
  .extend({
    id: z.string().min(4),
    quadrant: quadrantIdSchema,
    completed: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict();

export const importPayloadSchema = z.object({
  tasks: z.array(taskRecordSchema),
  exportedAt: z.string().datetime({ offset: true }),
  version: z.string()
});
