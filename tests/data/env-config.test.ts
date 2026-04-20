import { beforeEach, describe, expect, it, vi } from 'vitest';

function setWindowLocation(url: string) {
  const parsed = new URL(url);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      hostname: parsed.hostname,
      origin: parsed.origin,
      protocol: parsed.protocol,
    },
  });
}

describe('env-config', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_POCKETBASE_URL;
    setWindowLocation('https://gsd.vinny.dev/');
  });

  it('uses same-origin fallback for unknown https hosts', async () => {
    setWindowLocation('https://tasks.example.com/');

    const { getEnvironmentConfig } = await import('@/lib/env-config');

    expect(getEnvironmentConfig().pocketBaseUrl).toBe('https://tasks.example.com');
  });

  it('keeps the dedicated hosted PocketBase mapping for known production hosts', async () => {
    const { getEnvironmentConfig } = await import('@/lib/env-config');

    expect(getEnvironmentConfig().pocketBaseUrl).toBe('https://api.vinny.io');
  });

  it('respects an explicit NEXT_PUBLIC_POCKETBASE_URL override', async () => {
    process.env.NEXT_PUBLIC_POCKETBASE_URL = 'https://sync.example.com';

    const { getEnvironmentConfig } = await import('@/lib/env-config');

    expect(getEnvironmentConfig().pocketBaseUrl).toBe('https://sync.example.com');
  });
});
