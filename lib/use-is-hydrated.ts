"use client";

import { useSyncExternalStore } from "react";

const subscribe = (): (() => void) => () => {};

/** Match the server snapshot on the first client render, then expose hydration
 * without a state-setting effect. Useful for browser-owned preferences such as
 * next-themes that cannot be known during the static export. */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
