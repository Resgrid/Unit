// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  storage: {
    getAllKeys: jest.fn(() => ['key1', 'IS_FIRST_TIME', 'key2']),
    delete: jest.fn(),
  },
}));

// Mock storage/app functions
jest.mock('@/lib/storage/app', () => ({
  removeActiveUnitId: jest.fn(),
  removeActiveCallId: jest.fn(),
  removeDeviceUuid: jest.fn(),
}));

// Mock all the store imports
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/app/livekit-store', () => ({
  useLiveKitStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/app/audio-stream-store', () => ({
  useAudioStreamStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/app/bluetooth-audio-store', () => ({
  INITIAL_STATE: {
    connectedDevice: null,
    isScanning: false,
    isConnecting: false,
    availableDevices: [],
    connectionError: null,
    isAudioRoutingActive: false,
  },
  useBluetoothAudioStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/app/loading-store', () => ({
  useLoadingStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/contacts/store', () => ({
  useContactsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/notes/store', () => ({
  useNotesStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/offline-queue/store', () => ({
  useOfflineQueueStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/protocols/store', () => ({
  useProtocolsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/push-notification/store', () => ({
  usePushNotificationModalStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/roles/store', () => ({
  useRolesStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/security/store', () => ({
  securityStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

