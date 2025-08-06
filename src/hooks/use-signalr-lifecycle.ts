import { useCallback, useEffect, useRef } from 'react';

import { logger } from '@/lib/logging';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { useAppLifecycle } from './use-app-lifecycle';

interface UseSignalRLifecycleOptions {
  isSignedIn: boolean;
  hasInitialized: boolean;
}

export function useSignalRLifecycle({ isSignedIn, hasInitialized }: UseSignalRLifecycleOptions) {
  const { isActive, appState } = useAppLifecycle();
  const signalRStore = useSignalRStore();
  const lastAppState = useRef<string | null>(null);
  const isProcessing = useRef(false);
  const pendingOperations = useRef<AbortController | null>(null);

  const handleAppBackground = useCallback(async () => {
    if (!isSignedIn || !hasInitialized || isProcessing.current) return;

    // Cancel any pending operations
    if (pendingOperations.current) {
      pendingOperations.current.abort();
    }

    isProcessing.current = true;
    const controller = new AbortController();
    pendingOperations.current = controller;

    logger.info({
      message: 'App going to background, disconnecting SignalR',
    });

    try {
      // Use Promise.allSettled to prevent one failure from blocking the other
      const results = await Promise.allSettled([signalRStore.disconnectUpdateHub(), signalRStore.disconnectGeolocationHub()]);

      // Log any failures without throwing
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const hubName = index === 0 ? 'UpdateHub' : 'GeolocationHub';
          logger.error({
            message: `Failed to disconnect ${hubName} on app background`,
            context: { error: result.reason },
          });
        }
      });
    } catch (error) {
      logger.error({
        message: 'Unexpected error during SignalR disconnect on app background',
        context: { error },
      });
    } finally {
      if (controller === pendingOperations.current) {
        isProcessing.current = false;
        pendingOperations.current = null;
      }
    }
  }, [isSignedIn, hasInitialized, signalRStore]);

  const handleAppResume = useCallback(async () => {
    if (!isSignedIn || !hasInitialized || isProcessing.current) return;

    // Cancel any pending operations
    if (pendingOperations.current) {
      pendingOperations.current.abort();
    }

    isProcessing.current = true;
    const controller = new AbortController();
    pendingOperations.current = controller;

    logger.info({
      message: 'App resumed from background, reconnecting SignalR',
    });

    try {
      // Use Promise.allSettled to prevent one failure from blocking the other
      const results = await Promise.allSettled([signalRStore.connectUpdateHub(), signalRStore.connectGeolocationHub()]);

      // Log any failures without throwing
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const hubName = index === 0 ? 'UpdateHub' : 'GeolocationHub';
          logger.error({
            message: `Failed to reconnect ${hubName} on app resume`,
            context: { error: result.reason },
          });
        }
      });
    } catch (error) {
      logger.error({
        message: 'Unexpected error during SignalR reconnect on app resume',
        context: { error },
      });
    } finally {
      if (controller === pendingOperations.current) {
        isProcessing.current = false;
        pendingOperations.current = null;
      }
    }
  }, [isSignedIn, hasInitialized, signalRStore]);

  // Handle app going to background
  useEffect(() => {
    if (!isActive && (appState === 'background' || appState === 'inactive') && hasInitialized) {
      // Debounce rapid state changes
      const timer = setTimeout(() => {
        if (!isActive && (appState === 'background' || appState === 'inactive')) {
          handleAppBackground();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isActive, appState, hasInitialized, handleAppBackground]);

  // Handle app resuming from background
  useEffect(() => {
    if (isActive && appState === 'active' && hasInitialized && lastAppState.current !== 'active') {
      // Only reconnect if coming from background/inactive state
      if (lastAppState.current === 'background' || lastAppState.current === 'inactive') {
        const timer = setTimeout(() => {
          // Double-check state before reconnecting
          if (isActive && appState === 'active') {
            handleAppResume();
          }
        }, 500); // Small delay to prevent multiple rapid calls

        return () => clearTimeout(timer);
      }
    }

    lastAppState.current = appState;
  }, [isActive, appState, hasInitialized, handleAppResume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingOperations.current) {
        pendingOperations.current.abort();
        pendingOperations.current = null;
      }
      isProcessing.current = false;
    };
  }, []);

  return {
    isActive,
    appState,
    handleAppBackground,
    handleAppResume,
  };
}
