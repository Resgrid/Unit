import React from 'react';
import { useMMKVBoolean } from 'react-native-mmkv';

import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { logger } from '../logging';
import { storage } from '../storage';
import { getDefaultRealtimeGeolocationState, getRealtimeGeolocationStorageKey, saveRealtimeGeolocationState } from '../storage/realtime-geolocation';

// Define a type for the location service update function
type LocationServiceRealtimeUpdater = (enabled: boolean) => Promise<void>;

// Global variable to hold the location service update function
let locationServiceRealtimeUpdater: LocationServiceRealtimeUpdater | null = null;

/**
 * Register the location service realtime updater function
 * This should be called from the location service to register its update function
 */
export const registerLocationServiceRealtimeUpdater = (updater: LocationServiceRealtimeUpdater) => {
  locationServiceRealtimeUpdater = updater;
};

/**
 * Hook for managing realtime geolocation functionality.
 *
 * Governs whether this unit's position is transmitted while the app is in the foreground, and
 * whether the app is subscribed to the geolocation hub for other units' positions. Background
 * transmission is a separate setting — see `useBackgroundGeolocation`.
 */
export const useRealtimeGeolocation = () => {
  const [realtimeGeolocationEnabled, _setRealtimeGeolocationEnabled] = useMMKVBoolean(getRealtimeGeolocationStorageKey(), storage);

  const isGeolocationHubConnected = useSignalRStore((state) => state.isGeolocationHubConnected);
  const connectGeolocationHub = useSignalRStore((state) => state.connectGeolocationHub);
  const disconnectGeolocationHub = useSignalRStore((state) => state.disconnectGeolocationHub);

  const setRealtimeGeolocationEnabled = React.useCallback(
    async (enabled: boolean) => {
      try {
        _setRealtimeGeolocationEnabled(enabled);
        saveRealtimeGeolocationState(enabled);

        // Update the location service if the updater is registered
        if (locationServiceRealtimeUpdater) {
          await locationServiceRealtimeUpdater(enabled);
        }

        // Connect or disconnect from the SignalR geolocation hub
        if (enabled) {
          await connectGeolocationHub();
        } else {
          await disconnectGeolocationHub();
        }

        logger.info({
          message: `Realtime geolocation ${enabled ? 'enabled' : 'disabled'}`,
          context: { enabled, hubConnected: isGeolocationHubConnected },
        });
      } catch (error) {
        logger.error({
          message: 'Failed to update realtime geolocation state',
          context: { error, enabled },
        });
        throw error;
      }
    },
    [_setRealtimeGeolocationEnabled, connectGeolocationHub, disconnectGeolocationHub, isGeolocationHubConnected]
  );

  // `useMMKVBoolean` answers undefined for a key that has never been written, which is every unit
  // upgrading into this setting. Those units must read as enabled, not as switched off.
  const isRealtimeGeolocationEnabled = realtimeGeolocationEnabled ?? getDefaultRealtimeGeolocationState();

  return {
    isRealtimeGeolocationEnabled,
    setRealtimeGeolocationEnabled,
    isGeolocationHubConnected,
  } as const;
};
