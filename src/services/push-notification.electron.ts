/**
 * Electron Push Notification Service
 * Handles system notifications for Electron desktop applications
 */
import { logger } from '@/lib/logging';
import { isElectron } from '@/lib/platform';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';

// Type declaration for Electron API exposed via preload
declare global {
  interface Window {
    electronAPI?: {
      showNotification: (options: { title: string; body: string; data: any }) => Promise<boolean>;
      onNotificationClicked: (callback: (data: any) => void) => void;
      platform: string;
      isElectron: boolean;
    };
  }
}

class ElectronPushNotificationService {
  private static instance: ElectronPushNotificationService;
  private isInitialized = false;
  private cleanupListener: (() => void) | null = null;

  static getInstance(): ElectronPushNotificationService {
    if (!ElectronPushNotificationService.instance) {
      ElectronPushNotificationService.instance = new ElectronPushNotificationService();
    }
    return ElectronPushNotificationService.instance;
  }

  /**
   * Initialize the Electron notification service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!isElectron || !window.electronAPI) {
      logger.warn({
        message: 'Electron API not available - skipping Electron notification service initialization',
      });
      return;
    }

    // Listen for notification clicks from the main process
    window.electronAPI.onNotificationClicked(this.handleNotificationClick);
    this.cleanupListener = null; // No cleanup needed for Electron API

    this.isInitialized = true;
    logger.info({
      message: 'Electron notification service initialized',
      context: { platform: window.electronAPI.platform },
    });
  }

  /**
   * Handle notification click events from main process
   */
  private handleNotificationClick = (data: any): void => {
    logger.info({
      message: 'Electron notification clicked',
      context: { data },
    });

    // Show the notification modal
    if (data?.eventCode) {
      usePushNotificationModalStore.getState().showNotificationModal({
        eventCode: data.eventCode,
        title: data.title,
        body: data.body || data.message,
        data,
      });
    }
  };

  /**
   * Show a native system notification
   */
  async showNotification(title: string, body: string, data?: any): Promise<boolean> {
    if (!window.electronAPI) {
      logger.warn({
        message: 'Cannot show notification: Electron API not available',
      });
      return false;
    }

    try {
      const result = await window.electronAPI.showNotification({
        title,
        body,
        data: data || {},
      });

      logger.info({
        message: 'Electron notification shown',
        context: { title, success: result },
      });

      return result;
    } catch (error) {
      logger.error({
        message: 'Failed to show Electron notification',
        context: { error, title },
      });
      return false;
    }
  }

  /**
   * Request notification permission
   * Note: Electron has different permission handling than web
   * Desktop notifications typically don't require explicit permission
   */
  async requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    // Electron desktop notifications don't require explicit permission like web
    // They use the system's built-in notification system
    return 'granted';
  }

  /**
   * Subscribe to push notifications
   * For Electron, we rely on SignalR for real-time updates
   * which then triggers local system notifications
   */
  async subscribe(_vapidPublicKey?: string): Promise<string | null> {
    // Electron apps don't use web push subscriptions
    // They receive updates via SignalR and show local system notifications
    logger.info({
      message: 'Electron apps use SignalR for notifications, not web push subscriptions',
    });
    return 'electron-signalr';
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    // No actual subscription to unsubscribe from in Electron
    return true;
  }

  /**
   * Cleanup listeners on unmount
   */
  cleanup(): void {
    if (this.cleanupListener) {
      this.cleanupListener();
      this.cleanupListener = null;
    }
    this.isInitialized = false;
  }

  /**
   * Check if Electron notifications are supported
   */
  static isSupported(): boolean {
    return isElectron && !!window.electronAPI;
  }
}

export const electronPushNotificationService = ElectronPushNotificationService.getInstance();
