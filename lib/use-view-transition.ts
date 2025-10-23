'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

/**
 * Document interface with View Transitions API support check
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
 */
interface DocumentWithViewTransition {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
}

/**
 * Hook for navigating between routes with smooth View Transitions (React 19)
 *
 * Uses the View Transitions API for animated page changes. Falls back to
 * instant navigation on unsupported browsers (Firefox, older Safari).
 *
 * Browser support:
 * - ✅ Chrome/Edge 111+
 * - ✅ Safari 18+ (partial)
 * - ❌ Firefox (uses fallback)
 *
 * @returns Navigation utilities
 * @returns {Function} navigateWithTransition - Navigate to a route with animation
 * @returns {boolean} isPending - True during transition (for loading states)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { navigateWithTransition, isPending } = useViewTransition();
 *
 *   return (
 *     <button
 *       onClick={() => navigateWithTransition('/dashboard')}
 *       disabled={isPending}
 *     >
 *       Go to Dashboard
 *     </button>
 *   );
 * }
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
 */
export function useViewTransition() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigateWithTransition = <T extends string>(href: Route<T>) => {
    const doc = document as DocumentWithViewTransition;

    // View Transitions API provides smooth animations but lacks universal browser support.
    // Graceful degradation ensures all users can navigate, even without animations.
    if (!doc.startViewTransition) {
      router.push(href);
      return;
    }

    // Wrapping router.push in startTransition ensures React can batch updates
    // during the transition, preventing UI flickering and improving performance.
    doc.startViewTransition(() => {
      startTransition(() => {
        router.push(href);
      });
    });
  };

  return { navigateWithTransition, isPending };
}
