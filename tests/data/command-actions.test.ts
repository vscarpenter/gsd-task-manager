import { describe, it, expect, vi } from 'vitest';
import { buildCommandActions } from '@/lib/command-actions';
import type { CommandActionHandlers, CommandAction } from '@/lib/command-actions';
import type { FilterCriteria } from '@/lib/filters';

function createMockHandlers(overrides?: Partial<CommandActionHandlers>): CommandActionHandlers {
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
    ...overrides,
  };
}

const defaultConditions = {
  isSyncEnabled: false,
  selectionMode: false,
  hasSelection: false,
};

describe('buildCommandActions', () => {
  it('should return core actions with no smart views', () => {
    const actions = buildCommandActions(createMockHandlers(), [], defaultConditions);

    const actionIds = actions.map((a) => a.id);
    expect(actionIds).toContain('new-task');
    expect(actionIds).toContain('toggle-theme');
    expect(actionIds).toContain('export-tasks');
    expect(actionIds).toContain('import-tasks');
  });

  it('should include navigation actions', () => {
    const actions = buildCommandActions(createMockHandlers(), [], defaultConditions);

    const navActions = actions.filter((a) => a.section === 'navigation');
    const navIds = navActions.map((a) => a.id);
    expect(navIds).toContain('view-matrix');
    expect(navIds).toContain('view-dashboard');
    expect(navIds).toContain('view-archive');
  });

  it('should include settings actions', () => {
    const actions = buildCommandActions(createMockHandlers(), [], defaultConditions);

    const settingsIds = actions.filter((a) => a.section === 'settings').map((a) => a.id);
    expect(settingsIds).toContain('open-settings');
    expect(settingsIds).toContain('open-help');
  });

  it('should add smart view actions from builtInSmartViews', () => {
    const smartViews = [
      { id: 'overdue', name: 'Overdue', icon: '🔴', criteria: { status: 'active' } as FilterCriteria, description: 'Overdue tasks' },
      { id: 'today', name: 'Due Today', icon: '📅', criteria: { status: 'active' } as FilterCriteria },
    ];

    const actions = buildCommandActions(createMockHandlers(), smartViews, defaultConditions);

    const viewActions = actions.filter((a) => a.section === 'views');
    expect(viewActions).toHaveLength(2);
    expect(viewActions[0].id).toBe('view-overdue');
    expect(viewActions[1].id).toBe('view-today');
  });

  it('should include sync actions when sync is enabled', () => {
    const handlers = createMockHandlers({
      onTriggerSync: vi.fn(),
      onViewSyncHistory: vi.fn(),
    });
    const conditions = { ...defaultConditions, isSyncEnabled: true };

    const actions = buildCommandActions(handlers, [], conditions);

    const actionIds = actions.map((a) => a.id);
    expect(actionIds).toContain('sync-now');
    expect(actionIds).toContain('view-sync-history');
  });

  it('should not include sync actions when sync is disabled', () => {
    const handlers = createMockHandlers({
      onTriggerSync: vi.fn(),
      onViewSyncHistory: vi.fn(),
    });

    const actions = buildCommandActions(handlers, [], defaultConditions);

    const actionIds = actions.map((a) => a.id);
    expect(actionIds).not.toContain('sync-now');
    expect(actionIds).not.toContain('view-sync-history');
  });

  it('should include selection mode toggle when handler is provided', () => {
    const handlers = createMockHandlers({
      onToggleSelectionMode: vi.fn(),
    });

    const actions = buildCommandActions(handlers, [], defaultConditions);

    const selectionAction = actions.find((a) => a.id === 'toggle-selection-mode');
    expect(selectionAction).toBeDefined();
    expect(selectionAction!.label).toBe('Enter selection mode');
  });

  it('should show exit selection mode label when in selection mode', () => {
    const handlers = createMockHandlers({
      onToggleSelectionMode: vi.fn(),
    });
    const conditions = { ...defaultConditions, selectionMode: true };

    const actions = buildCommandActions(handlers, [], conditions);

    const selectionAction = actions.find((a) => a.id === 'toggle-selection-mode');
    expect(selectionAction!.label).toBe('Exit selection mode');
  });

  it('should include clear selection when in selection mode with active selection', () => {
    const handlers = createMockHandlers({
      onClearSelection: vi.fn(),
    });
    const conditions = { isSyncEnabled: false, selectionMode: true, hasSelection: true };

    const actions = buildCommandActions(handlers, [], conditions);

    const clearAction = actions.find((a) => a.id === 'clear-selection');
    expect(clearAction).toBeDefined();
  });

  it('should not include clear selection when not in selection mode', () => {
    const handlers = createMockHandlers({
      onClearSelection: vi.fn(),
    });

    const actions = buildCommandActions(handlers, [], defaultConditions);

    const clearAction = actions.find((a) => a.id === 'clear-selection');
    expect(clearAction).toBeUndefined();
  });

  it('should execute smart view handler with correct criteria', () => {
    const handlers = createMockHandlers();
    const criteria = { status: 'active' } as FilterCriteria;
    const smartViews = [
      { id: 'test-view', name: 'Test', criteria },
    ];

    const actions = buildCommandActions(handlers, smartViews, defaultConditions);
    const viewAction = actions.find((a) => a.id === 'view-test-view');
    viewAction!.onExecute();

    expect(handlers.onApplySmartView).toHaveBeenCalledWith(criteria, 'test-view');
  });

  it('should include keywords for search on all actions', () => {
    const actions = buildCommandActions(createMockHandlers(), [], defaultConditions);

    for (const action of actions) {
      expect(action.keywords.length).toBeGreaterThan(0);
    }
  });

  it('should use default icon for smart views without one', () => {
    const smartViews = [
      { id: 'no-icon', name: 'No Icon View', criteria: {} as FilterCriteria },
    ];

    const actions = buildCommandActions(createMockHandlers(), smartViews, defaultConditions);
    const viewAction = actions.find((a: CommandAction) => a.id === 'view-no-icon');
    expect(viewAction!.label).toContain('📋');
  });
});
