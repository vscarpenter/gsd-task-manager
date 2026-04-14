import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Command } from 'cmdk';
import { CommandActionItem, ShortcutDisplay } from '@/components/command-palette/command-item';
import { TaskItem } from '@/components/command-palette/task-item';
import { CommandGroup } from '@/components/command-palette/command-group';
import { CommandPalette } from '@/components/command-palette';
import { createMockTask } from '@/tests/fixtures';
import type { CommandAction, CommandActionHandlers } from '@/lib/command-actions';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/use-tasks', () => ({
  useTasks: () => ({ all: [] }),
}));

vi.mock('@/lib/smart-views', () => ({
  getSmartViews: vi.fn().mockResolvedValue([]),
}));

/**
 * Helper to wrap cmdk components in the required <Command> root
 */
function CommandWrapper({ children }: { children: React.ReactNode }) {
  return <Command>{children}</Command>;
}

function createAction(overrides?: Partial<CommandAction>): CommandAction {
  return {
    id: 'test',
    label: 'Test Action',
    section: 'actions',
    keywords: ['test'],
    onExecute: vi.fn(),
    ...overrides,
  };
}

describe('Command Palette Components', () => {
  describe('CommandActionItem', () => {
    it('renders action label', () => {
      const action = createAction({ id: 'test', label: 'Test Action' });

      render(
        <CommandWrapper>
          <CommandActionItem action={action} onSelect={vi.fn()} />
        </CommandWrapper>
      );

      expect(screen.getByText('Test Action')).toBeInTheDocument();
    });
  });

  describe('ShortcutDisplay', () => {
    it('renders keyboard shortcuts', () => {
      render(<ShortcutDisplay keys={['⌘', 'K']} />);

      expect(screen.getByText('⌘')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });
  });

  describe('TaskItem', () => {
    it('renders task title', () => {
      const task = createMockTask({ title: 'Buy groceries' });

      render(
        <CommandWrapper>
          <TaskItem task={task} onSelect={vi.fn()} />
        </CommandWrapper>
      );

      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    it('renders quadrant badge', () => {
      const task = createMockTask({
        quadrant: 'urgent-important',
      });

      render(
        <CommandWrapper>
          <TaskItem task={task} onSelect={vi.fn()} />
        </CommandWrapper>
      );

      // urgent-important => "UI" (first letter of each word uppercased)
      expect(screen.getByText('UI')).toBeInTheDocument();
    });

    it('renders tags', () => {
      const task = createMockTask({ tags: ['work', 'urgent'] });

      render(
        <CommandWrapper>
          <TaskItem task={task} onSelect={vi.fn()} />
        </CommandWrapper>
      );

      expect(screen.getByText('#work #urgent')).toBeInTheDocument();
    });
  });

  describe('CommandGroup', () => {
    it('renders heading and action items', () => {
      const actions = [
        createAction({ id: 'a1', label: 'First Action' }),
        createAction({ id: 'a2', label: 'Second Action' }),
      ];

      render(
        <CommandWrapper>
          <CommandGroup
            heading="Test Group"
            actions={actions}
            onExecute={vi.fn()}
          />
        </CommandWrapper>
      );

      expect(screen.getByText('Test Group')).toBeInTheDocument();
      expect(screen.getByText('First Action')).toBeInTheDocument();
      expect(screen.getByText('Second Action')).toBeInTheDocument();
    });

    it('renders nothing when actions array is empty', () => {
      const { container } = render(
        <CommandWrapper>
          <CommandGroup heading="Empty Group" actions={[]} onExecute={vi.fn()} />
        </CommandWrapper>
      );

      expect(screen.queryByText('Empty Group')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// Full CommandPalette component integration tests
// ============================================================================

// cmdk's Command.Dialog uses ResizeObserver internally; polyfill for jsdom
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// cmdk scrolls selected items into view; stub for jsdom
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function makeHandlers(): CommandActionHandlers {
  return {
    onNewTask: vi.fn(),
    onToggleTheme: vi.fn(),
    onExportTasks: vi.fn(),
    onImportTasks: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHelp: vi.fn(),
    onViewDashboard: vi.fn(),
    onViewMatrix: vi.fn(),
    onViewArchive: vi.fn(),
    onApplySmartView: vi.fn(),
  };
}

const defaultConditions = {
  isSyncEnabled: false,
  selectionMode: false,
  hasSelection: false,
};

describe('CommandPalette (full component)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing visible when closed by default', () => {
    render(<CommandPalette handlers={makeHandlers()} conditions={defaultConditions} />);

    expect(
      screen.queryByPlaceholderText('Search tasks, actions, settings...')
    ).not.toBeInTheDocument();
  });

  it('renders search input when opened via Cmd+K', async () => {
    render(<CommandPalette handlers={makeHandlers()} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search tasks, actions, settings...')
      ).toBeInTheDocument();
    });
  });

  it('renders search input when opened via Ctrl+K', async () => {
    render(<CommandPalette handlers={makeHandlers()} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search tasks, actions, settings...')
      ).toBeInTheDocument();
    });
  });

  it('filters action list when typing in the search input', async () => {
    const user = userEvent.setup();
    render(<CommandPalette handlers={makeHandlers()} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search tasks, actions, settings...')).toBeInTheDocument()
    );

    const input = screen.getByPlaceholderText('Search tasks, actions, settings...');
    await user.type(input, 'export');

    await waitFor(() => {
      expect(screen.getByText('Export tasks as JSON')).toBeInTheDocument();
    });
    expect(screen.queryByText('Create new task')).not.toBeInTheDocument();
  });

  it('shows "No results found." when nothing matches the search', async () => {
    const user = userEvent.setup();
    render(<CommandPalette handlers={makeHandlers()} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search tasks, actions, settings...')).toBeInTheDocument()
    );

    const input = screen.getByPlaceholderText('Search tasks, actions, settings...');
    await user.type(input, 'xyzxyzxyz');

    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });
  });

  it('closes the palette when Escape is pressed', async () => {
    render(<CommandPalette handlers={makeHandlers()} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search tasks, actions, settings...')).toBeInTheDocument()
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Search tasks, actions, settings...')
      ).not.toBeInTheDocument();
    });
  });

  it('calls the action handler when an action item is clicked', async () => {
    const user = userEvent.setup();
    const handlers = makeHandlers();
    render(<CommandPalette handlers={handlers} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByText('Create new task')).toBeInTheDocument());

    await user.click(screen.getByText('Create new task'));

    expect(handlers.onNewTask).toHaveBeenCalledTimes(1);
  });

  it('closes the palette after executing an action', async () => {
    const user = userEvent.setup();
    render(<CommandPalette handlers={makeHandlers()} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByText('Create new task')).toBeInTheDocument());

    await user.click(screen.getByText('Create new task'));

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Search tasks, actions, settings...')
      ).not.toBeInTheDocument();
    });
  });

  it('moves selection down with ArrowDown key', async () => {
    render(<CommandPalette handlers={makeHandlers()} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search tasks, actions, settings...')).toBeInTheDocument()
    );

    const input = screen.getByPlaceholderText('Search tasks, actions, settings...');
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => {
      const selectedItems = document.querySelectorAll('[data-selected], [aria-selected="true"]');
      expect(selectedItems.length).toBeGreaterThan(0);
    });
  });

  it('executes focused action when Enter is pressed', async () => {
    const handlers = makeHandlers();
    render(<CommandPalette handlers={handlers} conditions={defaultConditions} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search tasks, actions, settings...')).toBeInTheDocument()
    );

    const input = screen.getByPlaceholderText('Search tasks, actions, settings...');
    // Navigate to first item and execute it
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    // One of the action handlers should have been called
    await waitFor(() => {
      const allHandlers = [
        handlers.onNewTask,
        handlers.onToggleTheme,
        handlers.onExportTasks,
        handlers.onImportTasks,
        handlers.onOpenSettings,
        handlers.onOpenHelp,
        handlers.onViewDashboard,
        handlers.onViewMatrix,
        handlers.onViewArchive,
      ];
      const calledCount = allHandlers.filter(h => (h as ReturnType<typeof vi.fn>).mock.calls.length > 0).length;
      expect(calledCount).toBe(1);
    });
  });
});
