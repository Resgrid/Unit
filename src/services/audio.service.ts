import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/lib/logging';

class AudioService {
  private static instance: AudioService;

  private constructor() {
    this.initializeAudio();
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  private async initializeAudio(): Promise<void> {
    try {
      logger.info({
        message: 'Audio service initialized',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize audio service',
        context: { error },
      });
    }
  }

  private async playNotificationSound(soundIdentifier: string): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        // On iOS, we can trigger a silent notification with sound
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '',
            body: '',
            sound: soundIdentifier,
            badge: 0,
          },
          trigger: null, // Trigger immediately
        });
      } else {
        // On Android, we can play system sounds or use notification channels
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '',
            body: '',
            sound: soundIdentifier,
          },
          trigger: null,
        });
      }

      logger.debug({
        message: 'Sound played via notification',
        context: { soundIdentifier },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to play notification sound',
        context: { soundIdentifier, error },
      });
    }
  }

  async playConnectionSound(): Promise<void> {
    try {
      const soundIdentifier = Platform.select({
        ios: 'space_notification1',
        android: 'space_notification1',
      });

      if (soundIdentifier) {
        await this.playNotificationSound(soundIdentifier);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play connection sound',
        context: { error },
      });
    }
  }

  async playDisconnectionSound(): Promise<void> {
    try {
      const soundIdentifier = Platform.select({
        ios: 'space_notification2',
        android: 'space_notification2',
      });

      if (soundIdentifier) {
        await this.playNotificationSound(soundIdentifier);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play disconnection sound',
        context: { error },
      });
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info({
        message: 'Audio service cleaned up',
      });
    } catch (error) {
      logger.error({
        message: 'Error during audio service cleanup',
        context: { error },
      });
    }
  }
}

export const audioService = AudioService.getInstance();
