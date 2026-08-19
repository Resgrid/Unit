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
  showNotificationModal: (notificationData: PushNotificationData) => Promise<void>;
  hideNotificationModal: () => void;
  parseNotification: (notificationData: PushNotificationData) => ParsedNotification;
}

// First character of the event code prefix sent by the Resgrid backend, e.g.
// "C:1234" call, "M:5678" message, "t:9012" chat, "g:3456" group chat.
const EVENT_CODE_PREFIXES: Record<string, NotificationType> = {
  c: 'call',
  m: 'message',
  t: 'chat',
  g: 'group-chat',
};

export const parseNotificationData = (notificationData: PushNotificationData): ParsedNotification => {
  const eventCode = notificationData.eventCode || '';
  let type: NotificationType = 'unknown';
  let id = '';

  const separatorIndex = eventCode.indexOf(':');

  if (separatorIndex > 0) {
    // Colon form ("C:1234", "t:{channelId}"): split on the FIRST colon only, so
    // an id that itself contains one survives intact.
    const lowerPrefix = eventCode.slice(0, separatorIndex).toLowerCase();
    type = EVENT_CODE_PREFIXES[lowerPrefix.charAt(0)] ?? 'unknown';
    id = eventCode.slice(separatorIndex + 1);
  } else if (eventCode.length > 1) {
    // Legacy colon-less form ("C1234"): first character is the type prefix, the
    // rest is the id.
    type = EVENT_CODE_PREFIXES[eventCode.charAt(0).toLowerCase()] ?? 'unknown';
    id = eventCode.slice(1);
  }

  return {
    type,
    id,
    eventCode,
    title: notificationData.title,
    body: notificationData.body,
    data: notificationData.data,
  };
};

export const usePushNotificationModalStore = create<PushNotificationModalState>((set, get) => ({
  isOpen: false,
  notification: null,

  parseNotification: (notificationData: PushNotificationData): ParsedNotification => parseNotificationData(notificationData),

  showNotificationModal: async (notificationData: PushNotificationData) => {
    const parsedNotification = get().parseNotification(notificationData);

    logger.info({
      message: 'Showing push notification modal',
      context: {
        type: parsedNotification.type,
        id: parsedNotification.id,
        eventCode: parsedNotification.eventCode,
      },
    });

    // Play the appropriate sound for this notification type and await it
    // This ensures the sound starts playing before the modal appears
    try {
      await notificationSoundService.playNotificationSound(parsedNotification.type);
    } catch (error) {
      logger.error({
        message: 'Failed to play notification sound',
        context: { error, type: parsedNotification.type },
      });
    }

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
