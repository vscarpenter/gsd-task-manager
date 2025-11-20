import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatrixBoard } from '@/components/matrix-board';
import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';

// Mock next-themes
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

// Mock notification checker
vi.mock('@/lib/notification-checker', () => ({
  notificationChecker: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

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
      render(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
      });
    });

    it('should render all four quadrants', async () => {
      render(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText(/urgent & important/i)).toBeInTheDocument();
        expect(screen.getByText(/not urgent & important/i)).toBeInTheDocument();
        expect(screen.getByText(/urgent & not important/i)).toBeInTheDocument();
        expect(screen.getByText(/not urgent & not important/i)).toBeInTheDocument();
      });
    });

    it('should render app header with controls', async () => {
      render(<MatrixBoard />);

      await waitFor(() => {
        // Search should be present
        expect(screen.getByPlaceholderText(/search tasks/i)).toBeInTheDocument();

        // New task button should be present
        expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
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
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: ['work'],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
        {
          id: 'task-2',
          title: 'Not Urgent Important Task',
          description: 'Plan for this',
          urgent: false,
          important: true,
          quadrant: 'not-urgent-important',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: ['personal'],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
      ];

      await db.tasks.bulkAdd(tasks);
    });

    it('should display tasks in correct quadrants', async () => {
      render(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText('Urgent Important Task')).toBeInTheDocument();
        expect(screen.getByText('Not Urgent Important Task')).toBeInTheDocument();
      });
    });

    it('should show task tags', async () => {
      render(<MatrixBoard />);

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
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {},
      });

      render(<MatrixBoard />);

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
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: ['coding', 'javascript'],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
        {
          id: 'task-2',
          title: 'Python Script',
          description: 'Automate deployment',
          urgent: false,
          important: true,
          quadrant: 'not-urgent-important',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: ['coding', 'python'],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
        {
          id: 'task-3',
          title: 'Meeting Notes',
          description: 'Review weekly standup',
          urgent: false,
          important: false,
          quadrant: 'not-urgent-not-important',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: ['meetings'],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
      ];

      await db.tasks.bulkAdd(tasks);
    });

    it('should filter tasks by title', async () => {
      render(<MatrixBoard />);

      const searchInput = await screen.findByPlaceholderText(/search tasks/i);

      await user.type(searchInput, 'JavaScript');

      await waitFor(() => {
        expect(screen.getByText('JavaScript Project')).toBeInTheDocument();
        expect(screen.queryByText('Python Script')).not.toBeInTheDocument();
        expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
      });
    });

    it('should filter tasks by description', async () => {
      render(<MatrixBoard />);

      const searchInput = await screen.findByPlaceholderText(/search tasks/i);

      await user.type(searchInput, 'deployment');

      await waitFor(() => {
        expect(screen.getByText('Python Script')).toBeInTheDocument();
        expect(screen.queryByText('JavaScript Project')).not.toBeInTheDocument();
      });
    });

    it('should filter tasks by tags', async () => {
      render(<MatrixBoard />);

      const searchInput = await screen.findByPlaceholderText(/search tasks/i);

      await user.type(searchInput, 'python');

      await waitFor(() => {
        expect(screen.getByText('Python Script')).toBeInTheDocument();
      });
    });

    it('should clear search results when search is cleared', async () => {
      render(<MatrixBoard />);

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
      render(<MatrixBoard />);

      await user.keyboard('n');

      await waitFor(() => {
        expect(screen.getByText(/create new task/i)).toBeInTheDocument();
      });
    });

    it('should focus search input with "/" key', async () => {
      render(<MatrixBoard />);

      await user.keyboard('/');

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search tasks/i);
        expect(searchInput).toHaveFocus();
      });
    });

    it('should open help dialog with "?" key', async () => {
      render(<MatrixBoard />);

      await user.keyboard('?');

      await waitFor(() => {
        // Help dialog should be visible
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Task Creation', () => {
    it('should create a new task', async () => {
      render(<MatrixBoard />);

      const newTaskButton = await screen.findByRole('button', { name: /new task/i });
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

      // Mark as urgent and important
      const urgentCheckbox = screen.getByLabelText(/urgent/i);
      const importantCheckbox = screen.getByLabelText(/important/i);

      await user.click(urgentCheckbox);
      await user.click(importantCheckbox);

      // Submit the form
      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

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
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {},
      });
    });

    it('should edit an existing task', async () => {
      render(<MatrixBoard />);

      // Find and click the edit button on the task
      const taskCard = await screen.findByText('Task to Edit');
      const editButton = within(taskCard.closest('[data-task-card]')!).getByLabelText(/edit/i);

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
      const saveButton = screen.getByRole('button', { name: /save/i });
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {},
      });
    });

    it('should toggle task completion', async () => {
      render(<MatrixBoard />);

      // Find the complete checkbox
      const taskCard = await screen.findByText('Task to Complete');
      const checkbox = within(taskCard.closest('[data-task-card]')!).getByRole('checkbox');

      // Complete the task
      await user.click(checkbox);

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
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {},
      });
    });

    it('should delete a task', async () => {
      render(<MatrixBoard />);

      // Find and click delete button
      const taskCard = await screen.findByText('Task to Delete');
      const deleteButton = within(taskCard.closest('[data-task-card]')!).getByLabelText(/delete/i);

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
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
        {
          id: 'bulk-2',
          title: 'Bulk Task 2',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
        {
          id: 'bulk-3',
          title: 'Bulk Task 3',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
      ];

      await db.tasks.bulkAdd(tasks);
    });

    it('should enter selection mode when task is selected', async () => {
      render(<MatrixBoard />);

      // Click on first task to select it
      const task1 = await screen.findByText('Bulk Task 1');
      const taskCard = task1.closest('[data-task-card]')!;

      await user.click(taskCard);

      // Selection indicator should appear
      await waitFor(() => {
        expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
      });
    });

    it('should select multiple tasks', async () => {
      render(<MatrixBoard />);

      // Select first task
      const task1 = await screen.findByText('Bulk Task 1');
      await user.click(task1.closest('[data-task-card]')!);

      // Select second task
      const task2 = await screen.findByText('Bulk Task 2');
      await user.click(task2.closest('[data-task-card]')!);

      // Should show 2 selected
      await waitFor(() => {
        expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
      });
    });

    it('should bulk delete selected tasks', async () => {
      render(<MatrixBoard />);

      // Select tasks
      const task1 = await screen.findByText('Bulk Task 1');
      const task2 = await screen.findByText('Bulk Task 2');

      await user.click(task1.closest('[data-task-card]')!);
      await user.click(task2.closest('[data-task-card]')!);

      // Click bulk delete button
      const deleteButton = await screen.findByRole('button', { name: /delete/i });
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
      render(<MatrixBoard />);

      // Select tasks
      const task1 = await screen.findByText('Bulk Task 1');
      const task2 = await screen.findByText('Bulk Task 2');

      await user.click(task1.closest('[data-task-card]')!);
      await user.click(task2.closest('[data-task-card]')!);

      // Click bulk complete button
      const completeButton = await screen.findByRole('button', { name: /complete/i });
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
    it('should handle new task action from URL parameter', async () => {
      // Mock window.location.search
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          search: '?action=new-task',
        },
        writable: true,
      });

      render(<MatrixBoard />);

      // New task dialog should open automatically
      await waitFor(() => {
        expect(screen.getByText(/create new task/i)).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state with no tasks', async () => {
      render(<MatrixBoard />);

      await waitFor(() => {
        expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
        expect(screen.getByText(/get started by creating your first task/i)).toBeInTheDocument();
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {},
      });

      render(<MatrixBoard />);

      // Search for non-existent term
      const searchInput = await screen.findByPlaceholderText(/search tasks/i);
      await user.type(searchInput, 'Python');

      await waitFor(() => {
        expect(screen.getByText(/no matching tasks found/i)).toBeInTheDocument();
      });
    });
  });
});
