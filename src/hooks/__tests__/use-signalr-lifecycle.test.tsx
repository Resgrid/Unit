import { renderHook, waitFor } from '@testing-library/react-native';
import { AppStateStatus } from 'react-native';

import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { useSignalRLifecycle } from '../use-signalr-lifecycle';

// Mock the dependencies
jest.mock('@/stores/signalr/signalr-store');
jest.mock('../use-app-lifecycle');

const mockUseSignalRStore = useSignalRStore as jest.MockedFunction<typeof useSignalRStore>;
const mockUseAppLifecycle = require('../use-app-lifecycle').useAppLifecycle as jest.MockedFunction<any>;

describe('useSignalRLifecycle', () => {
  const mockConnectUpdateHub = jest.fn();
  const mockDisconnectUpdateHub = jest.fn();
  const mockConnectGeolocationHub = jest.fn();
  const mockDisconnectGeolocationHub = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SignalR store
    mockUseSignalRStore.mockReturnValue({
      connectUpdateHub: mockConnectUpdateHub,
      disconnectUpdateHub: mockDisconnectUpdateHub,
      connectGeolocationHub: mockConnectGeolocationHub,
      disconnectGeolocationHub: mockDisconnectGeolocationHub,
      isUpdateHubConnected: false,
      isGeolocationHubConnected: false,
    } as any);

    // Mock app lifecycle
    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active' as AppStateStatus,
    });
  });

  it('should disconnect SignalR when app goes to background', async () => {
    const { rerender } = renderHook(
      ({ isSignedIn, hasInitialized, isActive, appState }) => {
        mockUseAppLifecycle.mockReturnValue({ isActive, appState });
        return useSignalRLifecycle({ isSignedIn, hasInitialized });
      },
      {
        initialProps: {
          isSignedIn: true,
          hasInitialized: true,
          isActive: true,
          appState: 'active' as AppStateStatus,
        },
      }
    );

    // Simulate app going to background
    rerender({
      isSignedIn: true,
      hasInitialized: true,
      isActive: false,
      appState: 'background' as AppStateStatus,
    });

    // Wait for debounced operation
    await waitFor(() => {
      expect(mockDisconnectUpdateHub).toHaveBeenCalled();
      expect(mockDisconnectGeolocationHub).toHaveBeenCalled();
    }, { timeout: 200 });
  });

  it('should reconnect SignalR when app becomes active from background', async () => {
    const { rerender } = renderHook(
      ({ isSignedIn, hasInitialized, isActive, appState }) => {
        mockUseAppLifecycle.mockReturnValue({ isActive, appState });
        return useSignalRLifecycle({ isSignedIn, hasInitialized });
      },
      {
        initialProps: {
          isSignedIn: true,
          hasInitialized: true,
          isActive: false,
          appState: 'background' as AppStateStatus,
        },
      }
    );

    // Simulate app becoming active
    rerender({
      isSignedIn: true,
      hasInitialized: true,
      isActive: true,
      appState: 'active' as AppStateStatus,
    });

    await waitFor(() => {
      expect(mockConnectUpdateHub).toHaveBeenCalled();
      expect(mockConnectGeolocationHub).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('should not manage SignalR when user is not signed in', async () => {
    const { rerender } = renderHook(
      ({ isSignedIn, hasInitialized, isActive, appState }) => {
        mockUseAppLifecycle.mockReturnValue({ isActive, appState });
        return useSignalRLifecycle({ isSignedIn, hasInitialized });
      },
      {
        initialProps: {
          isSignedIn: false,
          hasInitialized: true,
          isActive: true,
          appState: 'active' as AppStateStatus,
        },
      }
    );

    // Simulate app going to background
    rerender({
      isSignedIn: false,
      hasInitialized: true,
      isActive: false,
      appState: 'background' as AppStateStatus,
    });

    // Should not call SignalR methods when user is not signed in
    expect(mockDisconnectUpdateHub).not.toHaveBeenCalled();
    expect(mockDisconnectGeolocationHub).not.toHaveBeenCalled();
  });

  it('should not manage SignalR when app is not initialized', async () => {
    const { rerender } = renderHook(
      ({ isSignedIn, hasInitialized, isActive, appState }) => {
        mockUseAppLifecycle.mockReturnValue({ isActive, appState });
        return useSignalRLifecycle({ isSignedIn, hasInitialized });
      },
      {
        initialProps: {
          isSignedIn: true,
          hasInitialized: false,
          isActive: true,
          appState: 'active' as AppStateStatus,
        },
      }
    );

    // Simulate app going to background
    rerender({
      isSignedIn: true,
      hasInitialized: false,
      isActive: false,
      appState: 'background' as AppStateStatus,
    });

    // Should not call SignalR methods when app is not initialized
    expect(mockDisconnectUpdateHub).not.toHaveBeenCalled();
    expect(mockDisconnectGeolocationHub).not.toHaveBeenCalled();
  });

  it('should handle SignalR operation failures gracefully', async () => {
    // Mock one operation to fail
    mockDisconnectUpdateHub.mockRejectedValue(new Error('Update hub disconnect failed'));
    mockDisconnectGeolocationHub.mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ isSignedIn, hasInitialized, isActive, appState }) => {
        mockUseAppLifecycle.mockReturnValue({ isActive, appState });
        return useSignalRLifecycle({ isSignedIn, hasInitialized });
      },
      {
        initialProps: {
          isSignedIn: true,
          hasInitialized: true,
          isActive: true,
          appState: 'active' as AppStateStatus,
        },
      }
    );

    // Simulate app going to background
    rerender({
      isSignedIn: true,
      hasInitialized: true,
      isActive: false,
      appState: 'background' as AppStateStatus,
    });

    // Wait for operations to complete
    await waitFor(() => {
      expect(mockDisconnectUpdateHub).toHaveBeenCalled();
      expect(mockDisconnectGeolocationHub).toHaveBeenCalled();
    }, { timeout: 200 });

    // Both should have been called despite one failing
    expect(mockDisconnectUpdateHub).toHaveBeenCalledTimes(1);
    expect(mockDisconnectGeolocationHub).toHaveBeenCalledTimes(1);
  });

  it('should prevent concurrent operations', async () => {
    const { rerender } = renderHook(
      ({ isSignedIn, hasInitialized, isActive, appState }) => {
        mockUseAppLifecycle.mockReturnValue({ isActive, appState });
        return useSignalRLifecycle({ isSignedIn, hasInitialized });
      },
      {
        initialProps: {
          isSignedIn: true,
          hasInitialized: true,
          isActive: true,
          appState: 'active' as AppStateStatus,
        },
      }
    );

    // Simulate app going to background
    rerender({
      isSignedIn: true,
      hasInitialized: true,
      isActive: false,
      appState: 'background' as AppStateStatus,
    });

    // Wait for debounced operation to start
    await waitFor(() => {
      expect(mockDisconnectUpdateHub).toHaveBeenCalledTimes(1);
    }, { timeout: 200 });

    // Immediately change back to active (should be prevented due to concurrent operation)
    rerender({
      isSignedIn: true,
      hasInitialized: true,
      isActive: true,
      appState: 'active' as AppStateStatus,
    });

    // Wait to ensure no additional calls are made during the processing period
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should have only been called once due to concurrency prevention
    expect(mockDisconnectUpdateHub).toHaveBeenCalledTimes(1);
    expect(mockConnectUpdateHub).toHaveBeenCalledTimes(0); // Should be prevented
  });
}); 