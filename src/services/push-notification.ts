import notifee, { AndroidImportance, AndroidVisibility, AuthorizationStatus, EventType } from '@notifee/react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { registerUnitDevice } from '@/api/devices/push';
import { logger } from '@/lib/logging';
import { getDeviceUuid } from '@/lib/storage/app';
import { getAppliedNotificationSoundMode, getModernNotificationSoundsEnabled, setAppliedNotificationSoundMode } from '@/lib/storage/notification-prefs';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';
import { securityStore } from '@/stores/security/store';

// Numeric values for the CheckInType field expected by the API.
// 0 = Personnel check-in (no unit), 1 = Unit check-in.
const CHECK_IN_TYPE_PERSONNEL = 0;
const CHECK_IN_TYPE_UNIT = 1;

// Delays (ms) before showing the modal on a notification tap, so the React tree
// is mounted and the store is ready. See docs/ios-push-notification-tap-fix.md.
const TAP_BACKGROUND_DELAY_MS = 300;
const TAP_KILLED_INITIAL_DELAY_MS = 1000;
const TAP_KILLED_MODAL_DELAY_MS = 500;

// Define notification response types
export interface PushNotificationData {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

// Configure how notifications are presented while the app is in the foreground.
// With expo-notifications owning the UNUserNotificationCenter delegate (Firebase
// no longer does), this controls the native banner/sound/badge presentation.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface AndroidSoundChannel {
  id: string;
  name: string;
  description: string;
  vibration: boolean;
  modernSound: string;
  classicSound: string;
}

// Android notification channels whose sound follows the "modern sounds" setting.
// Channel IDs are fixed because the backend targets them by id, so to change a
// channel's sound we delete and recreate it (a channel's sound is immutable once
// created). The custom-tone channels (c1-c25) are intentionally excluded.
const ANDROID_SOUND_CHANNELS: AndroidSoundChannel[] = [
  { id: 'calls', name: 'Generic Call', description: 'Generic Call', vibration: true, modernSound: 'modernnotification', classicSound: 'notification' },
  { id: '0', name: 'Emergency Call', description: 'Emergency Call', vibration: true, modernSound: 'moderncallemergency', classicSound: 'callemergency' },
  { id: '1', name: 'High Call', description: 'High Call', vibration: true, modernSound: 'moderncallhigh', classicSound: 'callhigh' },
  { id: '2', name: 'Medium Call', description: 'Medium Call', vibration: true, modernSound: 'moderncallmedium', classicSound: 'callmedium' },
  { id: '3', name: 'Low Call', description: 'Low Call', vibration: true, modernSound: 'moderncalllow', classicSound: 'calllow' },
  { id: 'notif', name: 'Notification', description: 'Notifications', vibration: false, modernSound: 'modernnotification', classicSound: 'notification' },
  { id: 'message', name: 'Message', description: 'Messages', vibration: false, modernSound: 'modernmessage', classicSound: 'newmessage' },
];

class PushNotificationService {
  private static instance: PushNotificationService;
  private pushToken: string | null = null;
  private notificationListener: { remove: () => void } | null = null;
  private responseListener: { remove: () => void } | null = null;
  private notifeeForegroundUnsubscribe: (() => void) | null = null;

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
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      // Modern sounds are the default; the user can opt back into the classic
      // sounds via the settings toggle.
      const useModernSounds = getModernNotificationSoundsEnabled();
      const desiredMode = useModernSounds ? 'modern' : 'classic';
      const appliedMode = getAppliedNotificationSoundMode();

      // A channel's sound cannot be changed after creation, so when the sound
      // mode changes (or on a fresh install / app upgrade) delete the channels
      // first and let them be recreated below with the correct sound.
      if (appliedMode !== desiredMode) {
        await Promise.all(ANDROID_SOUND_CHANNELS.map((channel) => notifee.deleteChannel(channel.id)));
      }

      // Standard call/notification/message channels — sound follows the setting.
      for (const channel of ANDROID_SOUND_CHANNELS) {
        const sound = useModernSounds ? channel.modernSound : channel.classicSound;
        await this.createNotificationChannel(channel.id, channel.name, channel.description, sound, channel.vibration);
      }

      // Custom call channels (c1-c25) — user-selected tones, not affected by the setting.
      for (let i = 1; i <= 25; i++) {
        const channelId = `c${i}`;
        await this.createNotificationChannel(channelId, `Custom Call ${i}`, `Custom Call Tone ${i}`, channelId);
      }

      setAppliedNotificationSoundMode(desiredMode);

