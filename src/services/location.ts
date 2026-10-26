import axios from 'axios';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, type AppStateStatus } from 'react-native';

import { setUnitLocation } from '@/api/units/unitLocation';
import { registerLocationServiceUpdater } from '@/lib/hooks/use-background-geolocation';
import { registerLocationServiceRealtimeUpdater } from '@/lib/hooks/use-realtime-geolocation';
import { translate } from '@/lib/i18n/utils';
import { LocationTransmissionGate, type TransmissionRecord } from '@/lib/location-transmission-gate';
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

// Transmission pacing. The OS delivers fixes far faster than dispatch needs them (iOS ignores
// `timeInterval` and reports every `distanceInterval` of travel), and every POST wakes the cellular
// radio. A moving unit is reported at most every 15s.
//
// A parked unit is not silent, though: it re-reports every 5 minutes. The server drops a unit's
// ping from the map once its Timestamp is older than the department's location TTL, and a unit
// that is trapped or unresponsive is exactly the one dispatch must still be able to see.
const MIN_TRANSMIT_INTERVAL_MS = 15 * 1000;
const MIN_TRANSMIT_DISTANCE_METERS = 25;
const STATIONARY_TRANSMIT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Options for the OS-managed background task.
 *
 * Background AVL is paced at roughly one fix every 25–30s, which is what dispatch's map needs, and
 * each part of the request is set so the device does no more work than that:
 *
 * - `timeInterval` (Android only — iOS ignores it) is how often the fused provider computes a fix.
 *   Computing at the reporting cadence instead of twice as often halves the location work while
 *   the screen is off.
 * - `distanceInterval` and `deferredUpdatesDistance` are 0 so a parked unit keeps delivering. Any
 *   distance filter would silence it completely, and backgrounded JS has no other way to wake:
 *   Android pauses JS timers there. These fixes are what let the transmission gate send the
 *   parked unit's 5-minute keep-alive; the gate discards the rest without touching the network.
 * - `deferredUpdatesInterval` holds fixes natively and wakes the JS runtime once per window
 *   instead of once per fix. Both platforms apply it only while backgrounded. The interval sits
 *   just under `timeInterval` so each Android fix still clears it rather than being held for a
 *   second one.
 *
 * `pausesUpdatesAutomatically` is deliberately false. iOS will otherwise stop updates once it
 * decides the device has been stationary for a while and only resume on significant motion — an
 * apparatus parked at a scene would drop off dispatch's map and stay off it.
 *
 * `activityType` is AutomotiveNavigation here (Responder uses Other): this app runs on a
 * vehicle-mounted device, and telling iOS so lets it tune the GPS duty cycle for road travel.
 *
 * TaskManager persists these with the registration, so a change here only reaches installed apps
 * because `registerBackgroundTask` re-registers whenever the stored options differ.
 */
const getBackgroundTaskOptions = (): Location.LocationTaskOptions => ({
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 30000,
  distanceInterval: 0,
  deferredUpdatesInterval: 25000,
  deferredUpdatesDistance: 0,
  pausesUpdatesAutomatically: false,
  activityType: Location.LocationActivityType.AutomotiveNavigation,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: translate('location.tracking_notification_title'),
    notificationBody: translate('location.tracking_notification_body'),
  },
});

/**
 * Whether the options TaskManager holds for the task already match `desired`. Only the keys we set
 * are compared, and booleans are allowed to round-trip through native storage as 0/1.
 */
const hasSameTaskOptions = (current: unknown, desired: unknown): boolean => {
  if (desired !== null && typeof desired === 'object') {
    if (current === null || typeof current !== 'object') {
      return false;
    }
    return Object.entries(desired as Record<string, unknown>).every(([key, value]) => hasSameTaskOptions((current as Record<string, unknown>)[key], value));
  }
  return current === desired || (typeof desired === 'boolean' && Number(current) === Number(desired));
};

/**
 * Register the background task, or re-register it when its stored options are out of date.
 * Returns true when it called into the OS.
 *
 * Must run while the app is in the foreground: Android refuses to start the location foreground
 * service from the background.
 */
