import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatrixBoard } from '@/components/matrix-board';
import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';
import { ToastProvider } from '@/components/ui/toast';
import { renderWithAct } from '../utils/render-with-act';

// Helper to render with providers
const renderWithProviders = (ui: React.ReactElement) =>
  renderWithAct(
    <ToastProvider>
      {ui}
    </ToastProvider>
  );

// Mock next-themes
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

// Mock Next.js App Router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock notification checker
vi.mock('@/lib/notification-checker', () => ({
  notificationChecker: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/use-sync', () => ({
  useSync: () => ({
    sync: vi.fn(),
    isSyncing: false,
    status: 'idle',
    error: null,
    isEnabled: false,
    lastResult: null,
    pendingRequests: 0,
    nextRetryAt: null,
    retryCount: 0,
    autoSyncEnabled: true,
    autoSyncInterval: 2,
  }),
}));

vi.mock('@/components/sync/sync-button', () => ({
  SyncButton: () => <div data-testid="sync-button" />,
}));

vi.mock('@/components/ui/toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({
    showToast: vi.fn(),
    hideToast: vi.fn(),
  }),
}));

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('@/components/command-palette', () => ({
  CommandPalette: () => null,
}));

vi.mock('@/components/bulk-tag-dialog', () => ({
  BulkTagDialog: () => null,
}));

vi.mock('@/components/settings-dialog', () => ({
  SettingsDialog: () => null,
}));

vi.mock('@/components/quick-settings-panel', () => ({
  QuickSettingsPanel: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="quick-settings-panel">{children}</div>
  ),
}));

vi.mock('@/lib/use-auto-archive', () => ({
  useAutoArchive: () => undefined,
}));

vi.mock('@/components/matrix-board/use-event-handlers', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/matrix-board/use-event-handlers')
  >('@/components/matrix-board/use-event-handlers');

  return {
    ...actual,
    usePinnedSmartViews: () => undefined,
    useToggleCompletedListener: () => undefined,
    useTaskHighlighting: () => undefined,
    useNotificationChecker: () => undefined,
    useUrlHighlightParam: () => undefined,
  };
});

