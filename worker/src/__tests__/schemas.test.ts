import { describe, it, expect } from 'vitest';
import {
  vectorClockSchema,
  registerRequestSchema,
  loginRequestSchema,
  syncOperationSchema,
  pushRequestSchema,
  pullRequestSchema,
  resolveRequestSchema,
  updateDeviceRequestSchema,
} from '../schemas';

describe('vectorClockSchema', () => {
  it('accepts valid vector clock with string keys and non-negative integers', () => {
    const validClock = { device1: 0, device2: 5, device3: 100 };
    expect(() => vectorClockSchema.parse(validClock)).not.toThrow();
    expect(vectorClockSchema.parse(validClock)).toEqual(validClock);
  });

  it('accepts empty object as valid vector clock', () => {
    expect(() => vectorClockSchema.parse({})).not.toThrow();
  });

  it('rejects negative values', () => {
    expect(() => vectorClockSchema.parse({ device: -1 })).toThrow();
  });

  it('rejects non-integer values', () => {
    expect(() => vectorClockSchema.parse({ device: 1.5 })).toThrow();
  });

  it('rejects non-number values', () => {
    expect(() => vectorClockSchema.parse({ device: 'not a number' })).toThrow();
  });
});

describe('registerRequestSchema', () => {
  it('accepts valid registration request', () => {
    const validRequest = {
      email: 'user@example.com',
      password: 'securepassword123',
      deviceName: 'My iPhone',
    };
    expect(() => registerRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('rejects invalid email format', () => {
    const invalidRequest = {
      email: 'not-an-email',
      password: 'securepassword123',
      deviceName: 'My iPhone',
    };
    expect(() => registerRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects email exceeding max length (255)', () => {
    const invalidRequest = {
      email: 'a'.repeat(250) + '@test.com',
      password: 'securepassword123',
      deviceName: 'My iPhone',
    };
    expect(() => registerRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects password shorter than 12 characters', () => {
    const invalidRequest = {
      email: 'user@example.com',
      password: 'short',
      deviceName: 'My iPhone',
    };
    expect(() => registerRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects password exceeding 128 characters', () => {
    const invalidRequest = {
      email: 'user@example.com',
      password: 'a'.repeat(129),
      deviceName: 'My iPhone',
    };
    expect(() => registerRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects empty device name', () => {
    const invalidRequest = {
      email: 'user@example.com',
      password: 'securepassword123',
      deviceName: '',
    };
    expect(() => registerRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects device name exceeding 100 characters', () => {
    const invalidRequest = {
      email: 'user@example.com',
      password: 'securepassword123',
      deviceName: 'a'.repeat(101),
    };
    expect(() => registerRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('loginRequestSchema', () => {
  it('accepts valid login request with required fields', () => {
    const validRequest = {
      email: 'user@example.com',
      passwordHash: 'hashedPasswordValue',
    };
    expect(() => loginRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('accepts login request with optional deviceId and deviceName', () => {
    const validRequest = {
      email: 'user@example.com',
      passwordHash: 'hashedPasswordValue',
      deviceId: 'device-123',
      deviceName: 'My Device',
    };
    expect(() => loginRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('rejects invalid email format', () => {
    const invalidRequest = {
      email: 'invalid-email',
      passwordHash: 'hashedPasswordValue',
    };
    expect(() => loginRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects device name exceeding 100 characters', () => {
    const invalidRequest = {
      email: 'user@example.com',
      passwordHash: 'hashedPasswordValue',
      deviceName: 'a'.repeat(101),
    };
    expect(() => loginRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('syncOperationSchema', () => {
  it('accepts valid create operation', () => {
    const validOp = {
      type: 'create',
      taskId: 'task-123',
      encryptedBlob: 'encrypted-data',
      nonce: 'random-nonce',
      vectorClock: { device1: 1 },
      checksum: 'abc123',
    };
    expect(() => syncOperationSchema.parse(validOp)).not.toThrow();
  });

  it('accepts valid update operation', () => {
    const validOp = {
      type: 'update',
      taskId: 'task-123',
      vectorClock: { device1: 2 },
    };
    expect(() => syncOperationSchema.parse(validOp)).not.toThrow();
  });

  it('accepts valid delete operation', () => {
    const validOp = {
      type: 'delete',
      taskId: 'task-123',
      vectorClock: { device1: 3 },
    };
    expect(() => syncOperationSchema.parse(validOp)).not.toThrow();
  });

  it('rejects invalid operation type', () => {
    const invalidOp = {
      type: 'invalid',
      taskId: 'task-123',
      vectorClock: {},
    };
    expect(() => syncOperationSchema.parse(invalidOp)).toThrow();
  });

  it('rejects empty taskId', () => {
    const invalidOp = {
      type: 'create',
      taskId: '',
      vectorClock: {},
    };
    expect(() => syncOperationSchema.parse(invalidOp)).toThrow();
  });
});

describe('pushRequestSchema', () => {
  it('accepts valid push request', () => {
    const validRequest = {
      deviceId: 'device-123',
      operations: [
        {
          type: 'create',
          taskId: 'task-1',
          vectorClock: { device1: 1 },
        },
      ],
      clientVectorClock: { device1: 1 },
    };
    expect(() => pushRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('accepts push request with empty operations array', () => {
    const validRequest = {
      deviceId: 'device-123',
      operations: [],
      clientVectorClock: {},
    };
    expect(() => pushRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('rejects empty deviceId', () => {
    const invalidRequest = {
      deviceId: '',
      operations: [],
      clientVectorClock: {},
    };
    expect(() => pushRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('pullRequestSchema', () => {
  it('accepts valid pull request with required fields', () => {
    const validRequest = {
      deviceId: 'device-123',
      lastVectorClock: { device1: 5 },
    };
    expect(() => pullRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('accepts pull request with optional fields', () => {
    const validRequest = {
      deviceId: 'device-123',
      lastVectorClock: { device1: 5 },
      sinceTimestamp: 1704067200,
      limit: 50,
      cursor: 'cursor-abc',
    };
    expect(() => pullRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('rejects limit exceeding 100', () => {
    const invalidRequest = {
      deviceId: 'device-123',
      lastVectorClock: {},
      limit: 101,
    };
    expect(() => pullRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects non-positive sinceTimestamp', () => {
    const invalidRequest = {
      deviceId: 'device-123',
      lastVectorClock: {},
      sinceTimestamp: 0,
    };
    expect(() => pullRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('resolveRequestSchema', () => {
  it('accepts keep_local resolution', () => {
    const validRequest = {
      taskId: 'task-123',
      resolution: 'keep_local',
    };
    expect(() => resolveRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('accepts keep_remote resolution', () => {
    const validRequest = {
      taskId: 'task-123',
      resolution: 'keep_remote',
    };
    expect(() => resolveRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('accepts merge resolution with mergedTask', () => {
    const validRequest = {
      taskId: 'task-123',
      resolution: 'merge',
      mergedTask: {
        encryptedBlob: 'merged-data',
        nonce: 'merged-nonce',
        vectorClock: { device1: 10, device2: 5 },
        checksum: 'merged-checksum',
      },
    };
    expect(() => resolveRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('rejects invalid resolution type', () => {
    const invalidRequest = {
      taskId: 'task-123',
      resolution: 'invalid',
    };
    expect(() => resolveRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects empty taskId', () => {
    const invalidRequest = {
      taskId: '',
      resolution: 'keep_local',
    };
    expect(() => resolveRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('updateDeviceRequestSchema', () => {
  it('accepts valid device name update', () => {
    const validRequest = { name: 'New Device Name' };
    expect(() => updateDeviceRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('rejects empty name', () => {
    const invalidRequest = { name: '' };
    expect(() => updateDeviceRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('rejects name exceeding 100 characters', () => {
    const invalidRequest = { name: 'a'.repeat(101) };
    expect(() => updateDeviceRequestSchema.parse(invalidRequest)).toThrow();
  });
});