const registerBackgroundTask = async (): Promise<boolean> => {
  const options = getBackgroundTaskOptions();

  if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)) {
    let currentOptions: unknown = null;
    try {
      currentOptions = await TaskManager.getTaskOptionsAsync(LOCATION_TASK_NAME);
    } catch (error) {
      // Unreadable options are treated as stale: re-registering only updates them in place.
      logger.debug({ message: 'Could not read background location task options', context: { error } });
    }
    if (hasSameTaskOptions(currentOptions, options)) {
      return false;
    }
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, options);
  return true;
};

let rejectedUnitId: string | null = null;
let consecutiveRejections = 0;
let nextAttemptAtMs = 0;

const resetRejectionBackoff = (): void => {
  rejectedUnitId = null;
  consecutiveRejections = 0;
  nextAttemptAtMs = 0;
};

const transmissionGate = new LocationTransmissionGate({
  minIntervalMs: MIN_TRANSMIT_INTERVAL_MS,
  minDistanceMeters: MIN_TRANSMIT_DISTANCE_METERS,
  stationaryIntervalMs: STATIONARY_TRANSMIT_INTERVAL_MS,
});

// The newest fix held back by the transmission interval. Without it, a unit that stops moving just
// after a transmission would leave dispatch with the position it had up to 15s before it parked —
// a stationary device produces no further fixes to correct that.
let pendingTransmission: { location: Location.LocationObject; isTransmissionEnabled: boolean } | null = null;
let pendingTransmissionTimer: ReturnType<typeof setTimeout> | null = null;

const cancelPendingTransmission = (): void => {
  if (pendingTransmissionTimer) {
    clearTimeout(pendingTransmissionTimer);
    pendingTransmissionTimer = null;
  }
  pendingTransmission = null;
};

// Foreground keep-alive for a parked unit. The foreground watcher's distance filter means a unit
// that is not moving delivers no fixes, so nothing would ever re-report it. Restarted by every
// transmission, so it only fires after 5 minutes of silence. JS timers do not run while Android is
// backgrounded; there the background task's fixes carry the keep-alive instead (see
// `getBackgroundTaskOptions`), and an overdue timer fires as soon as the app is foregrounded.
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
// Set by LocationService, which owns the settings and the last known position.
let heartbeatHandler: (() => void) | null = null;

const cancelHeartbeat = (): void => {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
};

/** Restart the keep-alive countdown: by default a full interval from now. */
const scheduleHeartbeat = (delayMs: number = STATIONARY_TRANSMIT_INTERVAL_MS): void => {
  cancelHeartbeat();
  heartbeatTimer = setTimeout(() => {
    heartbeatTimer = null;
    heartbeatHandler?.();
  }, delayMs);
};

/**
 * Start the countdown unless one is already running, measured from the last transmission: a unit
 * that last reported 10 minutes ago — say, before a stretch in the background where it was not
 * allowed to — is overdue now, not in another 5 minutes.
 */
const ensureHeartbeatScheduled = (): void => {
  if (heartbeatTimer) {
    return;
  }
  const lastTransmittedAt = transmissionGate.getLastTransmittedAt();
  // Clamped: a clock that went backwards must not push the keep-alive out past its interval.
  const sinceLastTransmission = lastTransmittedAt === null ? 0 : Math.max(0, Date.now() - lastTransmittedAt);
  scheduleHeartbeat(Math.max(0, STATIONARY_TRANSMIT_INTERVAL_MS - sinceLastTransmission));
};

/**
 * iOS reports -1 for course, speed and the accuracy fields when the value is
 * unavailable — a stationary unit (parked at the station, screen off) reports
 * it on every single fix. Returns undefined for those sentinels so they are
 * never sent to the API or queued for offline replay.
 */
const nonNegativeOrUndefined = (value: number | null | undefined): number | undefined => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined);

/**
 * The OS hands the background task a batch: every fix collected while deferring, oldest first. Only
 * the newest one says where the unit is now — the first can be a whole deferral window old.
 */
const getNewestLocation = (locations: Location.LocationObject[] | undefined): Location.LocationObject | undefined =>
  locations?.reduce<Location.LocationObject | undefined>((newest, candidate) => (!newest || candidate.timestamp >= newest.timestamp ? candidate : newest), undefined);

/**
 * Post a fix to the unit-location endpoint.
 *
 * `isTransmissionEnabled` is resolved by the caller because which setting governs a fix depends on
 * where it came from: a foreground fix is governed by Realtime Geolocation, a background one by
 * Background Geolocation. Deciding it here would collapse two independent settings into one.
 */
