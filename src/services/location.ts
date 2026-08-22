import axios from 'axios';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, type AppStateStatus } from 'react-native';

import { setUnitLocation } from '@/api/units/unitLocation';
import { registerLocationServiceUpdater } from '@/lib/hooks/use-background-geolocation';
import { registerLocationServiceRealtimeUpdater } from '@/lib/hooks/use-realtime-geolocation';
import { translate } from '@/lib/i18n/utils';
import { logger } from '@/lib/logging';
import { isWeb } from '@/lib/platform';
import { loadBackgroundGeolocationState } from '@/lib/storage/background-geolocation';
import { loadRealtimeGeolocationState, saveRealtimeGeolocationState } from '@/lib/storage/realtime-geolocation';
import { SaveUnitLocationInput } from '@/models/v4/unitLocation/saveUnitLocationInput';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { isNetworkError } from '@/utils/network';

const LOCATION_TASK_NAME = 'location-updates';

// A 4xx from SetUnitLocation is deterministic: the same unit sending the same
// shape of payload will be rejected again on the next fix. Foreground updates
// arrive every 15s, so without a backoff a single rejected unit produces a
// failed request — and a log line — indefinitely.
const REJECTION_BACKOFF_BASE_MS = 30 * 1000;
const REJECTION_BACKOFF_MAX_MS = 15 * 60 * 1000;

/**
 * Options for the OS-managed background task.
 *
 * `deferredUpdates*` is the significant battery lever on Android: it lets the OS collect fixes
 * while the screen is off and hand them over in one batch, instead of waking the JS runtime for
 * every individual fix. iOS ignores it.
 *
 * `pausesUpdatesAutomatically` is deliberately false. iOS will otherwise stop updates once it
 * decides the device has been stationary for a while and only resume on significant motion — an
 * apparatus parked at a scene would drop off dispatch's map and stay off it.
 *
 * `activityType` is AutomotiveNavigation here (Responder uses Other): this app runs on a
 * vehicle-mounted device, and telling iOS so lets it tune the GPS duty cycle for road travel.
 */
const getBackgroundTaskOptions = (): Location.LocationTaskOptions => ({
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 15000,
  distanceInterval: 10,
  deferredUpdatesInterval: 30000,
  deferredUpdatesDistance: 25,
  pausesUpdatesAutomatically: false,
  activityType: Location.LocationActivityType.AutomotiveNavigation,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: translate('location.tracking_notification_title'),
    notificationBody: translate('location.tracking_notification_body'),
  },
});

let rejectedUnitId: string | null = null;
let consecutiveRejections = 0;
let nextAttemptAtMs = 0;

const resetRejectionBackoff = (): void => {
  rejectedUnitId = null;
  consecutiveRejections = 0;
  nextAttemptAtMs = 0;
};

/**
 * iOS reports -1 for course, speed and the accuracy fields when the value is
 * unavailable — a stationary unit (parked at the station, screen off) reports
 * it on every single fix. Returns undefined for those sentinels so they are
 * never sent to the API or queued for offline replay.
 */
const nonNegativeOrUndefined = (value: number | null | undefined): number | undefined => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined);

/**
 * Post a fix to the unit-location endpoint.
 *
 * `isTransmissionEnabled` is resolved by the caller because which setting governs a fix depends on
 * where it came from: a foreground fix is governed by Realtime Geolocation, a background one by
 * Background Geolocation. Deciding it here would collapse two independent settings into one.
 */
