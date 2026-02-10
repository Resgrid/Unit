import { useCallback, useMemo } from 'react';
import { create } from 'zustand';

interface LoadingState {
  /**
   * Map of loading states by key
   */
  loadingStates: Record<string, boolean>;

  /**
   * Set loading state for a specific key
   */
  setLoading: (key: string, isLoading: boolean) => void;

  /**
   * Toggle loading state for a specific key
   */
  toggleLoading: (key: string) => void;

  /**
   * Check if a specific key is loading
   */
  isLoading: (key: string) => boolean;

  /**
   * Reset all loading states
   */
  resetLoading: () => void;
}

export const useLoadingStore = create<LoadingState>((set, get) => ({
  loadingStates: {},

  setLoading: (key, isLoading) =>
    set((state) => ({
      loadingStates: {
        ...state.loadingStates,
        [key]: isLoading,
      },
    })),

  toggleLoading: (key) =>
    set((state) => ({
      loadingStates: {
        ...state.loadingStates,
        [key]: !state.loadingStates[key],
      },
    })),

  isLoading: (key) => get().loadingStates[key] || false,

  resetLoading: () => set({ loadingStates: {} }),
}));

/**
 * Hook to manage loading state for a specific key
 */
export const useLoading = (key: string) => {
  const setLoading = useLoadingStore((s) => s.setLoading);
  const toggleLoadingAction = useLoadingStore((s) => s.toggleLoading);
  const loading = useLoadingStore((s) => s.loadingStates[key] ?? false);

  const startLoading = useCallback(() => setLoading(key, true), [setLoading, key]);
  const stopLoading = useCallback(() => setLoading(key, false), [setLoading, key]);
  const toggleLoading = useCallback(() => toggleLoadingAction(key), [toggleLoadingAction, key]);

  return useMemo(
    () => ({
      isLoading: loading,
      startLoading,
      stopLoading,
      toggleLoading,
    }),
    [loading, startLoading, stopLoading, toggleLoading]
  );
};
