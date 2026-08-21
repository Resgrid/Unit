import { act, renderHook } from '@testing-library/react-native';

// Create the mock before any imports
const mockCoreStoreGetState = jest.fn(() => ({
  config: {
    EventingUrl: 'https://eventing.example.com/',
  },
}));

// Mock all dependencies before importing anything
jest.mock('@/services/signalr.service', () => {
  const mockInstance = {
    connectToHubWithEventingUrl: jest.fn().mockResolvedValue(undefined),
    disconnectFromHub: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    connectToHub: jest.fn().mockResolvedValue(undefined),
    disconnectAll: jest.fn().mockResolvedValue(undefined),
  };
  class MockSignalRService {
    static readonly HUB_DISCONNECTED_EVENT = '__hubDisconnected';
    static readonly HUB_RECONNECTING_EVENT = '__hubReconnecting';
    static readonly HUB_RECONNECTED_EVENT = '__hubReconnected';
  }
  return {
    SignalRService: MockSignalRService,
    signalRService: mockInstance,
    default: mockInstance,
  };
});

// Mock the core store module directly - mock as a function that behaves like a Zustand store
jest.mock('../../app/core-store', () => {
  const createMockStore = () => {
    const mockStore = () => mockCoreStoreGetState();
    // Ensure getState always calls the current mock function
    mockStore.getState = () => mockCoreStoreGetState();
    mockStore.subscribe = jest.fn();
    mockStore.setState = jest.fn();
    mockStore.destroy = jest.fn();

    return mockStore;
  };

  return {
    useCoreStore: createMockStore(),
  };
});

// Feature flags: default the chat flag to enabled so connectChatHub is not short-circuited.
jest.mock('../../feature-flags/store', () => ({
  FeatureFlagKeys: { ChatSystem: 'Chat.System' },
  featureFlagsStore: {
    getState: jest.fn(() => ({
      isEnabled: jest.fn(() => true),
    })),
  },
}));

const mockFetchCalls = jest.fn().mockResolvedValue(undefined);
jest.mock('../../calls/store', () => ({
  useCallsStore: {
    getState: jest.fn(() => ({
      fetchCalls: mockFetchCalls,
    })),
  },
}));

jest.mock('../../security/store', () => ({
  securityStore: {
    getState: jest.fn(() => ({
      rights: {
        DepartmentId: '123',
      },
    })),
  },
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  },
}));

jest.mock('@/lib/env', () => ({
  Env: {
    CHANNEL_HUB_NAME: 'eventingHub',
    REALTIME_GEO_HUB_NAME: 'geolocationHub',
  },
}));

jest.mock('@/lib', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      accessToken: 'mock-token',
    })),
  },
}));

// Import the store after all mocks are set up
import { useSignalRStore } from '../signalr-store';
import { logger } from '@/lib/logging';
import { signalRService } from '@/services/signalr.service';
import { securityStore } from '../../security/store';

const mockSecurityStoreGetState = securityStore.getState as jest.Mock;

