import notifee, { AndroidImportance, AndroidVisibility, AuthorizationStatus, EventType } from '@notifee/react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { registerUnitDevice } from '@/api/devices/push';
import { logger } from '@/lib/logging';
import { routerPushWithRetry } from '@/lib/navigation';
import { getDeviceUuid } from '@/lib/storage/app';
import { getAppliedNotificationSoundMode, getModernNotificationSoundsEnabled, setAppliedNotificationSoundMode } from '@/lib/storage/notification-prefs';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import useAuthStore from '@/stores/auth/store';
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

/**
 * Handles chat push deep-links. Chat notifications carry an eventCode of
 * "t:{channelId}" (direct message) or "g:{channelId}" (group/channel); both
 * navigate to the chat conversation route.
 */
export function handleChatDeepLink(eventCode: string): boolean {
  const match = /^([tg]):(.+)$/.exec(eventCode);
  if (!match) return false;
  const channelId = match[2];
  if (/[/\\?#]/.test(channelId)) return false;
  void routerPushWithRetry(
    { pathname: '/chat/[channelId]', params: { channelId } },
    {
      maxAttempts: 40,
      retryDelayMs: 250,
      // On a cold start the session is still hydrating. Pushing a protected route before
      // it settles gets the route replaced by the auth guard, which is indistinguishable
      // from the tap doing nothing at all.
      waitUntil: () => useAuthStore.getState().status === 'signedIn',
    }
  ).catch((error) => {
    logger.error({ message: 'Failed to deep-link to chat channel', context: { error, eventCode } });
  });
  return true;
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
  /**
   * Request identifiers of taps already routed to the modal. On a cold start the SAME
   * launch tap can arrive through both addNotificationResponseReceivedListener and
   * getLastNotificationResponseAsync — dedupe by identifier so it shows once while
   * distinct notifications still each get handled.
   */
  private handledResponseIds = new Set<string>();

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

  /**
   * Single path for tap responses from expo-notifications (live listener AND the
   * cold-start replay). Skips responses whose request identifier was already routed.
   */
  private handleResponseOnce(response: Notifications.NotificationResponse, delayMs: number, source: string): void {
    const request = response.notification.request;
    const identifier = request.identifier;

    if (identifier && this.handledResponseIds.has(identifier)) {
      logger.debug({
        message: 'Skipping already-handled notification response',
        context: { identifier, source },
      });
      return;
    }
    if (identifier) {
      // Cap the dedupe set — one entry per tap, never pruned otherwise.
      if (this.handledResponseIds.size >= 200) {
        const oldest = this.handledResponseIds.values().next().value;
        if (oldest !== undefined) {
          this.handledResponseIds.delete(oldest);
        }
      }
      this.handledResponseIds.add(identifier);
    }

    const content = request.content;
    const data = content.data as Record<string, unknown> | undefined;

    logger.info({
      message: 'Notification response received (tap)',
      context: { data, actionIdentifier: response.actionIdentifier, source },
    });

    // Delay so the React tree is mounted and the modal store is ready.
    setTimeout(() => {
      // Deep-link chat notifications: eventCode "t:{channelId}" (DM) / "g:{channelId}" (group).
      const eventCode = data?.eventCode;
      if (typeof eventCode === 'string' && handleChatDeepLink(eventCode)) {
        return;
      }
      this.showModalForData(data, content.title, content.body);
    }, delayMs);
  }

  // Notification tap (background → foreground) via expo-notifications.
  private handleNotificationResponse = (response: Notifications.NotificationResponse): void => {
    this.handleResponseOnce(response, TAP_BACKGROUND_DELAY_MS, 'listener');
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
    // expo-notifications surfaces this via getLastNotificationResponseAsync(); the same
    // tap may also have reached the response listener above, so both routes flow through
    // handleResponseOnce which dedupes by request identifier.
    setTimeout(() => {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (!response) {
            return;
          }

          logger.info({
            message: 'App opened from notification (killed state)',
            context: { data: response.notification.request.content.data },
          });

          this.handleResponseOnce(response, TAP_KILLED_MODAL_DELAY_MS, 'killed-state');
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

  /**
   * Best-effort local push teardown on logout: clears the in-memory token,
   * badge and delivered notifications so the previous user's alerts don't
   * linger for the next user of the device. NOTE: the backend has no
   * unregister-device endpoint yet — server-side token invalidation should be
   * added there and called from here when available.
   */
  public async unregisterFromPushNotifications(): Promise<void> {
    try {
      this.pushToken = null;
      await Notifications.setBadgeCountAsync(0).catch(() => {});
      await Notifications.dismissAllNotificationsAsync().catch(() => {});
      if (Platform.OS === 'android') {
        await notifee.cancelAllNotifications().catch(() => {});
      }
      logger.info({
        message: 'Push notification local state cleared on logout',
      });
    } catch (error) {
      logger.warn({
        message: 'Error clearing push notification state on logout',
        context: { error },
      });
    }
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
  const authStatus = useAuthStore((state) => state.status);
  const previousUnitIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Push notifications are native-only; skip on web
    if (Platform.OS === 'web') return;

    // Don't register until auth has settled. On a cold start (especially a
    // background wake) the persisted activeUnitId and rights hydrate before
    // token validity is known, so registering here sends a request with a
    // stale token: the 401 forces a refresh and, if the refresh token has
    // expired, logs the user out.
    if (authStatus !== 'signedIn' || !useAuthStore.getState().accessToken) return;

    // Only register if we have an active unit ID and it's different from the previous one
    if (rights && activeUnitId && activeUnitId !== previousUnitIdRef.current) {
      pushNotificationService
        .registerForPushNotifications(activeUnitId, rights.DepartmentCode)
        .then((token) => {
          if (token) {
            // Only mark the unit as registered on success. Marking it
            // unconditionally meant a single transient failure (401 during
            // hydration, offline, 5xx) permanently disabled push for the rest
            // of the app session, since the ref then matched forever.
            previousUnitIdRef.current = activeUnitId;
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
    }

    // Cleanup function
    return () => {
      // No need to clean up here as the service handles its own cleanup
    };
  }, [activeUnitId, rights, authStatus]);

  return {
    pushToken: pushNotificationService.getPushToken(),
  };
};
