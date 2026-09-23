import { AppState } from 'react-native';

import { saveCallImage } from '@/api/calls/callFiles';
import { setUnitLocation } from '@/api/units/unitLocation';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { QueuedEventStatus, QueuedEventType } from '@/models/offline-queue/queued-event';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
    currentState: 'active',
  },
}));

// Mock APIs
jest.mock('@/api/calls/callFiles', () => ({
  saveCallImage: jest.fn(),
}));

jest.mock('@/api/units/unitLocation', () => ({
  setUnitLocation: jest.fn(),
}));

jest.mock('@/api/units/unitStatuses', () => ({
  saveUnitStatus: jest.fn(),
}));

jest.mock('@/api/check-in-timers/check-in-timers', () => ({
  performCheckIn: jest.fn(),
}));

// Mock the offline queue store
jest.mock('@/stores/offline-queue/store', () => ({
  useOfflineQueueStore: {
    getState: jest.fn(),
  },
  setOfflineQueueActivityListener: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock models
jest.mock('@/models/v4/unitLocation/saveUnitLocationInput', () => ({
  SaveUnitLocationInput: jest.fn().mockImplementation(() => ({
    UnitId: '',
    Timestamp: '',
    Latitude: '',
    Longitude: '',
    Accuracy: '',
    Altitude: '',
    AltitudeAccuracy: '',
    Speed: '',
    Heading: '',
  })),
}));

jest.mock('@/models/v4/unitStatus/saveUnitStatusInput', () => ({
  SaveUnitStatusInput: jest.fn().mockImplementation(() => ({
    Id: '',
    Type: '',
    Note: '',
    RespondingTo: '',
    Timestamp: '',
    TimestampUtc: '',
    Roles: [],
  })),
  SaveUnitStatusRoleInput: jest.fn().mockImplementation(() => ({
    RoleId: '',
    UserId: '',
  })),
}));

const mockSaveCallImage = saveCallImage as jest.MockedFunction<typeof saveCallImage>;
const mockSetUnitLocation = setUnitLocation as jest.MockedFunction<typeof setUnitLocation>;
const mockSaveUnitStatus = saveUnitStatus as jest.MockedFunction<typeof saveUnitStatus>;
const mockUseOfflineQueueStore = useOfflineQueueStore as { getState: jest.MockedFunction<any> };
const mockAppState = AppState as jest.Mocked<typeof AppState>;

describe('OfflineEventManager', () => {
  let mockStoreState: any;

  // The processing timer only runs while the queue has something to do, so any
  // test that expects a timer has to give the queue work first.
  const seedPendingWork = (): void => {
    const event = {
      id: 'seeded-event',
      type: QueuedEventType.UNIT_STATUS,
      status: QueuedEventStatus.PENDING,
      data: { unitId: 'unit-1', statusType: 'available', timestamp: '2023-01-01T00:00:00Z', timestampUtc: 'Sun, 01 Jan 2023 00:00:00 GMT' },
      retryCount: 0,
      maxRetries: 3,
      createdAt: Date.now(),
    };
    mockStoreState.getPendingEvents.mockReturnValue([event]);
    mockStoreState.queuedEvents = [event];
  };

  beforeAll(() => {
    // Use fake timers for the entire test suite
    jest.useFakeTimers();
  });

  afterAll(() => {
    // Clean up any remaining timers and restore real timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    mockStoreState = {
      isConnected: true,
      isNetworkReachable: true,
      addEvent: jest.fn().mockReturnValue('test-event-id'),
      updateEventStatus: jest.fn(),
      removeEvent: jest.fn(),
      getPendingEvents: jest.fn().mockReturnValue([]),
      getFailedEvents: jest.fn().mockReturnValue([]),
      pruneFailedEvents: jest.fn(),
      queuedEvents: [],
      initializeNetworkListener: jest.fn(),
      retryAllFailedEvents: jest.fn(),
      clearCompletedEvents: jest.fn(),
      _setProcessing: jest.fn(),
      totalEvents: 0,
      completedEvents: 0,
    };

    mockUseOfflineQueueStore.getState.mockReturnValue(mockStoreState);

    // Setup AppState mock
    mockAppState.addEventListener.mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    // Ensure processing is stopped after each test
    try {
      offlineEventManager.stopProcessing();
    } catch (e) {
      // Ignore any errors during cleanup
    }
    jest.clearAllTimers();
  });

  describe('queueUnitStatusEvent', () => {
    it('should queue a unit status event', () => {
      const eventId = offlineEventManager.queueUnitStatusEvent('unit-1', 'available', 'Test note', 'call-1', 2, [{ roleId: 'role-1', userId: 'user-1' }]);

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.UNIT_STATUS,
        expect.objectContaining({
          unitId: 'unit-1',
          statusType: 'available',
          note: 'Test note',
          respondingTo: 'call-1',
          respondingToType: 2,
          roles: [{ roleId: 'role-1', userId: 'user-1' }],
          timestamp: expect.any(String),
          timestampUtc: expect.any(String),
        })
      );
    });

    it('should queue unit status event without optional parameters', () => {
      const eventId = offlineEventManager.queueUnitStatusEvent('unit-1', 'available');

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.UNIT_STATUS,
        expect.objectContaining({
          unitId: 'unit-1',
          statusType: 'available',
          note: undefined,
          respondingTo: undefined,
          respondingToType: undefined,
          roles: undefined,
        })
      );
    });
  });

  describe('queueLocationUpdateEvent', () => {
    it('should queue a location update event', () => {
      const eventId = offlineEventManager.queueLocationUpdateEvent('unit-1', 40.7128, -74.006, 10, 45, 25);

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.LOCATION_UPDATE,
        expect.objectContaining({
          unitId: 'unit-1',
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          heading: 45,
          speed: 25,
          timestamp: expect.any(String),
        })
      );
    });

    it('should queue location update event without optional parameters', () => {
      const eventId = offlineEventManager.queueLocationUpdateEvent('unit-1', 40.7128, -74.006);

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.LOCATION_UPDATE,
        expect.objectContaining({
          unitId: 'unit-1',
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: undefined,
          heading: undefined,
          speed: undefined,
        })
      );
    });
  });

  describe('queueCallImageUploadEvent', () => {
    it('should queue a call image upload event', () => {
      const eventId = offlineEventManager.queueCallImageUploadEvent('call-1', 'user-1', 'Test note', 'image.jpg', '/path/to/image.jpg', 40.7128, -74.006);

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.CALL_IMAGE_UPLOAD,
        expect.objectContaining({
          callId: 'call-1',
          userId: 'user-1',
          note: 'Test note',
          name: 'image.jpg',
          filePath: '/path/to/image.jpg',
          latitude: 40.7128,
          longitude: -74.006,
        })
      );
    });

    it('should queue call image upload event without optional parameters', () => {
      const eventId = offlineEventManager.queueCallImageUploadEvent('call-1', 'user-1', 'Test note', 'image.jpg', '/path/to/image.jpg');

      expect(eventId).toBe('test-event-id');
      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.CALL_IMAGE_UPLOAD,
        expect.objectContaining({
          callId: 'call-1',
          userId: 'user-1',
          note: 'Test note',
          name: 'image.jpg',
          filePath: '/path/to/image.jpg',
          latitude: undefined,
          longitude: undefined,
        })
      );
    });
  });

  describe('getStats', () => {
    it('should return processing statistics', () => {
      mockStoreState.totalEvents = 10;
      mockStoreState.completedEvents = 7;
      mockStoreState.getPendingEvents.mockReturnValue([{ id: '1' }, { id: '2' }]);
      mockStoreState.getFailedEvents.mockReturnValue([{ id: '3' }]);

      const stats = offlineEventManager.getStats();

      expect(stats).toEqual({
        isProcessing: false,
        totalEvents: 10,
        pendingEvents: 2,
        failedEvents: 1,
        completedEvents: 7,
      });
    });
  });

  describe('retryFailedEvents', () => {
    it('should retry all failed events', () => {
      offlineEventManager.retryFailedEvents();

      expect(mockStoreState.retryAllFailedEvents).toHaveBeenCalled();
    });
  });

  describe('clearCompletedEvents', () => {
    it('should clear completed events', () => {
      offlineEventManager.clearCompletedEvents();

      expect(mockStoreState.clearCompletedEvents).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should initialize network listener', () => {
      offlineEventManager.initialize();

      expect(mockStoreState.initializeNetworkListener).toHaveBeenCalled();
    });
  });

  describe('startProcessing', () => {
    it('should start processing interval when the queue has work', () => {
      seedPendingWork();
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      offlineEventManager.startProcessing();

      // Verify setInterval was called
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);

      // Verify immediate processing call
      expect(mockStoreState.getPendingEvents).toHaveBeenCalled();
    });

    it('should not start multiple intervals', () => {
      seedPendingWork();
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      offlineEventManager.startProcessing();
      offlineEventManager.startProcessing();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('should not arm a timer while the queue is empty', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      offlineEventManager.startProcessing();

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('should stop the timer once the queue drains', async () => {
      // Arm the timer while offline so the initial run returns before it starts
      // draining (which would otherwise still be in flight below).
      seedPendingWork();
      mockStoreState.isConnected = false;
      mockStoreState.isNetworkReachable = false;

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      offlineEventManager.startProcessing();
      clearIntervalSpy.mockClear();

      // Queue drains — the next tick has nothing to do and must not keep ticking.
      mockStoreState.isConnected = true;
      mockStoreState.isNetworkReachable = true;
      mockStoreState.getPendingEvents.mockReturnValue([]);
      mockStoreState.queuedEvents = [];

      await (offlineEventManager as any).processQueuedEvents();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should evict permanently failed events while processing', async () => {
      seedPendingWork();

      await (offlineEventManager as any).processQueuedEvents();

      expect(mockStoreState.pruneFailedEvents).toHaveBeenCalled();
    });

    it('should keep the timer armed for events waiting on a retry backoff', async () => {
      // Not returned by getPendingEvents (backoff has not elapsed) but still live.
      mockStoreState.getPendingEvents.mockReturnValue([]);
      mockStoreState.queuedEvents = [{ id: 'backoff', status: QueuedEventStatus.FAILED, retryCount: 1, maxRetries: 3, nextRetryAt: Date.now() + 60000 }];

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      offlineEventManager.startProcessing();
      clearIntervalSpy.mockClear();

      await (offlineEventManager as any).processQueuedEvents();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });
  });

  describe('stopProcessing', () => {
    it('should stop processing interval', () => {
      seedPendingWork();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      offlineEventManager.startProcessing();
      offlineEventManager.stopProcessing();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('event processing', () => {
    beforeEach(() => {
      mockSaveUnitStatus.mockResolvedValue({} as any);
      mockSetUnitLocation.mockResolvedValue({} as any);
      mockSaveCallImage.mockResolvedValue({} as any);
    });

    it('should set up processing interval but skip processing when offline', () => {
      seedPendingWork();
      mockStoreState.isConnected = false;
      mockStoreState.isNetworkReachable = false;

      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      offlineEventManager.startProcessing();

      // The interval stays armed while offline so the queued work drains as soon
      // as connectivity returns; processing itself returns early.
      expect(setIntervalSpy).toHaveBeenCalled();
      expect(mockStoreState.updateEventStatus).not.toHaveBeenCalled();
    });

    it('should set up processing interval when online', () => {
      const mockEvent = {
        id: 'test-event',
        type: QueuedEventType.UNIT_STATUS,
        status: QueuedEventStatus.PENDING,
        data: {
          unitId: 'unit-1',
          statusType: 'available',
          timestamp: '2023-01-01T00:00:00Z',
          timestampUtc: 'Sun, 01 Jan 2023 00:00:00 GMT',
        },
        retryCount: 0,
        maxRetries: 3,
        createdAt: Date.now(),
      };

      mockStoreState.getPendingEvents.mockReturnValue([mockEvent]);
      mockStoreState.queuedEvents = [mockEvent];
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      // Trigger processing
      offlineEventManager.startProcessing();

      // The interval should be set up
      expect(setIntervalSpy).toHaveBeenCalled();

      // Verify that getPendingEvents is called immediately when online
      expect(mockStoreState.getPendingEvents).toHaveBeenCalled();
    });
  });

  describe('unit status replay rejected by the server', () => {
    const httpError = (status: number) => Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: { status } });

    const networkError = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK', request: {} });

    const buildEvent = (respondingTo: string, respondingToType: number | null) => ({
      id: 'status-event',
      type: QueuedEventType.UNIT_STATUS,
      status: QueuedEventStatus.PENDING,
      data: {
        unitId: 'unit-1',
        statusType: '3',
        note: 'On scene',
        respondingTo,
        respondingToType,
        // When the crew tapped the status — not when the queue drains
        timestamp: '2026-09-23T10:00:00.000Z',
        timestampUtc: 'Wed, 23 Sep 2026 10:00:00 GMT',
      },
      retryCount: 0,
      maxRetries: 3,
      createdAt: Date.now(),
    });

    const processEvent = (event: ReturnType<typeof buildEvent>) => (offlineEventManager as any).processEvent(event);

    it('replays once without the destination when the server rejects it with 400, keeping the original time', async () => {
      mockSaveUnitStatus.mockRejectedValueOnce(httpError(400)).mockResolvedValueOnce({} as any);

      await processEvent(buildEvent('555', 2));

      expect(mockSaveUnitStatus).toHaveBeenCalledTimes(2);
      expect(mockSaveUnitStatus).toHaveBeenNthCalledWith(1, expect.objectContaining({ RespondingTo: '555', RespondingToType: 2, Timestamp: '2026-09-23T10:00:00.000Z' }));
      expect(mockSaveUnitStatus).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ Type: '3', Note: 'On scene', RespondingTo: '0', RespondingToType: null, Timestamp: '2026-09-23T10:00:00.000Z', TimestampUtc: 'Wed, 23 Sep 2026 10:00:00 GMT' })
      );
      expect(mockStoreState.updateEventStatus).toHaveBeenLastCalledWith('status-event', QueuedEventStatus.COMPLETED);
    });

    it('stops retrying when the replay without destination is rejected too', async () => {
      mockSaveUnitStatus.mockRejectedValueOnce(httpError(400)).mockRejectedValueOnce(httpError(400));

      await processEvent(buildEvent('555', 2));

      expect(mockSaveUnitStatus).toHaveBeenCalledTimes(2);
      expect(mockStoreState.updateEventStatus).toHaveBeenLastCalledWith('status-event', QueuedEventStatus.FAILED, expect.stringContaining('HTTP 400'), { permanent: true });
    });

    it('stops retrying a status without destination that the server rejects with 400', async () => {
      mockSaveUnitStatus.mockRejectedValueOnce(httpError(400));

      await processEvent(buildEvent('0', null));

      expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1);
      expect(mockStoreState.updateEventStatus).toHaveBeenLastCalledWith('status-event', QueuedEventStatus.FAILED, expect.any(String), { permanent: true });
    });

    it.each([[403], [404]])('stops retrying on other client errors (%p) without a destination fallback', async (status) => {
      mockSaveUnitStatus.mockRejectedValueOnce(httpError(status));

      await processEvent(buildEvent('555', 2));

      expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1);
      expect(mockStoreState.updateEventStatus).toHaveBeenLastCalledWith('status-event', QueuedEventStatus.FAILED, expect.stringContaining(`HTTP ${status}`), { permanent: true });
    });

    it.each([
      ['a network error', networkError()],
      ['a server error', httpError(500)],
      ['an expired session', httpError(401)],
      ['throttling', httpError(429)],
    ])('keeps the normal retry for %s', async (_label, error) => {
      mockSaveUnitStatus.mockRejectedValueOnce(error);

      await processEvent(buildEvent('555', 2));

      expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1);
      expect(mockStoreState.updateEventStatus).toHaveBeenLastCalledWith('status-event', QueuedEventStatus.FAILED, (error as Error).message);
    });

    it('queues the time the status was recorded rather than the enqueue time', () => {
      const recordedAt = new Date('2026-09-23T10:00:00.000Z');

      offlineEventManager.queueUnitStatusEvent('unit-1', '3', '', '555', 2, [], undefined, recordedAt);

      expect(mockStoreState.addEvent).toHaveBeenCalledWith(
        QueuedEventType.UNIT_STATUS,
        expect.objectContaining({ respondingTo: '555', respondingToType: 2, timestamp: '2026-09-23T10:00:00.000Z', timestampUtc: 'Wed, 23 Sep 2026 10:00:00 GMT' })
      );
    });
  });

  describe('app state handling', () => {
    it('should have set up app state listener during initialization', () => {
      // The AppState listener should have been set up when the module was imported
      // Even if the mock wasn't capturing it initially, we can test the behavior
      // by directly calling the handler method that would be triggered

      // Create a spy to verify the method calls
      const startProcessingSpy = jest.spyOn(offlineEventManager, 'startProcessing');

      // Since we can't easily test the private method directly, let's test via initialize
      // which calls handleAppStateChange with current state
      offlineEventManager.initialize();

      // The initialize method calls handleAppStateChange with AppState.currentState ('active')
      // which should trigger startProcessing
      expect(startProcessingSpy).toHaveBeenCalled();
    });

    it('should be able to handle app state changes', () => {
      // Test that the service has the capability to handle state changes
      // by testing the initialize method which demonstrates the app state handling
      expect(() => {
        offlineEventManager.initialize();
      }).not.toThrow();

      // Verify the store initialization was called
      expect(mockStoreState.initializeNetworkListener).toHaveBeenCalled();
    });
  });
});
