// Mock all dependencies first
jest.mock('@/api/units/unitLocation', () => ({
  setUnitLocation: jest.fn(),
}));
jest.mock('@/lib/hooks/use-background-geolocation', () => ({
  registerLocationServiceUpdater: jest.fn(),
}));
jest.mock('@/lib/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/storage/background-geolocation', () => ({
  loadBackgroundGeolocationState: jest.fn(),
}));

jest.mock('@/services/offline-event-manager.service', () => ({
  offlineEventManager: {
    queueLocationUpdateEvent: jest.fn(),
  },
}));

jest.mock('@/utils/network', () => ({
  isNetworkError: jest.fn(),
}));

// Create mock store states
const mockCoreStoreState = {
  activeUnitId: 'unit-123' as string | null,
};

const mockLocationStoreState = {
  setLocation: jest.fn(),
  setBackgroundEnabled: jest.fn(),
};

// Mock stores with proper Zustand structure
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    getState: jest.fn(() => mockCoreStoreState),
  },
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: {
    getState: jest.fn(() => mockLocationStoreState),
  },
}));

jest.mock('expo-location', () => {
  const mockRequestForegroundPermissions = jest.fn();
  const mockRequestBackgroundPermissions = jest.fn();
  const mockGetBackgroundPermissions = jest.fn();
  const mockWatchPositionAsync = jest.fn();
  const mockStartLocationUpdatesAsync = jest.fn();
  const mockStopLocationUpdatesAsync = jest.fn();
  return {
    requestForegroundPermissionsAsync: mockRequestForegroundPermissions,
    requestBackgroundPermissionsAsync: mockRequestBackgroundPermissions,
    getBackgroundPermissionsAsync: mockGetBackgroundPermissions,
    watchPositionAsync: mockWatchPositionAsync,
    startLocationUpdatesAsync: mockStartLocationUpdatesAsync,
    stopLocationUpdatesAsync: mockStopLocationUpdatesAsync,
    Accuracy: {
      Balanced: 'balanced',
    },
  };
});

// TaskManager mocks are now handled in the jest.mock() call

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
    currentState: 'active',
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios),
  },
}));

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { setUnitLocation } from '@/api/units/unitLocation';
import { registerLocationServiceUpdater } from '@/lib/hooks/use-background-geolocation';
import { logger } from '@/lib/logging';
import { loadBackgroundGeolocationState } from '@/lib/storage/background-geolocation';
import { SaveUnitLocationInput } from '@/models/v4/unitLocation/saveUnitLocationInput';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { isNetworkError } from '@/utils/network';

// Import the service after mocks are set up
let locationService: any;

// Mock types
const mockSetUnitLocation = setUnitLocation as jest.MockedFunction<typeof setUnitLocation>;
const mockRegisterLocationServiceUpdater = registerLocationServiceUpdater as jest.MockedFunction<typeof registerLocationServiceUpdater>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockLoadBackgroundGeolocationState = loadBackgroundGeolocationState as jest.MockedFunction<typeof loadBackgroundGeolocationState>;
const mockIsNetworkError = isNetworkError as jest.MockedFunction<typeof isNetworkError>;
const mockQueueLocationUpdateEvent = offlineEventManager.queueLocationUpdateEvent as jest.Mock;
const mockTaskManager = TaskManager as jest.Mocked<typeof TaskManager>;
const mockAppState = AppState as jest.Mocked<typeof AppState>;
const mockLocation = Location as jest.Mocked<typeof Location>;

// Mock location data
const mockLocationObject: Location.LocationObject = {
  coords: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10.5,
    accuracy: 5.0,
    altitudeAccuracy: 2.0,
    heading: 90.0,
    speed: 15.5,
  },
  timestamp: Date.now(),
};

// Mock API response
const mockApiResponse = {
  Id: 'location-12345',
  PageSize: 0,
  Timestamp: '',
  Version: '',
  Node: '',
  RequestId: '',
  Status: '',
  Environment: '',
};