      logger.info({
        message: 'Android notification channels setup completed',
        context: { soundMode: desiredMode },
      });
    } catch (error) {
      logger.error({
        message: 'Error setting up Android notification channels',
        context: { error },
      });
    }
  }

  /**
   * Re-applies the Android notification channels using the current "modern
   * sounds" preference. Call this after the user toggles the setting so the
   * channel sounds update — the channels are deleted and recreated because a
   * channel's sound is immutable once created. No-op on non-Android platforms.
   */
  public async refreshAndroidNotificationChannels(): Promise<void> {
    await this.setupAndroidNotificationChannels();
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

  // Shared helper: show the in-app modal when a notification carries an eventCode.
  private showModalForData(data: Record<string, unknown> | undefined, title?: string | null, body?: string | null): void {
    const eventCode = data?.eventCode;
    if (!eventCode || typeof eventCode !== 'string') {
      return;
    }

    const notificationData: PushNotificationData & { eventCode: string } = {
      eventCode,
      data,
    };
    if (title) {
      notificationData.title = title;
    }
    if (body) {
      notificationData.body = body;
    }

    void usePushNotificationModalStore.getState().showNotificationModal(notificationData);
  }

  // Foreground push received via expo-notifications.
  private handleNotificationReceived = (notification: Notifications.Notification): void => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;

    logger.info({
      message: 'Notification received',
      context: { data },
    });

    this.showModalForData(data, notification.request.content.title, notification.request.content.body);
  };

  // Notification tap (background → foreground) via expo-notifications.
  private handleNotificationResponse = (response: Notifications.NotificationResponse): void => {
    const content = response.notification.request.content;
    const data = content.data as Record<string, unknown> | undefined;

    logger.info({
      message: 'Notification response received (tap)',
      context: { data, actionIdentifier: response.actionIdentifier },
    });

    // Delay so the React tree is mounted and the modal store is ready.
    setTimeout(() => {
      this.showModalForData(data, content.title, content.body);
    }, TAP_BACKGROUND_DELAY_MS);
  };

  // Notifee events handle taps/actions on notifee-displayed notifications,
  // including the check-in action surfaced by the check-in timer feature.
  private setupNotifeeEvents(): void {
    this.notifeeForegroundUnsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      logger.info({
        message: 'Notifee foreground event',
        context: { type, detail: { id: detail.notification?.id, data: detail.notification?.data } },
      });

      // Handle check-in action press
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'check-in') {
        await this.handleCheckInAction();
      }

      // Handle notification press → modal
      if (type === EventType.PRESS && detail.notification) {
        this.showModalForData(detail.notification.data, detail.notification.title, detail.notification.body);
      }
    });

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      logger.info({
        message: 'Notifee background event',
        context: { type, detail: { id: detail.notification?.id, data: detail.notification?.data } },
      });

      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'check-in') {
        await this.handleCheckInAction();
      }

      if (type === EventType.PRESS && detail.notification) {
        this.showModalForData(detail.notification.data, detail.notification.title, detail.notification.body);
      }
    });
  }

  private async handleCheckInAction(): Promise<void> {
    logger.info({ message: 'Check-in action pressed from notification' });
    const activeCall = useCoreStore.getState().activeCall;
    const activeUnit = useCoreStore.getState().activeUnit;
    if (!activeCall) {
      return;
    }

    const callId = parseInt(activeCall.CallId, 10);
    if (Number.isNaN(callId)) {
      logger.error({ message: 'Check-in action aborted: invalid CallId', context: { CallId: activeCall.CallId } });
      return;
    }

    const unitId = activeUnit ? parseInt(activeUnit.UnitId, 10) : undefined;
    if (activeUnit && Number.isNaN(unitId)) {
      logger.error({ message: 'Check-in action aborted: invalid UnitId', context: { UnitId: activeUnit.UnitId } });
      return;
    }

    await useCheckInTimerStore.getState().performCheckIn({
      CallId: callId,
      CheckInType: activeUnit ? CHECK_IN_TYPE_UNIT : CHECK_IN_TYPE_PERSONNEL,
      UnitId: unitId,
      Latitude: useLocationStore.getState().latitude?.toString(),
      Longitude: useLocationStore.getState().longitude?.toString(),
    });
  }

  async initialize(): Promise<void> {
    // Push notifications are native-only; skip on web
    if (Platform.OS === 'web') {
      logger.debug({ message: 'Push notification service skipped on web' });
      return;
    }

    // Register expo-notifications listeners synchronously so taps/receipts that
    // arrive during startup are not missed.
    this.notificationListener = Notifications.addNotificationReceivedListener(this.handleNotificationReceived);
    this.responseListener = Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);

    // Set up notification channels/categories based on platform
    await this.setupAndroidNotificationChannels();
    await this.setupIOSNotificationCategories();

    // Notifee events (check-in action + notifee-displayed taps)
    this.setupNotifeeEvents();

    // Handle the notification that launched the app from a killed state.
    // expo-notifications surfaces this via getLastNotificationResponseAsync().
    setTimeout(() => {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (!response) {
            return;
          }
          const content = response.notification.request.content;
          const data = content.data as Record<string, unknown> | undefined;

          logger.info({
            message: 'App opened from notification (killed state)',
            context: { data },
          });

          setTimeout(() => {
            this.showModalForData(data, content.title, content.body);
          }, TAP_KILLED_MODAL_DELAY_MS);
        })
        .catch((error) => {
          logger.error({
            message: 'Error checking initial notification',
            context: { error },
          });
        });
    }, TAP_KILLED_INITIAL_DELAY_MS);

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
      // Request OS notification permissions (iOS critical alerts included).
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        logger.warn({
          message: 'Failed to get push notification permissions',
          context: { status: finalStatus },
        });
        return null;
      }

      // Also request Notifee permissions so notifee-managed channels/critical
      // alerts are authorized on both platforms.
      const notifeeSettings = await notifee.requestPermission({
        alert: true,
        badge: true,
        sound: true,
        criticalAlert: true,
      });
      if (notifeeSettings.authorizationStatus === AuthorizationStatus.DENIED) {
        logger.warn({
          message: 'Notifee notification permissions denied',
          context: { authorizationStatus: notifeeSettings.authorizationStatus },
        });
        return null;
      }

      // Get the native device push token (FCM on Android, APNs on iOS).
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      this.pushToken = devicePushToken.data as string;

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
      logger.warn({
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
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }

    if (this.notifeeForegroundUnsubscribe) {
      this.notifeeForegroundUnsubscribe();
      this.notifeeForegroundUnsubscribe = null;
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
    // Push notifications are native-only; skip on web
    if (Platform.OS === 'web') return;

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
