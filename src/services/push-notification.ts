import notifee, { AndroidImportance, AndroidVisibility, AuthorizationStatus } from '@notifee/react-native';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Device from 'expo-device';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { registerUnitDevice } from '@/api/devices/push';
import { logger } from '@/lib/logging';
import { getDeviceUuid } from '@/lib/storage/app';
import { useCoreStore } from '@/stores/app/core-store';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';
import { securityStore } from '@/stores/security/store';

// Define notification response types
export interface PushNotificationData {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private pushToken: string | null = null;
  private fcmOnMessageUnsubscribe: (() => void) | null = null;
  private fcmOnNotificationOpenedAppUnsubscribe: (() => void) | null = null;
  private backgroundMessageHandlerRegistered: boolean = false;

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private async createNotificationChannel(id: string, name: string, description: string, sound?: string, vibration: boolean = true): Promise<void> {
    await notifee.createChannel({
      id,
      name,
      description,
      importance: AndroidImportance.HIGH,
      vibration: vibration,
      vibrationPattern: vibration ? [300, 500] : undefined,
      sound,
      lights: true,
      lightColor: '#FF231F7C',
      visibility: AndroidVisibility.PUBLIC,
    });
  }

  private async setupAndroidNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        // Standard call channels
        await this.createNotificationChannel('calls', 'Generic Call', 'Generic Call');
        await this.createNotificationChannel('0', 'Emergency Call', 'Emergency Call', 'callemergency');
        await this.createNotificationChannel('1', 'High Call', 'High Call', 'callhigh');
        await this.createNotificationChannel('2', 'Medium Call', 'Medium Call', 'callmedium');
        await this.createNotificationChannel('3', 'Low Call', 'Low Call', 'calllow');

        // Message and notification channels
        await this.createNotificationChannel('notif', 'Notification', 'Notifications', undefined, false);
        await this.createNotificationChannel('message', 'Message', 'Messages', undefined, false);

        // Custom call channels (c1-c25)
        for (let i = 1; i <= 25; i++) {
          const channelId = `c${i}`;
          await this.createNotificationChannel(channelId, `Custom Call ${i}`, `Custom Call Tone ${i}`, channelId);
        }

