import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

import { logger } from '@/lib/logging';

// Mock the env module
jest.mock('@/lib/env', () => ({
  Env: {
    REALTIME_GEO_HUB_NAME: 'geolocationHub',
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
    useAuthStore: {
      getState: mockGetState,
    },
  };
});

import useAuthStore from '@/stores/auth/store';
import { signalRService, SignalRHubConnectConfig, SignalRHubConfig } from '../signalr.service';

// Mock the dependencies
jest.mock('@microsoft/signalr');
jest.mock('@/lib/logging');

const mockGetState = (useAuthStore as any).getState;
const mockRefreshAccessToken = mockGetState().refreshAccessToken;

const mockHubConnectionBuilder = HubConnectionBuilder as jest.MockedClass<typeof HubConnectionBuilder>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('SignalRService', () => {
  let mockConnection: jest.Mocked<HubConnection>;
  let mockBuilderInstance: jest.Mocked<HubConnectionBuilder>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear SignalR service state
    (signalRService as any).connections.clear();
    (signalRService as any).reconnectAttempts.clear();
    (signalRService as any).hubConfigs.clear();

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

  describe('connectToHubWithEventingUrl', () => {
    const mockConfig: SignalRHubConnectConfig = {
      name: 'testHub',
      eventingUrl: 'https://api.example.com/',
      hubName: 'eventingHub',
      methods: ['method1', 'method2'],
    };

    it('should connect to hub successfully', async () => {
      await signalRService.connectToHubWithEventingUrl(mockConfig);

      expect(mockHubConnectionBuilder).toHaveBeenCalled();
      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        'https://api.example.com/eventingHub',
        expect.objectContaining({
          accessTokenFactory: expect.any(Function),
        })
      );
      expect(mockBuilderInstance.withAutomaticReconnect).toHaveBeenCalledWith([0, 2000, 5000, 10000, 30000]);
      expect(mockBuilderInstance.configureLogging).toHaveBeenCalledWith(LogLevel.Information);
      expect(mockConnection.start).toHaveBeenCalled();
    });

    it('should register all methods on connection', async () => {
      await signalRService.connectToHubWithEventingUrl(mockConfig);

      expect(mockConnection.on).toHaveBeenCalledTimes(2);
      expect(mockConnection.on).toHaveBeenCalledWith('method1', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('method2', expect.any(Function));
    });

    it('should set up connection event handlers', async () => {
      await signalRService.connectToHubWithEventingUrl(mockConfig);

      expect(mockConnection.onclose).toHaveBeenCalledWith(expect.any(Function));
      expect(mockConnection.onreconnecting).toHaveBeenCalledWith(expect.any(Function));
      expect(mockConnection.onreconnected).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should throw error if no access token is available', async () => {
      mockGetState.mockReturnValue({ 
        accessToken: '',
        refreshAccessToken: mockRefreshAccessToken,
      });

      await expect(signalRService.connectToHubWithEventingUrl(mockConfig)).rejects.toThrow(
        'No authentication token available'
      );
    });

    it('should add trailing slash to EventingUrl if missing', async () => {
      const configWithoutSlash: SignalRHubConnectConfig = {
        name: 'testHub',
        eventingUrl: 'https://api.example.com',
        hubName: 'eventingHub',
        methods: ['method1', 'method2'],
      };

      await signalRService.connectToHubWithEventingUrl(configWithoutSlash);

      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        'https://api.example.com/eventingHub',
        expect.any(Object),
      );
    });

    it('should use URL parameter for geolocation hub authentication', async () => {
      // Create a geolocation config
      const geoConfig: SignalRHubConnectConfig = {
        name: 'geoHub',
        eventingUrl: 'https://api.example.com/',
        hubName: 'geolocationHub', // This should match REALTIME_GEO_HUB_NAME from env
        methods: ['onPersonnelLocationUpdated'],
      };

      await signalRService.connectToHubWithEventingUrl(geoConfig);

      // Should connect with URL parameter instead of header auth
      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        'https://api.example.com/geolocationHub?access_token=mock-token',
        {}
      );
    });

    it('should use header authentication for non-geolocation hubs', async () => {
      const regularConfig: SignalRHubConnectConfig = {
        name: 'regularHub',
        eventingUrl: 'https://api.example.com/',
        hubName: 'eventingHub',
        methods: ['method1'],
      };

      await signalRService.connectToHubWithEventingUrl(regularConfig);

      // Should connect with header auth
      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        'https://api.example.com/eventingHub',
        expect.objectContaining({
          accessTokenFactory: expect.any(Function),
        })
      );
    });

    it('should properly encode access token in URL for geolocation hub', async () => {
      // Set up a token that needs encoding
      mockGetState.mockReturnValue({ 
        accessToken: 'token with spaces & special chars',
        refreshAccessToken: mockRefreshAccessToken,
      });

      const geoConfig: SignalRHubConnectConfig = {
        name: 'geoHub',
        eventingUrl: 'https://api.example.com/',
        hubName: 'geolocationHub', // This should match REALTIME_GEO_HUB_NAME from env
        methods: ['onPersonnelLocationUpdated'],
      };

      await signalRService.connectToHubWithEventingUrl(geoConfig);

      // Should properly encode the token in the URL
      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        'https://api.example.com/geolocationHub?access_token=token%20with%20spaces%20%26%20special%20chars',
        {}
      );
    });

    it('should properly URI encode complex access tokens for geolocation hub', async () => {
      // Set up a complex token with various characters that need encoding
      mockGetState.mockReturnValue({ 
        accessToken: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9+/=?#&',
        refreshAccessToken: mockRefreshAccessToken,
      });

      const geoConfig: SignalRHubConnectConfig = {
        name: 'geoHub',
        eventingUrl: 'https://api.example.com/',
        hubName: 'geolocationHub',
        methods: ['onPersonnelLocationUpdated'],
      };

      await signalRService.connectToHubWithEventingUrl(geoConfig);

      // Should properly encode all special characters in the token
      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        'https://api.example.com/geolocationHub?access_token=Bearer%20eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9%2B%2F%3D%3F%23%26',
        {}
      );
    });

    it('should handle URL with existing query parameters for geolocation hub', async () => {
      const geoConfig: SignalRHubConnectConfig = {
        name: 'geoHub',
        eventingUrl: 'https://api.example.com/path?existing=param',
        hubName: 'geolocationHub', // This should match REALTIME_GEO_HUB_NAME from env
        methods: ['onPersonnelLocationUpdated'],
      };

      await signalRService.connectToHubWithEventingUrl(geoConfig);

      // Should append the hub to the path and merge access_token with existing query parameters
      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        'https://api.example.com/path/geolocationHub?existing=param&access_token=mock-token',
        {}
      );
    });

    it('should not add extra trailing slash if EventingUrl already has one', async () => {
      const configWithSlash: SignalRHubConnectConfig = {
        name: 'testHub',
        eventingUrl: 'https://api.example.com/',
        hubName: 'eventingHub',
        methods: ['method1', 'method2'],
      };

      await signalRService.connectToHubWithEventingUrl(configWithSlash);

      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        'https://api.example.com/eventingHub',
        expect.any(Object),
      );
    });

    it('should throw error if EventingUrl is not provided', async () => {
      const configWithoutUrl = { ...mockConfig, eventingUrl: '' };

      await expect(signalRService.connectToHubWithEventingUrl(configWithoutUrl)).rejects.toThrow(
        'EventingUrl is required for SignalR connection'
      );
    });

    it('should not connect if already connected', async () => {
      // Connect first time
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Reset mocks to verify second call behavior
      jest.clearAllMocks();
      
      // Try to connect again
      await signalRService.connectToHubWithEventingUrl(mockConfig);

      expect(mockHubConnectionBuilder).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: `Already connected to hub: ${mockConfig.name}`,
      });
    });

    it('should handle connection errors gracefully', async () => {
      const error = new Error('Connection failed');
      mockConnection.start.mockRejectedValue(error);

      await expect(signalRService.connectToHubWithEventingUrl(mockConfig)).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: `Failed to connect to hub: ${mockConfig.name}`,
        context: { error },
      });
    });
  });

  describe('connectToHub (legacy method)', () => {
    const mockConfig: SignalRHubConfig = {
      name: 'testHub',
      url: 'https://api.example.com/hub',
      methods: ['method1'],
    };

    it('should connect to hub successfully', async () => {
      await signalRService.connectToHub(mockConfig);

      expect(mockHubConnectionBuilder).toHaveBeenCalled();
      expect(mockBuilderInstance.withUrl).toHaveBeenCalledWith(
        mockConfig.url,
        expect.objectContaining({
          accessTokenFactory: expect.any(Function),
        })
      );
      expect(mockConnection.start).toHaveBeenCalled();
    });
  });

  describe('disconnectFromHub', () => {
    const mockConfig: SignalRHubConnectConfig = {
      name: 'testHub',
      eventingUrl: 'https://api.example.com/',
      hubName: 'eventingHub',
      methods: ['method1'],
    };

    it('should disconnect from hub successfully', async () => {
      // Connect first
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Then disconnect
      await signalRService.disconnectFromHub(mockConfig.name);

      expect(mockConnection.stop).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: `Disconnected from hub: ${mockConfig.name}`,
      });
    });

    it('should handle disconnect errors gracefully', async () => {
      const error = new Error('Disconnect failed');
      
      // Connect first
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Mock stop to throw error
      mockConnection.stop.mockRejectedValue(error);

      await expect(signalRService.disconnectFromHub(mockConfig.name)).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: `Error disconnecting from hub: ${mockConfig.name}`,
        context: { error },
      });
    });

    it('should do nothing if hub is not connected', async () => {
      await signalRService.disconnectFromHub('nonExistentHub');

      expect(mockConnection.stop).not.toHaveBeenCalled();
    });
  });

  describe('invoke', () => {
    const mockConfig: SignalRHubConnectConfig = {
      name: 'testHub',
      eventingUrl: 'https://api.example.com/',
      hubName: 'eventingHub',
      methods: ['method1'],
    };

    it('should invoke method on connected hub', async () => {
      const methodData = { test: 'data' };
      
      // Connect first
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Invoke method
      await signalRService.invoke(mockConfig.name, 'testMethod', methodData);

      expect(mockConnection.invoke).toHaveBeenCalledWith('testMethod', methodData);
    });

    it('should handle invoke errors gracefully', async () => {
      const error = new Error('Invoke failed');
      const methodData = { test: 'data' };
      
      // Connect first
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Mock invoke to throw error
      mockConnection.invoke.mockRejectedValue(error);

      await expect(signalRService.invoke(mockConfig.name, 'testMethod', methodData)).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: `Error invoking method testMethod from hub: ${mockConfig.name}`,
        context: { error },
      });
    });

    it('should do nothing if hub is not connected', async () => {
      await signalRService.invoke('nonExistentHub', 'testMethod', {});

      expect(mockConnection.invoke).not.toHaveBeenCalled();
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connected hubs', async () => {
      const config1: SignalRHubConnectConfig = {
        name: 'hub1',
        eventingUrl: 'https://api.example.com/',
        hubName: 'eventingHub',
        methods: ['method1'],
      };
      const config2: SignalRHubConnectConfig = {
        name: 'hub2',
        eventingUrl: 'https://api.example.com/',
        hubName: 'geoHub',
        methods: ['method2'],
      };

      // Connect to multiple hubs
      await signalRService.connectToHubWithEventingUrl(config1);
      await signalRService.connectToHubWithEventingUrl(config2);

      // Disconnect all
      await signalRService.disconnectAll();

      // Should have called stop on both connections
      expect(mockConnection.stop).toHaveBeenCalledTimes(2);
    });
  });

  describe('event handling', () => {
    const mockConfig: SignalRHubConnectConfig = {
      name: 'testHub',
      eventingUrl: 'https://api.example.com/',
      hubName: 'eventingHub',
      methods: ['testMethod'],
    };

    it('should handle received messages and emit events', async () => {
      const eventCallback = jest.fn();
      
      // Set up event listener
      signalRService.on('testMethod', eventCallback);
      
      // Connect to hub
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Get the registered callback for the method
      const registeredCallback = mockConnection.on.mock.calls.find(
        call => call[0] === 'testMethod'
      )?.[1];
      
      expect(registeredCallback).toBeDefined();
      
      // Simulate receiving a message
      const testData = { message: 'test' };
      registeredCallback!(testData);
      
      // Verify the event was emitted
      expect(eventCallback).toHaveBeenCalledWith(testData);
    });

    it('should remove event listeners', () => {
      const eventCallback = jest.fn();
      
      signalRService.on('testEvent', eventCallback);
      signalRService.off('testEvent', eventCallback);
      
      // Emit an event (this would be called internally)
      signalRService['emit']('testEvent', { test: 'data' });
      
      // Callback should not have been called
      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('reconnection handling', () => {
    const mockConfig: SignalRHubConnectConfig = {
      name: 'testHub',
      eventingUrl: 'https://api.example.com/',
      hubName: 'eventingHub',
      methods: ['method1'],
    };

    it('should attempt reconnection on connection close', async () => {
      // Use fake timers to control setTimeout behavior
      jest.useFakeTimers();
      
      // Connect to hub
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Verify onclose was called to register the callback
      expect(mockConnection.onclose).toHaveBeenCalled();
      
      // Get the onclose callback from the first call
      const onCloseCallback = mockConnection.onclose.mock.calls[0][0];
      
      // Spy on the connectToHubWithEventingUrl method to track reconnection attempts
      const connectSpy = jest.spyOn(signalRService, 'connectToHubWithEventingUrl');
      connectSpy.mockResolvedValue(); // Mock the reconnection call
      
      // Remove the connection to simulate it being closed
      (signalRService as any).connections.delete(mockConfig.name);
      
      // Trigger connection close
      onCloseCallback();
      
      // Advance timers by the exact reconnect interval (5000ms)
      jest.advanceTimersByTime(5000);
      
      // Wait for all promises to resolve
      await jest.runAllTicks();
      
      // Should have called refreshAccessToken
      expect(mockRefreshAccessToken).toHaveBeenCalled();
      
      // Should have called connectToHubWithEventingUrl for reconnection
      expect(connectSpy).toHaveBeenCalledWith(mockConfig);
      
      jest.useRealTimers();
      connectSpy.mockRestore();
    }, 10000);

    it('should stop reconnection attempts after max attempts', async () => {
      jest.useFakeTimers();
      
      // Connect to hub first
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Verify onclose was called and get the callback
      expect(mockConnection.onclose).toHaveBeenCalled();
      const onCloseCallback = mockConnection.onclose.mock.calls[0][0];
      
      // Now set up the spy to make reconnection attempts fail
      const connectSpy = jest.spyOn(signalRService, 'connectToHubWithEventingUrl');
      connectSpy.mockRejectedValue(new Error('Connection failed'));
      
      // Remove the connection to simulate it being closed
      (signalRService as any).connections.delete(mockConfig.name);
      
      // Simulate multiple failed reconnection attempts
      for (let i = 0; i < 6; i++) {
        onCloseCallback();
        jest.advanceTimersByTime(5000);
        await jest.runAllTicks();
        // Simulate each attempt failing by removing the connection
        (signalRService as any).connections.delete(mockConfig.name);
      }
      
      // Should log max attempts reached error
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: `Max reconnection attempts (5) reached for hub: ${mockConfig.name}`,
      });
      
      jest.useRealTimers();
      connectSpy.mockRestore();
    });

    it('should reset reconnection attempts on successful reconnection', async () => {
      // Connect to hub
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Verify onreconnected was called and get the callback
      expect(mockConnection.onreconnected).toHaveBeenCalled();
      const onReconnectedCallback = mockConnection.onreconnected.mock.calls[0][0];
      
      // Trigger reconnection
      onReconnectedCallback('new-connection-id');
      
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: `Reconnected to hub: ${mockConfig.name}`,
        context: { connectionId: 'new-connection-id' },
      });
    });

    it('should handle token refresh failure during reconnection', async () => {
      jest.useFakeTimers();
      
      // Setup refresh token to fail
      mockRefreshAccessToken.mockRejectedValue(new Error('Token refresh failed'));
      
      // Connect to hub
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Verify onclose was called and get the callback
      expect(mockConnection.onclose).toHaveBeenCalled();
      const onCloseCallback = mockConnection.onclose.mock.calls[0][0];
      
      // Spy on the connectToHubWithEventingUrl method to ensure it's not called when token refresh fails
      const connectSpy = jest.spyOn(signalRService, 'connectToHubWithEventingUrl');
      connectSpy.mockResolvedValue();
      
      // Remove the connection to simulate it being closed
      (signalRService as any).connections.delete(mockConfig.name);
      
      // Trigger connection close
      onCloseCallback();
      
      // Fast-forward time to trigger the setTimeout callback
      jest.advanceTimersByTime(5000);
      
      // Wait for all promises to resolve
      await jest.runAllTicks();
      
      // Should have attempted to refresh token
      expect(mockRefreshAccessToken).toHaveBeenCalled();
      
      // Should have logged the failure
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: `Failed to refresh token or reconnect to hub: ${mockConfig.name}`,
        context: { error: expect.any(Error), attempts: 1, maxAttempts: 5 },
      });
      
      // Should NOT have called connectToHubWithEventingUrl due to token refresh failure
      expect(connectSpy).not.toHaveBeenCalled();
      
      jest.useRealTimers();
      connectSpy.mockRestore();
    });
  });
});
