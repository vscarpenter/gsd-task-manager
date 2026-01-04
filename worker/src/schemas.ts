import { z } from 'zod';

// Vector Clock schema
export const vectorClockSchema = z.record(z.string(), z.number().int().min(0));

// Auth schemas
export const registerRequestSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(12).max(128),
  deviceName: z.string().min(1).max(100),
});

export const loginRequestSchema = z.object({
  email: z.email(),
  passwordHash: z.string(),
  deviceId: z.string().optional(),
  deviceName: z.string().max(100).optional(),
});

// Sync schemas
export const syncOperationSchema = z.object({
  type: z.enum(['create', 'update', 'delete']),
  taskId: z.string().min(1),
  encryptedBlob: z.string().optional(),
  nonce: z.string().optional(),
  vectorClock: vectorClockSchema,
  checksum: z.string().optional(),
});

export const pushRequestSchema = z.object({
  deviceId: z.string().min(1),
  operations: z.array(syncOperationSchema),
  clientVectorClock: vectorClockSchema,
});

export const pullRequestSchema = z.object({
  deviceId: z.string().min(1),
  lastVectorClock: vectorClockSchema,
  sinceTimestamp: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

export const resolveRequestSchema = z.object({
  taskId: z.string().min(1),
  resolution: z.enum(['keep_local', 'keep_remote', 'merge']),
  mergedTask: z
    .object({
      encryptedBlob: z.string(),
      nonce: z.string(),
      vectorClock: vectorClockSchema,
      checksum: z.string(),
    })
    .optional(),
});

// Device schemas
export const updateDeviceRequestSchema = z.object({
  name: z.string().min(1).max(100),
});
