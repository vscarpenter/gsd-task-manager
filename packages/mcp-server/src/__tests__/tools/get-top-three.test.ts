import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../types.js';

vi.mock('../../tools.js', () => ({ listTasks: vi.fn() }));

import { listTasks } from '../../tools.js';
import { handleGetTopThree } from '../../tools/handlers/top-three-handler.js';
import { validateToolArgs } from '../../tools/handlers/input-schemas.js';
import { getTopThreeTool } from '../../tools/schemas/read-tools.js';

const config = { pocketBaseUrl: 'https://pb.example', authToken: 'token' };
const NOW = new Date('2026-11-04T16:00:00.000Z');

function task(id: string, overrides: Record<string, unknown> = {}): Task {
  return {
    id,
    title: `task ${id}`,
    description: '',
    urgent: true,
    important: true,
    quadrant: 'urgent-important',
    completed: false,
    tags: [],
    subtasks: [],
    recurrence: 'none',
    dependencies: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  } as Task;
}

async function run(args: { timeZone?: string } = {}) {
  const response = await handleGetTopThree(config, args);
  return JSON.parse(response.content[0]?.text ?? 'null');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe('get_top_three', () => {
  it('returns the picks in rank order with their task objects', async () => {
    vi.mocked(listTasks).mockResolvedValue([
      task('b', { focusDate: '2026-11-04', focusRank: 2 }),
      task('a', { focusDate: '2026-11-04', focusRank: 1 }),
    ]);

    const result = await run({ timeZone: 'America/Chicago' });

    expect(result.picks.map((t: Task) => t.id)).toEqual(['a', 'b']);
    expect(result.picks[0].title).toBe('task a');
    expect(result.needsTidy).toBe(false);
  });

  it('judges today in the requested zone', async () => {
    vi.mocked(listTasks).mockResolvedValue([task('a', { focusDate: '2026-11-04', focusRank: 1 })]);

    const chicago = await run({ timeZone: 'America/Chicago' });
    const tokyo = await run({ timeZone: 'Asia/Tokyo' });

    expect(chicago.picks).toHaveLength(1);
    expect(tokyo.picks).toHaveLength(0);
    expect(tokyo.date).toBe('2026-11-05');
  });

  it('suggests the first three tasks that are not picks, overdue Q1 first', async () => {
    vi.mocked(listTasks).mockResolvedValue([
      task('picked', { focusDate: '2026-11-04', focusRank: 1 }),
      task('late', { dueDate: '2026-11-01T18:00:00.000Z' }),
      task('soon', { dueDate: '2026-11-09T18:00:00.000Z' }),
      task('undated'),
      task('extra', { createdAt: '2026-10-05T00:00:00.000Z' }),
    ]);

    const result = await run({ timeZone: 'America/Chicago' });

    expect(result.suggestions.map((t: Task) => t.id)).toEqual(['late', 'soon', 'undated']);
  });

  it('suggests a Schedule task due within the two-day default window', async () => {
    vi.mocked(listTasks).mockResolvedValue([
      task('sched', { urgent: false, quadrant: 'not-urgent-important', dueDate: '2026-11-05T18:00:00.000Z' }),
      task('far', { urgent: false, quadrant: 'not-urgent-important', dueDate: '2026-11-20T18:00:00.000Z' }),
    ]);

    const result = await run({ timeZone: 'America/Chicago' });

    expect(result.suggestions.map((t: Task) => t.id)).toEqual(['sched']);
  });

  it('reports needsTidy when two picks share a rank', async () => {
    vi.mocked(listTasks).mockResolvedValue([
      task('a', { focusDate: '2026-11-04', focusRank: 1 }),
      task('b', { focusDate: '2026-11-04', focusRank: 1 }),
    ]);

    expect((await run({ timeZone: 'America/Chicago' })).needsTidy).toBe(true);
  });

  it('defaults to the system time zone', async () => {
    vi.mocked(listTasks).mockResolvedValue([]);

    const result = await run();

    expect(result.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('rejects an unknown time zone before reading any task', async () => {
    await expect(handleGetTopThree(config, { timeZone: 'Mars/Olympus' })).rejects.toThrow(/time zone/i);
    expect(listTasks).not.toHaveBeenCalled();
  });
});

describe('get_top_three arguments and schema', () => {
  it('accepts no arguments and an IANA zone, and rejects anything else', () => {
    expect(() => validateToolArgs('get_top_three', {})).not.toThrow();
    expect(() => validateToolArgs('get_top_three', { timeZone: 'Europe/Paris' })).not.toThrow();
    expect(() => validateToolArgs('get_top_three', { limit: 3 })).toThrow();
  });

  it('is read-only and describes itself as the user picking, never the agent', () => {
    expect(getTopThreeTool.name).toBe('get_top_three');
    expect(getTopThreeTool.description).toMatch(/read-only/i);
    expect(getTopThreeTool.description).toMatch(/cannot pick/i);
  });
});
