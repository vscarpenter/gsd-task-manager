import { render, screen } from '@testing-library/react';
import { Command } from 'cmdk';
import { CommandActionItem, ShortcutDisplay } from '@/components/command-palette/command-item';
import { TaskItem } from '@/components/command-palette/task-item';
import { CommandGroup } from '@/components/command-palette/command-group';
import { createMockTask } from '@/tests/fixtures';
import type { CommandAction } from '@/lib/command-actions';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
