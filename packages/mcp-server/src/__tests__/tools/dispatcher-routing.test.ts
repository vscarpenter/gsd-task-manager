import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolName } from '../../tools/handlers/input-schemas.js';
import type { GsdConfig } from '../../types.js';

// One mock per handler, grouped by the module that index.ts imports it from.
const mockedModules = vi.hoisted(() => {
  const mockHandler = () =>
    vi.fn(async (..._args: unknown[]) => ({ content: [{ type: 'text' as const, text: 'ok' }] }));
  return {
    read: {
      handleGetSyncStatus: mockHandler(),
      handleGetTaskStats: mockHandler(),
      handleListTasks: mockHandler(),
      handleGetTask: mockHandler(),
      handleSearchTasks: mockHandler(),
      handleGetTokenStatus: mockHandler(),
    },
    topThree: { handleGetTopThree: mockHandler() },
    analytics: {
      handleGetProductivityMetrics: mockHandler(),
      handleGetQuadrantAnalysis: mockHandler(),
      handleGetTagAnalytics: mockHandler(),
      handleGetUpcomingDeadlines: mockHandler(),
      handleGetTaskInsights: mockHandler(),
    },
    system: {
      handleValidateConfig: mockHandler(),
      handleGetHelp: mockHandler(),
      handleGetCacheStats: mockHandler(),
    },
    write: {
      handleCreateTask: mockHandler(),
      handleUpdateTask: mockHandler(),
      handleCompleteTask: mockHandler(),
      handleDeleteTask: mockHandler(),
      handleBulkUpdateTasks: mockHandler(),
    },
  };
});

vi.mock('../../tools/handlers/read-handlers.js', () => mockedModules.read);
vi.mock('../../tools/handlers/top-three-handler.js', () => mockedModules.topThree);
vi.mock('../../tools/handlers/analytics-handlers.js', () => mockedModules.analytics);
vi.mock('../../tools/handlers/system-handlers.js', () => mockedModules.system);
vi.mock('../../tools/handlers/write-handlers.js', () => mockedModules.write);

import { handleToolCall } from '../../tools/handlers/index.js';

const handlers = {
  ...mockedModules.read,
  ...mockedModules.topThree,
  ...mockedModules.analytics,
  ...mockedModules.system,
  ...mockedModules.write,
};

const config: GsdConfig = { pocketBaseUrl: 'https://pocketbase.invalid', authToken: 'token' };

interface Route {
  args: Record<string, unknown>;
  handler: keyof typeof handlers;
  /** The leading arguments the handler must get: config, the validated args, or both, as its signature takes them. */
  calledWith: unknown[];
}

// Every tool but delete_task, whose routing dispatcher-write-safety.test.ts already pins.
// Rows with tags send '#Work': a handler that receives 'work' got the validated args, not the raw ones.
const ROUTES = {
  get_sync_status: { args: {}, handler: 'handleGetSyncStatus', calledWith: [config] },
  get_task_stats: { args: {}, handler: 'handleGetTaskStats', calledWith: [config] },
  list_tasks: {
    args: { quadrant: 'urgent-important', tags: ['#Work'] },
    handler: 'handleListTasks',
    calledWith: [config, { quadrant: 'urgent-important', tags: ['work'] }],
  },
  get_task: { args: { taskId: 'task-1' }, handler: 'handleGetTask', calledWith: [config, { taskId: 'task-1' }] },
  search_tasks: { args: { query: 'report' }, handler: 'handleSearchTasks', calledWith: [config, { query: 'report' }] },
  get_token_status: { args: {}, handler: 'handleGetTokenStatus', calledWith: [config] },
  get_top_three: {
    args: { timeZone: 'America/Chicago' },
    handler: 'handleGetTopThree',
    calledWith: [config, { timeZone: 'America/Chicago' }],
  },
  get_productivity_metrics: { args: {}, handler: 'handleGetProductivityMetrics', calledWith: [config] },
  get_quadrant_analysis: { args: {}, handler: 'handleGetQuadrantAnalysis', calledWith: [config] },
  get_tag_analytics: { args: { limit: 5 }, handler: 'handleGetTagAnalytics', calledWith: [config, { limit: 5 }] },
  get_upcoming_deadlines: { args: {}, handler: 'handleGetUpcomingDeadlines', calledWith: [config] },
  get_task_insights: { args: {}, handler: 'handleGetTaskInsights', calledWith: [config] },
  validate_config: { args: {}, handler: 'handleValidateConfig', calledWith: [config] },
  get_help: { args: { topic: 'tools' }, handler: 'handleGetHelp', calledWith: [{ topic: 'tools' }] },
  get_cache_stats: { args: { reset: true }, handler: 'handleGetCacheStats', calledWith: [{ reset: true }] },
  create_task: {
    args: { title: 'Draft report', urgent: true, important: false, tags: ['#Work'] },
    handler: 'handleCreateTask',
    calledWith: [config, { title: 'Draft report', urgent: true, important: false, tags: ['work'] }],
  },
  update_task: {
    args: { id: 'task-1', title: 'Final report' },
    handler: 'handleUpdateTask',
    calledWith: [config, { id: 'task-1', title: 'Final report' }],
  },
  complete_task: {
    args: { id: 'task-1', completed: true },
    handler: 'handleCompleteTask',
    calledWith: [config, { id: 'task-1', completed: true }],
  },
  bulk_update_tasks: {
    args: { taskIds: ['task-1', 'task-2'], operation: { type: 'complete', completed: true } },
    handler: 'handleBulkUpdateTasks',
    calledWith: [config, { taskIds: ['task-1', 'task-2'], operation: { type: 'complete', completed: true } }],
  },
} satisfies Record<Exclude<ToolName, 'delete_task'>, Route>;

/**
 * The calls each handler received, cut to their first `argCount` arguments, leaving out the handlers
 * nothing called. The routing contract is which handler gets the config and the validated args, so
 * arguments the dispatcher appends after those don't count.
 */
function callsByHandler(argCount: number): Record<string, unknown[][]> {
  return Object.fromEntries(
    Object.entries(handlers)
      .filter(([, handler]) => handler.mock.calls.length > 0)
      .map(([name, handler]) => [name, handler.mock.calls.map((call) => call.slice(0, argCount))])
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dispatcher routing', () => {
  it.each(Object.entries(ROUTES))(
    'should_route_%s_to_its_own_handler_with_validated_args',
    async (name, { args, handler, calledWith }) => {
      await handleToolCall(name, args, config);

      expect(callsByHandler(calledWith.length)).toEqual({ [handler]: [calledWith] });
    }
  );
});
