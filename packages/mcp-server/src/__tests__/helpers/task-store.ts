import { taskToPBFields, type GsdConfig, type PBTask, type Task } from '../../types.js';

/**
 * The user's PocketBase tasks, held in memory for protocol tests. The fakes
 * below stand in for the module boundaries every delete path reads and writes
 * through (`tools/list-tasks.js` and `write-ops/helpers.js`), so a test can see
 * each write and change a task while a confirmation dialog is open.
 */
export const taskStore = {
  tasks: new Map<string, Task>(),
  deleted: [] as string[],
  dependencyWrites: [] as string[],
  /** Full task-list reads, which every delete round starts with. */
  listReads: 0,
  /** Runs once, right after the next full task-list read, to change the store mid-call. */
  afterNextListRead: undefined as (() => void) | undefined,
};

export function seedTaskStore(tasks: Task[]): void {
  taskStore.tasks = new Map(tasks.map((task) => [task.id, task]));
  taskStore.deleted = [];
  taskStore.dependencyWrites = [];
  taskStore.listReads = 0;
  taskStore.afterNextListRead = undefined;
}

/** An edit made on another device, which moves the task's updatedAt. */
export function editElsewhere(taskId: string, updatedAt: string): void {
  const task = taskStore.tasks.get(taskId);
  if (task) taskStore.tasks.set(taskId, { ...task, updatedAt });
}

export function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    tags: [],
    subtasks: [],
    recurrence: 'none',
    dependencies: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function pbEntry(task: Task): { pbRecordId: string; clientUpdatedAt: string; record: PBTask } {
  return {
    pbRecordId: `record-${task.id}`,
    clientUpdatedAt: task.updatedAt,
    // taskToPBFields sets every field the client owns, but its declared return type is Partial.
    record: {
      id: `record-${task.id}`,
      ...taskToPBFields(task, 'owner-1', 'device-1'),
      created: task.createdAt,
      updated: task.updatedAt,
    } as PBTask,
  };
}

const taskIdOf = (pbRecordId: string): string => pbRecordId.replace(/^record-/, '');

function listAll(): Task[] {
  taskStore.listReads += 1;
  const tasks = [...taskStore.tasks.values()];
  const hook = taskStore.afterNextListRead;
  taskStore.afterNextListRead = undefined;
  hook?.();
  return tasks;
}

export const listTasksFakes = {
  listTasks: async (): Promise<Task[]> => listAll(),
  listTasksFresh: async (): Promise<Task[]> => listAll(),
};

export const writeHelperFakes = {
  getAuthInfo: async () => ({ ownerId: 'owner-1', deviceId: 'device-1' }),
  fetchSinglePBTaskFresh: async (_config: GsdConfig, taskId: string) => {
    const task = taskStore.tasks.get(taskId);
    return task ? pbEntry(task) : null;
  },
  fetchPBSnapshotForTasks: async (_config: GsdConfig, taskIds: string[]) =>
    new Map(taskIds.flatMap((id) => {
      const task = taskStore.tasks.get(id);
      return task ? [[id, pbEntry(task)] as const] : [];
    })),
  deleteTaskInPBById: async (_config: GsdConfig, pbRecordId: string) => {
    taskStore.tasks.delete(taskIdOf(pbRecordId));
    taskStore.deleted.push(taskIdOf(pbRecordId));
  },
  updateTaskDependenciesInPBById: async (_config: GsdConfig, pbRecordId: string, dependencies: string[]) => {
    const task = taskStore.tasks.get(taskIdOf(pbRecordId));
    if (task) taskStore.tasks.set(task.id, { ...task, dependencies });
    taskStore.dependencyWrites.push(taskIdOf(pbRecordId));
  },
};
