/**
 * App Reset Service
 *
 * This service provides a centralized way to clear all app data,
 * reset stores, and clean up resources when the user logs out.
 * It's designed to be reusable and testable.
 */

import { queryClient } from '@/api/common/api-provider';
import { registerSessionCleanupHandler } from '@/lib/auth/session-cleanup';
import { logger } from '@/lib/logging';
import { storage } from '@/lib/storage';
import { removeActiveCallId, removeActiveUnitId, removeDeviceUuid } from '@/lib/storage/app';
import { locationService } from '@/services/location';
import { pushNotificationService } from '@/services/push-notification';
import { signalRService } from '@/services/signalr.service';
import { useAudioStreamStore } from '@/stores/app/audio-stream-store';
import { INITIAL_STATE as BLUETOOTH_INITIAL_STATE, useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
import { useCoreStore } from '@/stores/app/core-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';
import { useLoadingStore } from '@/stores/app/loading-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useCallsStore } from '@/stores/calls/store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { useContactsStore } from '@/stores/contacts/store';
import { useDispatchStore } from '@/stores/dispatch/store';
import { useMapsStore } from '@/stores/maps/store';
import { useNotesStore } from '@/stores/notes/store';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';
import { usePoisStore } from '@/stores/pois/store';
import { useProtocolsStore } from '@/stores/protocols/store';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';
import { useRolesStore } from '@/stores/roles/store';
import { useRoutesStore } from '@/stores/routes/store';
import { securityStore } from '@/stores/security/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';
import { useStatusBottomSheetStore } from '@/stores/status/store';
import { useUnitsStore } from '@/stores/units/store';
import { useWeatherAlertsStore } from '@/stores/weather-alerts/store';

// ============================================================================
// Initial State Constants
// These can be imported and used by stores or tests
// ============================================================================

export const INITIAL_CORE_STATE = {
  activeUnitId: null,
  activeUnit: null,
  activeUnitStatus: null,
  activeUnitStatusType: null,
  activeCallId: null,
  activeCall: null,
  activePriority: null,
  config: null,
  isLoading: false,
  isInitialized: false,
  isInitializing: false,
  error: null,
  activeStatuses: null,
};

export const INITIAL_CALLS_STATE = {
  calls: [] as never[],
  callPriorities: [] as never[],
  callTypes: [] as never[],
  destinationPois: [] as never[],
  poiTypes: [] as never[],
  callDispatches: {},
  callDispatchesFetchedAt: {},
  isLoading: false,
  isInitialized: false,
  isCallFormDataLoaded: false,
  error: null,
  lastFetchedAt: 0,
};

export const INITIAL_UNITS_STATE = {
  units: [] as never[],
  unitStatuses: [] as never[],
  isLoading: false,
  error: null,
};

export const INITIAL_CONTACTS_STATE = {
  contacts: [] as never[],
  contactNotes: {},
  searchQuery: '',
  selectedContactId: null,
  isDetailsOpen: false,
  isLoading: false,
  isNotesLoading: false,
  error: null,
};

export const INITIAL_NOTES_STATE = {
  notes: [] as never[],
  searchQuery: '',
  selectedNoteId: null,
  isDetailsOpen: false,
  isLoading: false,
  error: null,
};

export const INITIAL_ROLES_STATE = {
  roles: [] as never[],
  unitRoleAssignments: [] as never[],
  users: [] as never[],
  isLoading: false,
  isInitialized: false,
  error: null,
};

export const INITIAL_PROTOCOLS_STATE = {
  protocols: [] as never[],
  searchQuery: '',
  selectedProtocolId: null,
  isDetailsOpen: false,
  isLoading: false,
  error: null,
};

export const INITIAL_DISPATCH_STATE = {
  data: {
    users: [] as never[],
    groups: [] as never[],
    roles: [] as never[],
    units: [] as never[],
  },
  selection: {
    everyone: false,
    users: [] as string[],
    groups: [] as string[],
    roles: [] as string[],
    units: [] as string[],
  },
  isLoading: false,
  error: null,
  searchQuery: '',
};

export const INITIAL_SECURITY_STATE = {
  error: null,
  rights: null,
};

export const INITIAL_LOCATION_STATE = {
  latitude: null,
  longitude: null,
  heading: null,
  accuracy: null,
  speed: null,
  altitude: null,
  timestamp: null,
};

export const INITIAL_LIVEKIT_STATE = {
  isConnected: false,
  isConnecting: false,
  currentRoom: null,
  currentRoomInfo: null,
  isTalking: false,
  availableRooms: [] as never[],
  isBottomSheetVisible: false,
};

export const INITIAL_AUDIO_STREAM_STATE = {
  availableStreams: [] as never[],
  currentStream: null,
  isPlaying: false,
  isLoading: false,
  isBuffering: false,
  isBottomSheetVisible: false,
};

export const INITIAL_BLUETOOTH_AUDIO_STATE = BLUETOOTH_INITIAL_STATE;

export const INITIAL_PUSH_NOTIFICATION_MODAL_STATE = {
  isOpen: false,
  notification: null,
};

export const INITIAL_MAPS_STATE = {
  activeLayers: [] as never[],
  layerToggles: {},
  cachedGeoJSON: {},
  indoorMaps: [] as never[],
  currentIndoorMap: null,
  currentFloorId: null,
  currentFloor: null,
  currentZonesGeoJSON: null,
  customMaps: [] as never[],
  currentCustomMap: null,
  searchResults: [] as never[],
  searchQuery: '',
  isLoading: false,
  isLoadingLayers: false,
  isLoadingGeoJSON: false,
  error: null,
};

export const INITIAL_POIS_STATE = {
  poiTypes: [] as never[],
  pois: [] as never[],
  destinationPois: [] as never[],
  poiDetails: {},
  selectedPoi: null,
  isLoading: false,
  isLoadingDetail: false,
  error: null,
  lastFetchedAt: 0,
};

export const INITIAL_ROUTES_STATE = {
  routePlans: [] as never[],
  activePlan: null,
  activeInstance: null,
  instanceStops: [] as never[],
  directions: null,
  deviations: [] as never[],
  routeHistory: [] as never[],
  isTracking: false,
  isLoading: false,
  isLoadingStops: false,
  isLoadingDirections: false,
  isInitialized: false,
  error: null,
};

// Keys to preserve during storage clear (e.g., first-time flags)
const STORAGE_KEYS_TO_PRESERVE = ['IS_FIRST_TIME'];

/**
 * Clears all persisted storage items except those in the preserve list
 */
export const clearPersistedStorage = (): void => {
  const allKeys = storage.getAllKeys();
  allKeys.forEach((key) => {
    if (!STORAGE_KEYS_TO_PRESERVE.includes(key)) {
      storage.delete(key);
    }
  });
};

/**
 * Clears app-specific storage items (active unit, call, device UUID)
 */
export const clearAppStorageItems = (): void => {
  removeActiveUnitId();
  removeActiveCallId();
  removeDeviceUuid();
};

/**
 * Resets all zustand stores to their initial states
 * Uses existing reset methods where available
 */
export const resetAllStores = async (): Promise<void> => {
  // Core stores - use setState with initial state constants
  useCoreStore.setState(INITIAL_CORE_STATE);
  useCallsStore.setState(INITIAL_CALLS_STATE);
  useUnitsStore.setState(INITIAL_UNITS_STATE);
  useContactsStore.setState(INITIAL_CONTACTS_STATE);
  useNotesStore.setState(INITIAL_NOTES_STATE);
  useRolesStore.setState(INITIAL_ROLES_STATE);
  useProtocolsStore.setState(INITIAL_PROTOCOLS_STATE);
  useDispatchStore.setState(INITIAL_DISPATCH_STATE);
  securityStore.setState(INITIAL_SECURITY_STATE);

  // Stores with existing reset/clear methods
  useStatusBottomSheetStore.getState().reset();
  useOfflineQueueStore.getState().clearAllEvents();
  useLoadingStore.getState().resetLoading();

  // Location store - only reset location data, preserve settings
  useLocationStore.setState(INITIAL_LOCATION_STATE);

  // LiveKit store - await async disconnect, then reset
  const liveKitState = useLiveKitStore.getState();
  if (liveKitState.isConnected) {
    try {
      await liveKitState.disconnectFromRoom();
    } catch (error) {
      logger.error({
        message: 'Error disconnecting from LiveKit room during reset',
        context: { error },
      });
    }
  }
  useLiveKitStore.setState(INITIAL_LIVEKIT_STATE);

  // Audio stream store - await async cleanup, then reset
  const audioStreamState = useAudioStreamStore.getState();
  try {
    await audioStreamState.cleanup();
  } catch (error) {
    logger.error({
      message: 'Error cleaning up audio stream during reset',
      context: { error },
    });
  }
  useAudioStreamStore.setState(INITIAL_AUDIO_STREAM_STATE);

  // Bluetooth audio store - reset
  useBluetoothAudioStore.setState(INITIAL_BLUETOOTH_AUDIO_STATE);

  // Push notification modal store - reset
  usePushNotificationModalStore.setState(INITIAL_PUSH_NOTIFICATION_MODAL_STATE);

  // Department-scoped data stores that previously survived logout
  useMapsStore.setState(INITIAL_MAPS_STATE);
  usePoisStore.setState(INITIAL_POIS_STATE);
  useRoutesStore.setState(INITIAL_ROUTES_STATE);
  useWeatherAlertsStore.getState().reset();

  // Check-in timer store — reset() also stops the 30s polling interval that
  // would otherwise keep fetching the OLD call's timers under the NEW user's
  // credentials after re-login.
  useCheckInTimerStore.getState().reset();
};

/**
 * Tears down live services and realtime connections. MUST run on every logout
 * path — otherwise the previous user's hub connections keep receiving events
 * and stale connected-flags block the next user's SignalR session.
 */
export const teardownServices = async (): Promise<void> => {
  // SignalR: disconnect both hubs and clear the store's connected flags
  try {
    await signalRService.disconnectAll();
  } catch (error) {
    logger.error({
      message: 'Error disconnecting SignalR hubs during reset',
      context: { error },
    });
  }
  useSignalRStore.setState({
    isUpdateHubConnected: false,
    isGeolocationHubConnected: false,
    lastUpdateMessage: null,
    lastUpdateTimestamp: 0,
    lastUpdateTimestamps: {},
    lastUnitStatusMessage: null,
    lastUnitStatusTimestamp: 0,
    lastGeolocationMessage: null,
    lastGeolocationTimestamp: 0,
    error: null,
  });

  // Location tracking: stop foreground/background updates (battery + privacy)
  try {
    await locationService.stopLocationUpdates();
  } catch (error) {
    logger.error({
      message: 'Error stopping location updates during reset',
      context: { error },
    });
  }

  // Push notifications: clear local token/badge/delivered notifications.
  // (Method only exists on the native variant — web/Electron have no-op push.)
  try {
    const unregister = (pushNotificationService as { unregisterFromPushNotifications?: () => Promise<void> }).unregisterFromPushNotifications;
    if (unregister) {
      await unregister.call(pushNotificationService);
    }
  } catch (error) {
    logger.error({
      message: 'Error clearing push notification state during reset',
      context: { error },
    });
  }
};

/**
 * Clears all app data, cached values, settings, and stores.
 * This is the main function to call when user logs out.
 *
 * @returns Promise that resolves when all data has been cleared
 */
export const clearAllAppData = async (): Promise<void> => {
  logger.info({
    message: 'Clearing all app data on logout',
  });

  try {
    // Tear down realtime connections and background services first so nothing
    // keeps writing into stores while they are being reset.
    await teardownServices();

    // Clear persisted storage items
    clearAppStorageItems();

    // Clear all MMKV storage except preserved keys
    clearPersistedStorage();

    // Reset all zustand stores to their initial states
    await resetAllStores();

    // Drop all react-query cached data — query keys are not user-scoped.
    queryClient.clear();

    logger.info({
      message: 'Successfully cleared all app data',
    });
  } catch (error) {
    logger.error({
      message: 'Error clearing app data on logout',
      context: { error },
    });
    // Re-throw to allow calling code to handle if needed
    throw error;
  }
};

export default {
  clearAllAppData,
  clearAppStorageItems,
  clearPersistedStorage,
  resetAllStores,
  teardownServices,
  // Export initial states for testing and external use
  INITIAL_CORE_STATE,
  INITIAL_CALLS_STATE,
  INITIAL_UNITS_STATE,
  INITIAL_CONTACTS_STATE,
  INITIAL_NOTES_STATE,
  INITIAL_PROTOCOLS_STATE,
  INITIAL_DISPATCH_STATE,
  INITIAL_SECURITY_STATE,
  INITIAL_LOCATION_STATE,
  INITIAL_LIVEKIT_STATE,
  INITIAL_AUDIO_STREAM_STATE,
  INITIAL_BLUETOOTH_AUDIO_STATE,
  INITIAL_PUSH_NOTIFICATION_MODAL_STATE,
  INITIAL_MAPS_STATE,
  INITIAL_POIS_STATE,
  INITIAL_ROUTES_STATE,
};

// Register the full wipe as THE session-cleanup handler so every logout path
// in the auth store (manual, forced 401, refresh rejection) runs it. This
// module must be imported at app startup for the registration to take effect.
registerSessionCleanupHandler(clearAllAppData);
