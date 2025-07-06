import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';

import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useAuthStore } from '@/lib/auth';
import { logger } from '@/lib/logging';
import { useIsFirstTime } from '@/lib/storage';
import { bluetoothAudioService } from '@/services/bluetooth-audio.service';
import { usePushNotifications } from '@/services/push-notification';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useRolesStore } from '@/stores/roles/store';
import { securityStore } from '@/stores/security/store';

import TabLayout from '../_layout';

// Mock all dependencies
jest.mock('@/hooks/use-app-lifecycle');
jest.mock('@/lib/auth');
jest.mock('@/lib/logging');
jest.mock('@/lib/storage');
jest.mock('@/services/bluetooth-audio.service');
jest.mock('@/services/push-notification');
jest.mock('@/stores/app/core-store');
jest.mock('@/stores/calls/store');
jest.mock('@/stores/roles/store');
jest.mock('@/stores/security/store');
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => `Redirect to ${href}`,
  SplashScreen: {
    hideAsync: jest.fn(),
  },
  Tabs: {
    Screen: ({ children }: { children: React.ReactNode }) => children,
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock('react-native', () => ({
  StyleSheet: {
    create: jest.fn((styles) => styles),
  },
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
jest.mock('@novu/react-native', () => ({
  NovuProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock UI components
jest.mock('@/components/ui', () => ({
  View: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => children,
  ButtonIcon: ({ children }: { children: React.ReactNode }) => children,
  ButtonText: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: { children: React.ReactNode }) => children,
  DrawerBackdrop: ({ children }: { children: React.ReactNode }) => children,
  DrawerBody: ({ children }: { children: React.ReactNode }) => children,
  DrawerContent: ({ children }: { children: React.ReactNode }) => children,
  DrawerFooter: ({ children }: { children: React.ReactNode }) => children,
  DrawerHeader: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/ui/icon', () => ({
  Icon: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/ui/text', () => ({
  Text: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/notifications/NotificationButton', () => ({
  NotificationButton: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/notifications/NotificationInbox', () => ({
  NotificationInbox: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/sidebar/sidebar', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock stores
const mockCoreStore = {
  getState: jest.fn(),
  init: jest.fn(),
  fetchConfig: jest.fn(),
  config: null,
  activeUnitId: null,
};

const mockCallsStore = {
  getState: jest.fn(),
  init: jest.fn(),
  fetchCalls: jest.fn(),
};

const mockRolesStore = {
  getState: jest.fn(),
  init: jest.fn(),
  fetchRoles: jest.fn(),
};

const mockSecurityStore = {
  getState: jest.fn(),
  getRights: jest.fn(),
  rights: null,
};

const mockUseAppLifecycle = useAppLifecycle as jest.MockedFunction<typeof useAppLifecycle>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockUseIsFirstTime = useIsFirstTime as jest.MockedFunction<typeof useIsFirstTime>;
const mockUsePushNotifications = usePushNotifications as jest.MockedFunction<typeof usePushNotifications>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockBluetoothAudioService = bluetoothAudioService as jest.Mocked<typeof bluetoothAudioService>;

describe('TabLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseAppLifecycle.mockReturnValue({
      appState: 'active',
      isActive: true,
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    mockUseAuthStore.mockReturnValue({
      status: 'signedIn',
    });

    mockUseIsFirstTime.mockReturnValue([false, jest.fn()]);
    mockUsePushNotifications.mockReturnValue({
      pushToken: null,
      sendTestNotification: jest.fn(),
    });

    // Setup store mocks
    mockCoreStore.getState.mockReturnValue({
      init: mockCoreStore.init,
      fetchConfig: mockCoreStore.fetchConfig,
      config: null,
      activeUnitId: null,
    });

    mockCallsStore.getState.mockReturnValue({
      init: mockCallsStore.init,
      fetchCalls: mockCallsStore.fetchCalls,
    });

    mockRolesStore.getState.mockReturnValue({
      init: mockRolesStore.init,
      fetchRoles: mockRolesStore.fetchRoles,
    });

    mockSecurityStore.getState.mockReturnValue({
      getRights: mockSecurityStore.getRights,
      rights: null,
    });

    (useCoreStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        config: null,
        activeUnitId: null,
        ...mockCoreStore.getState(),
      };
      return selector ? selector(state) : state;
    });

    (useCallsStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = mockCallsStore.getState();
      return selector ? selector(state) : state;
    });

    (useRolesStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = mockRolesStore.getState();
      return selector ? selector(state) : state;
    });

    (securityStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        rights: null,
        ...mockSecurityStore.getState(),
      };
      return selector ? selector(state) : state;
    });

    mockBluetoothAudioService.initialize.mockResolvedValue(undefined);
  });

  describe('Initialization Logic', () => {
    it('should initialize app only once when user is signed in', async () => {
      render(<TabLayout />);

      await waitFor(() => {
        expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
        expect(mockRolesStore.init).toHaveBeenCalledTimes(1);
        expect(mockCallsStore.init).toHaveBeenCalledTimes(1);
        expect(mockSecurityStore.getRights).toHaveBeenCalledTimes(1);
        expect(mockCoreStore.fetchConfig).toHaveBeenCalledTimes(1);
        expect(mockBluetoothAudioService.initialize).toHaveBeenCalledTimes(1);
      });
    });

    it('should not initialize when user is not signed in', async () => {
      mockUseAuthStore.mockReturnValue({ status: 'signedOut' });

      render(<TabLayout />);

      await waitFor(() => {
        expect(mockCoreStore.init).not.toHaveBeenCalled();
        expect(mockRolesStore.init).not.toHaveBeenCalled();
        expect(mockCallsStore.init).not.toHaveBeenCalled();
        expect(mockSecurityStore.getRights).not.toHaveBeenCalled();
        expect(mockCoreStore.fetchConfig).not.toHaveBeenCalled();
        expect(mockBluetoothAudioService.initialize).not.toHaveBeenCalled();
      });
    });

    it('should not initialize multiple times when auth status changes', async () => {
      const { rerender } = render(<TabLayout />);

      // Wait for initial initialization
      await waitFor(() => {
        expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
      });

      // Change auth status but keep signed in
      mockUseAuthStore.mockReturnValue({ status: 'signedIn' });
      rerender(<TabLayout />);

      // Should not initialize again
      await waitFor(() => {
        expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
        expect(mockRolesStore.init).toHaveBeenCalledTimes(1);
        expect(mockCallsStore.init).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Initialization failed');
      mockCoreStore.init.mockRejectedValue(error);

      render(<TabLayout />);

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith({
          message: 'Failed to initialize app',
          context: { error },
        });
      });
    });

    it('should reset initialization state on error to allow retry', async () => {
      const error = new Error('Initialization failed');
      mockCoreStore.init.mockRejectedValueOnce(error);
      mockCoreStore.init.mockResolvedValueOnce(undefined);

      const { rerender } = render(<TabLayout />);

      // Wait for initial failed initialization
      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith({
          message: 'Failed to initialize app',
          context: { error },
        });
      });

      // Force re-render with different app state to trigger retry
      mockUseAppLifecycle.mockReturnValue({
        appState: 'active',
        isActive: true,
        isBackground: false,
        lastActiveTimestamp: Date.now() + 1000,
      });

      rerender(<TabLayout />);

      // Should retry initialization
      await waitFor(() => {
        expect(mockCoreStore.init).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('App Lifecycle Management', () => {
    it('should refresh data when app resumes from background', async () => {
      // Start with app in background
      mockUseAppLifecycle.mockReturnValue({
        appState: 'background',
        isActive: false,
        isBackground: true,
        lastActiveTimestamp: Date.now(),
      });

      const { rerender } = render(<TabLayout />);

      // Wait for initial initialization
      await waitFor(() => {
        expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
      });

      // App comes back to foreground
      mockUseAppLifecycle.mockReturnValue({
        appState: 'active',
        isActive: true,
        isBackground: false,
        lastActiveTimestamp: Date.now() + 1000,
      });

      rerender(<TabLayout />);

      await waitFor(() => {
        // Should refresh data but not re-initialize
        expect(mockCoreStore.fetchConfig).toHaveBeenCalledTimes(2); // 1 from init, 1 from refresh
        expect(mockCallsStore.fetchCalls).toHaveBeenCalledTimes(1);
        expect(mockRolesStore.fetchRoles).toHaveBeenCalledTimes(1);

        // Should not re-initialize
        expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle data refresh errors gracefully', async () => {
      const error = new Error('Refresh failed');
      mockCoreStore.fetchConfig.mockRejectedValueOnce(error);

      // Start with app in background
      mockUseAppLifecycle.mockReturnValue({
        appState: 'background',
        isActive: false,
        isBackground: true,
        lastActiveTimestamp: Date.now(),
      });

      const { rerender } = render(<TabLayout />);

      // Wait for initial initialization
      await waitFor(() => {
        expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
      });

      // App comes back to foreground
      mockUseAppLifecycle.mockReturnValue({
        appState: 'active',
        isActive: true,
        isBackground: false,
        lastActiveTimestamp: Date.now() + 1000,
      });

      rerender(<TabLayout />);

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith({
          message: 'Failed to refresh data on app resume',
          context: { error },
        });
      });
    });
  });

  describe('Splash Screen Management', () => {
    it('should hide splash screen after delay when status is not idle', async () => {
      jest.useFakeTimers();

      render(<TabLayout />);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith({
          message: 'Splash screen hidden',
        });
      });

      jest.useRealTimers();
    });

    it('should not hide splash screen multiple times', async () => {
      jest.useFakeTimers();

      const { rerender } = render(<TabLayout />);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Re-render component
      rerender(<TabLayout />);

      // Fast-forward time again
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith({
          message: 'Splash screen hidden',
        });
      });

      // Should only be called once
      expect(mockLogger.info).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('Routing Logic', () => {
    it('should redirect to onboarding when first time', () => {
      mockUseIsFirstTime.mockReturnValue([true, jest.fn()]);

      const { getByText } = render(<TabLayout />);

      expect(getByText('Redirect to /onboarding')).toBeTruthy();
    });

    it('should redirect to login when signed out', () => {
      mockUseAuthStore.mockReturnValue({ status: 'signedOut' });

      const { getByText } = render(<TabLayout />);

      expect(getByText('Redirect to /login')).toBeTruthy();
    });

    it('should render tabs when signed in and not first time', () => {
      mockUseIsFirstTime.mockReturnValue([false, jest.fn()]);
      mockUseAuthStore.mockReturnValue({ status: 'signedIn' });

      const { queryByText } = render(<TabLayout />);

      expect(queryByText(/Redirect to/)).toBeFalsy();
    });
  });

  describe('Concurrent Initialization Prevention', () => {
    it('should prevent concurrent initializations', async () => {
      // Mock initialization to take some time
      let resolveInit: () => void;
      const initPromise = new Promise<void>((resolve) => {
        resolveInit = resolve;
      });
      mockCoreStore.init.mockReturnValue(initPromise);

      const { rerender } = render(<TabLayout />);

      // Trigger another render while initialization is in progress
      rerender(<TabLayout />);

      // Should show that initialization is in progress
      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith({
          message: 'App initialization already in progress, skipping',
        });
      });

      // Complete the initialization
      resolveInit!();

      await waitFor(() => {
        expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
      });
    });
  });
}); 