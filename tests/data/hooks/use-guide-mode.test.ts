import { renderHook, act } from '@testing-library/react';
import { useGuideMode } from '@/lib/hooks/use-guide-mode';

describe('useGuideMode', () => {
  it('defaults to wizard mode', () => {
    const { result } = renderHook(() => useGuideMode());

    expect(result.current.mode).toBe('wizard');
    expect(result.current.isWizard).toBe(true);
    expect(result.current.isAccordion).toBe(false);
  });

  it('accepts a custom default mode', () => {
    const { result } = renderHook(() => useGuideMode('accordion'));

    expect(result.current.mode).toBe('accordion');
    expect(result.current.isAccordion).toBe(true);
    expect(result.current.isWizard).toBe(false);
  });

  it('toggleMode switches between wizard and accordion', () => {
    const { result } = renderHook(() => useGuideMode());

    expect(result.current.mode).toBe('wizard');

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe('accordion');
    expect(result.current.isAccordion).toBe(true);
    expect(result.current.isWizard).toBe(false);

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe('wizard');
    expect(result.current.isWizard).toBe(true);
  });

  it('setMode sets a specific mode directly', () => {
    const { result } = renderHook(() => useGuideMode());

    expect(result.current.mode).toBe('wizard');

    act(() => {
      result.current.setMode('accordion');
    });

    expect(result.current.mode).toBe('accordion');

    act(() => {
      result.current.setMode('wizard');
    });

    expect(result.current.mode).toBe('wizard');
  });
});
