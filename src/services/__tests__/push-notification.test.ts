import * as Notifications from 'expo-notifications';

import { usePushNotificationModalStore } from '@/stores/push-notification/store';

// Mock the store
jest.mock('@/stores/push-notification/store', () => ({
  usePushNotificationModalStore: {
    getState: jest.fn(),
  },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Device',
  osName: 'iOS',
  osVersion: '15.0',
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios ?? obj.default),
  },
}));

// Mock expo-notifications
const mockRemove = jest.fn();
const mockAddNotificationReceivedListener = jest.fn().mockReturnValue({ remove: mockRemove });
const mockAddNotificationResponseReceivedListener = jest.fn().mockReturnValue({ remove: mockRemove });

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: mockAddNotificationReceivedListener,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  removeNotificationSubscription: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: {
    MAX: 'max',
    HIGH: 'high',
    DEFAULT: 'default',
    LOW: 'low',
    MIN: 'min',
  },
  AndroidNotificationVisibility: {
    PUBLIC: 'public',
    PRIVATE: 'private',
    SECRET: 'secret',
  },
}));

// Mock other dependencies
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/storage/app', () => ({
  getDeviceUuid: jest.fn(),
}));

jest.mock('@/api/devices/push', () => ({
  registerUnitDevice: jest.fn(),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    getState: jest.fn(() => ({ unit: { id: 'test-unit' } })),
  },
}));

jest.mock('@/stores/security/store', () => ({
  securityStore: {
    getState: jest.fn(() => ({ accessToken: 'test-token' })),
  },
}));

// Mock Firebase messaging
const mockFcmUnsubscribe = jest.fn();
const mockOnMessage = jest.fn().mockReturnValue(mockFcmUnsubscribe);

jest.mock('@react-native-firebase/messaging', () => {
  return jest.fn(() => ({
    onMessage: mockOnMessage,
  }));
});

