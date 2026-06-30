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

// Mock other dependencies
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/storage/app', () => ({
  getDeviceUuid: jest.fn(() => 'test-device-uuid'),
}));

jest.mock('@/api/devices/push', () => ({
  registerUnitDevice: jest.fn(),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn((selector) => {
    const state = { activeUnitId: 'test-unit' };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/stores/security/store', () => ({
  securityStore: jest.fn((selector) => {
    const state = { rights: { DepartmentCode: 'TEST' } };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/stores/check-in-timers/store', () => ({
  useCheckInTimerStore: {
    getState: jest.fn(() => ({
      performCheckIn: jest.fn(),
    })),
  },
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: {
    getState: jest.fn(() => ({
      latitude: null,
      longitude: null,
    })),
  },
}));

// Mock expo-notifications (the push transport)
const mockReceivedRemove = jest.fn();
const mockResponseRemove = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockAddNotificationReceivedListener = jest.fn(() => ({ remove: mockReceivedRemove }));
const mockAddNotificationResponseReceivedListener = jest.fn(() => ({ remove: mockResponseRemove }));
const mockGetLastNotificationResponseAsync = jest.fn(() => Promise.resolve(null));
const mockGetPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockRequestPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockGetDevicePushTokenAsync = jest.fn(() => Promise.resolve({ data: 'test-device-token' }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: mockSetNotificationHandler,
  addNotificationReceivedListener: mockAddNotificationReceivedListener,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  getLastNotificationResponseAsync: mockGetLastNotificationResponseAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getDevicePushTokenAsync: mockGetDevicePushTokenAsync,
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

// Mock the modern-sounds preference module (controls Android channel sounds)
const mockGetModernNotificationSoundsEnabled = jest.fn((): boolean => true);
const mockGetAppliedNotificationSoundMode = jest.fn((): string | undefined => undefined);
const mockSetAppliedNotificationSoundMode = jest.fn();

jest.mock('@/lib/storage/notification-prefs', () => ({
  getModernNotificationSoundsEnabled: mockGetModernNotificationSoundsEnabled,
  getAppliedNotificationSoundMode: mockGetAppliedNotificationSoundMode,
  setAppliedNotificationSoundMode: mockSetAppliedNotificationSoundMode,
}));

// Mock Notifee (channels, categories, foreground/background events, check-in)
const mockNotifeeForegroundUnsubscribe = jest.fn();
const mockCreateChannel = jest.fn(() => Promise.resolve());
const mockDeleteChannel = jest.fn(() => Promise.resolve());
const mockSetNotificationCategories = jest.fn(() => Promise.resolve());
const mockNotifeeRequestPermission = jest.fn(() =>
  Promise.resolve({
    authorizationStatus: 1, // AUTHORIZED
  })
);
const mockDisplayNotification = jest.fn(() => Promise.resolve('notification-id'));
const mockOnForegroundEvent = jest.fn(() => mockNotifeeForegroundUnsubscribe);
const mockOnBackgroundEvent = jest.fn();

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: mockCreateChannel,
    deleteChannel: mockDeleteChannel,
    setNotificationCategories: mockSetNotificationCategories,
    requestPermission: mockNotifeeRequestPermission,
    displayNotification: mockDisplayNotification,
    onForegroundEvent: mockOnForegroundEvent,
    onBackgroundEvent: mockOnBackgroundEvent,
  },
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
  },
  AndroidVisibility: {
    PUBLIC: 1,
  },
  AuthorizationStatus: {
    AUTHORIZED: 1,
    DENIED: 2,
  },
  EventType: {
    PRESS: 1,
    ACTION_PRESS: 2,
  },
}));

describe('Push Notification Service Integration', () => {
  const mockShowNotificationModal = jest.fn().mockResolvedValue(undefined);
  const mockGetState = usePushNotificationModalStore.getState as jest.Mock;

  beforeAll(() => {
    mockGetState.mockReturnValue({
      showNotificationModal: mockShowNotificationModal,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockShowNotificationModal.mockResolvedValue(undefined);
    mockGetState.mockReturnValue({
      showNotificationModal: mockShowNotificationModal,
    });
  });

  // Builds an expo-notifications Notification shape with the given data/title/body.
  const createMockNotification = (data: any): any => ({
    request: {
      content: {
        title: data.title ?? null,
        body: data.body ?? null,
        data: data.data ?? {},
      },
    },
  });

  // Mirrors the service's eventCode → modal contract for the received handler.
  const simulateNotificationReceived = (notification: any): void => {
    const content = notification.request.content;
    const data = content.data;

    // eventCode must be a string to be valid
    if (data && data.eventCode && typeof data.eventCode === 'string') {
      const notificationData: any = {
        eventCode: data.eventCode as string,
        data,
      };
      if (content.title) {
        notificationData.title = content.title;
      }
      if (content.body) {
        notificationData.body = content.body;
      }

      usePushNotificationModalStore
        .getState()
        .showNotificationModal(notificationData)
        .catch((err: unknown) => {
          // Handle error in test environment
          console.error('Error showing notification modal:', err);
        });
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

  describe('listener lifecycle', () => {
    let pushNotificationService: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetModules();

      // Re-require the module to get fresh instance
      jest.unmock('../push-notification');
      const module = require('../push-notification');
      pushNotificationService = module.pushNotificationService;
    });

    it('should register expo-notifications listeners on initialization', async () => {
      jest.useFakeTimers();

      await pushNotificationService.initialize();

      // Run timers to trigger the killed-state getLastNotificationResponseAsync()
      jest.runAllTimers();

      expect(mockAddNotificationReceivedListener).toHaveBeenCalled();
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();
      expect(mockGetLastNotificationResponseAsync).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should properly cleanup all listeners', async () => {
      await pushNotificationService.initialize();

      mockReceivedRemove.mockClear();
      mockResponseRemove.mockClear();
      mockNotifeeForegroundUnsubscribe.mockClear();

      pushNotificationService.cleanup();

      expect(mockReceivedRemove).toHaveBeenCalledTimes(1);
      expect(mockResponseRemove).toHaveBeenCalledTimes(1);
      expect(mockNotifeeForegroundUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should not error when cleanup is called without initialization', () => {
      expect(() => pushNotificationService.cleanup()).not.toThrow();
    });

    it('should not error when cleanup is called multiple times', async () => {
      await pushNotificationService.initialize();

      expect(() => {
        pushNotificationService.cleanup();
        pushNotificationService.cleanup();
        pushNotificationService.cleanup();
      }).not.toThrow();
    });
  });

  describe('registration', () => {
    let pushNotificationService: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetModules();

      // Re-require the module to get fresh instance
      jest.unmock('../push-notification');
      const module = require('../push-notification');
      pushNotificationService = module.pushNotificationService;
    });

    it('should successfully register for push notifications with iOS', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockGetDevicePushTokenAsync.mockResolvedValueOnce({ data: 'test-device-token' });

      const token = await pushNotificationService.registerForPushNotifications('unit-123', 'TEST');

      expect(token).toBe('test-device-token');
      expect(mockGetPermissionsAsync).toHaveBeenCalled();
      expect(mockGetDevicePushTokenAsync).toHaveBeenCalled();
    });

    it('should request permission if not already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockGetDevicePushTokenAsync.mockResolvedValueOnce({ data: 'test-device-token' });

      const token = await pushNotificationService.registerForPushNotifications('unit-123', 'TEST');

      expect(token).toBe('test-device-token');
      expect(mockGetPermissionsAsync).toHaveBeenCalled();
      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
      expect(mockGetDevicePushTokenAsync).toHaveBeenCalled();
    });

    it('should return null if permission is denied', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      const token = await pushNotificationService.registerForPushNotifications('unit-123', 'TEST');

      expect(token).toBeNull();
      expect(mockGetDevicePushTokenAsync).not.toHaveBeenCalled();
    });

    it('should return null when called without an active unit ID', async () => {
      const token = await pushNotificationService.registerForPushNotifications('', 'TEST');

      expect(token).toBeNull();
      expect(mockGetDevicePushTokenAsync).not.toHaveBeenCalled();
    });
  });

  describe('Android notification channels', () => {
    let pushNotificationService: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetModules();

      // Mock Platform.OS to be android
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
          select: jest.fn((obj) => obj.android ?? obj.default),
        },
      }));

      // Re-require the module to get fresh instance
      jest.unmock('../push-notification');
      const module = require('../push-notification');
      pushNotificationService = module.pushNotificationService;
    });

    it('should create notification channels on Android', async () => {
      await pushNotificationService.initialize();

      // Standard channels: calls, 0-3, notif, message = 7
      // Custom channels: c1-c25 = 25
      // Total: 32 channels
      expect(mockCreateChannel).toHaveBeenCalledTimes(32);
    });

    it('should use modern sounds for the standard channels by default', async () => {
      mockGetModernNotificationSoundsEnabled.mockReturnValue(true);

      await pushNotificationService.initialize();

      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'calls', sound: 'modernnotification' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: '0', sound: 'moderncallemergency' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: '1', sound: 'moderncallhigh' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: '2', sound: 'moderncallmedium' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: '3', sound: 'moderncalllow' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'notif', sound: 'modernnotification' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'message', sound: 'modernmessage' }));
    });

    it('should use classic sounds when modern sounds are disabled', async () => {
      mockGetModernNotificationSoundsEnabled.mockReturnValue(false);

      await pushNotificationService.initialize();

      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'calls', sound: 'notification' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: '0', sound: 'callemergency' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'notif', sound: 'notification' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'message', sound: 'newmessage' }));
      // Never falls back to a modern sound when disabled.
      expect(mockCreateChannel).not.toHaveBeenCalledWith(expect.objectContaining({ sound: 'moderncallemergency' }));
    });

    it('should leave custom call channels (c1-c25) unaffected by the setting', async () => {
      mockGetModernNotificationSoundsEnabled.mockReturnValue(true);

      await pushNotificationService.initialize();

      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', sound: 'c1' }));
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'c25', sound: 'c25' }));
    });

    it('should delete the standard sound channels before recreating them when the mode changes', async () => {
      mockGetModernNotificationSoundsEnabled.mockReturnValue(true);
      mockGetAppliedNotificationSoundMode.mockReturnValue('classic');

      await pushNotificationService.initialize();

      // The 7 standard sound channels are deleted so they can be recreated with the new sound.
      expect(mockDeleteChannel).toHaveBeenCalledTimes(7);
      expect(mockDeleteChannel).toHaveBeenCalledWith('0');
      expect(mockDeleteChannel).toHaveBeenCalledWith('notif');
      expect(mockDeleteChannel).not.toHaveBeenCalledWith('c1');
    });

    it('should not delete channels when the sound mode is unchanged', async () => {
      mockGetModernNotificationSoundsEnabled.mockReturnValue(true);
      mockGetAppliedNotificationSoundMode.mockReturnValue('modern');

      await pushNotificationService.initialize();

      expect(mockDeleteChannel).not.toHaveBeenCalled();
      expect(mockCreateChannel).toHaveBeenCalledTimes(32);
    });

    it('should persist the applied sound mode after setup', async () => {
      mockGetModernNotificationSoundsEnabled.mockReturnValue(true);
      mockGetAppliedNotificationSoundMode.mockReturnValue('modern');

      await pushNotificationService.initialize();

      expect(mockSetAppliedNotificationSoundMode).toHaveBeenCalledWith('modern');
    });

    it('refreshAndroidNotificationChannels recreates channels with the current setting', async () => {
      mockGetModernNotificationSoundsEnabled.mockReturnValue(false);
      mockGetAppliedNotificationSoundMode.mockReturnValue('modern');

      await pushNotificationService.refreshAndroidNotificationChannels();

      // Mode changed modern -> classic, so the standard channels are deleted and recreated.
      expect(mockDeleteChannel).toHaveBeenCalledTimes(7);
      expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({ id: '0', sound: 'callemergency' }));
      expect(mockSetAppliedNotificationSoundMode).toHaveBeenCalledWith('classic');
    });
  });
});
