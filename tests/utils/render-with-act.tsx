import { act, render } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

export async function renderWithAct(
  ui: ReactElement,
  options?: RenderOptions
): Promise<RenderResult> {
  let result: RenderResult;

  await act(async () => {
    result = render(ui, options);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return result!;
}
