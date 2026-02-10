import { useEffect } from 'react';

import { useAppLifecycleStore } from '@/stores/app/app-lifecycle';

export const useAppLifecycle = () => {
  const appState = useAppLifecycleStore((state) => state.appState);
  const isActive = useAppLifecycleStore((state) => state.isActive);
  const isBackground = useAppLifecycleStore((state) => state.isBackground);
  const lastActiveTimestamp = useAppLifecycleStore((state) => state.lastActiveTimestamp);

  useEffect(() => {
    // You can add any side effects based on app state changes here
    // For example, you might want to pause/resume certain operations
    // when the app goes to background/foreground
  }, [appState]);

  return {
    appState,
    isActive,
    isBackground,
    lastActiveTimestamp,
  };
};