const sendLocationToAPI = async (location: Location.LocationObject, isTransmissionEnabled: boolean): Promise<void> => {
  if (!isTransmissionEnabled) {
    logger.debug({
      message: 'Location transmission disabled for this fix, skipping API call',
    });
    return;
  }

  const { activeUnitId } = useCoreStore.getState();
  try {
    if (!activeUnitId) {
      logger.warn({
        message: 'No active unit selected, skipping location API call',
      });
      return;
    }

    // A rejection only tells us about the unit it was recorded for; switching
    // units is a fresh start.
    if (rejectedUnitId !== null && rejectedUnitId !== activeUnitId) {
      resetRejectionBackoff();
    }

    if (nextAttemptAtMs > Date.now()) {
      logger.debug({
        message: 'Skipping location API call while backing off after server rejection',
        context: { unitId: activeUnitId, consecutiveRejections, nextAttemptAtMs },
      });
      return;
    }

    const { latitude, longitude, altitude, accuracy, altitudeAccuracy, speed, heading } = location.coords;

    const locationInput = new SaveUnitLocationInput();
    locationInput.UnitId = activeUnitId;
    locationInput.Timestamp = new Date(location.timestamp).toISOString();
    locationInput.Latitude = latitude.toString();
    locationInput.Longitude = longitude.toString();
    locationInput.Accuracy = nonNegativeOrUndefined(accuracy)?.toString() ?? '0';
    // Altitude is legitimately negative below sea level, so only non-finite
    // values are replaced.
    locationInput.Altitude = typeof altitude === 'number' && Number.isFinite(altitude) ? altitude.toString() : '0';
    locationInput.AltitudeAccuracy = nonNegativeOrUndefined(altitudeAccuracy)?.toString() ?? '0';
    locationInput.Speed = nonNegativeOrUndefined(speed)?.toString() ?? '0';
    locationInput.Heading = nonNegativeOrUndefined(heading)?.toString() ?? '0';

    const result = await setUnitLocation(locationInput);

    resetRejectionBackoff();

    logger.info({
      message: 'Location successfully sent to API',
      context: {
        unitId: activeUnitId,
        resultId: result.Id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
    });
  } catch (error) {
    // The axios message is only "Request failed with status code 400"; without
    // the status and response body there is no way to tell why the server
    // rejected the payload.
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;

    logger.warn({
      message: 'Failed to send location to API',
      context: {
        error: error instanceof Error ? error.message : String(error),
        ...(status !== undefined ? { status, response: axios.isAxiosError(error) ? error.response?.data : undefined } : {}),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
    });

    if (status !== undefined && status >= 400 && status < 500 && activeUnitId) {
      rejectedUnitId = activeUnitId;
      consecutiveRejections += 1;
      const backoffMs = Math.min(REJECTION_BACKOFF_BASE_MS * 2 ** (consecutiveRejections - 1), REJECTION_BACKOFF_MAX_MS);
      nextAttemptAtMs = Date.now() + backoffMs;

      logger.warn({
        message: 'Backing off location updates after server rejection',
        context: { unitId: activeUnitId, status, consecutiveRejections, backoffMs },
      });
    }

    // Queue the position for offline replay on genuine network failures so the
    // unit's location on the server does not silently go stale. Server
    // rejections (4xx) are NOT queued — replaying them would fail forever.
    if (isNetworkError(error) && activeUnitId) {
      try {
        offlineEventManager.queueLocationUpdateEvent(
          activeUnitId,
          location.coords.latitude,
          location.coords.longitude,
          nonNegativeOrUndefined(location.coords.accuracy),
          nonNegativeOrUndefined(location.coords.heading),
          nonNegativeOrUndefined(location.coords.speed)
        );
      } catch (queueError) {
        logger.warn({
          message: 'Failed to queue location update for offline replay',
          context: { error: queueError },
        });
      }
    }
  }
};

// Define the background task (native only — TaskManager is unsupported on web)
if (!isWeb) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      logger.error({
        message: 'Location task error',
        context: { error },
      });
      return;
    }
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      const location = locations[0];
      if (location) {
        logger.info({
          message: 'Background location update received',
          context: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
          },
        });

        // Update local store
        useLocationStore.getState().setLocation(location);

        // The OS task keeps delivering while the app is foregrounded, so the fix has to be
        // attributed to the right setting before it can be sent: foreground fixes belong to
        // Realtime Geolocation, background ones to Background Geolocation.
        const isTransmissionEnabled = AppState.currentState === 'active' ? await loadRealtimeGeolocationState() : await loadBackgroundGeolocationState();

        await sendLocationToAPI(location, isTransmissionEnabled);
      }
    }
  });
}

