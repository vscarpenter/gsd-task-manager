import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createMcpLogger } from '../../utils/logger.js';

function lastEntry(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  return JSON.parse(String(call?.[0]));
}

describe('MCP logger', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('should write one JSON line per log call to stderr only', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = createMcpLogger('LIST_TASKS');

    logger.info('listing tasks', { count: 3 });

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(String(stderrSpy.mock.calls[0][0])).toMatch(/\n$/);
    expect(lastEntry(stderrSpy)).toMatchObject({
      level: 'INFO',
      module: 'LIST_TASKS',
      message: 'listing tasks',
      context: { count: 3 },
    });
    stdoutSpy.mockRestore();
  });

  it('should include the error message and a truncated stack on error entries', () => {
    const logger = createMcpLogger('LIST_TASKS');
    const error = new Error('boom');

    logger.error('Failed to map task', error, { taskId: 't1' });

    const entry = lastEntry(stderrSpy);
    expect(entry).toMatchObject({
      level: 'ERROR',
      module: 'LIST_TASKS',
      message: 'Failed to map task',
      error: 'boom',
      context: { taskId: 't1' },
    });
    expect(String(entry.stack).split(' | ')).toHaveLength(3);
  });

  it('should omit error fields for message-only errors', () => {
    const logger = createMcpLogger('CONFIG');

    logger.error('Configuration error');

    const entry = lastEntry(stderrSpy);
    expect(entry).toMatchObject({ level: 'ERROR', module: 'CONFIG' });
    expect(entry).not.toHaveProperty('error');
    expect(entry).not.toHaveProperty('stack');
    expect(entry).not.toHaveProperty('context');
  });

  it('should write warn entries at WARN level', () => {
    const logger = createMcpLogger('SERVER');

    logger.warn('slow request', { ms: 1200 });

    expect(lastEntry(stderrSpy)).toMatchObject({ level: 'WARN', context: { ms: 1200 } });
  });

  it('should suppress debug entries unless debug logging is enabled', () => {
    vi.stubEnv('LOG_LEVEL', '');
    vi.stubEnv('NODE_ENV', 'production');
    createMcpLogger('SERVER').debug('hidden');
    expect(stderrSpy).not.toHaveBeenCalled();

    vi.stubEnv('LOG_LEVEL', 'debug');
    createMcpLogger('SERVER').debug('shown');
    expect(lastEntry(stderrSpy)).toMatchObject({ level: 'DEBUG', message: 'shown' });
  });
});
