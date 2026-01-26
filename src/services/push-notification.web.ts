/**
 * Web Push Notification Service
 * Handles push notifications for web browsers using the Web Push API
 */
import { logger } from '@/lib/logging';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';

class WebPushNotificationService {
  private static instance: WebPushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private pushSubscription: PushSubscription | null = null;
  private isInitialized = false;

  static getInstance(): WebPushNotificationService {
    if (!WebPushNotificationService.instance) {
      WebPushNotificationService.instance = new WebPushNotificationService();
    }
    return WebPushNotificationService.instance;
  }

  /**
   * Initialize the web push notification service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      logger.warn({
        message: 'Web Push notifications are not supported in this browser',
      });
      return;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js');
      logger.info({
        message: 'Service worker registered for push notifications',
        context: { scope: this.registration.scope },
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage);

      // Wait for service worker to be ready, then send CLIENT_READY handshake
      await navigator.serviceWorker.ready;
      this.sendClientReadyHandshake();

      // Additionally add a one-time 'controllerchange' listener to handle cases where controller is null initially (first-install)
      const onControllerChange = () => {
        if (navigator.serviceWorker.controller) {
          logger.info({
            message: 'Service worker controller changed, sending CLIENT_READY',
          });
          navigator.serviceWorker.controller.postMessage({
            type: 'CLIENT_READY',
          });
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

      this.isInitialized = true;
    } catch (error) {
      logger.error({
        message: 'Failed to register service worker',
        context: { error },
      });
    }
  }

  /**
   * Send CLIENT_READY handshake to service worker
   * This signals that the client is ready to receive notification messages
   */
  private sendClientReadyHandshake(): void {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLIENT_READY',
      });
      logger.info({
        message: 'Sent CLIENT_READY handshake to service worker controller',
      });
    } else if (this.registration?.active) {
      this.registration.active.postMessage({
        type: 'CLIENT_READY',
      });
      logger.info({
        message: 'Sent CLIENT_READY handshake to active service worker (registration.active fallback)',
      });
    } else {
      logger.info({
        message: 'Silently skipping send CLIENT_READY: no controller or active registration available',
      });
    }
  }

  /**
   * Handle messages from the service worker
   */
  private handleServiceWorkerMessage = (event: MessageEvent): void => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      const data = event.data?.data ?? undefined;

      // Only proceed if data is an object and has the expected fields
      if (data && typeof data === 'object' && data.eventCode) {
        logger.info({
          message: 'Notification clicked from service worker',
          context: { data },
        });

        // Show the notification modal
        usePushNotificationModalStore.getState().showNotificationModal({
          eventCode: data.eventCode,
          title: data.title,
          body: data.body || data.message,
          data,
        });
      } else {
        logger.warn({
          message: 'Notification click received with missing or invalid data',
          context: { data: event.data },
        });
      }
    }
  };

  /**
   * Request permission and subscribe to push notifications
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      logger.warn({
        message: 'Notifications not supported in this browser',
      });
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    logger.info({
      message: 'Notification permission result',
      context: { permission },
    });

    return permission;
  }

  /**
   * Subscribe to push notifications with VAPID key
   */
  async subscribe(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      logger.error({
        message: 'Cannot subscribe: service worker not registered',
      });
      return null;
    }

    try {
      // Check permission first
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        logger.warn({
          message: 'Notification permission not granted',
          context: { permission },
        });
        return null;
      }

      // Subscribe to push manager
      this.pushSubscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      logger.info({
        message: 'Successfully subscribed to push notifications',
        context: {
          endpoint: this.pushSubscription.endpoint,
        },
      });

      return this.pushSubscription;
    } catch (error) {
      logger.error({
        message: 'Failed to subscribe to push notifications',
        context: { error },
      });
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    try {
      // If pushSubscription is null, try to retrieve it from the push manager as a fallback
      if (!this.pushSubscription && this.registration) {
        try {
          this.pushSubscription = await this.registration.pushManager.getSubscription();
        } catch (error) {
          logger.error({
            message: 'Failed to retrieve active push subscription during unsubscribe',
            context: { error },
          });
        }
      }

      if (!this.pushSubscription) {
        logger.info({
          message: 'No active push subscription found to unsubscribe',
        });
        return true;
      }

      const success = await this.pushSubscription.unsubscribe();

      if (success) {
        this.pushSubscription = null;

        // Clear any potential persisted client-side records
        // Explicitly clearing any typical local storage keys as a safety measure
        try {
          localStorage.removeItem('push_subscription');
          localStorage.removeItem('push_endpoint');
        } catch (storageError) {
          // Ignore errors from localStorage if it's not available
        }

        logger.info({
          message: 'Successfully unsubscribed from push notifications',
        });
      } else {
        logger.warn({
          message: 'Push subscription unsubscribe returned false',
        });
      }

      return success;
    } catch (error) {
      logger.error({
        message: 'Failed to unsubscribe from push notifications',
        context: { error },
      });
      return false;
    }
  }

  /**
   * Get the current push subscription
   */
  getSubscription(): PushSubscription | null {
    return this.pushSubscription;
  }

  /**
   * Show a local notification (for testing or immediate notifications)
   */
  async showLocalNotification(title: string, body: string, data?: any): Promise<void> {
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      return;
    }

    // Use the Notification API directly
    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data,
      requireInteraction: true,
      tag: data?.eventCode || 'notification',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();

      if (data?.eventCode) {
        usePushNotificationModalStore.getState().showNotificationModal({
          eventCode: data.eventCode,
          title,
          body,
          data,
        });
      }
    };
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Check if push notifications are supported
   */
  static isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
}

export const webPushNotificationService = WebPushNotificationService.getInstance();