class LocationService {
  private static instance: LocationService;
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundSubscription: Location.LocationSubscription | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private isBackgroundGeolocationEnabled = false;
  private isRealtimeGeolocationEnabled = true;
  // Single-flight guards. The subscription fields are only assigned after an
  // await, so a plain "already subscribed?" check lets two concurrent starts
  // both pass it and create duplicate watchers — and lets a stop run in the gap
  // and drop the fresh subscription. Concurrent callers share the in-flight
  // promise instead, and stop* waits for it before tearing anything down.
  private startPromise: Promise<void> | null = null;
  private startBackgroundPromise: Promise<void> | null = null;

  private constructor() {
    this.initializeAppStateListener();
    // Register this service's update function to avoid circular dependency
    registerLocationServiceUpdater(this.updateBackgroundGeolocationSetting.bind(this));
    registerLocationServiceRealtimeUpdater(this.updateRealtimeGeolocationSetting.bind(this));
  }

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  private initializeAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    logger.info({
      message: 'Location service handling app state change',
      context: { nextAppState, backgroundEnabled: this.isBackgroundGeolocationEnabled },
    });

    // AppState invokes this without awaiting, so anything that throws here (a
    // permission revoked while backgrounded is the common one) becomes an
    // unhandled rejection instead of a recoverable, logged failure.
    try {
      if (nextAppState === 'background' && this.isBackgroundGeolocationEnabled) {
        await this.startBackgroundUpdates();
      } else if (nextAppState === 'active') {
        await this.stopBackgroundUpdates();
      }
    } catch (error) {
      logger.warn({
        message: 'Failed to handle location app state change',
        context: { error, nextAppState },
      });
    }
  };

  async requestPermissions(requestBackground = false): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

    let backgroundStatus = 'undetermined';
    if (requestBackground) {
      const result = await Location.requestBackgroundPermissionsAsync();
      backgroundStatus = result.status;
    }

    logger.info({
      message: 'Location permissions requested',
      context: {
        foregroundStatus,
        backgroundStatus: requestBackground ? backgroundStatus : 'not requested',
        backgroundRequested: requestBackground,
      },
    });

    // Only require foreground permissions for basic functionality
    // Background permissions are optional and will be handled separately
    return foregroundStatus === 'granted';
  }

  async startLocationUpdates(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }

    const promise = this.performStartLocationUpdates().finally(() => {
      if (this.startPromise === promise) {
        this.startPromise = null;
      }
    });
    this.startPromise = promise;
    return promise;
  }

  private async performStartLocationUpdates(): Promise<void> {
    // On web, use a lightweight browser geolocation watcher instead of expo-location/TaskManager
    if (isWeb) {
      if (!('geolocation' in navigator)) {
        logger.warn({ message: 'Geolocation API not available in this browser' });
        return;
      }

      // The native path loads this below, but the web path returns before reaching it.
      this.isRealtimeGeolocationEnabled = await loadRealtimeGeolocationState();

      if (!this.locationSubscription) {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const loc: Location.LocationObject = {
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                altitude: pos.coords.altitude ?? 0,
                accuracy: pos.coords.accuracy ?? 0,
                altitudeAccuracy: pos.coords.altitudeAccuracy ?? 0,
                heading: pos.coords.heading ?? 0,
                speed: pos.coords.speed ?? 0,
              },
              timestamp: pos.timestamp,
            };
            useLocationStore.getState().setLocation(loc);
            sendLocationToAPI(loc, this.isRealtimeGeolocationEnabled);
          },
          (err) => {
            logger.warn({ message: 'Web geolocation error', context: { code: err.code, msg: err.message } });
          },
          { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 }
        );
        // Store a compatible subscription object
        this.locationSubscription = { remove: () => navigator.geolocation.clearWatch(watchId) } as unknown as Location.LocationSubscription;
        logger.info({ message: 'Foreground location updates started' });
      }
      return;
    }

    // Load both geolocation settings first
    this.isBackgroundGeolocationEnabled = await loadBackgroundGeolocationState();
    this.isRealtimeGeolocationEnabled = await loadRealtimeGeolocationState();

    // Only request background permissions if the user has enabled background geolocation
    const hasPermissions = await this.requestPermissions(this.isBackgroundGeolocationEnabled);
    if (!hasPermissions) {
      throw new Error('Location permissions not granted');
    }

    // Check if we have background permissions for background tracking
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    const hasBackgroundPermissions = backgroundStatus === 'granted';

    // Only register background task if both setting is enabled AND we have background permissions
    const shouldEnableBackground = this.isBackgroundGeolocationEnabled && hasBackgroundPermissions;

    if (shouldEnableBackground) {
      // Check if task is already registered for background updates
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isTaskRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, getBackgroundTaskOptions());
        logger.info({
          message: 'Background location task registered',
        });
      }
    } else if (this.isBackgroundGeolocationEnabled && !hasBackgroundPermissions) {
      logger.warn({
        message: 'Background geolocation enabled but permissions denied, running in foreground-only mode',
        context: {
          backgroundStatus,
          settingEnabled: this.isBackgroundGeolocationEnabled,
        },
      });
    }

    // Start foreground updates (idempotent - check if already subscribed)
    if (!this.locationSubscription) {
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 10,
        },
        (location) => {
          logger.info({
            message: 'Foreground location update received',
            context: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading,
            },
          });
          useLocationStore.getState().setLocation(location);
          // Foreground transmission is governed by Realtime Geolocation. The watcher itself keeps
          // running either way: the map, route ETAs and the status sheet all read the location
          // store, and switching transmission off must not blind the app to its own position.
          sendLocationToAPI(location, this.isRealtimeGeolocationEnabled);
        }
      );
    } else {
      logger.info({
        message: 'Foreground location subscription already active, skipping duplicate subscription',
      });
    }

    logger.info({
      message: 'Foreground location updates started',
      context: {
        backgroundEnabled: shouldEnableBackground,
        backgroundPermissions: hasBackgroundPermissions,
        backgroundSetting: this.isBackgroundGeolocationEnabled,
      },
    });
  }

  async startBackgroundUpdates(): Promise<void> {
    if (this.startBackgroundPromise) {
      return this.startBackgroundPromise;
    }

    const promise = this.performStartBackgroundUpdates().finally(() => {
      if (this.startBackgroundPromise === promise) {
        this.startBackgroundPromise = null;
      }
    });
    this.startBackgroundPromise = promise;
    return promise;
  }

  private async performStartBackgroundUpdates(): Promise<void> {
    if (isWeb) return; // Background location not supported on web
    if (this.backgroundSubscription || !this.isBackgroundGeolocationEnabled) {
      return;
    }

    // Check if OS-managed background task is already registered
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isTaskRegistered) {
      logger.info({
        message: 'OS-managed background location task is registered, skipping watchPositionAsync subscription',
      });
      useLocationStore.getState().setBackgroundEnabled(true);
      return;
    }

    logger.info({
      message: 'Starting background location updates',
    });

    this.backgroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000,
        distanceInterval: 20,
      },
      (location) => {
        logger.info({
          message: 'Background location update received',
          context: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
          },
        });
        useLocationStore.getState().setLocation(location);
        sendLocationToAPI(location, this.isBackgroundGeolocationEnabled); // Background fixes follow the background setting
      }
    );

    useLocationStore.getState().setBackgroundEnabled(true);
  }

  async stopBackgroundUpdates(): Promise<void> {
    if (isWeb) return;
    // A start still in flight assigns its subscription after this runs, which
    // would leave an orphaned watcher running forever.
    if (this.startBackgroundPromise) {
      await this.startBackgroundPromise.catch(() => {});
    }
    if (this.backgroundSubscription) {
      logger.info({
        message: 'Stopping background location updates',
      });
      await this.backgroundSubscription.remove();
      this.backgroundSubscription = null;
    }
    useLocationStore.getState().setBackgroundEnabled(false);
  }

  async updateRealtimeGeolocationSetting(enabled: boolean): Promise<void> {
    this.isRealtimeGeolocationEnabled = enabled;

    await saveRealtimeGeolocationState(enabled);

    // Flipping the flag is worthless without a watcher, and one is not guaranteed to exist:
    // `startLocationUpdates` runs once per unit selection and throws when the permission prompt was
    // declined. A unit that denied location at launch, granted it in the OS settings and then
    // switched realtime on would otherwise transmit nothing until the next cold start.
    //
    // Restarting is idempotent — `startLocationUpdates` shares its in-flight promise and skips a
    // subscription that already exists. Failures are logged rather than rethrown: the setting was
    // saved, and permission can still be granted later.
    if (enabled) {
      try {
        await this.startLocationUpdates();
      } catch (error) {
        logger.error({
          message: 'Failed to start location updates after enabling realtime geolocation',
          context: { error },
        });
      }

      // performStartLocationUpdates re-reads the setting from storage, and a read that threw
      // answers with the default. The caller's explicit choice wins over that guess.
      this.isRealtimeGeolocationEnabled = enabled;
    }

    logger.info({
      message: `Realtime geolocation setting updated to: ${enabled}`,
      context: { enabled },
    });
  }

  async updateBackgroundGeolocationSetting(enabled: boolean): Promise<void> {
    if (isWeb) return; // Background geolocation not applicable on web
    this.isBackgroundGeolocationEnabled = enabled;

    if (enabled) {
      // Request background permissions when enabling background geolocation
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      const hasBackgroundPermissions = backgroundStatus === 'granted';

      if (!hasBackgroundPermissions) {
        logger.warn({
          message: 'Cannot enable background geolocation: background permissions not granted',
          context: { backgroundStatus },
        });
        return;
      }

      // Register the task if not already registered
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isTaskRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, getBackgroundTaskOptions());
        logger.info({
          message: 'Background location task registered after setting change',
        });
      }

      // Start background updates if app is currently backgrounded
      if (AppState.currentState === 'background') {
        // Check if OS-managed background task is already registered before starting watchPositionAsync
        const isTaskRegisteredForWatch = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isTaskRegisteredForWatch) {
          logger.info({
            message: 'OS-managed background location task is registered, skipping watchPositionAsync subscription in updateBackgroundGeolocationSetting',
          });
          useLocationStore.getState().setBackgroundEnabled(true);
        } else {
          await this.startBackgroundUpdates();
        }
      }
    } else {
      // Stop background updates and unregister task
      await this.stopBackgroundUpdates();
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        logger.info({
          message: 'Background location task unregistered after setting change',
        });
      }
    }
  }

  async stopLocationUpdates(): Promise<void> {
    // Wait out any start still in flight: it assigns this.locationSubscription
    // after its await, so stopping first would clear a null field and leave the
    // watcher that lands afterwards running with nothing tracking it.
    if (this.startPromise) {
      await this.startPromise.catch(() => {});
    }

    if (this.locationSubscription) {
      if (isWeb) {
        // On web the subscription is our own shim wrapping clearWatch
        (this.locationSubscription as any).remove();
      } else {
        await this.locationSubscription.remove();
      }
      this.locationSubscription = null;
    }

    if (!isWeb) {
      await this.stopBackgroundUpdates();

      // Check if task is registered before stopping
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    }

    logger.info({
      message: 'All location updates stopped',
    });
  }

  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const locationService = LocationService.getInstance();
