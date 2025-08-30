import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

import { logger } from '@/lib/logging';

// Mock the env module
jest.mock('@/lib/env', () => ({
  Env: {
    REALTIME_GEO_HUB_NAME: 'geolocationHub',
    CHANNEL_HUB_NAME: 'channelHub',
  },
}));

// Mock the auth store
jest.mock('@/stores/auth/store', () => {
  const mockRefreshAccessToken = jest.fn().mockResolvedValue(undefined);
  const mockGetState = jest.fn(() => ({ 
    accessToken: 'mock-token',
    refreshAccessToken: mockRefreshAccessToken,
  }));
  return {
    __esModule: true,
    default: {
      getState: mockGetState,
    },
  };
});

import useAuthStore from '@/stores/auth/store';
import { SignalRService, SignalRHubConnectConfig } from '../signalr.service';

// Mock the dependencies
jest.mock('@microsoft/signalr');
jest.mock('@/lib/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setGlobalContext: jest.fn(),
    clearGlobalContext: jest.fn(),
  },
  useLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

const mockGetState = (useAuthStore as any).getState;
const mockRefreshAccessToken = jest.fn().mockResolvedValue(undefined);

const mockHubConnectionBuilder = HubConnectionBuilder as jest.MockedClass<typeof HubConnectionBuilder>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('SignalRService - Enhanced Features', () => {
  let mockConnection: jest.Mocked<HubConnection>;
  let mockBuilderInstance: jest.Mocked<HubConnectionBuilder>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset SignalR service singleton
    SignalRService.resetInstance();

    // Mock HubConnection
    mockConnection = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      invoke: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      onclose: jest.fn(),
      onreconnecting: jest.fn(),
      onreconnected: jest.fn(),
    } as any;

    // Mock HubConnectionBuilder
    mockBuilderInstance = {
      withUrl: jest.fn().mockReturnThis(),
      withAutomaticReconnect: jest.fn().mockReturnThis(),
      configureLogging: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(mockConnection),
    } as any;

    mockHubConnectionBuilder.mockImplementation(() => mockBuilderInstance);

    // Reset refresh token mock
    mockRefreshAccessToken.mockClear();
    mockRefreshAccessToken.mockResolvedValue(undefined);

    // Mock auth store
    mockGetState.mockReturnValue({ 
      accessToken: 'mock-token',
      refreshAccessToken: mockRefreshAccessToken,
    });
  });

  describe('Singleton behavior', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = SignalRService.getInstance();
      const instance2 = SignalRService.getInstance();
      const instance3 = SignalRService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });

    it('should safely reset instance', async () => {
      const originalInstance = SignalRService.getInstance();
      
      // Mock disconnectAll to avoid actual disconnection
      const disconnectAllSpy = jest.spyOn(originalInstance, 'disconnectAll').mockResolvedValue();
      
      SignalRService.resetInstance();
      
      const newInstance = SignalRService.getInstance();
      
      expect(newInstance).not.toBe(originalInstance);
      expect(disconnectAllSpy).toHaveBeenCalled();
      
      disconnectAllSpy.mockRestore();
    });

    it('should create instance with proper logging', () => {
      SignalRService.getInstance();
      
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'SignalR service singleton instance created',
      });
    });
  });

  describe('Connection locking', () => {
    const mockConfig: SignalRHubConnectConfig = {
      name: 'testHub',
      eventingUrl: 'https://api.example.com/',
      hubName: 'eventingHub',
      methods: ['method1'],
    };

    it('should prevent concurrent connections to the same hub', async () => {
      const service = SignalRService.getInstance();
      
      // Start first connection (don't await)
      const firstConnection = service.connectToHubWithEventingUrl(mockConfig);

      // Start second connection while first is in progress
      const secondConnection = service.connectToHubWithEventingUrl(mockConfig);

      // Both should complete successfully
      await Promise.all([firstConnection, secondConnection]);

      // Should only have built one connection
      expect(mockHubConnectionBuilder).toHaveBeenCalledTimes(1);
      expect(mockConnection.start).toHaveBeenCalledTimes(1);
    });

    it('should wait for ongoing connection before disconnecting', async () => {
      const service = SignalRService.getInstance();
      
      // Start connection (don't await)
      const connectionPromise = service.connectToHubWithEventingUrl(mockConfig);

      // Start disconnect while connection is in progress
      const disconnectPromise = service.disconnectFromHub(mockConfig.name);

      // Wait for both to complete
      await Promise.all([connectionPromise, disconnectPromise]);

      // Should have connected then disconnected
      expect(mockConnection.start).toHaveBeenCalledTimes(1);
      expect(mockConnection.stop).toHaveBeenCalledTimes(1);
    });

    it('should wait for ongoing connection before invoking method', async () => {
      const service = SignalRService.getInstance();
      
      // Start connection (don't await)
      const connectionPromise = service.connectToHubWithEventingUrl(mockConfig);

      // Start invoke while connection is in progress
      const invokePromise = service.invoke(mockConfig.name, 'testMethod', { data: 'test' });

      // Wait for both to complete
      await Promise.all([connectionPromise, invokePromise]);

      // Should have connected then invoked
      expect(mockConnection.start).toHaveBeenCalledTimes(1);
      expect(mockConnection.invoke).toHaveBeenCalledTimes(1);
    });

    it('should log when waiting for ongoing connection', async () => {
      const service = SignalRService.getInstance();
      
      // Start first connection
      const firstConnection = service.connectToHubWithEventingUrl(mockConfig);

      // Start second connection - should wait
      const secondConnection = service.connectToHubWithEventingUrl(mockConfig);

      await Promise.all([firstConnection, secondConnection]);

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: `Connection to hub ${mockConfig.name} is already in progress, waiting...`,
      });
    });
  });

  describe('Enhanced reconnection logic', () => {
    const mockConfig: SignalRHubConnectConfig = {
      name: 'testHub',
      eventingUrl: 'https://api.example.com/',
      hubName: 'eventingHub',
      methods: ['method1'],
    };

    it('should properly schedule reconnection attempts', async () => {
      const service = SignalRService.getInstance();
      
      // Connect to hub
      await service.connectToHubWithEventingUrl(mockConfig);
      
      // Get the onclose callback
      const onCloseCallback = mockConnection.onclose.mock.calls[0][0];
      
      // Use fake timers for this test
      jest.useFakeTimers();
      
      // Trigger connection close
      onCloseCallback();
      
      // Should log the reconnection attempt scheduling
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: `Scheduling reconnection attempt 1/5 for hub: ${mockConfig.name}`,
      });
      
      jest.useRealTimers();
    });

    it('should cleanup resources after max reconnection attempts', async () => {
      const service = SignalRService.getInstance();
      
      // Connect to hub
      await service.connectToHubWithEventingUrl(mockConfig);
      
      // Get the onclose callback
      const onCloseCallback = mockConnection.onclose.mock.calls[0][0];
      
      // Trigger connection close multiple times to exceed max attempts
      for (let i = 0; i < 6; i++) {
        onCloseCallback();
      }
      
      // Should log max attempts reached and cleanup
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: `Max reconnection attempts (5) reached for hub: ${mockConfig.name}`,
      });
    });

    it('should skip reconnection if already connected', async () => {
      const service = SignalRService.getInstance();
      
      // Connect to hub
      await service.connectToHubWithEventingUrl(mockConfig);
      
      // Get the onclose callback
      const onCloseCallback = mockConnection.onclose.mock.calls[0][0];
      
      jest.useFakeTimers();
      
      // Mock the connections map to indicate connection exists
      const connectionsMap = (service as any).connections;
      const originalHas = connectionsMap.has;
      connectionsMap.has = jest.fn().mockReturnValue(true);
      
      // Trigger connection close
      onCloseCallback();
      
      // Fast forward time
      jest.advanceTimersByTime(5000);
      
      // Should log skip message
      expect(mockLogger.debug).toHaveBeenCalledWith({
        message: `Hub ${mockConfig.name} is already connected, skipping reconnection attempt`,
      });
      
      // Restore original method
      connectionsMap.has = originalHas;
      
      jest.useRealTimers();
    });

    it('should cancel scheduled reconnect if hub is explicitly disconnected after onclose handler', async () => {
      const service = SignalRService.getInstance();
      
      // Connect to hub
      await service.connectToHubWithEventingUrl(mockConfig);
      
      // Get the onclose callback
      const onCloseCallback = mockConnection.onclose.mock.calls[0][0];
      
      jest.useFakeTimers();
      
      // Store original connections map state
      const connectionsMap = (service as any).connections;
      const originalConnectionsMap = new Map(connectionsMap);
      
      // Trigger connection close to schedule a reconnect
      onCloseCallback();
      
      // Should log the reconnection attempt scheduling
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: `Scheduling reconnection attempt 1/5 for hub: ${mockConfig.name}`,
      });
      
      // Clear previous logs to isolate subsequent logging
      jest.clearAllMocks();
      
      // Simulate explicit disconnect after the onclose handler
      await service.disconnectFromHub(mockConfig.name);
      
      // Advance timers to trigger the scheduled reconnect
      jest.advanceTimersByTime(5000);
      
      // Assert that no reconnection attempt occurs
      // The reconnect logic should not be called because the hub was explicitly disconnected
      expect(mockLogger.debug).toHaveBeenCalledWith({
        message: `Hub ${mockConfig.name} config was removed, skipping reconnection attempt`,
      });
      
      // Ensure no actual reconnection attempt was made
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('attempting to reconnect to hub'),
        })
      );
      
      // Restore original connections map and timers
      connectionsMap.clear();
      originalConnectionsMap.forEach((value, key) => {
        connectionsMap.set(key, value);
      });
      
      jest.useRealTimers();
    });
  });
});