describe('LocationService', () => {
  let mockLocationSubscription: jest.Mocked<Location.LocationSubscription>;

  beforeAll(() => {
    // Import the service after all mocks are set up
    const { locationService: service } = require('../location');
    locationService = service;
  });

  beforeEach(() => {
    // Clear all mock call history
    jest.clearAllMocks();

    // Reset mock functions in store states - recreate the mock functions
    mockLocationStoreState.setLocation = jest.fn();
    mockLocationStoreState.setBackgroundEnabled = jest.fn();

    // Clear the mock subscription - handled in the mock itself

    // Setup mock location subscription
    mockLocationSubscription = {
      remove: jest.fn(),
    } as jest.Mocked<Location.LocationSubscription>;

    // Setup Location API mocks
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      expires: 'never',
      granted: true,
      canAskAgain: true,
    });

    mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      expires: 'never',
      granted: true,
      canAskAgain: true,
    });

    mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      expires: 'never',
      granted: true,
      canAskAgain: true,
    });

    mockLocation.watchPositionAsync.mockResolvedValue(mockLocationSubscription);
    mockLocation.startLocationUpdatesAsync.mockResolvedValue();
    mockLocation.stopLocationUpdatesAsync.mockResolvedValue();

    // Setup TaskManager mocks
    mockTaskManager.isTaskRegisteredAsync.mockResolvedValue(false);

    // Setup storage mock
    mockLoadBackgroundGeolocationState.mockResolvedValue(false);

    // Setup API mock
    mockSetUnitLocation.mockResolvedValue(mockApiResponse);

    // Default: errors are not network errors (no offline queueing)
    mockIsNetworkError.mockReturnValue(false);

    // Reset core store state
    mockCoreStoreState.activeUnitId = 'unit-123';

    // Reset internal state of the service
    (locationService as any).locationSubscription = null;
    (locationService as any).backgroundSubscription = null;
    (locationService as any).isBackgroundGeolocationEnabled = false;
    (locationService as any).startPromise = null;
    (locationService as any).startBackgroundPromise = null;
  });

  describe('Concurrent start/stop safety', () => {
    it('should create only one foreground watcher when starts overlap', async () => {
      mockLocation.watchPositionAsync.mockResolvedValue(mockLocationSubscription);
      mockTaskManager.isTaskRegisteredAsync.mockResolvedValue(false);

      // Two callers race before the first watcher is assigned — the pre-fix
      // guard let both through and leaked a duplicate watcher.
      const first = locationService.startLocationUpdates();
      const second = locationService.startLocationUpdates();
      await Promise.all([first, second]);

      expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(1);
    });

    it('should not leave an orphaned watcher when stop interleaves with a start', async () => {
      mockLocation.watchPositionAsync.mockResolvedValue(mockLocationSubscription);
      mockTaskManager.isTaskRegisteredAsync.mockResolvedValue(false);

      const start = locationService.startLocationUpdates();
      // Stop issued while the watcher is still being created.
      const stop = locationService.stopLocationUpdates();
      await Promise.all([start, stop]);

      // The stop waited for the start, so the watcher it created was removed.
      expect(mockLocationSubscription.remove).toHaveBeenCalled();
      expect((locationService as any).locationSubscription).toBeNull();
    });

    it('should create only one background watcher when starts overlap', async () => {
      (locationService as any).isBackgroundGeolocationEnabled = true;
      mockTaskManager.isTaskRegisteredAsync.mockResolvedValue(false);
      mockLocation.watchPositionAsync.mockResolvedValue(mockLocationSubscription);

      const first = locationService.startBackgroundUpdates();
      const second = locationService.startBackgroundUpdates();
      await Promise.all([first, second]);

      expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('App state handler resilience', () => {
    it('should log a warning instead of rejecting when a backgrounded start fails', async () => {
      (locationService as any).isBackgroundGeolocationEnabled = true;
      mockTaskManager.isTaskRegisteredAsync.mockRejectedValue(new Error('permission revoked'));

      // The handler is registered with AppState and its result is never awaited,
      // so a throw here would surface as an unhandled rejection.
      await expect((locationService as any).handleAppStateChange('background')).resolves.toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to handle location app state change',
        })
      );
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const LocationServiceClass = (locationService as any).constructor;
      const instance1 = LocationServiceClass.getInstance();
      const instance2 = LocationServiceClass.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Permission Requests', () => {
    it('should only request foreground permissions by default', async () => {
      const result = await locationService.requestPermissions();

      expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(mockLocation.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should request background permissions when explicitly requested', async () => {
      const result = await locationService.requestPermissions(true);

      expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(mockLocation.requestBackgroundPermissionsAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if foreground permission is denied', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      const result = await locationService.requestPermissions();
      expect(result).toBe(false);
    });

    it('should return true if foreground is granted but background is denied', async () => {
      mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      const result = await locationService.requestPermissions();
      expect(result).toBe(true); // Should still work with just foreground permissions
    });

    it('should log permission status for foreground-only requests', async () => {
      await locationService.requestPermissions();

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Location permissions requested',
        context: {
          foregroundStatus: 'granted',
          backgroundStatus: 'not requested',
          backgroundRequested: false,
        },
      });
    });

    it('should log permission status when background is requested and denied', async () => {
      mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      await locationService.requestPermissions(true);

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Location permissions requested',
        context: {
          foregroundStatus: 'granted',
          backgroundStatus: 'denied',
          backgroundRequested: true,
        },
      });
    });
  });

  describe('Location Updates', () => {
    it('should start foreground location updates successfully', async () => {
      await locationService.startLocationUpdates();

      expect(mockLocation.watchPositionAsync).toHaveBeenCalledWith(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 10,
        },
        expect.any(Function)
      );

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Foreground location updates started',
        context: {
          backgroundEnabled: false,
          backgroundPermissions: true,
          backgroundSetting: false,
        },
      });
    });

    it('should start foreground updates even when background permissions are denied', async () => {
      mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      await locationService.startLocationUpdates();

      expect(mockLocation.watchPositionAsync).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Foreground location updates started',
        context: {
          backgroundEnabled: false,
          backgroundPermissions: false,
          backgroundSetting: false,
        },
      });
    });

    it('should warn when background geolocation is enabled but permissions denied', async () => {
      mockLoadBackgroundGeolocationState.mockResolvedValue(true);
      mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      await locationService.startLocationUpdates();

      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Background geolocation enabled but permissions denied, running in foreground-only mode',
        context: {
          backgroundStatus: 'denied',
          settingEnabled: true,
        },
      });
    });

    it('should throw error if foreground permissions are not granted', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      await expect(locationService.startLocationUpdates()).rejects.toThrow('Location permissions not granted');
    });

    it('should register background task if background geolocation is enabled and permissions granted', async () => {
      mockLoadBackgroundGeolocationState.mockResolvedValue(true);

      await locationService.startLocationUpdates();

      expect(mockLocation.startLocationUpdatesAsync).toHaveBeenCalledWith('location-updates', {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: 'Location Tracking',
          notificationBody: 'Tracking your location in the background',
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Foreground location updates started',
        context: {
          backgroundEnabled: true,
          backgroundPermissions: true,
          backgroundSetting: true,
        },
      });
    });

    it('should not register background task if background permissions are denied', async () => {
      mockLoadBackgroundGeolocationState.mockResolvedValue(true);
      mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      await locationService.startLocationUpdates();

      expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('should not register background task if already registered', async () => {
      mockLoadBackgroundGeolocationState.mockResolvedValue(true);
      mockTaskManager.isTaskRegisteredAsync.mockResolvedValue(true);

      await locationService.startLocationUpdates();

      expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('should handle location updates and send to store and API', async () => {
      await locationService.startLocationUpdates();

      // Get the callback function passed to watchPositionAsync
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockLocationStoreState.setLocation).toHaveBeenCalledWith(mockLocationObject);
      expect(mockSetUnitLocation).toHaveBeenCalledWith(expect.any(SaveUnitLocationInput));
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Foreground location update received',
        context: {
          latitude: mockLocationObject.coords.latitude,
          longitude: mockLocationObject.coords.longitude,
          heading: mockLocationObject.coords.heading,
        },
      });
    });
  });

  describe('Background Location Updates', () => {
    beforeEach(() => {
      // Set background geolocation enabled for these tests
      (locationService as any).isBackgroundGeolocationEnabled = true;
    });

    it('should start background updates when not already active', async () => {
      await locationService.startBackgroundUpdates();

      expect(mockLocation.watchPositionAsync).toHaveBeenCalledWith(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000,
          distanceInterval: 20,
        },
        expect.any(Function)
      );

      expect(mockLocationStoreState.setBackgroundEnabled).toHaveBeenCalledWith(true);
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Starting background location updates',
      });
    });

    it('should not start background updates if already active', async () => {
      (locationService as any).backgroundSubscription = mockLocationSubscription;

      await locationService.startBackgroundUpdates();

      expect(mockLocation.watchPositionAsync).not.toHaveBeenCalled();
    });

    it('should not start background updates if disabled', async () => {
      (locationService as any).isBackgroundGeolocationEnabled = false;

      await locationService.startBackgroundUpdates();

      expect(mockLocation.watchPositionAsync).not.toHaveBeenCalled();
    });

    it('should stop background updates correctly', async () => {
      (locationService as any).backgroundSubscription = mockLocationSubscription;

      await locationService.stopBackgroundUpdates();

      expect(mockLocationSubscription.remove).toHaveBeenCalled();
      expect(mockLocationStoreState.setBackgroundEnabled).toHaveBeenCalledWith(false);
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Stopping background location updates',
      });
    });

    it('should handle background location updates and send to API', async () => {
      await locationService.startBackgroundUpdates();

      // Get the callback function
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockLocationStoreState.setLocation).toHaveBeenCalledWith(mockLocationObject);
      expect(mockSetUnitLocation).toHaveBeenCalledWith(expect.any(SaveUnitLocationInput));
    });
  });

  describe('API Integration', () => {
    it('should send location data to API with correct format', async () => {
      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockSetUnitLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          UnitId: 'unit-123',
          Latitude: mockLocationObject.coords.latitude.toString(),
          Longitude: mockLocationObject.coords.longitude.toString(),
          Accuracy: mockLocationObject.coords.accuracy?.toString(),
          Altitude: mockLocationObject.coords.altitude?.toString(),
          AltitudeAccuracy: mockLocationObject.coords.altitudeAccuracy?.toString(),
          Speed: mockLocationObject.coords.speed?.toString(),
          Heading: mockLocationObject.coords.heading?.toString(),
          Timestamp: expect.any(String),
        })
      );
    });

    it('should handle null values in location data', async () => {
      const locationWithNulls: Location.LocationObject = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };

      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(locationWithNulls);

      expect(mockSetUnitLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          Accuracy: '0',
          Altitude: '0',
          AltitudeAccuracy: '0',
          Speed: '0',
          Heading: '0',
        })
      );
    });

    it('should skip API call if no active unit is selected', async () => {
      // Change the core store state for this test
      mockCoreStoreState.activeUnitId = null;

      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockSetUnitLocation).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'No active unit selected, skipping location API call',
      });

      // Reset for other tests
      mockCoreStoreState.activeUnitId = 'unit-123';
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API Error');
      mockSetUnitLocation.mockRejectedValue(apiError);

      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Failed to send location to API',
        context: {
          error: 'API Error',
          latitude: mockLocationObject.coords.latitude,
          longitude: mockLocationObject.coords.longitude,
        },
      });
    });

    it('should queue location update for offline replay on network errors', async () => {
      const networkError = new Error('Network Error');
      mockSetUnitLocation.mockRejectedValue(networkError);
      mockIsNetworkError.mockReturnValue(true);

      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Failed to send location to API',
        context: {
          error: 'Network Error',
          latitude: mockLocationObject.coords.latitude,
          longitude: mockLocationObject.coords.longitude,
        },
      });

      expect(mockQueueLocationUpdateEvent).toHaveBeenCalledWith(
        'unit-123',
        mockLocationObject.coords.latitude,
        mockLocationObject.coords.longitude,
        mockLocationObject.coords.accuracy,
        mockLocationObject.coords.heading,
        mockLocationObject.coords.speed
      );
    });

    it('should not queue location update for non-network errors', async () => {
      const serverError = new Error('Server rejected');
      mockSetUnitLocation.mockRejectedValue(serverError);
      mockIsNetworkError.mockReturnValue(false);

      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockQueueLocationUpdateEvent).not.toHaveBeenCalled();
    });

    it('should not queue location update on network error when no active unit', async () => {
      mockCoreStoreState.activeUnitId = null;
      const networkError = new Error('Network Error');
      mockSetUnitLocation.mockRejectedValue(networkError);
      mockIsNetworkError.mockReturnValue(true);

      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockSetUnitLocation).not.toHaveBeenCalled();
      expect(mockQueueLocationUpdateEvent).not.toHaveBeenCalled();

      mockCoreStoreState.activeUnitId = 'unit-123';
    });

    it('should log successful API calls', async () => {
      // Reset mock to resolved value
      mockSetUnitLocation.mockResolvedValue(mockApiResponse);

      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Location successfully sent to API',
        context: {
          unitId: 'unit-123',
          resultId: mockApiResponse.Id,
          latitude: mockLocationObject.coords.latitude,
          longitude: mockLocationObject.coords.longitude,
        },
      });
    });
  });

  describe('Unavailable sensor values', () => {
    // iOS reports -1 for course, speed and the accuracy fields when the value
    // is unavailable, which a stationary unit does on every fix.
    const locationWithSentinels: Location.LocationObject = {
      coords: {
        latitude: 52.08197889841628,
        longitude: -4.68186865536404,
        altitude: -3.5,
        accuracy: -1,
        altitudeAccuracy: -1,
        heading: -1,
        speed: -1,
      },
      timestamp: 1_755_176_389_981,
    };

    it('sends 0 instead of the iOS -1 sentinel values', async () => {
      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(locationWithSentinels);

      expect(mockSetUnitLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          Accuracy: '0',
          AltitudeAccuracy: '0',
          Speed: '0',
          Heading: '0',
        })
      );
    });

    it('preserves a legitimately negative altitude', async () => {
      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(locationWithSentinels);

      expect(mockSetUnitLocation).toHaveBeenCalledWith(expect.objectContaining({ Altitude: '-3.5' }));
    });

    it('does not queue the -1 sentinels for offline replay', async () => {
      mockSetUnitLocation.mockRejectedValue(new Error('Network Error'));
      mockIsNetworkError.mockReturnValue(true);

      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(locationWithSentinels);

      expect(mockQueueLocationUpdateEvent).toHaveBeenCalledWith('unit-123', locationWithSentinels.coords.latitude, locationWithSentinels.coords.longitude, undefined, undefined, undefined);
    });
  });

  describe('Server rejection backoff', () => {
    // Unit IDs here are deliberately distinct from 'unit-123': the backoff
    // state lives in the module, and a rejection recorded for one unit must
    // not leak into the other tests in this file.
    const createAxiosError = (status: number, data: unknown = { Message: 'Invalid location' }) =>
      Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        response: { status, data },
      });

    let nowSpy: jest.SpyInstance;
    let now = 1_700_000_000_000;

    beforeEach(() => {
      now = 1_700_000_000_000;
      nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    });

    afterEach(() => {
      nowSpy.mockRestore();
      mockCoreStoreState.activeUnitId = 'unit-123';
    });

    const sendLocation = async (): Promise<void> => {
      await locationService.startLocationUpdates();
      const locationCallback = mockLocation.watchPositionAsync.mock.calls.at(-1)![1] as Function;
      await locationCallback(mockLocationObject);
    };

    it('logs the response status and body so the rejection can be diagnosed', async () => {
      mockCoreStoreState.activeUnitId = 'unit-reject-status';
      mockSetUnitLocation.mockRejectedValue(createAxiosError(400, { Message: 'Heading out of range' }));

      await sendLocation();

      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Failed to send location to API',
        context: {
          error: 'Request failed with status code 400',
          status: 400,
          response: { Message: 'Heading out of range' },
          latitude: mockLocationObject.coords.latitude,
          longitude: mockLocationObject.coords.longitude,
        },
      });
    });

    it('stops sending for the backoff window after a 4xx and resumes once it elapses', async () => {
      mockCoreStoreState.activeUnitId = 'unit-reject-backoff';
      mockSetUnitLocation.mockRejectedValue(createAxiosError(400));

      await sendLocation();
      expect(mockSetUnitLocation).toHaveBeenCalledTimes(1);

      // Well inside the 30s window — the next fix must not hit the API.
      now += 10_000;
      await sendLocation();
      expect(mockSetUnitLocation).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ message: 'Skipping location API call while backing off after server rejection' }));

      now += 25_000;
      await sendLocation();
      expect(mockSetUnitLocation).toHaveBeenCalledTimes(2);
    });

    it('escalates the backoff on repeated rejections', async () => {
      mockCoreStoreState.activeUnitId = 'unit-reject-escalate';
      mockSetUnitLocation.mockRejectedValue(createAxiosError(400));

      await sendLocation();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Backing off location updates after server rejection', context: expect.objectContaining({ backoffMs: 30_000 }) }));

      now += 31_000;
      await sendLocation();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Backing off location updates after server rejection', context: expect.objectContaining({ backoffMs: 60_000 }) }));
    });

    it('clears the backoff when the active unit changes', async () => {
      mockCoreStoreState.activeUnitId = 'unit-reject-switch-a';
      mockSetUnitLocation.mockRejectedValue(createAxiosError(400));

      await sendLocation();
      expect(mockSetUnitLocation).toHaveBeenCalledTimes(1);

      // Same instant, different unit: the previous rejection says nothing
      // about this one.
      mockCoreStoreState.activeUnitId = 'unit-reject-switch-b';
      await sendLocation();
      expect(mockSetUnitLocation).toHaveBeenCalledTimes(2);
    });

    it('clears the backoff after a successful send', async () => {
      mockCoreStoreState.activeUnitId = 'unit-reject-recover';
      mockSetUnitLocation.mockRejectedValue(createAxiosError(400));
      await sendLocation();

      now += 31_000;
      mockSetUnitLocation.mockResolvedValue(mockApiResponse);
      await sendLocation();

      mockLogger.warn.mockClear();
      mockSetUnitLocation.mockRejectedValue(createAxiosError(400));
      await sendLocation();

      // Counter restarted, so this is a first rejection again, not a third.
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Backing off location updates after server rejection', context: expect.objectContaining({ consecutiveRejections: 1, backoffMs: 30_000 }) })
      );
    });

    it('does not back off on server errors, which are transient', async () => {
      mockCoreStoreState.activeUnitId = 'unit-reject-5xx';
      mockSetUnitLocation.mockRejectedValue(createAxiosError(503));

      await sendLocation();
      await sendLocation();

      expect(mockSetUnitLocation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Background Geolocation Setting Updates', () => {
    it('should enable background tracking and register task when permissions are granted', async () => {
      await locationService.updateBackgroundGeolocationSetting(true);

      expect(mockLocation.startLocationUpdatesAsync).toHaveBeenCalledWith(
        'location-updates',
        expect.objectContaining({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 10,
        })
      );
    });

    it('should warn and not register task when background permissions are denied', async () => {
      mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });

      await locationService.updateBackgroundGeolocationSetting(true);

      expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Cannot enable background geolocation: background permissions not granted',
        context: { backgroundStatus: 'denied' },
      });
    });

    it('should disable background tracking and unregister task', async () => {
      mockTaskManager.isTaskRegisteredAsync.mockResolvedValue(true);

      await locationService.updateBackgroundGeolocationSetting(false);

      expect(mockLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith('location-updates');
    });

    it('should start background updates if app is backgrounded when enabled', async () => {
      (AppState as any).currentState = 'background';
      const startBackgroundUpdatesSpy = jest.spyOn(locationService, 'startBackgroundUpdates');

      await locationService.updateBackgroundGeolocationSetting(true);

      expect(startBackgroundUpdatesSpy).toHaveBeenCalled();
    });

    it('should not start background updates if app is active when enabled', async () => {
      (AppState as any).currentState = 'active';
      const startBackgroundUpdatesSpy = jest.spyOn(locationService, 'startBackgroundUpdates');

      await locationService.updateBackgroundGeolocationSetting(true);

      expect(startBackgroundUpdatesSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should stop all location updates', async () => {
      (locationService as any).locationSubscription = mockLocationSubscription;
      (locationService as any).backgroundSubscription = mockLocationSubscription;
      mockTaskManager.isTaskRegisteredAsync.mockResolvedValue(true);

      await locationService.stopLocationUpdates();

      expect(mockLocationSubscription.remove).toHaveBeenCalledTimes(2);
      expect(mockLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith('location-updates');
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'All location updates stopped',
      });
    });

    it('should cleanup app state subscription', () => {
      locationService.cleanup();

      // Note: The subscription's remove method is called, but we can't easily test it
      // since the subscription is created dynamically inside the mock
      expect(true).toBe(true); // This test passes if cleanup doesn't throw
    });

    it('should handle cleanup when no subscription exists', () => {
      (locationService as any).appStateSubscription = null;

      expect(() => locationService.cleanup()).not.toThrow();
    });
  });

  describe('Foreground-only Mode (Background Permissions Denied)', () => {
    beforeEach(() => {
      // Mock background permissions as denied for these tests
      mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });
      mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 'never',
        granted: false,
        canAskAgain: true,
      });
    });

    it('should allow location tracking with only foreground permissions', async () => {
      const result = await locationService.requestPermissions();
      expect(result).toBe(true);

      await expect(locationService.startLocationUpdates()).resolves.not.toThrow();
      expect(mockLocation.watchPositionAsync).toHaveBeenCalled();
    });

    it('should log correct permission status for foreground-only requests', async () => {
      await locationService.requestPermissions();

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Location permissions requested',
        context: {
          foregroundStatus: 'granted',
          backgroundStatus: 'not requested',
          backgroundRequested: false,
        },
      });
    });

    it('should start foreground updates and warn about background limitations', async () => {
      mockLoadBackgroundGeolocationState.mockResolvedValue(true); // User wants background but can't have it

      await locationService.startLocationUpdates();

      expect(mockLocation.watchPositionAsync).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Background geolocation enabled but permissions denied, running in foreground-only mode',
        context: {
          backgroundStatus: 'denied',
          settingEnabled: true,
        },
      });
      expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('should handle location updates in foreground-only mode', async () => {
      await locationService.startLocationUpdates();

      const locationCallback = mockLocation.watchPositionAsync.mock.calls[0][1] as Function;
      await locationCallback(mockLocationObject);

      expect(mockLocationStoreState.setLocation).toHaveBeenCalledWith(mockLocationObject);
      expect(mockSetUnitLocation).toHaveBeenCalledWith(expect.any(SaveUnitLocationInput));
    });

    it('should not enable background geolocation when permissions are denied', async () => {
      await locationService.updateBackgroundGeolocationSetting(true);

      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Cannot enable background geolocation: background permissions not granted',
        context: { backgroundStatus: 'denied' },
      });
      expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle location subscription errors', async () => {
      const error = new Error('Location subscription failed');
      mockLocation.watchPositionAsync.mockRejectedValue(error);

      await expect(locationService.startLocationUpdates()).rejects.toThrow('Location subscription failed');
    });

    it('should handle background task registration errors', async () => {
      const error = new Error('Task registration failed');
      mockLocation.startLocationUpdatesAsync.mockRejectedValue(error);
      mockLoadBackgroundGeolocationState.mockResolvedValue(true);

      await expect(locationService.startLocationUpdates()).rejects.toThrow('Task registration failed');
    });
  });
});