const sendLocationToAPI = async (location: Location.LocationObject, isTransmissionEnabled: boolean): Promise<void> => {
  if (!isTransmissionEnabled) {
    // The newest fix says not to transmit; an older one held back must not go out after it.
    cancelPendingTransmission();
    logger.debug({
      message: 'Location transmission disabled for this fix, skipping API call',
    });
    return;
  }

  const { activeUnitId } = useCoreStore.getState();
  let transmission: TransmissionRecord | null = null;
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

    const now = Date.now();
    const decision = transmissionGate.evaluate(activeUnitId, location.coords, now);

    if (decision.action === 'skip') {
      // This fix is newer than anything held back and no further from the last transmitted
      // position, so whatever was held back is already out of date.
      cancelPendingTransmission();
      return;
    }

    if (decision.action === 'defer') {
      // Only the newest held-back fix matters; it replaces any older one under the same timer.
      pendingTransmission = { location, isTransmissionEnabled };
      if (!pendingTransmissionTimer) {
        pendingTransmissionTimer = setTimeout(() => {
          pendingTransmissionTimer = null;
          const pending = pendingTransmission;
          pendingTransmission = null;
          if (pending) {
            void sendLocationToAPI(pending.location, pending.isTransmissionEnabled);
          }
        }, decision.retryInMs);
      }
      return;
    }

    cancelPendingTransmission();
    // Recorded before the request resolves: iOS can deliver several fixes while one POST is in
    // flight, and each of them must see this one.
    transmission = transmissionGate.record(activeUnitId, location.coords, now);
    scheduleHeartbeat();

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

    const isOffline = isNetworkError(error);

    // A position the server refused is not on the server, so the next fix must not be skipped as
    // "unchanged". One lost to the network is different: it goes to the offline queue below, and
    // retrying it on every fix would only keep the radio busy in a dead zone.
    if (transmission && !isOffline) {
      transmissionGate.markRejected(transmission);
    }

    // Queue the position for offline replay on genuine network failures so the
    // unit's location on the server does not silently go stale. Server
    // rejections (4xx) are NOT queued — replaying them would fail forever.
    if (isOffline && activeUnitId) {
      try {
        offlineEventManager.queueLocationUpdateEvent(
          activeUnitId,
          location.coords.latitude,
          location.coords.longitude,
          nonNegativeOrUndefined(location.coords.accuracy),
          nonNegativeOrUndefined(location.coords.heading),
          nonNegativeOrUndefined(location.coords.speed),
          location.timestamp
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

/** Clears all transmission pacing and backoff state. Test-only. */
export function _resetLocationTransmissionForTests(): void {
  cancelPendingTransmission();
  cancelHeartbeat();
  transmissionGate.reset();
  resetRejectionBackoff();
}

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
      const location = getNewestLocation(locations);
      if (location) {
        const isForeground = AppState.currentState === 'active';

        // The OS task keeps delivering while the app is foregrounded, at the same time as the
        // foreground watcher. When the watcher is running it already records and transmits every
        // fix; handling this one as well would post each position twice.
        if (isForeground && locationService.isForegroundWatcherActive()) {
          return;
        }

        logger.info({
          message: 'Background location update received',
          context: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
            batchSize: locations.length,
          },
        });

        // Update local store
        useLocationStore.getState().setLocation(location);

        // The fix has to be attributed to the right setting before it can be sent: foreground
        // fixes belong to Realtime Geolocation, background ones to Background Geolocation.
        const isTransmissionEnabled = isForeground ? await loadRealtimeGeolocationState() : await loadBackgroundGeolocationState();

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
  // Set once something has asked for tracking (unit selected, map mounted) and cleared by a stop,
  // so a resume only re-establishes tracking that is supposed to be running.
  private isTrackingRequested = false;
  // Single-flight guards. The subscription fields are only assigned after an
  // await, so a plain "already subscribed?" check lets two concurrent starts
  // both pass it and create duplicate watchers — and lets a stop run in the gap
  // and drop the fresh subscription. Concurrent callers share the in-flight
  // promise instead, and stop* waits for it before tearing anything down.
  private startPromise: Promise<void> | null = null;
  private startBackgroundPromise: Promise<void> | null = null;
  private resumePromise: Promise<void> | null = null;
  private watcherPromise: Promise<void> | null = null;

  private constructor() {
    this.initializeAppStateListener();
    // Register this service's update function to avoid circular dependency
    registerLocationServiceUpdater(this.updateBackgroundGeolocationSetting.bind(this));
    registerLocationServiceRealtimeUpdater(this.updateRealtimeGeolocationSetting.bind(this));
    heartbeatHandler = () => {
      void this.sendHeartbeat();
    };
  }

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /** True while the foreground watcher is delivering fixes to the store and the API. */
  isForegroundWatcherActive(): boolean {
    return this.locationSubscription !== null;
  }

  /**
   * Re-report the unit's last known position after 5 minutes without a transmission, so a parked —
   * or trapped — unit's marker never ages off the department's map.
   *
   * Stamped with the current time on purpose. The server ages a ping out by its Timestamp, and the
   * report means "still here as of now"; the fix's own time is when the unit last moved, which
   * would leave the marker expiring on schedule.
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.isTrackingRequested) {
      return;
    }

    // Read from storage, as the background task does: the setting that governs a report depends on
    // the app state it is sent in, and a headless launch has not loaded the service's copies.
    const isTransmissionEnabled = AppState.currentState === 'active' ? await loadRealtimeGeolocationState() : await loadBackgroundGeolocationState();
    // Re-checked after the await: a stop that landed during it has already cancelled the countdown,
    // and rearming it here would leave a stale timer for the next start to inherit.
    if (!isTransmissionEnabled || !this.isTrackingRequested) {
      // Nothing may be sent in this state, so stop counting; the next transmission, a resume or a
      // restart of tracking starts the countdown again.
      return;
    }

    // Keep counting even if this attempt finds nothing to send. A transmission below restarts the
    // countdown from the moment it is sent.
    scheduleHeartbeat();

    const location = await this.getLastKnownLocation();
    if (!location || !this.isTrackingRequested) {
      return;
    }

    logger.info({
      message: 'Sending location keep-alive for a stationary unit',
      context: { latitude: location.coords.latitude, longitude: location.coords.longitude, fixTimestamp: location.timestamp },
    });

    await sendLocationToAPI({ ...location, timestamp: Date.now() }, isTransmissionEnabled);
  }

  /** The freshest position the device already holds, without powering up the location hardware. */
  private async getLastKnownLocation(): Promise<Location.LocationObject | null> {
    if (!isWeb) {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          return lastKnown;
        }
      } catch (error) {
        logger.debug({ message: 'Could not read last known position for keep-alive', context: { error } });
      }
    }

    // Nothing cached by the OS (or web, which has no such cache): fall back to the last fix this
    // app recorded. A unit that has lost its signal still has a last known position worth keeping
    // on the map.
    const { latitude, longitude, heading, accuracy, speed, altitude, timestamp } = useLocationStore.getState();
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }
    return {
      coords: { latitude, longitude, heading, accuracy, speed, altitude, altitudeAccuracy: null },
      timestamp: timestamp ?? Date.now(),
    };
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
        await this.resumeTracking();
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
    this.isTrackingRequested = true;

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
      ensureHeartbeatScheduled();
      return;
    }

    // Load both geolocation settings first
    this.isBackgroundGeolocationEnabled = await loadBackgroundGeolocationState();
    this.isRealtimeGeolocationEnabled = await loadRealtimeGeolocationState();

    // Only request background permissions if the user has enabled background geolocation
    let hasPermissions: boolean;
    try {
      hasPermissions = await this.requestPermissions(this.isBackgroundGeolocationEnabled);
    } catch (error) {
      logger.error({
        message: 'Failed to request location permissions before starting updates',
        context: { operation: 'startLocationUpdates', error },
      });
      throw error;
    }
    if (!hasPermissions) {
      throw new Error('Location permissions not granted');
    }

    // Check if we have background permissions for background tracking
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    const hasBackgroundPermissions = backgroundStatus === 'granted';

    // Only register background task if both setting is enabled AND we have background permissions
    const shouldEnableBackground = this.isBackgroundGeolocationEnabled && hasBackgroundPermissions;

    if (shouldEnableBackground) {
      if (await registerBackgroundTask()) {
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
      await this.startForegroundWatcher();
    } else {
      logger.info({
        message: 'Foreground location subscription already active, skipping duplicate subscription',
      });
    }

    // A unit that starts out parked may never produce a fix; the keep-alive still reports it.
    ensureHeartbeatScheduled();

    logger.info({
      message: 'Foreground location updates started',
      context: {
        backgroundEnabled: shouldEnableBackground,
        backgroundPermissions: hasBackgroundPermissions,
        backgroundSetting: this.isBackgroundGeolocationEnabled,
      },
    });
  }

  /**
   * Create the foreground watcher unless one exists or is already being created.
   *
   * The OS pauses it natively while the app is backgrounded (Android pauses every watcher, iOS
   * watchers do not allow background updates), so it costs nothing there; the background task
   * covers that state.
   */
  private startForegroundWatcher(): Promise<void> {
    if (this.locationSubscription) {
      return Promise.resolve();
    }
    if (this.watcherPromise) {
      return this.watcherPromise;
    }

    const promise = Location.watchPositionAsync(
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
      },
      // Without a handler expo-location drops watcher errors silently.
      (reason) => {
        logger.warn({
          message: 'Foreground location watcher failed',
          context: { error: reason },
        });
      }
    )
      .then((subscription) => {
        this.locationSubscription = subscription;
      })
      .finally(() => {
        if (this.watcherPromise === promise) {
          this.watcherPromise = null;
        }
      });
    this.watcherPromise = promise;
    return promise;
  }

  /**
   * Re-establish tracking when the app returns to the foreground.
   *
   * Location access is usually fixed in the OS settings app while this app sits in the background
   * — after the start at unit selection already failed, or ran foreground-only. Nothing else
   * retries until the next cold start, so a unit that granted access would stay off dispatch's map.
   *
   * Never prompts: it only reads the current grants. A prompt on every resume would be a nag, and on
   * Android 11+ requesting background access opens the settings app.
   */
  private resumeTracking(): Promise<void> {
    if (isWeb || !this.isTrackingRequested) {
      return Promise.resolve();
    }
    if (this.resumePromise) {
      return this.resumePromise;
    }

    const promise = this.performResumeTracking().finally(() => {
      if (this.resumePromise === promise) {
        this.resumePromise = null;
      }
    });
    this.resumePromise = promise;
    return promise;
  }

  private async performResumeTracking(): Promise<void> {
    // A start still in flight is already doing this, with prompts where they are wanted.
    if (this.startPromise) {
      await this.startPromise.catch(() => {});
    }

    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
    // Re-checked after every await: a stop that lands mid-resume must not be undone by it.
    if (foregroundStatus !== 'granted' || !this.isTrackingRequested) {
      return;
    }

    if (this.isBackgroundGeolocationEnabled) {
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
      if (backgroundStatus === 'granted' && this.isTrackingRequested && (await registerBackgroundTask())) {
        logger.info({
          message: 'Background location task registered on app resume',
        });
      }
    }

    if (!this.locationSubscription && this.isTrackingRequested) {
      await this.startForegroundWatcher();
      logger.info({
        message: 'Foreground location updates resumed',
      });
    }

    // The countdown stops while reporting is not allowed (see `sendHeartbeat`); back in the
    // foreground it runs again. One that went overdue while backgrounded has already fired.
    if (this.isTrackingRequested) {
      ensureHeartbeatScheduled();
    }
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
      },
      (reason) => {
        logger.warn({
          message: 'Background location watcher failed',
          context: { error: reason },
        });
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

    if (!enabled) {
      cancelPendingTransmission();
    }

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
      if (await registerBackgroundTask()) {
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
      cancelPendingTransmission();
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
    this.isTrackingRequested = false;
    cancelPendingTransmission();
    cancelHeartbeat();
    // The next start may be for another unit, or long after this position was current.
    transmissionGate.reset();

    // Wait out any start still in flight: it assigns this.locationSubscription
    // after its await, so stopping first would clear a null field and leave the
    // watcher that lands afterwards running with nothing tracking it.
    if (this.startPromise) {
      await this.startPromise.catch(() => {});
    }
    if (this.resumePromise) {
      await this.resumePromise.catch(() => {});
    }
    if (this.watcherPromise) {
      await this.watcherPromise.catch(() => {});
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

    // Pacing was cancelled above, but the start awaited here can still schedule the keep-alive, and
    // a fix delivered before its subscription was removed can defer a transmission or restart it.
    cancelPendingTransmission();
    cancelHeartbeat();

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
