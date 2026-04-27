import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

import { logger } from '@/lib/logging';

const CHANNEL_ID = 'check-in-timers';
const NOTIFICATION_ID = 'check-in-timer-notification';

export interface NotificationLabels {
  statusLabels: Record<string, string>;
  channelName: string;
  channelDescription: string;
  actionText: string;
}

class CheckInNotificationService {
  private static instance: CheckInNotificationService;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private currentSeconds: number = 0;
  private currentStatus: string = 'Ok';
  private currentLabels: NotificationLabels | null = null;
  private channelCreated: boolean = false;

  static getInstance(): CheckInNotificationService {
    if (!CheckInNotificationService.instance) {
      CheckInNotificationService.instance = new CheckInNotificationService();
    }
    return CheckInNotificationService.instance;
  }

  private async ensureChannel(channelName: string, channelDescription: string): Promise<void> {
    if (this.channelCreated || Platform.OS !== 'android') return;

    await notifee.createChannel({
      id: CHANNEL_ID,
      name: channelName,
      description: channelDescription,
      importance: AndroidImportance.LOW,
    });
    this.channelCreated = true;
  }

  async startNotification(callName: string, callNumber: string, timerName: string, secondsRemaining: number, status: string, labels: NotificationLabels): Promise<void> {
    if (Platform.OS !== 'android') return;

    this.currentLabels = labels;
    await this.ensureChannel(labels.channelName, labels.channelDescription);
    this.currentSeconds = secondsRemaining;
    this.currentStatus = status;

    await this.displayNotification(callName, callNumber, timerName);

    // Local 1s countdown for smooth updates
    this.stopCountdown();
    this.countdownInterval = setInterval(async () => {
      this.currentSeconds = Math.max(0, this.currentSeconds - 1);
      await this.displayNotification(callName, callNumber, timerName);
    }, 1000);
  }

  async updateNotification(secondsRemaining: number, status: string, statusLabels: Record<string, string>): Promise<void> {
    this.currentSeconds = secondsRemaining;
    this.currentStatus = status;
    if (this.currentLabels) {
      this.currentLabels = { ...this.currentLabels, statusLabels };
    }
  }

  async stopNotification(): Promise<void> {
    this.stopCountdown();
    if (Platform.OS === 'android') {
      try {
        await notifee.cancelNotification(NOTIFICATION_ID);
      } catch (error) {
        logger.error({ message: 'Failed to cancel check-in notification', context: { error } });
      }
    }
  }

  private async displayNotification(callName: string, callNumber: string, timerName: string): Promise<void> {
    const minutes = Math.floor(this.currentSeconds / 60);
    const seconds = this.currentSeconds % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const statusLabel = this.currentLabels?.statusLabels[this.currentStatus] ?? this.currentStatus;
    const actionText = this.currentLabels?.actionText ?? 'Check In';

    try {
      await notifee.displayNotification({
        id: NOTIFICATION_ID,
        title: `${callName} #${callNumber}`,
        body: `${timerName} - ${timeStr} remaining [${statusLabel}]`,
        android: {
          channelId: CHANNEL_ID,
          ongoing: true,
          smallIcon: 'ic_notification',
          pressAction: { id: 'default' },
          actions: [
            {
              title: actionText,
              pressAction: { id: 'check-in' },
            },
          ],
        },
      });
    } catch (error) {
      logger.error({ message: 'Failed to display check-in notification', context: { error } });
    }
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}

export const checkInNotificationService = CheckInNotificationService.getInstance();
