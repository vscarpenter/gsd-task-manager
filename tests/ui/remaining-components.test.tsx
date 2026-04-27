/**
 * Coverage gap-closing tests for uncovered components:
 * - FirstTimeRedirect (0%)
 * - ClientLayout (0%)
 * - MatrixSkeleton (0%)
 * - FilterPopover (31%)
 * - useTaskForm hook (32%)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

// --- Mocks ---

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => mockPathname,
}));

vi.mock('@/lib/sync/sync-provider', () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sync-provider">{children}</div>
  ),
}));

vi.mock('@/lib/hooks/use-sync-status', () => ({
  useSyncStatus: () => ({
    isSyncing: false,
    status: 'idle',
    error: null,
    lastResult: null,
    sync: vi.fn(),
    isAuthenticated: false,
  }),
}));


vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} className={className} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: vi.fn().mockImplementation((props: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) => {
    const { ref: _ref, ...rest } = props;
    return <input {...rest} />;
  }),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/tag-multiselect', () => ({
  TagMultiselect: ({ availableTags, selectedTags, onChange }: {
    availableTags: string[];
    selectedTags: string[];
    onChange: (tags: string[]) => void;
  }) => (
    <div data-testid="tag-multiselect">
      {availableTags.map(tag => (
        <button key={tag} onClick={() => onChange([...selectedTags, tag])}>{tag}</button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/filter-due-date', () => ({
  FilterDueDate: () => <div data-testid="filter-due-date" />,
}));

vi.mock('@/lib/quadrants', () => ({
  quadrants: [
    { id: 'urgent-important', title: 'Do First', colorClass: 'bg-red-500' },
    { id: 'not-urgent-important', title: 'Schedule', colorClass: 'bg-blue-500' },
    { id: 'urgent-not-important', title: 'Delegate', colorClass: 'bg-yellow-500' },
    { id: 'not-urgent-not-important', title: 'Eliminate', colorClass: 'bg-gray-500' },
  ],
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('lucide-react', () => ({
  PlusIcon: () => <span data-testid="plus-icon">+</span>,
  SearchIcon: () => <span data-testid="search-icon">S</span>,
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <span data-testid="chevron-icon" className={className}>v</span>
  ),
  SaveIcon: () => <span data-testid="save-icon">Save</span>,
}));

// --- Component Imports (after mocks) ---

import { FirstTimeRedirect } from '@/components/first-time-redirect';
import { ClientLayout } from '@/components/client-layout';
import { MatrixSkeleton } from '@/components/matrix-skeleton';
import { FilterPopover } from '@/components/filter-popover';
import { useTaskForm, defaultValues } from '@/components/task-form/use-task-form';
import type { FilterCriteria } from '@/lib/filters';

// --- FirstTimeRedirect Tests ---

describe('FirstTimeRedirect', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    localStorage.removeItem('gsd-has-launched');
    mockPathname = '/';
  });

  it('redirects to /about on first visit', () => {
    render(<FirstTimeRedirect />);

    expect(mockReplace).toHaveBeenCalledWith('/about');
  });

  it('sets localStorage flag on first visit', () => {
    render(<FirstTimeRedirect />);

    expect(localStorage.getItem('gsd-has-launched')).toBe('true');
  });

  it('does not redirect when localStorage flag exists', () => {
    localStorage.setItem('gsd-has-launched', 'true');

    render(<FirstTimeRedirect />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect when already on /about', () => {
    mockPathname = '/about';

    render(<FirstTimeRedirect />);

    // Flag is set but no redirect because we're already on /about
    expect(localStorage.getItem('gsd-has-launched')).toBe('true');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders null (no visible UI)', () => {
    const { container } = render(<FirstTimeRedirect />);

    expect(container.innerHTML).toBe('');
  });
});

// --- ClientLayout Tests ---

describe('ClientLayout', () => {
  it('renders children inside SyncProvider', () => {
    render(
      <ClientLayout>
        <div data-testid="child">Child Content</div>
      </ClientLayout>
    );

    expect(screen.getByTestId('sync-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('wraps children with sync provider', () => {
    render(
      <ClientLayout>
        <p>Test</p>
      </ClientLayout>
    );

    const syncProvider = screen.getByTestId('sync-provider');
    expect(syncProvider).toContainHTML('<p>Test</p>');
  });
});

// --- MatrixSkeleton Tests ---

describe('MatrixSkeleton', () => {
  it('renders the skeleton grid', () => {
    const { container } = render(<MatrixSkeleton />);

    const grid = container.querySelector('.matrix-grid');
    expect(grid).toBeInTheDocument();
  });

  it('renders four skeleton columns', () => {
    const { container } = render(<MatrixSkeleton />);

    const columns = container.querySelectorAll('.matrix-card');
    expect(columns.length).toBe(4);
  });

  it('renders skeleton elements', () => {
    render(<MatrixSkeleton />);

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('uses correct quadrant background classes', () => {
    const { container } = render(<MatrixSkeleton />);

    expect(container.querySelector('.bg-quadrant-focus')).toBeInTheDocument();
    expect(container.querySelector('.bg-quadrant-schedule')).toBeInTheDocument();
    expect(container.querySelector('.bg-quadrant-delegate')).toBeInTheDocument();
    expect(container.querySelector('.bg-quadrant-eliminate')).toBeInTheDocument();
  });
});

// --- FilterPopover Tests ---

describe('FilterPopover', () => {
  const defaultCriteria: FilterCriteria = {};
  const defaultFilterProps = {
    open: true,
    onOpenChange: vi.fn(),
    criteria: defaultCriteria,
    onChange: vi.fn(),
    availableTags: ['work', 'personal', 'urgent'],
  };

  beforeEach(() => {
    defaultFilterProps.onChange.mockClear();
    defaultFilterProps.onOpenChange.mockClear();
  });

  it('renders the Filters dialog title', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders Quadrants section with all four quadrants', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    expect(screen.getByText('Do First')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Delegate')).toBeInTheDocument();
    expect(screen.getByText('Eliminate')).toBeInTheDocument();
  });

  it('renders Status section with all/active/completed', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    expect(screen.getByText('all')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('renders Recurrence section with daily/weekly/monthly after expanding', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    // Recurrence section is collapsed by default — expand it
    fireEvent.click(screen.getByText('Recurrence'));

    expect(screen.getByText('daily')).toBeInTheDocument();
    expect(screen.getByText('weekly')).toBeInTheDocument();
    expect(screen.getByText('monthly')).toBeInTheDocument();
  });

  it('renders Done and Clear All buttons', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Done is clicked', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    fireEvent.click(screen.getByText('Done'));
    expect(defaultFilterProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onChange({}) when Clear All is clicked', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    fireEvent.click(screen.getByText('Clear All'));
    expect(defaultFilterProps.onChange).toHaveBeenCalledWith({});
  });

  it('toggles a quadrant when clicked', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    fireEvent.click(screen.getByText('Do First'));
    expect(defaultFilterProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ quadrants: ['urgent-important'] })
    );
  });

  it('removes a quadrant when clicked twice', () => {
    const propsWithQuadrant = {
      ...defaultFilterProps,
      criteria: { quadrants: ['urgent-important' as const] },
    };

    render(<FilterPopover {...propsWithQuadrant} />);

    fireEvent.click(screen.getByText('Do First'));
    expect(defaultFilterProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ quadrants: undefined })
    );
  });

  it('updates status when a status button is clicked', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    fireEvent.click(screen.getByText('active'));
    expect(defaultFilterProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
  });

  it('toggles recurrence when clicked', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    // Expand Recurrence section first (defaultOpen=false)
    fireEvent.click(screen.getByText('Recurrence'));

    fireEvent.click(screen.getByText('daily'));
    expect(defaultFilterProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ recurrence: ['daily'] })
    );
  });

  it('does not render when open is false', () => {
    render(<FilterPopover {...defaultFilterProps} open={false} />);

    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
  });

  it('renders Save View button when onSaveAsSmartView is provided and filters are active', () => {
    render(
      <FilterPopover
        {...defaultFilterProps}
        criteria={{ quadrants: ['urgent-important'] }}
        onSaveAsSmartView={vi.fn()}
      />
    );

    expect(screen.getByText('Save View')).toBeInTheDocument();
  });

  it('does not render Save View button when no active filters', () => {
    render(
      <FilterPopover
        {...defaultFilterProps}
        onSaveAsSmartView={vi.fn()}
      />
    );

    expect(screen.queryByText('Save View')).not.toBeInTheDocument();
  });

  it('calls onSaveAsSmartView and closes dialog when Save View is clicked', () => {
    const onSaveAsSmartView = vi.fn();

    render(
      <FilterPopover
        {...defaultFilterProps}
        criteria={{ quadrants: ['urgent-important'] }}
        onSaveAsSmartView={onSaveAsSmartView}
      />
    );

    fireEvent.click(screen.getByText('Save View'));
    expect(onSaveAsSmartView).toHaveBeenCalledOnce();
    expect(defaultFilterProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles collapsible section when title is clicked', () => {
    render(<FilterPopover {...defaultFilterProps} />);

    // The Quadrants section is open by default
    expect(screen.getByText('Do First')).toBeInTheDocument();

    // Click the Quadrants header to collapse it
    fireEvent.click(screen.getByText('Quadrants'));

    // After collapsing, the quadrant buttons should be hidden
    expect(screen.queryByText('Do First')).not.toBeInTheDocument();
  });
});

// --- useTaskForm Hook Tests ---

describe('useTaskForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnCancel.mockClear();
  });

  it('returns default values when no initialValues provided', () => {
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit: mockOnSubmit, onCancel: mockOnCancel })
    );

    expect(result.current.values.title).toBe('');
    expect(result.current.values.urgent).toBe(true);
    expect(result.current.values.important).toBe(true);
    expect(result.current.values.recurrence).toBe('none');
    expect(result.current.values.tags).toEqual([]);
  });

  it('returns custom initial values when provided', () => {
    const initialValues = {
      ...defaultValues,
      title: 'My Task',
      urgent: false,
      tags: ['work'],
    };

    const { result } = renderHook(() =>
      useTaskForm({ initialValues, onSubmit: mockOnSubmit, onCancel: mockOnCancel })
    );

    expect(result.current.values.title).toBe('My Task');
    expect(result.current.values.urgent).toBe(false);
    expect(result.current.values.tags).toEqual(['work']);
  });

  it('initializes with submitting false and no errors', () => {
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit: mockOnSubmit, onCancel: mockOnCancel })
    );

    expect(result.current.submitting).toBe(false);
    expect(result.current.errors).toEqual({});
  });

  it('updates a field value', () => {
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit: mockOnSubmit, onCancel: mockOnCancel })
    );

    act(() => {
      result.current.updateField('title', 'Updated Title');
    });

    expect(result.current.values.title).toBe('Updated Title');
  });

  it('updates urgent and important fields', () => {
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit: mockOnSubmit, onCancel: mockOnCancel })
    );

    act(() => {
      result.current.updateField('urgent', false);
      result.current.updateField('important', false);
    });

    expect(result.current.values.urgent).toBe(false);
    expect(result.current.values.important).toBe(false);
  });

  it('exports defaultValues with expected shape', () => {
    expect(defaultValues).toEqual({
      title: '',
      description: '',
      urgent: true,
      important: true,
      dueDate: undefined,
      recurrence: 'none',
      tags: [],
      subtasks: [],
      dependencies: [],
      notifyBefore: 15,
      notificationEnabled: true,
    });
  });

  it('initializes selectedTime from initialValues dueDate', () => {
    const initialValues = {
      ...defaultValues,
      dueDate: '2025-06-15T14:30:00.000Z',
    };

    const { result } = renderHook(() =>
      useTaskForm({ initialValues, onSubmit: mockOnSubmit, onCancel: mockOnCancel })
    );

    // selectedTime should be populated from the ISO date
    expect(result.current.selectedTime).toBeDefined();
  });

  it('returns a form instance', () => {
    const { result } = renderHook(() =>
      useTaskForm({ onSubmit: mockOnSubmit, onCancel: mockOnCancel })
    );

    expect(result.current.form).toBeDefined();
    expect(result.current.form.store).toBeDefined();
  });
});
