import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

/**
 * "Sign out of all devices" (SEC-002). PocketBase tokens are stateless, so the
 * only way to end a user's sessions on the server is to rotate their token key.
 */

const source = readFileSync(
  resolve(process.cwd(), 'docker/pb_hooks/session_revoke.pb.js'),
  'utf8',
);

interface Route {
  method: string;
  path: string;
  handler: (event: unknown) => unknown;
  middleware: unknown;
}

function loadRoute(): { route: Route; authMiddleware: symbol } {
  let route: Route | undefined;
  const authMiddleware = Symbol('users-auth');

  vm.runInNewContext(source, {
    routerAdd: (method: string, path: string, handler: Route['handler'], middleware: unknown) => {
      route = { method, path, handler, middleware };
    },
    $apis: {
      requireAuth: (collection: string) => {
        expect(collection).toBe('users');
        return authMiddleware;
      },
    },
  });

  return { route: route!, authMiddleware };
}

describe('PocketBase session revoke hook', () => {
  it('registers DELETE /api/gsd/sessions behind a users login', () => {
    const { route, authMiddleware } = loadRoute();

    expect(route.method).toBe('DELETE');
    expect(route.path).toBe('/api/gsd/sessions');
    expect(route.middleware).toBe(authMiddleware);
  });

  it("rotates the caller's token key, saves it, and answers 204", () => {
    const { route } = loadRoute();
    const order: string[] = [];
    const user = { id: 'user-1', refreshTokenKey: vi.fn(() => order.push('rotate')) };
    // saveNoValidate: an unrelated field rule added later must not block a revoke.
    const app = { saveNoValidate: vi.fn(() => order.push('save')) };
    const noContent = vi.fn(() => 'no-content');

    const result = route.handler({ auth: user, app, noContent });

    expect(app.saveNoValidate).toHaveBeenCalledWith(user);
    expect(order).toEqual(['rotate', 'save']);
    expect(noContent).toHaveBeenCalledWith(204);
    expect(result).toBe('no-content');
  });
});