describe('MatrixBoard Integration Tests', () => {
  let db: ReturnType<typeof getDb>;
  const user = userEvent.setup();

  beforeEach(async () => {
    db = getDb();
    await db.tasks.clear();
    await db.smartViews.clear();
    await db.archiveSettings.clear();
  });

  afterEach(async () => {
    await db.tasks.clear();
    await db.smartViews.clear();
    await db.archiveSettings.clear();
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render empty state when no tasks exist', async () => {
      await renderWithProviders(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText(/welcome to gsd task manager/i)).toBeInTheDocument();
      });
    });

    it('should render all four quadrants', async () => {
      // Add a task so quadrants are rendered (they don't show on empty state)
      await db.tasks.add({
        id: 'test-task',
        title: 'Test Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      });

      await renderWithProviders(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText(/do first/i)).toBeInTheDocument();
        expect(screen.getByText(/schedule/i)).toBeInTheDocument();
        expect(screen.getByText(/delegate/i)).toBeInTheDocument();
        expect(screen.getByText(/eliminate/i)).toBeInTheDocument();
      });
    });

    it('should render app header with controls', async () => {
      await renderWithProviders(<MatrixBoard />);

      await waitFor(() => {
        // Search should be present
        expect(screen.getByPlaceholderText(/search tasks/i)).toBeInTheDocument();

        // New task button should be present (use text match since aria-label might not be set)
        expect(screen.getByRole('button', { name: /^new task$/i })).toBeInTheDocument();
      });
    });
  });

  describe('Task Display', () => {
    beforeEach(async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task-1',
          title: 'Urgent Important Task',
          description: 'This is urgent and important',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: ['work'],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'task-2',
          title: 'Not Urgent Important Task',
          description: 'Plan for this',
          urgent: false,
          important: true,
          quadrant: 'not-urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: ['personal'],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);
    });

    it('should display tasks in correct quadrants', async () => {
      await renderWithProviders(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText('Urgent Important Task')).toBeInTheDocument();
        expect(screen.getByText('Not Urgent Important Task')).toBeInTheDocument();
      });
    });

    it('should show task tags', async () => {
      await renderWithProviders(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText('work')).toBeInTheDocument();
        expect(screen.getByText('personal')).toBeInTheDocument();
      });
    });

    it('should hide completed tasks by default', async () => {
      await db.tasks.add({
        id: 'completed-task',
        title: 'Completed Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: true,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      });

      await renderWithProviders(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task-1',
          title: 'JavaScript Project',
          description: 'Build a web app',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: ['coding', 'javascript'],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'task-2',
          title: 'Python Script',
          description: 'Automate deployment',
          urgent: false,
          important: true,
          quadrant: 'not-urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: ['coding', 'python'],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'task-3',
          title: 'Meeting Notes',
          description: 'Review weekly standup',
          urgent: false,
          important: false,
          quadrant: 'not-urgent-not-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: ['meetings'],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);
    });

    it('should filter tasks by title', async () => {
      await renderWithProviders(<MatrixBoard />);

      const searchInput = await screen.findByPlaceholderText(/search tasks/i);

      await user.type(searchInput, 'JavaScript');

      await waitFor(() => {
        expect(screen.getByText('JavaScript Project')).toBeInTheDocument();
        expect(screen.queryByText('Python Script')).not.toBeInTheDocument();
        expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
      });
    });

    it('should filter tasks by description', async () => {
      await renderWithProviders(<MatrixBoard />);

      const searchInput = await screen.findByPlaceholderText(/search tasks/i);

      await user.type(searchInput, 'deployment');

      await waitFor(() => {
        expect(screen.getByText('Python Script')).toBeInTheDocument();
        expect(screen.queryByText('JavaScript Project')).not.toBeInTheDocument();
      });
    });

    it('should filter tasks by tags', async () => {
      await renderWithProviders(<MatrixBoard />);

      const searchInput = await screen.findByPlaceholderText(/search tasks/i);

      await user.type(searchInput, 'python');

      await waitFor(() => {
        expect(screen.getByText('Python Script')).toBeInTheDocument();
      });
    });

    it('should clear search results when search is cleared', async () => {
      await renderWithProviders(<MatrixBoard />);

      const searchInput = await screen.findByPlaceholderText(/search tasks/i);

      await user.type(searchInput, 'JavaScript');

      await waitFor(() => {
        expect(screen.queryByText('Python Script')).not.toBeInTheDocument();
      });

      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('JavaScript Project')).toBeInTheDocument();
        expect(screen.getByText('Python Script')).toBeInTheDocument();
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should open new task dialog with "n" key', async () => {
      await renderWithProviders(<MatrixBoard />);

      await user.keyboard('n');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create task/i })).toBeInTheDocument();
      });
    });

    it('should focus search input with "/" key', async () => {
      await renderWithProviders(<MatrixBoard />);

      await user.keyboard('/');

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search tasks/i);
        expect(searchInput).toHaveFocus();
      });
    });

    it('should open help dialog with "?" key', async () => {
      await renderWithProviders(<MatrixBoard />);

      await user.keyboard('?');

      await waitFor(() => {
        // Help dialog should be visible
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Task Creation', () => {
    it('should create a new task', async () => {
      await renderWithProviders(<MatrixBoard />);

      const newTaskButtons = await screen.findAllByRole('button', { name: /^new task$/i });
      const newTaskButton = newTaskButtons[0];
      await user.click(newTaskButton);

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      // Fill in the form
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'New Test Task');

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(descriptionInput, 'Test description');

      // Submit the form
      const saveButton = screen.getByRole('button', { name: /add task/i });
      await user.click(saveButton);

      // Verify task appears
      await waitFor(() => {
        expect(screen.getByText('New Test Task')).toBeInTheDocument();
      });

      // Verify in database
      const tasks = await db.tasks.toArray();
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('New Test Task');
      expect(tasks[0].quadrant).toBe('urgent-important');
    });
  });

  describe('Task Editing', () => {
    beforeEach(async () => {
      await db.tasks.add({
        id: 'edit-task',
        title: 'Task to Edit',
        description: 'Original description',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      });
    });

    it('should edit an existing task', async () => {
      await renderWithProviders(<MatrixBoard />);

      // Find and click the edit button on the task
      const taskCard = await screen.findByText('Task to Edit');
      const card = taskCard.closest('article');
      expect(card).toBeTruthy();
      const editButton = within(card as HTMLElement).getByLabelText(/edit task/i);

      await user.click(editButton);

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByDisplayValue('Task to Edit')).toBeInTheDocument();
      });

      // Edit the title
      const titleInput = screen.getByDisplayValue('Task to Edit');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Task Title');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /update task/i });
      await user.click(saveButton);

      // Verify changes
      await waitFor(() => {
        expect(screen.getByText('Updated Task Title')).toBeInTheDocument();
        expect(screen.queryByText('Task to Edit')).not.toBeInTheDocument();
      });

      // Verify in database
      const task = await db.tasks.get('edit-task');
      expect(task?.title).toBe('Updated Task Title');
    });
  });

  describe('Task Completion', () => {
    beforeEach(async () => {
      await db.tasks.add({
        id: 'toggle-task',
        title: 'Task to Complete',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      });
    });

    it('should toggle task completion', async () => {
      await renderWithProviders(<MatrixBoard />);

      // Find the complete button
      const taskCard = await screen.findByText('Task to Complete');
      const card = taskCard.closest('article');
      expect(card).toBeTruthy();
      const completeButton = within(card as HTMLElement).getByRole('button', { name: /mark as complete/i });

      // Complete the task
      await user.click(completeButton);

      // Task should be hidden (default behavior)
      await waitFor(() => {
        expect(screen.queryByText('Task to Complete')).not.toBeInTheDocument();
      });

      // Verify in database
      const task = await db.tasks.get('toggle-task');
      expect(task?.completed).toBe(true);
      expect(task?.completedAt).toBeDefined();
    });
  });

  describe('Task Deletion', () => {
    beforeEach(async () => {
      await db.tasks.add({
        id: 'delete-task',
        title: 'Task to Delete',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      });
    });

    it('should delete a task', async () => {
      await renderWithProviders(<MatrixBoard />);

      // Find and click delete button
      const taskCard = await screen.findByText('Task to Delete');
      const card = taskCard.closest('article');
      expect(card).toBeTruthy();
      const deleteButton = within(card as HTMLElement).getByLabelText(/delete task/i);

      await user.click(deleteButton);

      // Task should disappear
      await waitFor(() => {
        expect(screen.queryByText('Task to Delete')).not.toBeInTheDocument();
      });

      // Verify in database
      const task = await db.tasks.get('delete-task');
      expect(task).toBeUndefined();
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      const tasks: TaskRecord[] = [
        {
          id: 'bulk-1',
          title: 'Bulk Task 1',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'bulk-2',
          title: 'Bulk Task 2',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
        {
          id: 'bulk-3',
          title: 'Bulk Task 3',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      await db.tasks.bulkAdd(tasks);
    });

    it('should enter selection mode when task is selected', async () => {
      await renderWithProviders(<MatrixBoard />);

      const selectionToggle = await screen.findByRole('button', { name: /select tasks/i });
      await user.click(selectionToggle);

      const taskCheckbox = await screen.findByRole('checkbox', { name: /select bulk task 1/i });
      await user.click(taskCheckbox);

      // Selection indicator should appear
      await waitFor(() => {
        expect(screen.getAllByText(/1 selected/i).length).toBeGreaterThan(0);
      });
    });

    it('should select multiple tasks', async () => {
      await renderWithProviders(<MatrixBoard />);

      const selectionToggle = await screen.findByRole('button', { name: /select tasks/i });
      await user.click(selectionToggle);

      // Select first task
      const task1Checkbox = await screen.findByRole('checkbox', { name: /select bulk task 1/i });
      await user.click(task1Checkbox);

      // Select second task
      const task2Checkbox = await screen.findByRole('checkbox', { name: /select bulk task 2/i });
      await user.click(task2Checkbox);

      // Should show 2 selected
      await waitFor(() => {
        expect(screen.getAllByText(/2 selected/i).length).toBeGreaterThan(0);
      });
    });

    it('should bulk delete selected tasks', async () => {
      await renderWithProviders(<MatrixBoard />);

      const selectionToggle = await screen.findByRole('button', { name: /select tasks/i });
      await user.click(selectionToggle);

      // Select tasks
      const task1Checkbox = await screen.findByRole('checkbox', { name: /select bulk task 1/i });
      const task2Checkbox = await screen.findByRole('checkbox', { name: /select bulk task 2/i });

      await user.click(task1Checkbox);
      await user.click(task2Checkbox);

      // Click bulk delete button
      const deleteButton = await screen.findByTitle(/delete selected tasks/i);
      await user.click(deleteButton);

      // Tasks should be deleted
      await waitFor(() => {
        expect(screen.queryByText('Bulk Task 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Bulk Task 2')).not.toBeInTheDocument();
        expect(screen.getByText('Bulk Task 3')).toBeInTheDocument();
      });

      // Verify in database
      const count = await db.tasks.count();
      expect(count).toBe(1);
    });

    it('should bulk complete selected tasks', async () => {
      await renderWithProviders(<MatrixBoard />);

      const selectionToggle = await screen.findByRole('button', { name: /select tasks/i });
      await user.click(selectionToggle);

      // Select tasks
      const task1Checkbox = await screen.findByRole('checkbox', { name: /select bulk task 1/i });
      const task2Checkbox = await screen.findByRole('checkbox', { name: /select bulk task 2/i });

      await user.click(task1Checkbox);
      await user.click(task2Checkbox);

      // Click bulk complete button
      const completeButton = await screen.findByTitle(/mark selected as complete/i);
      await user.click(completeButton);

      // Tasks should be hidden (completed)
      await waitFor(() => {
        expect(screen.queryByText('Bulk Task 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Bulk Task 2')).not.toBeInTheDocument();
      });

      // Verify in database
      const task1Data = await db.tasks.get('bulk-1');
      const task2Data = await db.tasks.get('bulk-2');

      expect(task1Data?.completed).toBe(true);
      expect(task2Data?.completed).toBe(true);
    });
  });

  describe('URL Parameters', () => {
    let originalUrl: string;

    beforeEach(() => {
      originalUrl = window.location.href;
    });

    afterEach(() => {
      window.history.replaceState({}, '', originalUrl);
    });

    it('should handle new task action from URL parameter', async () => {
      window.history.pushState({}, '', '/?action=new-task');

      await renderWithProviders(<MatrixBoard />);

      // New task dialog should open automatically
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create task/i })).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state with no tasks', async () => {
      await renderWithProviders(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText(/welcome to gsd task manager/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first task/i)).toBeInTheDocument();
      });
    });

    it('should show empty state when all tasks are filtered out', async () => {
      await db.tasks.add({
        id: 'task-1',
        title: 'JavaScript Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      });

      await renderWithProviders(<MatrixBoard />);

      // Search for non-existent term
      const searchInput = await screen.findByPlaceholderText(/search tasks/i);
      await user.type(searchInput, 'Python');

      await waitFor(() => {
        expect(screen.getByText(/no tasks match/i)).toBeInTheDocument();
      });
    });
  });
});