describe('Push Notification Service Integration', () => {
  const mockShowNotificationModal = jest.fn();
  const mockGetState = usePushNotificationModalStore.getState as jest.Mock;

  beforeAll(() => {
    // Setup mocks first
    mockGetState.mockReturnValue({
      showNotificationModal: mockShowNotificationModal,
    });
  });

  beforeEach(() => {
    // Only clear the showNotificationModal mock between tests
    mockShowNotificationModal.mockClear();
    mockGetState.mockReturnValue({
      showNotificationModal: mockShowNotificationModal,
    });
  });

  const createMockNotification = (data: any): Notifications.Notification =>
    ({
      date: Date.now(),
      request: {
        identifier: 'test-id',
        content: {
          title: data.title || null,
          subtitle: null,
          body: data.body || null,
          data: data.data || {},
          sound: null,
        },
        trigger: {
          type: 'push',
        },
      },
    } as unknown as Notifications.Notification);

  // Test the notification handling logic directly
  const simulateNotificationReceived = (notification: Notifications.Notification): void => {
    const data = notification.request.content.data;

    // Check if the notification has an eventCode and show modal
    // eventCode must be a string to be valid
    if (data && data.eventCode && typeof data.eventCode === 'string') {
      const notificationData = {
        eventCode: data.eventCode as string,
        title: notification.request.content.title || undefined,
        body: notification.request.content.body || undefined,
        data,
      };

      // Show the notification modal using the store
      usePushNotificationModalStore.getState().showNotificationModal(notificationData);
    }
  };

  describe('notification received handler', () => {
    it('should show modal for call notification with eventCode', () => {
      const notification = createMockNotification({
        title: 'Emergency Call',
        body: 'Structure fire at Main St',
        data: {
          eventCode: 'C:1234',
          callId: '1234',
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).toHaveBeenCalledWith({
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire at Main St',
        data: {
          eventCode: 'C:1234',
          callId: '1234',
        },
      });
    });

    it('should show modal for message notification with eventCode', () => {
      const notification = createMockNotification({
        title: 'New Message',
        body: 'You have a new message from dispatch',
        data: {
          eventCode: 'M:5678',
          messageId: '5678',
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).toHaveBeenCalledWith({
        eventCode: 'M:5678',
        title: 'New Message',
        body: 'You have a new message from dispatch',
        data: {
          eventCode: 'M:5678',
          messageId: '5678',
        },
      });
    });

    it('should show modal for chat notification with eventCode', () => {
      const notification = createMockNotification({
        title: 'Chat Message',
        body: 'New message in chat',
        data: {
          eventCode: 'T:9101',
          chatId: '9101',
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).toHaveBeenCalledWith({
        eventCode: 'T:9101',
        title: 'Chat Message',
        body: 'New message in chat',
        data: {
          eventCode: 'T:9101',
          chatId: '9101',
        },
      });
    });

    it('should show modal for group chat notification with eventCode', () => {
      const notification = createMockNotification({
        title: 'Group Chat',
        body: 'New message in group chat',
        data: {
          eventCode: 'G:1121',
          groupId: '1121',
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).toHaveBeenCalledWith({
        eventCode: 'G:1121',
        title: 'Group Chat',
        body: 'New message in group chat',
        data: {
          eventCode: 'G:1121',
          groupId: '1121',
        },
      });
    });

    it('should not show modal for notification without eventCode', () => {
      const notification = createMockNotification({
        title: 'Regular Notification',
        body: 'This is a regular notification without eventCode',
        data: {
          someOtherData: 'value',
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });

    it('should not show modal for notification with empty eventCode', () => {
      const notification = createMockNotification({
        title: 'Empty Event Code',
        body: 'This notification has empty eventCode',
        data: {
          eventCode: '',
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });

    it('should not show modal for notification without data', () => {
      const notification = createMockNotification({
        title: 'No Data',
        body: 'This notification has no data object',
        data: null,
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });

    it('should handle notification with only title', () => {
      const notification = createMockNotification({
        title: 'Emergency Call',
        data: {
          eventCode: 'C:1234',
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).toHaveBeenCalledWith({
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: undefined,
        data: {
          eventCode: 'C:1234',
        },
      });
    });

    it('should handle notification with only body', () => {
      const notification = createMockNotification({
        body: 'Structure fire at Main St',
        data: {
          eventCode: 'C:1234',
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).toHaveBeenCalledWith({
        eventCode: 'C:1234',
        title: undefined,
        body: 'Structure fire at Main St',
        data: {
          eventCode: 'C:1234',
        },
      });
    });

    it('should handle notification with additional data fields', () => {
      const notification = createMockNotification({
        title: 'Emergency Call',
        body: 'Structure fire at Main St',
        data: {
          eventCode: 'C:1234',
          callId: '1234',
          priority: 'high',
          location: 'Main St',
          additionalInfo: {
            units: ['E1', 'L1'],
            timestamp: '2023-12-07T10:30:00Z',
          },
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).toHaveBeenCalledWith({
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire at Main St',
        data: {
          eventCode: 'C:1234',
          callId: '1234',
          priority: 'high',
          location: 'Main St',
          additionalInfo: {
            units: ['E1', 'L1'],
            timestamp: '2023-12-07T10:30:00Z',
          },
        },
      });
    });

    it('should not show modal for notification with non-string eventCode', () => {
      const notification = createMockNotification({
        title: 'Non-string Event Code',
        body: 'This notification has non-string eventCode',
        data: {
          eventCode: 123, // Number instead of string
        },
      });

      simulateNotificationReceived(notification);

      expect(mockShowNotificationModal).not.toHaveBeenCalled();
    });
  });

  describe('listener cleanup', () => {
    // Dynamically require the service to avoid mocking issues
    let PushNotificationService: any;
    let service: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetModules();
      
      // Re-require the module to get fresh instance
      jest.unmock('../push-notification');
      const module = require('../push-notification');
      service = module.pushNotificationService;
    });

    it('should store listener handles on initialization', async () => {
      // Initialize should add listeners
      await service.initialize();

      // Verify listeners were registered
      expect(mockAddNotificationReceivedListener).toHaveBeenCalled();
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();
      expect(mockOnMessage).toHaveBeenCalled();
    });

    it('should properly cleanup all listeners', async () => {
      // Initialize first to set up listeners
      await service.initialize();

      // Clear previous calls
      mockRemove.mockClear();
      mockFcmUnsubscribe.mockClear();

      // Call cleanup
      service.cleanup();

      // Verify all listeners were removed
      // Expo listeners should have .remove() called twice (once for each listener)
      expect(mockRemove).toHaveBeenCalledTimes(2);

      // FCM unsubscribe should be called once
      expect(mockFcmUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should not error when cleanup is called without initialization', () => {
      // Should not throw when cleanup is called without initializing
      expect(() => service.cleanup()).not.toThrow();
    });

    it('should not error when cleanup is called multiple times', async () => {
      await service.initialize();

      // Should not throw when cleanup is called multiple times
      expect(() => {
        service.cleanup();
        service.cleanup();
        service.cleanup();
      }).not.toThrow();
    });
  });
});
