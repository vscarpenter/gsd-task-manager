import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSmartViewShortcuts } from '@/lib/use-smart-view-shortcuts';
import type { SmartView } from '@/lib/filters';

function buildView(id: string, index: number): SmartView {
  return {
    id,
    name: `View ${index + 1}`,
    criteria: { searchQuery: `query-${id}` },
    isPinned: true,
    isBuiltIn: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  } as SmartView;
}

describe('useSmartViewShortcuts', () => {
  const onSelectView = vi.fn();
  const onClearView = vi.fn();
  const onActiveViewChange = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setup(views: SmartView[] = [buildView('v1', 0), buildView('v2', 1)]) {
    return renderHook(() =>
      useSmartViewShortcuts({ views, onSelectView, onClearView, onActiveViewChange }),
    );
  }

  it('should select a pinned view when pressing 1', () => {
    setup();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));

    expect(onSelectView).toHaveBeenCalledWith({ searchQuery: 'query-v1' });
    expect(onActiveViewChange).toHaveBeenCalledWith('v1');
  });

  it('should select the second view when pressing 2', () => {
    setup();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));

    expect(onSelectView).toHaveBeenCalledWith({ searchQuery: 'query-v2' });
    expect(onActiveViewChange).toHaveBeenCalledWith('v2');
  });

  it('should not trigger for out-of-range keys', () => {
    setup();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '9' }));

    expect(onSelectView).not.toHaveBeenCalled();
  });

  it('should clear view when pressing 0', () => {
    setup();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));

    expect(onClearView).toHaveBeenCalled();
    expect(onActiveViewChange).toHaveBeenCalledWith(null);
  });

  it('should not trigger when typing in an input', () => {
    setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(onSelectView).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('should not trigger when typing in a textarea', () => {
    setup();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    expect(onSelectView).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('should ignore non-number keys', () => {
    setup();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onSelectView).not.toHaveBeenCalled();
    expect(onClearView).not.toHaveBeenCalled();
  });

  it('should clean up event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = setup();

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});
