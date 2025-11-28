"use client";

import { useState, useEffect, useCallback } from 'react';

/**
 * Common state management for dialog components
 *
 * Provides:
 * - Loading state for async operations
 * - Error state with clear function
 * - Mounted state for SSR hydration safety
 * - Reset function to clear all state
 */
export interface UseDialogStateResult {
  /** Whether an async operation is in progress */
  isLoading: boolean;
  /** Set loading state */
  setIsLoading: (loading: boolean) => void;
  /** Current error message, or null if no error */
  error: string | null;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Whether component has mounted (for SSR hydration) */
  mounted: boolean;
  /** Clear error state */
  clearError: () => void;
  /** Reset all state to initial values */
  reset: () => void;
}

/**
 * Hook for managing common dialog state
 *
 * @example
 * ```tsx
 * function MyDialog({ isOpen, onClose }) {
 *   const { isLoading, setIsLoading, error, setError, mounted, reset } = useDialogState();
 *
 *   // Reset state when dialog closes
 *   useEffect(() => {
 *     if (!isOpen) reset();
 *   }, [isOpen, reset]);
 *
 *   if (!mounted) return null;
 *
 *   return (
 *     <Dialog open={isOpen}>
 *       {error && <ErrorMessage>{error}</ErrorMessage>}
 *       <Button disabled={isLoading}>Submit</Button>
 *     </Dialog>
 *   );
 * }
 * ```
 */
export function useDialogState(): UseDialogStateResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Track component mount for SSR hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    isLoading,
    setIsLoading,
    error,
    setError,
    mounted,
    clearError,
    reset,
  };
}
