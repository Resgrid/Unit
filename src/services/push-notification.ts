import notifee, { AndroidImportance, AndroidVisibility, AuthorizationStatus, EventType } from '@notifee/react-native';
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

  private async setupIOSNotificationCategories(): Promise<void> {
    if (Platform.OS === 'ios') {
      try {
        // Set up notification categories for iOS
        // Note: This does NOT request permissions, just sets up the categories
        await notifee.setNotificationCategories([
          {
            id: 'calls',
            actions: [
              {
                id: 'view',
                title: 'View Call',
                foreground: true,
              },
            ],
          },
        ]);

        logger.info({
          message: 'iOS notification categories setup completed',
        });
      } catch (error) {
        logger.error({
          message: 'Error setting up iOS notification categories',
          context: { error },
        });
      }
    }
  }

  private handleRemoteMessage = async (remoteMessage: any): Promise<void> => {
    logger.info({
      message: 'FCM message received',
      context: {
        data: remoteMessage.data,
        notification: remoteMessage.notification,
      },
    });

    // Extract eventCode and other data based on platform
    // For Android: data.eventCode, data.type, data.title, data.message
    // For iOS: comes through notification or data
    const eventCode = remoteMessage.data?.eventCode as string | undefined;
    const customType = remoteMessage.data?.type || remoteMessage.data?.customType;
    const title = (remoteMessage.data?.title as string) || remoteMessage.notification?.title;
    const body = (remoteMessage.data?.message as string) || remoteMessage.notification?.body;
    const category = remoteMessage.data?.category || remoteMessage.notification?.android?.channelId;

    // On iOS, display the notification in foreground using Notifee
    if (Platform.OS === 'ios' && remoteMessage.notification) {
      try {
        // Determine if this is a critical alert (calls)
        const isCritical = category === 'calls' || customType === '0';

        // Extract sound name from FCM payload, fallback to 'default'
        const sound = (remoteMessage.data?.sound as string) || 'default';

        await notifee.displayNotification({
          title: title,
          body: body,
          ios: {
            sound: sound,
            criticalVolume: 1.0,
            critical: isCritical,
            categoryId: (category as string) || 'calls',
          },
          data: remoteMessage.data as Record<string, string>,
        });
      } catch (error) {
        logger.error({
          message: 'Error displaying iOS foreground notification',
          context: { error },
        });
      }
    }

    // Check if the notification has an eventCode and show modal
    // eventCode must be a string to be valid
    if (eventCode && typeof eventCode === 'string') {
      const notificationData = {
        eventCode: eventCode,
        title: title,
        body: body,
        data: remoteMessage.data,
      };

      // Show the notification modal using the store
      await usePushNotificationModalStore.getState().showNotificationModal(notificationData);
    }
  };

  async initialize(): Promise<void> {
    // Set up notification channels/categories based on platform
    await this.setupAndroidNotificationChannels();
    await this.setupIOSNotificationCategories();

    // Set up Notifee event listeners for notification taps
    notifee.onForegroundEvent(async ({ type, detail }) => {
      logger.info({
        message: 'Notifee foreground event',
        context: { type, detail: { id: detail.notification?.id, data: detail.notification?.data } },
      });

      // Handle notification press
      if (type === EventType.PRESS && detail.notification) {
        const eventCode = detail.notification.data?.eventCode as string | undefined;
        const title = detail.notification.title;
        const body = detail.notification.body;

        if (eventCode && typeof eventCode === 'string') {
          const notificationData = {
            eventCode: eventCode,
            title: title,
            body: body,
            data: detail.notification.data,
          };

          logger.info({
            message: 'Showing notification modal from Notifee foreground tap',
            context: { eventCode, title },
          });

          await usePushNotificationModalStore.getState().showNotificationModal(notificationData);
        }
      }
    });

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      logger.info({
        message: 'Notifee background event',
        context: { type, detail: { id: detail.notification?.id, data: detail.notification?.data } },
      });

      // Handle notification press in background
      if (type === EventType.PRESS && detail.notification) {
        const eventCode = detail.notification.data?.eventCode as string | undefined;
        const title = detail.notification.title;
        const body = detail.notification.body;

        if (eventCode && typeof eventCode === 'string') {
          const notificationData = {
            eventCode: eventCode,
            title: title,
            body: body,
            data: detail.notification.data,
          };

          logger.info({
            message: 'Showing notification modal from Notifee background tap',
            context: { eventCode, title },
          });

          await usePushNotificationModalStore.getState().showNotificationModal(notificationData);
        }
      }
    });

    // Register background message handler (only once)
    if (!this.backgroundMessageHandlerRegistered) {
      messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
        logger.info({
          message: 'Background FCM message received',
          context: {
            data: remoteMessage.data,
            notification: remoteMessage.notification,
          },
        });

        // For iOS background notifications, display using Notifee
        if (Platform.OS === 'ios' && remoteMessage.notification) {
          const customType = remoteMessage.data?.type || remoteMessage.data?.customType;
          const category = remoteMessage.data?.category || remoteMessage.notification?.android?.channelId || 'calls';
          const title = (remoteMessage.data?.title as string) || remoteMessage.notification.title;
          const body = (remoteMessage.data?.message as string) || remoteMessage.notification.body;
          const isCritical = category === 'calls' || customType === '0';

          // Derive sound from remoteMessage.data['sound'] or remoteMessage.notification?.ios?.sound, fallback to 'default'
          const soundName = String(remoteMessage.data?.sound || remoteMessage.notification?.ios?.sound || 'default');

          await notifee.displayNotification({
            title: title,
            body: body,
            ios: {
              sound: soundName,
              criticalVolume: 1.0,
              critical: isCritical,
              categoryId: (category as string) || 'calls',
            },
            data: remoteMessage.data as Record<string, string>,
          });
        }
      });
      this.backgroundMessageHandlerRegistered = true;
    }

    // Listen for foreground messages and store the unsubscribe function
    this.fcmOnMessageUnsubscribe = messaging().onMessage(this.handleRemoteMessage);

    // Listen for notification opened app (when user taps on notification)
    this.fcmOnNotificationOpenedAppUnsubscribe = messaging().onNotificationOpenedApp((remoteMessage: any) => {
      logger.info({
        message: 'Notification opened app (from background)',
        context: {
          data: remoteMessage.data,
          notification: remoteMessage.notification,
        },
      });

      // Extract eventCode and other data
      const eventCode = remoteMessage.data?.eventCode as string | undefined;
      const title = (remoteMessage.data?.title as string) || remoteMessage.notification?.title;
      const body = (remoteMessage.data?.message as string) || remoteMessage.notification?.body;

      // Handle notification tap
      // Use a small delay to ensure the app is fully initialized and the store is ready
      setTimeout(async () => {
        if (eventCode && typeof eventCode === 'string') {
          const notificationData = {
            eventCode: eventCode,
            title: title,
            body: body,
            data: remoteMessage.data,
          };

          logger.info({
            message: 'Showing notification modal from tap (background)',
            context: { eventCode, title },
          });

          // Show the notification modal using the store
          await usePushNotificationModalStore.getState().showNotificationModal(notificationData);
        }
      }, 300);
    });

    // Check if app was opened from a notification (when app was killed)
    // Use a longer delay to ensure React tree is fully mounted
    setTimeout(() => {
      messaging()
        .getInitialNotification()
        .then((remoteMessage: any) => {
          if (remoteMessage) {
            logger.info({
              message: 'App opened from notification (killed state)',
              context: {
                data: remoteMessage.data,
                notification: remoteMessage.notification,
              },
            });

            // Extract eventCode and other data
            const eventCode = remoteMessage.data?.eventCode as string | undefined;
            const title = (remoteMessage.data?.title as string) || remoteMessage.notification?.title;
            const body = (remoteMessage.data?.message as string) || remoteMessage.notification?.body;

            // Handle the initial notification
            // Use a delay to ensure the app is fully loaded and the store is ready
            setTimeout(async () => {
              if (eventCode && typeof eventCode === 'string') {
                const notificationData = {
                  eventCode: eventCode,
                  title: title,
                  body: body,
                  data: remoteMessage.data,
                };

                logger.info({
                  message: 'Showing notification modal from tap (killed state)',
                  context: { eventCode, title },
                });

                // Show the notification modal using the store
                await usePushNotificationModalStore.getState().showNotificationModal(notificationData);
              }
            }, 500);
          }
        })
        .catch((error: any) => {
          logger.error({
            message: 'Error checking initial notification',
            context: { error },
          });
        });
    }, 1000);

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

    if (!unitId || unitId.trim() === '') {
      logger.warn({
        message: 'Cannot register for push notifications without an active unit ID',
      });
      return null;
    }

    try {
      // Request permissions based on platform
      if (Platform.OS === 'ios') {
        // For iOS, request permissions using Firebase Messaging
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

        // Also request Notifee permissions for iOS to enable critical alerts
        await notifee.requestPermission({
          alert: true,
          badge: true,
          sound: true,
          criticalAlert: true,
        });
      } else {
        // For Android, request permissions using Firebase Messaging
        let authStatus = await messaging().hasPermission();

        if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED || authStatus === messaging.AuthorizationStatus.DENIED) {
          authStatus = await messaging().requestPermission({
            alert: true,
            badge: true,
            sound: true,
          });
        }

        const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          logger.warn({
            message: 'Failed to get push notification permissions',
            context: { authStatus },
          });
          return null;
        }

        // For Android, also request notification permission using Notifee
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
        Token: this.pushToken || '',
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
