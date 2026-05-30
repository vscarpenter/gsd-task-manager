import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCaptureException = vi.hoisted(() => vi.fn());
const mockCaptureMessage = vi.hoisted(() => vi.fn());

vi.mock('../../utils/sentry.js', () => ({
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}));

import { createMcpLogger } from '../../utils/logger.js';

describe('MCP logger Sentry forwarding', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should forward errors to Sentry via captureException with module context', () => {
    const logger = createMcpLogger('LIST_TASKS');
    const error = new Error('boom');

    logger.error('Failed to map task', error, { taskId: 't1' });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
    const [forwardedError, context] = mockCaptureException.mock.calls[0];
    expect(forwardedError).toBe(error);
    expect(context).toMatchObject({ module: 'LIST_TASKS', taskId: 't1' });
  });

  it('should forward message-only errors via captureMessage', () => {
    const logger = createMcpLogger('CONFIG');

    logger.error('Configuration error');

    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).not.toHaveBeenCalled();
    const [message, context] = mockCaptureMessage.mock.calls[0];
    expect(message).toBe('Configuration error');
    expect(context).toMatchObject({ module: 'CONFIG' });
  });

  it('should not forward info, warn, or debug logs to Sentry', () => {
    const logger = createMcpLogger('SERVER');

    logger.info('i');
    logger.warn('w');
    logger.debug('d');

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('should still write to stderr when the Sentry forward throws', () => {
    mockCaptureException.mockImplementationOnce(() => {
      throw new Error('sentry down');
    });
    const logger = createMcpLogger('SERVER');

    expect(() => logger.error('boom', new Error('real'))).not.toThrow();
    expect(stderrSpy).toHaveBeenCalled();
  });
});
