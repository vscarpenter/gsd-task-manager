import { listTasks, type GsdConfig } from '../../tools.js';
import type { Task } from '../../types.js';
import {
  MAX_PICKS,
  localDate,
  suggestTopThree,
  todaysPicks,
  type TopThreeTask,
} from '../../top-three.js';
import type { McpToolResponse } from './types.js';

/** D-12's default escalation window. The setting is per device, so the server can't read one. */
const DEFAULT_ESCALATION_WINDOW_DAYS = 2;

// The focus fields reach Task through the PocketBase mapper (MCP-TOP3); until then they are absent.
type FocusTask = Task & Pick<TopThreeTask, 'focusDate' | 'focusRank'>;

function resolveTimeZone(requested: string | undefined): string {
  const zone = requested ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
  } catch {
    throw new Error(`Unknown time zone: ${zone}. Use an IANA name such as America/Chicago.`);
  }
  return zone;
}

function pick(byId: Map<string, FocusTask>, ids: string[]): FocusTask[] {
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Read-only. The user chooses the picks; this only reports them and what GSD would suggest. */
export async function handleGetTopThree(
  config: GsdConfig,
  args: { timeZone?: string }
): Promise<McpToolResponse> {
  const zone = resolveTimeZone(args.timeZone);
  const now = new Date();
  const tasks = (await listTasks(config)) as FocusTask[];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const { picks, needsTidy } = todaysPicks(tasks, now, zone);
  const suggestions = suggestTopThree(tasks, now, DEFAULT_ESCALATION_WINDOW_DAYS, zone).slice(0, MAX_PICKS);

  const result = {
    date: localDate(now, zone),
    timeZone: zone,
    picks: pick(byId, picks),
    needsTidy,
    suggestions: pick(byId, suggestions),
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}
