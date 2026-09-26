import * as Location from 'expo-location';

import { translate } from '@/lib/i18n/utils';
import { logger } from '@/lib/logging';
import { useLocationStore } from '@/stores/app/location-store';

/**
 * On-demand location fix, used when a unit status submission needs coordinates.
 *
 * The continuous watcher in `@/services/location` only runs once a unit has been selected and the
 * OS granted permission, and the store it feeds is deliberately not persisted. A submission
 * therefore cannot assume there is anything cached: it has to ask for a fix at the moment it needs
 * one, which is also what makes a `Gps`-required status enforceable.
 */
export type LocationFixOutcome = 'acquired' | 'permission-denied' | 'services-disabled' | 'unavailable';

export interface LocationFixResult {
  outcome: LocationFixOutcome;
  location: Location.LocationObject | null;
}

/**
 * `getCurrentPositionAsync` has no timeout of its own — indoors it can sit on the request until
 * the OS gives up, which on Android is effectively never. A submission must not hang behind it.
 */
const FIX_TIMEOUT_MS = 8000;

/** A fix from the last minute is a fine answer for "where are you now" and costs no radio time. */
const LAST_KNOWN_MAX_AGE_MS = 60 * 1000;

/**
 * Ceiling on reading what the OS already knows. Both calls are normally instant; the bound only
 * exists so a misbehaving platform call can never hold a status submission.
 */
const RECENT_READ_TIMEOUT_MS = 2000;

interface TimedFix<T> {
  promise: Promise<T | null>;
  cancel: () => void;
}

/**
 * Races a location call against a timer. The timer is cleared either way: leaving it pending keeps
 * a Jest fake-timer test from settling and, in the app, holds a needless reference for its duration.
 */
const withTimeout = <T>(work: Promise<T | null>, timeoutMs: number): TimedFix<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    promise: Promise.race([work, timeout]),
    cancel,
  };
};

const awaitWithTimeout = async <T>(work: Promise<T | null>, timeoutMs: number): Promise<T | null> => {
  const timed = withTimeout(work, timeoutMs);
  try {
    return await timed.promise;
  } finally {
    timed.cancel();
  }
};

const readCurrentPosition = (): Promise<Location.LocationObject | null> =>
  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch((error) => {
    logger.warn({
      message: 'Failed to acquire current position',
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    return null;
  });

const readLastKnown = async (): Promise<Location.LocationObject | null> => {
  try {
    return await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
  } catch (error) {
    logger.warn({
      message: 'Failed to read last known position',
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
};

/**
 * Ask for a position, prompting for permission if it has not been decided yet.
 *
 * `permission-denied` and `unavailable` are kept apart because they are different problems for the
 * crew to fix: one is a trip to the OS settings, the other is a move to open sky. A caller
 * enforcing a GPS-required status needs to say which.
 */
export const acquireLocationFix = async (): Promise<LocationFixResult> => {
  let permission: Location.LocationPermissionResponse;

  try {
    permission = await Location.getForegroundPermissionsAsync();

    // `canAskAgain` is false once the user has hard-denied; prompting again is a no-op that
    // returns the same denial, so skip straight to reporting it.
    if (permission.status !== 'granted' && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
  } catch (error) {
    logger.warn({
      message: 'Failed to resolve location permissions for fix',
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    return { outcome: 'permission-denied', location: null };
  }

  if (permission.status !== 'granted') {
    logger.info({
      message: 'Location fix requested without permission',
      context: { status: permission.status, canAskAgain: permission.canAskAgain },
    });
    return { outcome: 'permission-denied', location: null };
  }

  // Permission can be granted while the device's location services are switched off entirely; the
  // position call then fails in a way that looks identical to "no signal" unless we check.
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      logger.info({ message: 'Location services are disabled on the device' });
      return { outcome: 'services-disabled', location: null };
    }
  } catch (error) {
    // Treat an unanswerable services check as "probably fine" and let the position attempt decide.
    logger.warn({
      message: 'Failed to check whether location services are enabled',
      context: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  let location = await awaitWithTimeout(readCurrentPosition(), FIX_TIMEOUT_MS);

  // A timed-out live fix is common indoors. A recent cached one is still a truthful answer and is
  // far better than refusing a GPS-required status outright.
  if (!location) {
    location = await readLastKnown();
  }

  if (!location) {
    logger.info({ message: 'No location fix available for submission' });
    return { outcome: 'unavailable', location: null };
  }

  // Feed the store so the map and anything else reading it benefit from the fix we just paid for.
  // A store write is a side benefit, not the point of the call: if it throws, the caller still has
  // a real fix and a GPS-required status must not be refused over it.
  try {
    useLocationStore.getState().setLocation(location);
  } catch (error) {
    logger.warn({
      message: 'Failed to write acquired location fix to the store',
      context: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  return { outcome: 'acquired', location };
};

/**
 * A position for a status that does not require GPS: whatever the OS already holds from the last
 * minute, or null.
 *
 * Unlike `acquireLocationFix` this never prompts for permission and never waits on the radio. A
 * live fix can take the full `FIX_TIMEOUT_MS` indoors, and making every status wait that long for
 * coordinates it does not need is how crews ended up with a sheet spinning on "Submitting".
 */
export const readRecentLocation = async (): Promise<Location.LocationObject | null> => {
  const read = async (): Promise<Location.LocationObject | null> => {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return null;
    }

    return Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
  };

  try {
    return await awaitWithTimeout(read(), RECENT_READ_TIMEOUT_MS);
  } catch (error) {
    logger.warn({
      message: 'Failed to read recent location for status',
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
};

const FIX_ERROR_KEYS = {
  'permission-denied': 'location.fix_permission_denied',
  'services-disabled': 'location.fix_services_disabled',
  unavailable: 'location.fix_unavailable',
} as const;

const FIX_ERROR_FALLBACKS: Record<Exclude<LocationFixOutcome, 'acquired'>, string> = {
  'permission-denied': 'Location permission is required. Enable location access in your device settings and try again.',
  'services-disabled': 'Location services are turned off. Turn them on in your device settings and try again.',
  unavailable: 'Could not get a location fix. Move to an area with a clearer view of the sky and try again.',
};

/**
 * Message for a failed fix, naming the specific obstacle. "GPS is required for this status" leaves
 * the responder guessing; "turn location services on" tells them what to do about it.
 */
export const getLocationFixErrorMessage = (outcome: Exclude<LocationFixOutcome, 'acquired'>): string => {
  const key = FIX_ERROR_KEYS[outcome];
  const message = translate(key);
  return typeof message === 'string' && message.length > 0 && message !== key ? message : FIX_ERROR_FALLBACKS[outcome];
};
