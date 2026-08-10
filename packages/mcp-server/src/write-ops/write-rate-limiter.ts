const WRITE_INTERVAL_MS = 100;
const MAX_RATE_LIMIT_RETRIES = 1;
const DEFAULT_RETRY_MS = 200;

export interface SafeWriteError {
  code: string;
  rateLimited: boolean;
  retryAfterMs: number | null;
  status?: number;
}

const STATUS_CODES: Readonly<Record<number, string>> = {
  0: 'network_error',
  400: 'validation_failed',
  401: 'authentication_failed',
  403: 'authentication_failed',
  404: 'not_found',
  409: 'conflict',
  422: 'validation_failed',
  429: 'rate_limited',
};

function codeForStatus(status: number | undefined): string {
  if (status !== undefined && status >= 500) return 'backend_unavailable';
  return status === undefined ? 'write_failed' : STATUS_CODES[status] ?? 'write_failed';
}

function parseRetryAfterValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== 'string' || value.trim() === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function retryAfterFromHeaders(headers: unknown): number | null {
  if (!headers || typeof headers !== 'object') return null;
  if ('get' in headers && typeof headers.get === 'function') {
    return parseRetryAfterValue(headers.get('retry-after'));
  }
  const values = headers as Record<string, unknown>;
  return parseRetryAfterValue(values['retry-after'] ?? values['Retry-After']);
}

function retryAfterFromResponse(
  response: { retryAfterMs?: unknown; headers?: unknown } | undefined
): number | null {
  if (!response) return null;
  const bodyValue = parseRetryAfterValue(response.retryAfterMs);
  return bodyValue ?? retryAfterFromHeaders(response.headers);
}

function retryAfterForError(candidate: {
  retryAfterMs?: unknown;
  response?: { retryAfterMs?: unknown; headers?: unknown };
  originalError?: { response?: { headers?: unknown } };
} | null): number | null {
  const direct = parseRetryAfterValue(candidate?.retryAfterMs);
  if (direct !== null) return direct;
  const response = retryAfterFromResponse(candidate?.response);
  return response ?? retryAfterFromResponse(candidate?.originalError?.response);
}

export function sanitizePocketBaseWriteError(error: unknown): SafeWriteError {
  const candidate = error as {
    status?: unknown;
    retryAfterMs?: unknown;
    response?: { retryAfterMs?: unknown; headers?: unknown };
    originalError?: { response?: { headers?: unknown } };
  } | null;
  const status = typeof candidate?.status === 'number' ? candidate.status : undefined;
  const safe: SafeWriteError = {
    code: codeForStatus(status),
    rateLimited: status === 429,
    retryAfterMs: retryAfterForError(candidate),
  };
  if (status !== undefined) safe.status = status;
  return safe;
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export class WriteRateLimiter {
  private tail: Promise<void> = Promise.resolve();
  private nextWriteAt = 0;
  private rateLimitCount = 0;

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      await wait(Math.max(0, this.nextWriteAt - Date.now()));
      return await this.runWithRetry(operation);
    } finally {
      this.nextWriteAt = Date.now() + WRITE_INTERVAL_MS;
      release();
    }
  }

  getRateLimitCount(): number {
    return this.rateLimitCount;
  }

  private async runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const safe = sanitizePocketBaseWriteError(error);
        if (!safe.rateLimited || attempt >= MAX_RATE_LIMIT_RETRIES) throw error;
        this.rateLimitCount++;
        await wait(safe.retryAfterMs ?? DEFAULT_RETRY_MS);
      }
    }
  }
}
