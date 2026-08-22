import { logger } from '../logging';
import { storage } from './index';

const REALTIME_GEOLOCATION_ENABLED = 'REALTIME_GEOLOCATION_ENABLED';

/**
 * Unlike Responder, this setting defaults to ON.
 *
 * Before it existed, the Unit app transmitted the apparatus position on every foreground fix with
 * no way to switch it off, and dispatch AVL is the reason the app is mounted in the vehicle at all.
 * Defaulting the new toggle to OFF would silently take every already-installed unit off dispatch's
 * map on upgrade — a safety regression, not a preference change. Units that want to stop
 * transmitting now have a switch; everyone else keeps the behaviour they already had.
 */
const DEFAULT_REALTIME_GEOLOCATION_ENABLED = true;

/**
 * Load realtime geolocation state from MMKV storage
 * This function is used in the location service to avoid circular dependencies
 */
export const loadRealtimeGeolocationState = async (): Promise<boolean> => {
  try {
    const realtimeGeolocationEnabled = storage.getBoolean(REALTIME_GEOLOCATION_ENABLED);
    logger.info({
      message: 'Realtime geolocation state loaded on startup',
      context: { enabled: realtimeGeolocationEnabled },
    });
    return realtimeGeolocationEnabled ?? DEFAULT_REALTIME_GEOLOCATION_ENABLED;
  } catch (error) {
    logger.error({
      message: 'Failed to load realtime geolocation state on startup',
      context: { error },
    });
    // A read that threw says nothing about the user's choice. Answering `false` here would stop a
    // unit transmitting because of a storage hiccup, so fall back to the safe default.
    return DEFAULT_REALTIME_GEOLOCATION_ENABLED;
  }
};

/**
 * Save realtime geolocation state to MMKV storage
 */
export const saveRealtimeGeolocationState = (enabled: boolean): void => {
  storage.set(REALTIME_GEOLOCATION_ENABLED, enabled);
};

/**
 * Get the storage key for realtime geolocation
 */
export const getRealtimeGeolocationStorageKey = (): string => {
  return REALTIME_GEOLOCATION_ENABLED;
};

/**
 * The value to use when the key has never been written.
 */
export const getDefaultRealtimeGeolocationState = (): boolean => DEFAULT_REALTIME_GEOLOCATION_ENABLED;
