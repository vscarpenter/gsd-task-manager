import type { FormEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSavedItem } from '@/components/saved/use-saved-item';
import { timeOf } from '@/lib/due-time';
import { createMockTask } from '@/tests/fixtures';

// Berlin is east of UTC: an all-day due date, stored as local midnight, falls on
// the previous UTC day. The Saved and weekly-sweep return forms share this hook.
const originalTimezone = process.env.TZ;
beforeEach(() => {
  process.env.TZ = 'Europe/Berlin';
});
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

const submitEvent = { preventDefault() {} } as FormEvent;

function renderReturnForm(dueDate: string) {
  const onReturn = vi.fn().mockResolvedValue(true);
  const task = createMockTask({ dueDate, savedAt: '2026-11-01T00:00:00.000Z' });
  const hook = renderHook(() => useSavedItem({ task, onNotes: vi.fn(), onReturn, onDelete: vi.fn() }));
  act(() => hook.result.current.open('return'));
  return { hook, onReturn, task };
}

describe('the return form', () => {
  it('shows the local day of an all-day due date', () => {
    const { hook } = renderReturnForm(new Date(2026, 10, 10).toISOString());

    expect(hook.result.current.dueDate).toBe('2026-11-10');
  });

  it('returns an unchanged date exactly as stored', async () => {
    const stored = new Date(2026, 10, 10).toISOString();
    const { hook, onReturn, task } = renderReturnForm(stored);

    await act(() => hook.result.current.submit(submitEvent));

    expect(onReturn).toHaveBeenCalledWith(task, task.quadrant, stored);
  });

  it('keeps a newly picked date all day, with no 12:00 time', async () => {
    const { hook, onReturn } = renderReturnForm(new Date(2026, 10, 10).toISOString());
    act(() => hook.result.current.setDueDate('2026-11-12'));

    await act(() => hook.result.current.submit(submitEvent));

    const saved = onReturn.mock.calls[0][2] as string;
    expect(saved).toBe(new Date(2026, 10, 12).toISOString());
    expect(timeOf(saved)).toBeUndefined();
  });
});
