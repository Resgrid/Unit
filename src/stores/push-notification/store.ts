import { create } from 'zustand';

import { logger } from '@/lib/logging';
import { notificationSoundService } from '@/services/notification-sound.service';

export interface PushNotificationData {
  eventCode: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export type NotificationType = 'call' | 'message' | 'chat' | 'group-chat' | 'unknown';

export interface ParsedNotification {
  type: NotificationType;
  id: string;
  eventCode: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface PushNotificationModalState {
  isOpen: boolean;
  notification: ParsedNotification | null;
  showNotificationModal: (notificationData: PushNotificationData) => void;
  hideNotificationModal: () => void;
  parseNotification: (notificationData: PushNotificationData) => ParsedNotification;
}

export const usePushNotificationModalStore = create<PushNotificationModalState>((set, get) => ({
  isOpen: false,
  notification: null,

  parseNotification: (notificationData: PushNotificationData): ParsedNotification => {
    const eventCode = notificationData.eventCode || '';
    let type: NotificationType = 'unknown';
    let id = '';

    // Parse event code format like "C1234", "M5678", "T9012", "G3456"
    // First character is the type prefix, rest is the ID
    if (eventCode && eventCode.length > 1) {
      const prefix = eventCode[0].toLowerCase();
      id = eventCode.slice(1);

      if (prefix === 'c') {
        type = 'call';
      } else if (prefix === 'm') {
        type = 'message';
      } else if (prefix === 't') {
        type = 'chat';
      } else if (prefix === 'g') {
        type = 'group-chat';
      }
    }

    return {
      type,
      id,
      eventCode,
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data,
    };
  },

  showNotificationModal: (notificationData: PushNotificationData) => {
    const parsedNotification = get().parseNotification(notificationData);

    logger.info({
      message: 'Showing push notification modal',
      context: {
        type: parsedNotification.type,
        id: parsedNotification.id,
        eventCode: parsedNotification.eventCode,
      },
    });

    // Play the appropriate sound for this notification type
    notificationSoundService.playNotificationSound(parsedNotification.type).catch((error) => {
      logger.error({
        message: 'Failed to play notification sound',
        context: { error, type: parsedNotification.type },
      });
    });

    set({
      isOpen: true,
      notification: parsedNotification,
    });
  },

  hideNotificationModal: () => {
    logger.info({
      message: 'Hiding push notification modal',
    });

    set({
      isOpen: false,
      notification: null,
    });
  },
}));
