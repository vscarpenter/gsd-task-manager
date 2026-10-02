import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function readHook(name: string): string {
  return readFileSync(resolve(process.cwd(), 'docker/pb_hooks', name), 'utf8');
}

const bounceSource = readHook('oauth_web_redirect.pb.js');
const coreSource = readHook('oauth-web-redirect.js');
const blockSource = readHook('oauth_realtime_redirect_block.pb.js');

type ReadParam = (name: string) => string;

function loadCore() {
  const hookModule = {
    exports: {} as { callbackLocation: (readParam: ReadParam, target: string) => string },
  };
  vm.runInNewContext(coreSource, { module: hookModule, String, encodeURIComponent });
  return hookModule.exports;
}

type Route = { method: string; path: string; handler: (event: unknown) => unknown };

function loadRoutes(env: Record<string, string> = {}) {
  const routes: Route[] = [];
  vm.runInNewContext(bounceSource, {
    __hooks: '/pb_hooks',
    require: (path: string) => {
      expect(path).toBe('/pb_hooks/oauth-web-redirect.js');
      return loadCore();
    },
    $os: { getenv: (name: string) => env[name] ?? '' },
    routerAdd: (method: string, path: string, handler: (event: unknown) => unknown) => {
      routes.push({ method, path, handler });
    },
  });
  return routes;
}

/** FormValue semantics: raw strings from the form body or the query, '' when absent. */
function fakeEvent(params: Record<string, string>) {
  return {
    request: { formValue: (name: string) => params[name] ?? '' },
    redirect: vi.fn((status: number, location: string) => ({ status, location })),
  };
}

describe('PocketBase web OAuth redirect hook', () => {
  it('registers the same bounce for GET and POST (Apple uses form_post)', () => {
    const routes = loadRoutes();

    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /api/gsd/oauth-callback',
      'POST /api/gsd/oauth-callback',
    ]);
  });

  it('redirects to the callback page with params encoded in the fragment', () => {
    const [get] = loadRoutes();
    const event = fakeEvent({ code: 'a/b+c', state: 's1' });

    get.handler(event);

    expect(event.redirect).toHaveBeenCalledWith(303, '/auth/callback/#code=a%2Fb%2Bc&state=s1');
  });

  it('uses the configured callback page for a form_post return', () => {
    const [, post] = loadRoutes({ GSD_WEB_OAUTH_CALLBACK_URL: 'https://gsd.vinny.dev/auth/callback/' });
    const event = fakeEvent({ code: 'apple-code', state: 's2' });

    post.handler(event);

    expect(event.redirect).toHaveBeenCalledWith(
      303,
      'https://gsd.vinny.dev/auth/callback/#code=apple-code&state=s2',
    );
  });

  it('passes a provider error through and drops oversized values', () => {
    const { callbackLocation } = loadCore();
    const params: Record<string, string> = { error: 'access_denied', state: 's3', code: 'x'.repeat(2049) };

    expect(callbackLocation((name) => params[name] ?? '', '/auth/callback/')).toBe(
      '/auth/callback/#state=s3&error=access_denied',
    );
  });

  it('never takes the redirect target from the request', () => {
    const [get] = loadRoutes();
    const event = fakeEvent({ code: 'c', state: 's', redirect: 'https://evil.example' });

    get.handler(event);

    expect(event.redirect.mock.calls[0][1].startsWith('/auth/callback/#')).toBe(true);
    expect(event.redirect.mock.calls[0][1]).not.toContain('evil.example');
  });
});

describe('PocketBase realtime OAuth redirect block hook', () => {
  class NotFoundError extends Error {}

  function loadBlock() {
    let middleware: ((event: unknown) => unknown) | undefined;
    vm.runInNewContext(blockSource, {
      NotFoundError,
      routerUse: (handler: (event: unknown) => unknown) => {
        middleware = handler;
      },
    });
    return middleware!;
  }

  function requestTo(path: string) {
    return { request: { url: { path } }, next: vi.fn(() => 'next') };
  }

  it.each(['/api/oauth2-redirect', '/api/oauth2-redirect/'])('answers 404 for %s', (path) => {
    const event = requestTo(path);

    expect(() => loadBlock()(event)).toThrow(NotFoundError);
    expect(event.next).not.toHaveBeenCalled();
  });

  it('passes every other route through', () => {
    const event = requestTo('/api/gsd/oauth-callback');

    expect(loadBlock()(event)).toBe('next');
    expect(event.next).toHaveBeenCalledOnce();
  });
});