        logger.info({
          message: 'Android notification channels setup completed',
        });
      } catch (error) {
        logger.error({
          message: 'Error setting up Android notification channels',
          context: { error },
        });
      }
    }
  }

  private handleRemoteMessage = async (remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> => {
    logger.info({
      message: 'FCM message received',
      context: {
        data: remoteMessage.data,
        notification: remoteMessage.notification,
      },
    });

    // Check if the notification has an eventCode and show modal
    // eventCode must be a string to be valid
    if (remoteMessage.data && remoteMessage.data.eventCode && typeof remoteMessage.data.eventCode === 'string') {
      const notificationData = {
        eventCode: remoteMessage.data.eventCode as string,
        title: remoteMessage.notification?.title || undefined,
        body: remoteMessage.notification?.body || undefined,
        data: remoteMessage.data,
      };

      // Show the notification modal using the store
      usePushNotificationModalStore.getState().showNotificationModal(notificationData);
    }
  };

  async initialize(): Promise<void> {
    // Set up Android notification channels
    await this.setupAndroidNotificationChannels();

    // Register background message handler (only once)
    if (!this.backgroundMessageHandlerRegistered) {
      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        logger.info({
          message: 'Background FCM message received',
          context: {
            data: remoteMessage.data,
            notification: remoteMessage.notification,
          },
        });

        // Handle background notifications
        // Background messages can be used to update app state or show notifications
        // The notification is automatically displayed by FCM if it has a notification payload
      });
      this.backgroundMessageHandlerRegistered = true;
    }

    // Listen for foreground messages and store the unsubscribe function
    this.fcmOnMessageUnsubscribe = messaging().onMessage(this.handleRemoteMessage);

    // Listen for notification opened app (when user taps on notification)
    this.fcmOnNotificationOpenedAppUnsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
      logger.info({
        message: 'Notification opened app',
        context: {
          data: remoteMessage.data,
        },
      });

      // Handle notification tap
      // You can navigate to specific screens based on the notification data
      if (remoteMessage.data && remoteMessage.data.eventCode && typeof remoteMessage.data.eventCode === 'string') {
        const notificationData = {
          eventCode: remoteMessage.data.eventCode as string,
          title: remoteMessage.notification?.title || undefined,
          body: remoteMessage.notification?.body || undefined,
          data: remoteMessage.data,
        };

        // Show the notification modal using the store
        usePushNotificationModalStore.getState().showNotificationModal(notificationData);
      }
    });

    // Check if app was opened from a notification (when app was killed)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          logger.info({
            message: 'App opened from notification (killed state)',
            context: {
              data: remoteMessage.data,
            },
          });

          // Handle the initial notification
          if (remoteMessage.data && remoteMessage.data.eventCode && typeof remoteMessage.data.eventCode === 'string') {
            const notificationData = {
              eventCode: remoteMessage.data.eventCode as string,
              title: remoteMessage.notification?.title || undefined,
              body: remoteMessage.notification?.body || undefined,
              data: remoteMessage.data,
            };

            // Show the notification modal using the store
            usePushNotificationModalStore.getState().showNotificationModal(notificationData);
          }
        }
      });

    logger.info({
      message: 'Push notification service initialized',
    });
  }

  public async registerForPushNotifications(unitId: string, departmentCode: string): Promise<string | null> {
    if (!Device.isDevice) {
      logger.warn({
        message: 'Push notifications are not available on simulator/emulator',
      });
      return null;
    }

    try {
      // Request permissions using Firebase Messaging
      let authStatus = await messaging().hasPermission();

      if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED || authStatus === messaging.AuthorizationStatus.DENIED) {
        // Request permission
        authStatus = await messaging().requestPermission({
          alert: true,
          badge: true,
          sound: true,
          criticalAlert: true, // iOS critical alerts
          provisional: false,
        });
      }

      // Check if permission was granted
      const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        logger.warn({
          message: 'Failed to get push notification permissions',
          context: { authStatus },
        });
        return null;
      }

      // For Android, also request notification permission using Notifee
      if (Platform.OS === 'android') {
        const notifeeSettings = await notifee.requestPermission();
        if (notifeeSettings.authorizationStatus === AuthorizationStatus.DENIED) {
          logger.warn({
            message: 'Notifee notification permissions denied',
            context: { authorizationStatus: notifeeSettings.authorizationStatus },
          });
          return null;
        }
      }

      // Get FCM token
      const token = await messaging().getToken();
      this.pushToken = token;

      logger.info({
        message: 'Push notification token obtained',
        context: {
          token: this.pushToken,
          unitId,
          platform: Platform.OS,
        },
      });

      // Register device with backend
      await registerUnitDevice({
        UnitId: unitId,
        Token: this.pushToken,
        Platform: Platform.OS === 'ios' ? 1 : 2,
        DeviceUuid: getDeviceUuid() || '',
        Prefix: departmentCode,
      });

      return this.pushToken;
    } catch (error) {
      logger.error({
        message: 'Error registering for push notifications',
        context: { error },
      });
      return null;
    }
  }

  public getPushToken(): string | null {
    return this.pushToken;
  }

  public cleanup(): void {
    if (this.fcmOnMessageUnsubscribe) {
      this.fcmOnMessageUnsubscribe();
      this.fcmOnMessageUnsubscribe = null;
    }

    if (this.fcmOnNotificationOpenedAppUnsubscribe) {
      this.fcmOnNotificationOpenedAppUnsubscribe();
      this.fcmOnNotificationOpenedAppUnsubscribe = null;
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();

// React hook for component usage
export const usePushNotifications = () => {
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const rights = securityStore((state) => state.rights);
  const previousUnitIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only register if we have an active unit ID and it's different from the previous one
    if (rights && activeUnitId && activeUnitId !== previousUnitIdRef.current) {
      pushNotificationService
        .registerForPushNotifications(activeUnitId, rights.DepartmentCode)
        .then((token) => {
          if (token) {
            logger.info({
              message: 'Successfully registered for push notifications',
              context: { unitId: activeUnitId },
            });
          }
        })
        .catch((error) => {
          logger.error({
            message: 'Error in push notification registration hook',
            context: { error },
          });
        });

      previousUnitIdRef.current = activeUnitId;
    }

    // Cleanup function
    return () => {
      // No need to clean up here as the service handles its own cleanup
    };
  }, [activeUnitId, rights]);

  return {
    pushToken: pushNotificationService.getPushToken(),
  };
};
