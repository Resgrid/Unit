import React from 'react';
import { useMMKVBoolean } from 'react-native-mmkv';

import { logger } from '../logging';
import { storage } from '../storage';

const BACKGROUND_GEOLOCATION_ENABLED = 'BACKGROUND_GEOLOCATION_ENABLED';

/**
 * Hook for managing background geolocation functionality
 * This hook will return the background geolocation state which is stored in MMKV
 * When enabled, location tracking will continue when the app is backgrounded
 */
export const useBackgroundGeolocation = () => {
  const [backgroundGeolocationEnabled, _setBackgroundGeolocationEnabled] = useMMKVBoolean(BACKGROUND_GEOLOCATION_ENABLED, storage);

  const setBackgroundGeolocationEnabled = React.useCallback(
    async (enabled: boolean) => {
      try {
        _setBackgroundGeolocationEnabled(enabled);
        logger.info({
          message: `Background geolocation ${enabled ? 'enabled' : 'disabled'}`,
          context: { enabled },
        });
      } catch (error) {
        logger.error({
          message: 'Failed to update background geolocation state',
          context: { error, enabled },
        });
        throw error;
      }
    },
    [_setBackgroundGeolocationEnabled]
  );

  const isBackgroundGeolocationEnabled = backgroundGeolocationEnabled ?? false;
  return { isBackgroundGeolocationEnabled, setBackgroundGeolocationEnabled } as const;
};

// Function to be used in the root file to load the background geolocation state from MMKV on app startup
export const loadBackgroundGeolocationState = async () => {
  try {
    const backgroundGeolocationEnabled = storage.getBoolean(BACKGROUND_GEOLOCATION_ENABLED);
    logger.info({
      message: 'Background geolocation state loaded on startup',
      context: { enabled: backgroundGeolocationEnabled },
    });
    return backgroundGeolocationEnabled ?? false;
  } catch (error) {
    logger.error({
      message: 'Failed to load background geolocation state on startup',
      context: { error },
    });
    return false;
  }
};