describe('useSignalRStore', () => {
  const mockEventingUrl = 'https://eventing.example.com/';
  const mockDepartmentId = '123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset store state — the store is a module-level singleton and connection
    // flags persist across tests otherwise.
    useSignalRStore.setState({
      isUpdateHubConnected: false,
      lastUpdateMessage: null,
      lastUpdateTimestamp: 0,
      lastUpdateTimestamps: {},
      lastUnitStatusMessage: null,
      lastUnitStatusTimestamp: 0,
      isGeolocationHubConnected: false,
      lastGeolocationMessage: null,
      lastGeolocationTimestamp: 0,
      error: null,
    });

    // Reset the mock function to default behavior
    mockCoreStoreGetState.mockReturnValue({
      config: {
        EventingUrl: mockEventingUrl,
      },
    });

    // Mock security store
    mockSecurityStoreGetState.mockReturnValue({
      rights: {
        DepartmentId: mockDepartmentId,
      },
    } as any);

    // Mock SignalR service methods
    (signalRService.connectToHubWithEventingUrl as jest.Mock).mockResolvedValue(undefined);
    (signalRService.disconnectFromHub as jest.Mock).mockResolvedValue(undefined);
    (signalRService.invoke as jest.Mock).mockResolvedValue(undefined);
    (signalRService.on as jest.Mock).mockImplementation(() => {});
  });

  describe('Basic Store Functionality', () => {
    it('should create a store instance with correct initial state', () => {
      const { result } = renderHook(() => useSignalRStore());

      expect(result.current).toBeDefined();
      expect(typeof result.current.connectUpdateHub).toBe('function');
      expect(typeof result.current.disconnectUpdateHub).toBe('function');
      expect(typeof result.current.connectGeolocationHub).toBe('function');
      expect(typeof result.current.disconnectGeolocationHub).toBe('function');

      expect(result.current.isUpdateHubConnected).toBe(false);
      expect(result.current.isGeolocationHubConnected).toBe(false);
      expect(result.current.lastUpdateMessage).toBeNull();
      expect(result.current.lastGeolocationMessage).toBeNull();
      expect(result.current.lastUpdateTimestamp).toBe(0);
      expect(result.current.lastGeolocationTimestamp).toBe(0);
      expect(result.current.lastUpdateTimestamps).toEqual({});
      expect(result.current.lastUnitStatusMessage).toBeNull();
      expect(result.current.lastUnitStatusTimestamp).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe('connectUpdateHub', () => {
    it('should handle missing EventingUrl', async () => {
      // Mock core store without EventingUrl
      mockCoreStoreGetState.mockReturnValue({
        config: {
          EventingUrl: undefined,
        } as any,
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      expect(signalRService.connectToHubWithEventingUrl).not.toHaveBeenCalled();
      expect(result.current.error).toEqual(new Error('EventingUrl not available in config. Please ensure config is loaded first.'));

      expect(logger.error).toHaveBeenCalledWith({
        message: 'EventingUrl not available in config. Please ensure config is loaded first.',
      });
    });

    it('should handle missing config', async () => {
      // Mock core store without config
      mockCoreStoreGetState.mockReturnValue({
        config: null as any,
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      expect(signalRService.connectToHubWithEventingUrl).not.toHaveBeenCalled();
      expect(result.current.error).toEqual(new Error('EventingUrl not available in config. Please ensure config is loaded first.'));
    });

    it('should handle connection errors without double-reporting what the service already logged', async () => {
      const connectionError = new Error('Connection failed');
      (signalRService.connectToHubWithEventingUrl as jest.Mock).mockRejectedValue(connectionError);

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      expect(result.current.error).toEqual(connectionError);
      // The service logs the connect failure with hub context; the store must not
      // log the same transient failure a second time.
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to connect to SignalR hubs',
        })
      );
    });

    it('should register listeners BEFORE starting the connection so an early onConnected is not dropped', async () => {
      const registeredBeforeConnect: string[] = [];
      let connectStarted = false;

      (signalRService.on as jest.Mock).mockImplementation((event: string) => {
        if (!connectStarted) {
          registeredBeforeConnect.push(event);
        }
      });
      (signalRService.connectToHubWithEventingUrl as jest.Mock).mockImplementation(async () => {
        connectStarted = true;
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      // onConnected is the flag-setting listener the race dropped.
      expect(registeredBeforeConnect).toContain('onConnected');
      expect(registeredBeforeConnect).toContain('callAdded');
      expect(registeredBeforeConnect).toContain('__hubReconnected:eventingHub');
    });

    it('should set isUpdateHubConnected when onConnected fires during the connect call', async () => {
      const handlers: Record<string, (message?: unknown) => void> = {};
      (signalRService.on as jest.Mock).mockImplementation((event: string, handler: (message: unknown) => void) => {
        handlers[event] = handler;
      });
      // Simulate the server raising onConnected while connectToHubWithEventingUrl
      // is still in flight — the exact race the fix addresses.
      (signalRService.connectToHubWithEventingUrl as jest.Mock).mockImplementation(async () => {
        handlers['onConnected']?.();
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      expect(result.current.isUpdateHubConnected).toBe(true);
    });

    it('should join the department group with the parsed DepartmentId', async () => {
      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      expect(signalRService.invoke).toHaveBeenCalledWith('eventingHub', 'connect', 123);
    });

    it.each([
      ['missing', undefined],
      ['non-numeric', 'abc'],
      ['zero', '0'],
      ['negative', '-5'],
    ])('should not join the department group when DepartmentId is %s', async (_label, departmentId) => {
      mockSecurityStoreGetState.mockReturnValue({
        rights: {
          DepartmentId: departmentId,
        },
      } as any);

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      expect(signalRService.invoke).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({
        message: 'Cannot join SignalR department group: invalid or missing DepartmentId',
        context: { rawDepartmentId: departmentId },
      });
    });

    it('should register per-event handlers that record raw messages and per-event timestamps', async () => {
      const handlers: Record<string, (message?: unknown) => void> = {};
      (signalRService.on as jest.Mock).mockImplementation((event: string, handler: (message: unknown) => void) => {
        handlers[event] = handler;
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      const callsMessage = { CallId: '42' };
      act(() => {
        handlers['callsUpdated'](callsMessage);
      });

      expect(result.current.lastUpdateMessage).toBe(callsMessage);
      expect(result.current.lastUpdateTimestamp).toBeGreaterThan(0);
      expect(result.current.lastUpdateTimestamps.callsUpdated).toBe(result.current.lastUpdateTimestamp);

      const unitMessage = { UnitId: '123' };
      act(() => {
        handlers['unitStatusUpdated'](unitMessage);
      });

      expect(result.current.lastUnitStatusMessage).toBe(unitMessage);
      expect(result.current.lastUnitStatusTimestamp).toBeGreaterThan(0);
      expect(result.current.lastUpdateTimestamps.unitStatusUpdated).toBe(result.current.lastUnitStatusTimestamp);
    });

    it('should clear isUpdateHubConnected on hub disconnect and reconnecting events', async () => {
      const handlers: Record<string, (message?: unknown) => void> = {};
      (signalRService.on as jest.Mock).mockImplementation((event: string, handler: (message: unknown) => void) => {
        handlers[event] = handler;
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      act(() => {
        handlers['onConnected']();
      });
      expect(result.current.isUpdateHubConnected).toBe(true);

      act(() => {
        handlers['__hubDisconnected:eventingHub']();
      });
      expect(result.current.isUpdateHubConnected).toBe(false);

      act(() => {
        handlers['onConnected']();
      });
      act(() => {
        handlers['__hubReconnecting:eventingHub']();
      });
      expect(result.current.isUpdateHubConnected).toBe(false);
    });

    it('should re-join the department group and bump all timestamps on hub reconnect', async () => {
      const handlers: Record<string, (message?: unknown) => void> = {};
      (signalRService.on as jest.Mock).mockImplementation((event: string, handler: (message: unknown) => void) => {
        handlers[event] = handler;
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      (signalRService.invoke as jest.Mock).mockClear();

      await act(async () => {
        handlers['__hubReconnected:eventingHub']();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(signalRService.invoke).toHaveBeenCalledWith('eventingHub', 'connect', 123);
      expect(result.current.isUpdateHubConnected).toBe(true);
      expect(result.current.lastUpdateTimestamp).toBeGreaterThan(0);
      expect(result.current.lastUpdateTimestamps.callsUpdated).toBe(result.current.lastUpdateTimestamp);
      expect(result.current.lastUpdateTimestamps.unitStatusUpdated).toBe(result.current.lastUpdateTimestamp);
      expect(result.current.lastUpdateTimestamps.personnelStatusUpdated).toBe(result.current.lastUpdateTimestamp);
      expect(result.current.lastUpdateTimestamps.weatherAlertReceived).toBe(result.current.lastUpdateTimestamp);
    });

    it('should refresh the calls list once for a burst of call events (debounced)', async () => {
      jest.useFakeTimers();
      try {
        const handlers: Record<string, (message?: unknown) => void> = {};
        (signalRService.on as jest.Mock).mockImplementation((event: string, handler: (message: unknown) => void) => {
          handlers[event] = handler;
        });

        const { result } = renderHook(() => useSignalRStore());

        await act(async () => {
          await result.current.connectUpdateHub();
        });

        mockFetchCalls.mockClear();

        act(() => {
          handlers['callAdded']({ CallId: '1' });
          handlers['callsUpdated']({ CallId: '2' });
          handlers['callClosed']({ CallId: '3' });
        });

        // Still inside the debounce window — no refetch yet.
        expect(mockFetchCalls).not.toHaveBeenCalled();

        act(() => {
          jest.advanceTimersByTime(2000);
        });

        // A burst of three events coalesces into a single forced refresh.
        expect(mockFetchCalls).toHaveBeenCalledTimes(1);
        expect(mockFetchCalls).toHaveBeenCalledWith(true);

        // Timestamps still update immediately for the map hook.
        expect(result.current.lastUpdateTimestamps.callAdded).toBeGreaterThan(0);
        expect(result.current.lastUpdateTimestamps.callClosed).toBeGreaterThan(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should remove hub-scoped lifecycle listeners before connecting', async () => {
      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectUpdateHub();
      });

      expect(signalRService.removeAllListeners).toHaveBeenCalledWith('__hubDisconnected:eventingHub');
      expect(signalRService.removeAllListeners).toHaveBeenCalledWith('__hubReconnecting:eventingHub');
      expect(signalRService.removeAllListeners).toHaveBeenCalledWith('__hubReconnected:eventingHub');
    });
  });

  describe('disconnectUpdateHub', () => {
    it('should disconnect from update hub successfully', async () => {
      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.disconnectUpdateHub();
      });

      expect(signalRService.disconnectFromHub).toHaveBeenCalledWith('eventingHub');
      expect(result.current.isUpdateHubConnected).toBe(false);
      expect(result.current.lastUpdateMessage).toBeNull();
    });

    it('should handle disconnect errors', async () => {
      const disconnectError = new Error('Disconnect failed');
      (signalRService.disconnectFromHub as jest.Mock).mockRejectedValue(disconnectError);

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.disconnectUpdateHub();
      });

      expect(result.current.error).toEqual(disconnectError);
      expect(logger.warn).toHaveBeenCalledWith({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: disconnectError },
      });
    });
  });

  describe('connectGeolocationHub', () => {
    it('should handle missing EventingUrl', async () => {
      // Mock core store without EventingUrl
      mockCoreStoreGetState.mockReturnValue({
        config: {
          EventingUrl: undefined,
        } as any,
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectGeolocationHub();
      });

      expect(signalRService.connectToHubWithEventingUrl).not.toHaveBeenCalled();
      expect(result.current.error).toEqual(new Error('EventingUrl not available in config. Please ensure config is loaded first.'));
    });

    it('should register no-op location handlers that do not write to the store', async () => {
      const handlers: Record<string, (message?: unknown) => void> = {};
      (signalRService.on as jest.Mock).mockImplementation((event: string, handler: (message: unknown) => void) => {
        handlers[event] = handler;
      });

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.connectGeolocationHub();
      });

      act(() => {
        handlers['onPersonnelLocationUpdated']({ Latitude: 1, Longitude: 2 });
        handlers['onUnitLocationUpdated']({ Latitude: 3, Longitude: 4 });
      });

      expect(result.current.lastGeolocationMessage).toBeNull();
      expect(result.current.lastGeolocationTimestamp).toBe(0);
    });
  });

  describe('disconnectGeolocationHub', () => {
    it('should disconnect from geolocation hub successfully', async () => {
      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.disconnectGeolocationHub();
      });

      expect(signalRService.disconnectFromHub).toHaveBeenCalledWith('geolocationHub');
      expect(result.current.isGeolocationHubConnected).toBe(false);
      expect(result.current.lastGeolocationMessage).toBeNull();
    });

    it('should handle disconnect errors', async () => {
      const disconnectError = new Error('Geolocation disconnect failed');
      (signalRService.disconnectFromHub as jest.Mock).mockRejectedValue(disconnectError);

      const { result } = renderHook(() => useSignalRStore());

      await act(async () => {
        await result.current.disconnectGeolocationHub();
      });

      expect(result.current.error).toEqual(disconnectError);
      expect(logger.warn).toHaveBeenCalledWith({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: disconnectError },
      });
    });
  });
});
