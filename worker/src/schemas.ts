import { z } from 'zod';
import { SYNC_LIMITS } from './config';

// Vector Clock schema
export const vectorClockSchema = z
  .record(z.string(), z.number().int().min(0))
  .refine((clock) => Object.keys(clock).length <= SYNC_LIMITS.MAX_VECTOR_CLOCK_ENTRIES, {
    message: 'Vector clock too large',
  });

// Sync schemas
export const syncOperationSchema = z.object({
  type: z.enum(['create', 'update', 'delete']),
  taskId: z.string().min(1).max(SYNC_LIMITS.MAX_TASK_ID_CHARS),
  encryptedBlob: z.string().max(SYNC_LIMITS.MAX_ENCRYPTED_BLOB_CHARS).optional(),
  nonce: z.string().max(SYNC_LIMITS.MAX_NONCE_CHARS).optional(),
  vectorClock: vectorClockSchema,
  checksum: z.string().max(SYNC_LIMITS.MAX_CHECKSUM_CHARS).optional(),
});

export const pushRequestSchema = z.object({
  deviceId: z.string().min(1),
  operations: z.array(syncOperationSchema).max(SYNC_LIMITS.MAX_OPERATIONS_PER_PUSH),
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
