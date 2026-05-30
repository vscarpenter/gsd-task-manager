import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockInit = vi.hoisted(() => vi.fn());
const mockCaptureException = vi.hoisted(() => vi.fn());
const mockCaptureMessage = vi.hoisted(() => vi.fn());
const mockGetClient = vi.hoisted(() => vi.fn());
const mockFlush = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));

vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => {
    mockInit(...args);
  },
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
  getClient: mockGetClient,
  flush: mockFlush,
}));

describe('MCP Sentry wrapper', () => {
  const originalDsn = process.env.GSD_SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetClient.mockReturnValue(undefined);
    delete process.env.GSD_SENTRY_DSN;
  });

  afterEach(() => {
    if (originalDsn !== undefined) {
      process.env.GSD_SENTRY_DSN = originalDsn;
    } else {
      delete process.env.GSD_SENTRY_DSN;
    }
  });

  it('should init Sentry when GSD_SENTRY_DSN is present', async () => {
    process.env.GSD_SENTRY_DSN = 'https://key@sentry.io/1';
    const { initSentry } = await import('../../utils/sentry.js');

    initSentry();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.io/1',
        tracesSampleRate: 0,
      }),
    );
  });

  it('should not init Sentry when GSD_SENTRY_DSN is absent', async () => {
    const { initSentry } = await import('../../utils/sentry.js');

    initSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it('should not capture exceptions when uninitialized', async () => {
    const { captureException } = await import('../../utils/sentry.js');

    captureException(new Error('x'), { module: 'TEST' });

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('should send a masked exception with gsd context when initialized', async () => {
    mockGetClient.mockReturnValue({});
    const { captureException } = await import('../../utils/sentry.js');

    captureException(
      new Error('request failed Authorization: Bearer eyJ.tok.en'),
      { module: 'API' },
    );

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [sent, opts] = mockCaptureException.mock.calls[0];
    expect((sent as Error).message).not.toContain('eyJ.tok.en');
    expect((sent as Error).message).toContain('Bearer ***');
    expect(opts).toEqual({ contexts: { gsd: { module: 'API' } } });
  });

  it('should preserve the error type name when masking', async () => {
    class ApiError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'ApiError';
      }
    }
    mockGetClient.mockReturnValue({});
    const { captureException } = await import('../../utils/sentry.js');

    captureException(new ApiError('boom'));

    const [sent] = mockCaptureException.mock.calls[0];
    expect((sent as Error).name).toBe('ApiError');
  });

  it('should mask a string thrown value passed to captureException', async () => {
    mockGetClient.mockReturnValue({});
    const { captureException } = await import('../../utils/sentry.js');

    captureException('crashed with token=abc123');

    const [sent] = mockCaptureException.mock.calls[0];
    expect(sent).toBe('crashed with token=***');
  });

  it('should send a masked, error-level message when initialized', async () => {
    mockGetClient.mockReturnValue({});
    const { captureMessage } = await import('../../utils/sentry.js');

    captureMessage('failed token=secret123', { module: 'CONFIG' });

    expect(mockCaptureMessage).toHaveBeenCalledWith('failed token=***', {
      level: 'error',
      contexts: { gsd: { module: 'CONFIG' } },
    });
  });

  it('should not capture messages when uninitialized', async () => {
    const { captureMessage } = await import('../../utils/sentry.js');

    captureMessage('noop', { module: 'TEST' });

    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('should mask Bearer tokens and token/apikey params in maskSecrets', async () => {
    const { maskSecrets } = await import('../../utils/sentry.js');

    expect(maskSecrets('auth Bearer eyJabc.def.ghi')).toBe('auth Bearer ***');
    expect(maskSecrets('GET /x?token=secret123&p=1')).toBe(
      'GET /x?token=***&p=1',
    );
    expect(maskSecrets('GET /x?api_key=k99&p=1')).toBe('GET /x?apikey=***&p=1');
  });

  it('should resolve flush without calling Sentry when uninitialized', async () => {
    const { flush } = await import('../../utils/sentry.js');

    await expect(flush()).resolves.toBe(true);
    expect(mockFlush).not.toHaveBeenCalled();
  });

  it('should delegate to Sentry.flush when initialized', async () => {
    mockGetClient.mockReturnValue({});
    const { flush } = await import('../../utils/sentry.js');

    await flush(500);

    expect(mockFlush).toHaveBeenCalledWith(500);
  });
});
