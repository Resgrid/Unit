import { logger } from '@/lib/logging';
import { notificationSoundService } from '@/services/notification-sound.service';
import { usePushNotificationModalStore } from '../store';

// Mock logger service
jest.mock('@/lib/logging', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock notification sound service
jest.mock('@/services/notification-sound.service', () => ({
  notificationSoundService: {
    playNotificationSound: jest.fn(() => Promise.resolve()),
  },
}));

describe('usePushNotificationModalStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = usePushNotificationModalStore.getState();
    store.hideNotificationModal();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = usePushNotificationModalStore.getState();
      
      expect(state.isOpen).toBe(false);
      expect(state.notification).toBeNull();
    });
  });

  describe('showNotificationModal', () => {
    it('should show modal with call notification', () => {
      const callData = {
        eventCode: 'C1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(callData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'call',
        id: '1234',
        eventCode: 'C1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
        data: undefined,
      });
    });

    it('should show modal with message notification', () => {
      const messageData = {
        eventCode: 'M5678',
        title: 'New Message',
        body: 'You have a new message from dispatch',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(messageData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'message',
        id: '5678',
        eventCode: 'M5678',
        title: 'New Message',
        body: 'You have a new message from dispatch',
        data: undefined,
      });
    });

    it('should show modal with chat notification', () => {
      const chatData = {
        eventCode: 'T9101',
        title: 'Chat Message',
        body: 'New message in chat',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(chatData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'chat',
        id: '9101',
        eventCode: 'T9101',
        title: 'Chat Message',
        body: 'New message in chat',
        data: undefined,
      });
    });

    it('should show modal with group chat notification', () => {
      const groupChatData = {
        eventCode: 'G1121',
        title: 'Group Chat',
        body: 'New message in group chat',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(groupChatData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'group-chat',
        id: '1121',
        eventCode: 'G1121',
        title: 'Group Chat',
        body: 'New message in group chat',
        data: undefined,
      });
    });

    it('should handle unknown notification type', () => {
      const unknownData = {
        eventCode: 'X9999',
        title: 'Unknown',
        body: 'Unknown notification type',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(unknownData);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'unknown',
        id: '9999',
        eventCode: 'X9999',
        title: 'Unknown',
        body: 'Unknown notification type',
        data: undefined,
      });
    });

    it('should handle notification without valid eventCode', () => {
      const dataWithInvalidEventCode = {
        eventCode: 'I',
        title: 'Invalid Event Code',
        body: 'Notification with invalid event code',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(dataWithInvalidEventCode);

      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).toEqual({
        type: 'unknown',
        id: '',
        eventCode: 'I',
        title: 'Invalid Event Code',
        body: 'Notification with invalid event code',
        data: undefined,
      });
    });

    it('should log info message when showing notification', () => {
      const callData = {
        eventCode: 'C1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(callData);

      expect(logger.info).toHaveBeenCalledWith({
        message: 'Showing push notification modal',
        context: {
          type: 'call',
          id: '1234',
          eventCode: 'C1234',
        },
      });
    });

    it('should play notification sound when showing modal', () => {
      const callData = {
        eventCode: 'C1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(callData);

      expect(notificationSoundService.playNotificationSound).toHaveBeenCalledWith('call');
    });

    it('should handle sound playback error gracefully', async () => {
      const mockError = new Error('Sound playback failed');
      (notificationSoundService.playNotificationSound as jest.Mock).mockRejectedValueOnce(mockError);

      const callData = {
        eventCode: 'C1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(callData);

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Modal should still be shown even if sound fails
      const state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
    });
  });

  describe('hideNotificationModal', () => {
    it('should hide modal and clear notification', () => {
      // First show a notification
      const callData = {
        eventCode: 'C1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      const store = usePushNotificationModalStore.getState();
      store.showNotificationModal(callData);

      // Verify it's shown
      let state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.notification).not.toBeNull();

      // Hide it
      store.hideNotificationModal();

      // Verify it's hidden
      state = usePushNotificationModalStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.notification).toBeNull();
    });

    it('should log info message when hiding notification', () => {
      const store = usePushNotificationModalStore.getState();
      store.hideNotificationModal();

      expect(logger.info).toHaveBeenCalledWith({
        message: 'Hiding push notification modal',
      });
    });
  });

  describe('parseNotification', () => {
    it('should parse call event code correctly', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'C1234',
        title: 'Emergency Call',
        body: 'Structure fire',
      });

      expect(parsed.type).toBe('call');
      expect(parsed.id).toBe('1234');
      expect(parsed.eventCode).toBe('C1234');
    });

    it('should parse message event code correctly', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'M5678',
        title: 'New Message',
        body: 'Message content',
      });

      expect(parsed.type).toBe('message');
      expect(parsed.id).toBe('5678');
      expect(parsed.eventCode).toBe('M5678');
    });

    it('should parse chat event code correctly', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'T9101',
        title: 'Chat Message',
        body: 'Chat content',
      });

      expect(parsed.type).toBe('chat');
      expect(parsed.id).toBe('9101');
      expect(parsed.eventCode).toBe('T9101');
    });

    it('should parse group chat event code correctly', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'G1121',
        title: 'Group Chat',
        body: 'Group chat content',
      });

      expect(parsed.type).toBe('group-chat');
      expect(parsed.id).toBe('1121');
      expect(parsed.eventCode).toBe('G1121');
    });

    it('should handle lowercase event codes', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'c1234',
        title: 'Emergency Call',
        body: 'Structure fire',
      });

      expect(parsed.type).toBe('call');
      expect(parsed.id).toBe('1234');
      expect(parsed.eventCode).toBe('c1234');
    });

    it('should handle single character event code', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'C',
        title: 'Emergency Call',
        body: 'Structure fire',
      });

      expect(parsed.type).toBe('unknown');
      expect(parsed.id).toBe('');
      expect(parsed.eventCode).toBe('C');
    });

    it('should handle invalid event code format', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: 'INVALID',
        title: 'Invalid',
        body: 'Invalid format',
      });

      expect(parsed.type).toBe('unknown');
      expect(parsed.id).toBe('NVALID');
      expect(parsed.eventCode).toBe('INVALID');
    });

    it('should handle empty event code', () => {
      const store = usePushNotificationModalStore.getState();
      const parsed = store.parseNotification({
        eventCode: '',
        title: 'Empty Event Code',
        body: 'Empty event code',
      });

      expect(parsed.type).toBe('unknown');
      expect(parsed.id).toBe('');
      expect(parsed.eventCode).toBe('');
    });
  });
});