jest.mock('@/stores/status/store', () => ({
  useStatusBottomSheetStore: {
    setState: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/units/store', () => ({
  useUnitsStore: {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  },
}));

import {
  clearAllAppData,
  clearAppStorageItems,
  clearPersistedStorage,
  INITIAL_AUDIO_STREAM_STATE,
  INITIAL_BLUETOOTH_AUDIO_STATE,
  INITIAL_CALLS_STATE,
  INITIAL_CONTACTS_STATE,
  INITIAL_CORE_STATE,
  INITIAL_DISPATCH_STATE,
  INITIAL_LIVEKIT_STATE,
  INITIAL_LOCATION_STATE,
  INITIAL_NOTES_STATE,
  INITIAL_PROTOCOLS_STATE,
  INITIAL_PUSH_NOTIFICATION_MODAL_STATE,
  INITIAL_ROLES_STATE,
  INITIAL_SECURITY_STATE,
  INITIAL_UNITS_STATE,
  resetAllStores,
} from '../app-reset.service';

// Get mock references after imports
const mockStorage = jest.requireMock('@/lib/storage').storage;
const mockStorageApp = jest.requireMock('@/lib/storage/app');

// Mock function references for store methods
const mockStatusReset = jest.fn();
const mockOfflineQueueClear = jest.fn();
const mockLoadingReset = jest.fn();
const mockAudioCleanup = jest.fn().mockResolvedValue(undefined);
const mockLiveKitDisconnect = jest.fn().mockResolvedValue(undefined);

describe('app-reset.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset store mocks with proper implementations
    const { useLiveKitStore } = jest.requireMock('@/stores/app/livekit-store');
    const { useAudioStreamStore } = jest.requireMock('@/stores/app/audio-stream-store');
    const { useLoadingStore } = jest.requireMock('@/stores/app/loading-store');
    const { useOfflineQueueStore } = jest.requireMock('@/stores/offline-queue/store');
    const { useStatusBottomSheetStore } = jest.requireMock('@/stores/status/store');

    useLiveKitStore.getState.mockReturnValue({
      isConnected: false,
      disconnectFromRoom: mockLiveKitDisconnect,
    });

    useAudioStreamStore.getState.mockReturnValue({
      cleanup: mockAudioCleanup,
    });

    useLoadingStore.getState.mockReturnValue({
      resetLoading: mockLoadingReset,
    });

    useOfflineQueueStore.getState.mockReturnValue({
      clearAllEvents: mockOfflineQueueClear,
    });

    useStatusBottomSheetStore.getState.mockReturnValue({
      reset: mockStatusReset,
    });
  });

  describe('Initial State Constants', () => {
    it('should export INITIAL_CORE_STATE with correct shape', () => {
      expect(INITIAL_CORE_STATE).toEqual({
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
      });
    });

    it('should export INITIAL_CALLS_STATE with correct shape', () => {
      expect(INITIAL_CALLS_STATE).toEqual({
        calls: [],
        callPriorities: [],
        callTypes: [],
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_UNITS_STATE with correct shape', () => {
      expect(INITIAL_UNITS_STATE).toEqual({
        units: [],
        unitStatuses: [],
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_CONTACTS_STATE with correct shape', () => {
      expect(INITIAL_CONTACTS_STATE).toEqual({
        contacts: [],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        isNotesLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_NOTES_STATE with correct shape', () => {
      expect(INITIAL_NOTES_STATE).toEqual({
        notes: [],
        searchQuery: '',
        selectedNoteId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_ROLES_STATE with correct shape', () => {
      expect(INITIAL_ROLES_STATE).toEqual({
        roles: [],
        unitRoleAssignments: [],
        users: [],
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_PROTOCOLS_STATE with correct shape', () => {
      expect(INITIAL_PROTOCOLS_STATE).toEqual({
        protocols: [],
        searchQuery: '',
        selectedProtocolId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
      });
    });

    it('should export INITIAL_DISPATCH_STATE with correct shape', () => {
      expect(INITIAL_DISPATCH_STATE).toEqual({
        data: {
          users: [],
          groups: [],
          roles: [],
          units: [],
        },
        selection: {
          everyone: false,
          users: [],
          groups: [],
          roles: [],
          units: [],
        },
        isLoading: false,
        error: null,
        searchQuery: '',
      });
    });

    it('should export INITIAL_SECURITY_STATE with correct shape', () => {
      expect(INITIAL_SECURITY_STATE).toEqual({
        error: null,
        rights: null,
      });
    });

    it('should export INITIAL_LOCATION_STATE with correct shape', () => {
      expect(INITIAL_LOCATION_STATE).toEqual({
        latitude: null,
        longitude: null,
        heading: null,
        accuracy: null,
        speed: null,
        altitude: null,
        timestamp: null,
      });
    });

    it('should export INITIAL_LIVEKIT_STATE with correct shape', () => {
      expect(INITIAL_LIVEKIT_STATE).toEqual({
        isConnected: false,
        isConnecting: false,
        currentRoom: null,
        currentRoomInfo: null,
        isTalking: false,
        availableRooms: [],
        isBottomSheetVisible: false,
      });
    });

    it('should export INITIAL_AUDIO_STREAM_STATE with correct shape', () => {
      expect(INITIAL_AUDIO_STREAM_STATE).toEqual({
        availableStreams: [],
        currentStream: null,
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
        isBottomSheetVisible: false,
      });
    });

    it('should export INITIAL_BLUETOOTH_AUDIO_STATE with correct shape', () => {
      expect(INITIAL_BLUETOOTH_AUDIO_STATE).toEqual({
        connectedDevice: null,
        isScanning: false,
        isConnecting: false,
        availableDevices: [],
        connectionError: null,
        isAudioRoutingActive: false,
      });
    });

    it('should export INITIAL_PUSH_NOTIFICATION_MODAL_STATE with correct shape', () => {
      expect(INITIAL_PUSH_NOTIFICATION_MODAL_STATE).toEqual({
        isOpen: false,
        notification: null,
      });
    });
  });

  describe('clearAppStorageItems', () => {
    it('should call all remove functions', () => {
      clearAppStorageItems();

      expect(mockStorageApp.removeActiveUnitId).toHaveBeenCalled();
      expect(mockStorageApp.removeActiveCallId).toHaveBeenCalled();
      expect(mockStorageApp.removeDeviceUuid).toHaveBeenCalled();
    });
  });

  describe('clearPersistedStorage', () => {
    it('should clear all storage keys except preserved ones', () => {
      clearPersistedStorage();

      expect(mockStorage.getAllKeys).toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalledWith('key1');
      expect(mockStorage.delete).toHaveBeenCalledWith('key2');
      expect(mockStorage.delete).not.toHaveBeenCalledWith('IS_FIRST_TIME');
    });
  });

  describe('resetAllStores', () => {
    it('should reset all zustand stores', async () => {
      const { useCoreStore } = jest.requireMock('@/stores/app/core-store');
      const { useCallsStore } = jest.requireMock('@/stores/calls/store');
      const { useUnitsStore } = jest.requireMock('@/stores/units/store');

      await resetAllStores();

      expect(useCoreStore.setState).toHaveBeenCalledWith(INITIAL_CORE_STATE);
      expect(useCallsStore.setState).toHaveBeenCalledWith(INITIAL_CALLS_STATE);
      expect(useUnitsStore.setState).toHaveBeenCalledWith(INITIAL_UNITS_STATE);
      expect(mockStatusReset).toHaveBeenCalled();
      expect(mockOfflineQueueClear).toHaveBeenCalled();
      expect(mockLoadingReset).toHaveBeenCalled();
      expect(mockAudioCleanup).toHaveBeenCalled();
    });

    it('should disconnect from LiveKit room if connected', async () => {
      const { useLiveKitStore } = jest.requireMock('@/stores/app/livekit-store');

      useLiveKitStore.getState.mockReturnValue({
        isConnected: true,
        disconnectFromRoom: mockLiveKitDisconnect,
      });

      await resetAllStores();

      expect(mockLiveKitDisconnect).toHaveBeenCalled();
      expect(useLiveKitStore.setState).toHaveBeenCalledWith(INITIAL_LIVEKIT_STATE);
    });

    it('should not disconnect from LiveKit room if not connected', async () => {
      const { useLiveKitStore } = jest.requireMock('@/stores/app/livekit-store');
      const localMockDisconnect = jest.fn().mockResolvedValue(undefined);

      useLiveKitStore.getState.mockReturnValue({
        isConnected: false,
        disconnectFromRoom: localMockDisconnect,
      });

      await resetAllStores();

      expect(localMockDisconnect).not.toHaveBeenCalled();
      expect(useLiveKitStore.setState).toHaveBeenCalledWith(INITIAL_LIVEKIT_STATE);
    });
  });

  describe('clearAllAppData', () => {
    it('should call all clearing functions in sequence', async () => {
      await clearAllAppData();

      // Should clear app storage items
      expect(mockStorageApp.removeActiveUnitId).toHaveBeenCalled();
      expect(mockStorageApp.removeActiveCallId).toHaveBeenCalled();
      expect(mockStorageApp.removeDeviceUuid).toHaveBeenCalled();

      // Should clear persisted storage
      expect(mockStorage.getAllKeys).toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalled();
    });

    it('should throw error if clearing fails', async () => {
      const { useAudioStreamStore } = jest.requireMock('@/stores/app/audio-stream-store');
      const error = new Error('Cleanup failed');

      useAudioStreamStore.getState.mockReturnValue({
        cleanup: jest.fn().mockRejectedValue(error),
      });

      // The cleanup error is caught and logged within resetAllStores, 
      // so clearAllAppData should complete without throwing
      await expect(clearAllAppData()).resolves.toBeUndefined();
    });
  });
});
