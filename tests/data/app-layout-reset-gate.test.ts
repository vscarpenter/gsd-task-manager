/**
 * Root layout reset gate (AC17).
 *
 * Every surface that reads or writes task data mounts inside ResetLockGate.
 * Chrome that holds no task data stays outside, so toasts, error reporting,
 * and the service worker keep working while the app is locked.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const INSIDE_GATE = ['<ClientLayout>', '<FirstTimeRedirect />', '<OnboardingGate />', '<WebMcpRegister />'];
const OUTSIDE_GATE = ['<PwaRegister />', '<PwaUpdateToast />', '<GlobalErrorListener />', '<SentryInit />', '<ThemedToaster />'];

function splitAtGate(layout: string): { inside: string; outside: string } {
  const start = layout.indexOf('<ResetLockGate>');
  const end = layout.indexOf('</ResetLockGate>');
  if (start === -1 || end < start) return { inside: '', outside: layout };
  return { inside: layout.slice(start, end), outside: layout.slice(0, start) + layout.slice(end) };
}

describe('root layout reset gate', () => {
  it('should_mount_data_surfaces_inside_the_gate_and_chrome_outside_it', () => {
    const { inside, outside } = splitAtGate(readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8'));

    const misplacedDataSurfaces = INSIDE_GATE.filter((tag) => !inside.includes(tag) || outside.includes(tag));
    const misplacedChrome = OUTSIDE_GATE.filter((tag) => !outside.includes(tag) || inside.includes(tag));

    expect({ misplacedDataSurfaces, misplacedChrome }).toEqual({ misplacedDataSurfaces: [], misplacedChrome: [] });
  });
});
