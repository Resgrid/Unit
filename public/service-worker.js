/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/**
 * Service Worker for Resgrid Unit Web Push Notifications
 * This file handles background push notifications when the app is not in focus
 */

// Cache name for offline support (optional)
const CACHE_NAME = 'resgrid-unit-v1';

// Store pending notification data for newly opened windows
const pendingNotifications = new Map();

// Handle push events
self.addEventListener('push', function (event) {
  console.log('[Service Worker] Push received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'New Notification',
        body: event.data.text(),
      };
    }
  }

  const title = data.title || 'Resgrid Unit';
  const options = {
    body: data.body || data.message || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: data,
    requireInteraction: true,
    tag: data.eventCode || `notification-${Date.now()}`,
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', function (event) {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  // Handle dismiss action
  if (action === 'dismiss') {
    return;
  }

  // Open the app and send message to main thread
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Try to focus an existing window
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: data,
          });
          return;
        }
      }

      // Open new window if no existing window found
      if (clients.openWindow) {
        return clients.openWindow('/').then(function (client) {
          // Store notification data for handshake with the new window
          if (client) {
            pendingNotifications.set(client.id, data);
            console.log('[Service Worker] Stored pending notification for client:', client.id);
          }
        });
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', function (event) {
  console.log('[Service Worker] Notification closed:', event);
});

// Handle service worker installation
self.addEventListener('install', function (event) {
  console.log('[Service Worker] Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', function (event) {
  console.log('[Service Worker] Activating...');
  // Take control of all pages immediately
  event.waitUntil(clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', function (event) {
  console.log('[Service Worker] Message received:', event.data);

  // Handle skip waiting message
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Handle client ready handshake
  if (event.data && event.data.type === 'CLIENT_READY') {
    const clientId = event.source.id;
    console.log('[Service Worker] Client ready handshake received:', clientId);

    // Check if there's a pending notification for this client
    if (pendingNotifications.has(clientId)) {
      const notificationData = pendingNotifications.get(clientId);
      pendingNotifications.delete(clientId);

      console.log('[Service Worker] Sending pending notification to client:', clientId);
      event.source.postMessage({
        type: 'NOTIFICATION_CLICK',
        data: notificationData,
      });
    }
  }
});
